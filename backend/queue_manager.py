"""
High-Volume Processing Queue Manager
Handles thousands of audio files with rate limiting and progress tracking
"""
import threading
import time
import json
import os
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from queue import Queue, Empty
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class ProcessingTask:
    id: str
    file_path: str
    filename: str
    file_size: int
    status: str = "queued"  # queued, processing, completed, failed
    created_at: datetime = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    conversation_id: Optional[int] = None
    threat_score: Optional[float] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()

@dataclass
class ProcessingStats:
    total_tasks: int = 0
    queued: int = 0
    processing: int = 0
    completed: int = 0
    failed: int = 0
    daily_quota_used: int = 0
    daily_quota_limit: int = 2000
    estimated_time_remaining: str = "Calculating..."
    current_throughput: float = 0.0  # files per minute

class RateLimiter:
    """Manages Groq API rate limits"""
    
    def __init__(self, daily_limit: int = 2000):
        self.daily_limit = daily_limit
        self.usage_file = "daily_usage.json"
        self.lock = threading.Lock()
        self._load_usage()
    
    def _load_usage(self):
        """Load today's usage from file"""
        try:
            if os.path.exists(self.usage_file):
                with open(self.usage_file, 'r') as f:
                    data = json.load(f)
                    if data.get('date') == datetime.now().strftime('%Y-%m-%d'):
                        self.daily_used = data.get('used', 0)
                    else:
                        self.daily_used = 0
            else:
                self.daily_used = 0
        except:
            self.daily_used = 0
    
    def _save_usage(self):
        """Save today's usage to file"""
        try:
            data = {
                'date': datetime.now().strftime('%Y-%m-%d'),
                'used': self.daily_used
            }
            with open(self.usage_file, 'w') as f:
                json.dump(data, f)
        except Exception as e:
            logger.error(f"Failed to save usage: {e}")
    
    def can_process(self) -> bool:
        """Check if we can process another file"""
        with self.lock:
            return self.daily_used < self.daily_limit
    
    def use_quota(self) -> bool:
        """Use one quota slot, return True if successful"""
        with self.lock:
            if self.daily_used < self.daily_limit:
                self.daily_used += 1
                self._save_usage()
                return True
            return False
    
    def get_remaining(self) -> int:
        """Get remaining quota for today"""
        with self.lock:
            return max(0, self.daily_limit - self.daily_used)

class HighVolumeProcessor:
    """High-volume audio processing with threading and rate limiting"""
    
    def __init__(self, max_workers: int = 20):
        self.max_workers = max_workers
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.task_queue = Queue()
        self.tasks: Dict[str, ProcessingTask] = {}
        self.stats = ProcessingStats()
        self.rate_limiter = RateLimiter()
        self.lock = threading.Lock()
        self.processing_active = False
        self.worker_thread = None
        
        # Performance tracking
        self.start_time = None
        self.completed_times = []
        
    def add_files(self, file_paths: List[str]) -> List[str]:
        """Add multiple files to processing queue"""
        task_ids = []
        
        with self.lock:
            for file_path in file_paths:
                if os.path.exists(file_path):
                    task_id = f"task_{int(time.time() * 1000)}_{len(self.tasks)}"
                    filename = os.path.basename(file_path)
                    file_size = os.path.getsize(file_path)
                    
                    task = ProcessingTask(
                        id=task_id,
                        file_path=file_path,
                        filename=filename,
                        file_size=file_size
                    )
                    
                    self.tasks[task_id] = task
                    self.task_queue.put(task_id)
                    task_ids.append(task_id)
            
            self._update_stats()
        
        # Start processing if not already running
        if not self.processing_active:
            self.start_processing()
        
        return task_ids
    
    def start_processing(self):
        """Start the background processing worker"""
        if self.processing_active:
            return
        
        self.processing_active = True
        self.start_time = datetime.now()
        self.worker_thread = threading.Thread(target=self._process_worker, daemon=True)
        self.worker_thread.start()
        logger.info(f"Started high-volume processor with {self.max_workers} workers")
    
    def stop_processing(self):
        """Stop the background processing"""
        self.processing_active = False
        if self.worker_thread:
            self.worker_thread.join(timeout=5)
        logger.info("Stopped high-volume processor")
    
    def _process_worker(self):
        """Background worker that manages the thread pool"""
        futures = {}
        
        while self.processing_active or futures:
            # Submit new tasks if we have capacity and quota
            while (len(futures) < self.max_workers and 
                   not self.task_queue.empty() and 
                   self.rate_limiter.can_process()):
                
                try:
                    task_id = self.task_queue.get_nowait()
                    if self.rate_limiter.use_quota():
                        future = self.executor.submit(self._process_single_task, task_id)
                        futures[future] = task_id
                        
                        with self.lock:
                            self.tasks[task_id].status = "processing"
                            self.tasks[task_id].started_at = datetime.now()
                            self._update_stats()
                    else:
                        # Put task back in queue if no quota
                        self.task_queue.put(task_id)
                        break
                except Empty:
                    break
            
            # Check completed tasks
            completed_futures = []
            for future in list(futures.keys()):
                if future.done():
                    completed_futures.append(future)
            
            for future in completed_futures:
                task_id = futures.pop(future)
                try:
                    result = future.result()
                    with self.lock:
                        task = self.tasks[task_id]
                        task.status = "completed"
                        task.completed_at = datetime.now()
                        task.conversation_id = result.get('conversation_id')
                        task.threat_score = result.get('threat_score')
                        
                        # Track completion time for throughput calculation
                        self.completed_times.append(datetime.now())
                        # Keep only last 10 completions for rolling average
                        if len(self.completed_times) > 10:
                            self.completed_times.pop(0)
                        
                        self._update_stats()
                        
                except Exception as e:
                    with self.lock:
                        task = self.tasks[task_id]
                        task.status = "failed"
                        task.completed_at = datetime.now()
                        task.error_message = str(e)
                        self._update_stats()
                    
                    logger.error(f"Task {task_id} failed: {e}")
            
            # Sleep briefly to prevent busy waiting
            time.sleep(0.1)
            
            # Check if we should pause due to rate limit
            if not self.rate_limiter.can_process() and futures:
                logger.info("Daily quota reached, waiting for tasks to complete...")
                # Wait for current tasks to finish
                for future in futures:
                    future.result()
                futures.clear()
                break
    
    def _process_single_task(self, task_id: str) -> Dict[str, Any]:
        """Process a single audio file"""
        from main import process_audio_file  # Import here to avoid circular imports
        
        task = self.tasks[task_id]
        logger.info(f"Processing {task.filename}")
        
        try:
            # Process the file using existing logic
            result = process_audio_file(task.file_path)
            return result
        except Exception as e:
            logger.error(f"Failed to process {task.filename}: {e}")
            raise
    
    def _update_stats(self):
        """Update processing statistics"""
        self.stats.total_tasks = len(self.tasks)
        self.stats.queued = sum(1 for t in self.tasks.values() if t.status == "queued")
        self.stats.processing = sum(1 for t in self.tasks.values() if t.status == "processing")
        self.stats.completed = sum(1 for t in self.tasks.values() if t.status == "completed")
        self.stats.failed = sum(1 for t in self.tasks.values() if t.status == "failed")
        self.stats.daily_quota_used = self.rate_limiter.daily_used
        
        # Calculate throughput and ETA
        if len(self.completed_times) >= 2:
            time_span = (self.completed_times[-1] - self.completed_times[0]).total_seconds() / 60
            if time_span > 0:
                self.stats.current_throughput = len(self.completed_times) / time_span
                
                remaining_tasks = self.stats.queued + self.stats.processing
                if self.stats.current_throughput > 0:
                    eta_minutes = remaining_tasks / self.stats.current_throughput
                    eta_hours = int(eta_minutes // 60)
                    eta_mins = int(eta_minutes % 60)
                    self.stats.estimated_time_remaining = f"{eta_hours}h {eta_mins}m"
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current processing statistics"""
        with self.lock:
            return {
                **asdict(self.stats),
                "quota_remaining": self.rate_limiter.get_remaining(),
                "processing_active": self.processing_active
            }
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get status of specific task"""
        with self.lock:
            task = self.tasks.get(task_id)
            if task:
                return asdict(task)
            return None
    
    def get_all_tasks(self) -> List[Dict[str, Any]]:
        """Get all tasks with their status"""
        with self.lock:
            return [asdict(task) for task in self.tasks.values()]
    
    def clear_completed_tasks(self):
        """Clear completed and failed tasks to free memory"""
        with self.lock:
            to_remove = [
                task_id for task_id, task in self.tasks.items()
                if task.status in ["completed", "failed"]
            ]
            for task_id in to_remove:
                del self.tasks[task_id]
            self._update_stats()
        
        logger.info(f"Cleared {len(to_remove)} completed/failed tasks")

# Global processor instance
processor = HighVolumeProcessor(max_workers=20)