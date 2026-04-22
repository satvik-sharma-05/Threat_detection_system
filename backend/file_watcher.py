"""
File Watcher for Automatic Audio Processing
Monitors upload folder and processes new files automatically
"""
import os
import time
import threading
from pathlib import Path
from typing import Set, List
import logging
from queue_manager import processor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AudioFileWatcher:
    """Watches a directory for new audio files and auto-processes them"""
    
    def __init__(self, watch_directory: str = "uploads"):
        self.watch_directory = Path(watch_directory)
        self.watch_directory.mkdir(exist_ok=True)
        
        # Supported audio formats
        self.audio_extensions = {'.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac', '.wma'}
        
        # Track processed files to avoid reprocessing
        self.processed_files: Set[str] = set()
        self.last_scan_time = time.time()
        
        # Watcher thread
        self.watching = False
        self.watcher_thread = None
        
        # Load existing files to avoid reprocessing
        self._load_existing_files()
    
    def _load_existing_files(self):
        """Load existing files in directory to avoid reprocessing"""
        try:
            for file_path in self.watch_directory.rglob("*"):
                if file_path.is_file() and file_path.suffix.lower() in self.audio_extensions:
                    self.processed_files.add(str(file_path.absolute()))
            logger.info(f"Found {len(self.processed_files)} existing files in {self.watch_directory}")
        except Exception as e:
            logger.error(f"Error loading existing files: {e}")
    
    def start_watching(self):
        """Start watching the directory for new files"""
        if self.watching:
            return
        
        self.watching = True
        self.watcher_thread = threading.Thread(target=self._watch_loop, daemon=True)
        self.watcher_thread.start()
        logger.info(f"Started watching {self.watch_directory} for new audio files")
    
    def stop_watching(self):
        """Stop watching the directory"""
        self.watching = False
        if self.watcher_thread:
            self.watcher_thread.join(timeout=5)
        logger.info("Stopped file watcher")
    
    def _watch_loop(self):
        """Main watching loop"""
        while self.watching:
            try:
                new_files = self._scan_for_new_files()
                if new_files:
                    logger.info(f"Found {len(new_files)} new audio files")
                    task_ids = processor.add_files(new_files)
                    logger.info(f"Added {len(task_ids)} files to processing queue")
                
                # Sleep for 5 seconds before next scan
                time.sleep(5)
                
            except Exception as e:
                logger.error(f"Error in watch loop: {e}")
                time.sleep(10)  # Wait longer on error
    
    def _scan_for_new_files(self) -> List[str]:
        """Scan directory for new audio files"""
        new_files = []
        current_time = time.time()
        
        try:
            for file_path in self.watch_directory.rglob("*"):
                if (file_path.is_file() and 
                    file_path.suffix.lower() in self.audio_extensions):
                    
                    file_path_str = str(file_path.absolute())
                    
                    # Check if file is new
                    if file_path_str not in self.processed_files:
                        # Check if file is stable (not being written to)
                        file_mtime = file_path.stat().st_mtime
                        if current_time - file_mtime > 2:  # File hasn't been modified for 2 seconds
                            new_files.append(file_path_str)
                            self.processed_files.add(file_path_str)
        
        except Exception as e:
            logger.error(f"Error scanning for new files: {e}")
        
        return new_files
    
    def process_existing_files(self) -> List[str]:
        """Process all existing files in the directory (manual trigger)"""
        existing_files = []
        
        try:
            for file_path in self.watch_directory.rglob("*"):
                if (file_path.is_file() and 
                    file_path.suffix.lower() in self.audio_extensions):
                    existing_files.append(str(file_path.absolute()))
            
            if existing_files:
                # Clear processed files set to allow reprocessing
                self.processed_files.clear()
                task_ids = processor.add_files(existing_files)
                logger.info(f"Added {len(existing_files)} existing files to processing queue")
                return task_ids
            
        except Exception as e:
            logger.error(f"Error processing existing files: {e}")
        
        return []
    
    def get_directory_info(self) -> dict:
        """Get information about the watched directory"""
        try:
            total_files = 0
            total_size = 0
            audio_files = 0
            
            for file_path in self.watch_directory.rglob("*"):
                if file_path.is_file():
                    total_files += 1
                    total_size += file_path.stat().st_size
                    
                    if file_path.suffix.lower() in self.audio_extensions:
                        audio_files += 1
            
            return {
                "directory": str(self.watch_directory),
                "total_files": total_files,
                "audio_files": audio_files,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "processed_files": len(self.processed_files),
                "watching": self.watching
            }
        
        except Exception as e:
            logger.error(f"Error getting directory info: {e}")
            return {
                "directory": str(self.watch_directory),
                "error": str(e)
            }

# Global file watcher instance
file_watcher = AudioFileWatcher()