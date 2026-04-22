import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const API_URL = 'http://localhost:8000';

function BatchUpload() {
    const [uploading, setUploading] = useState(false);
    const [processingStats, setProcessingStats] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [error, setError] = useState(null);
    const [uploadType, setUploadType] = useState('files'); // 'files' or 'zip'
    const [selectedFiles, setSelectedFiles] = useState([]);

    // Poll processing status every 2 seconds
    useEffect(() => {
        const interval = setInterval(fetchProcessingStatus, 2000);
        return () => clearInterval(interval);
    }, []);

    const fetchProcessingStatus = async () => {
        try {
            const response = await axios.get(`${API_URL}/processing/status`);
            setProcessingStats(response.data);
        } catch (err) {
            console.error('Failed to fetch processing status:', err);
        }
    };

    const fetchTasks = async () => {
        try {
            const response = await axios.get(`${API_URL}/processing/tasks`);
            setTasks(response.data.tasks);
        } catch (err) {
            console.error('Failed to fetch tasks:', err);
        }
    };

    const onDropFiles = async (acceptedFiles) => {
        if (acceptedFiles.length === 0) return;

        setSelectedFiles(acceptedFiles);
        setUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            acceptedFiles.forEach(file => {
                formData.append('files', file);
            });

            const response = await axios.post(`${API_URL}/upload/batch`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            console.log('Batch upload successful:', response.data);
            fetchTasks();
            setUploading(false);
        } catch (err) {
            console.error('Batch upload failed:', err);
            setError(err.response?.data?.detail || err.message);
            setUploading(false);
        }
    };

    const onDropZip = async (acceptedFiles) => {
        if (acceptedFiles.length === 0) return;

        const zipFile = acceptedFiles[0];
        setUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', zipFile);

            const response = await axios.post(`${API_URL}/upload/zip`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            console.log('ZIP upload successful:', response.data);
            fetchTasks();
            setUploading(false);
        } catch (err) {
            console.error('ZIP upload failed:', err);
            setError(err.response?.data?.detail || err.message);
            setUploading(false);
        }
    };

    const { getRootProps: getFilesRootProps, getInputProps: getFilesInputProps, isDragActive: isFilesDragActive } = useDropzone({
        onDrop: onDropFiles,
        accept: {
            'audio/*': ['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac', '.wma']
        },
        maxSize: 100 * 1024 * 1024, // 100MB per file
        multiple: true
    });

    const { getRootProps: getZipRootProps, getInputProps: getZipInputProps, isDragActive: isZipDragActive } = useDropzone({
        onDrop: onDropZip,
        accept: {
            'application/zip': ['.zip']
        },
        maxSize: 1024 * 1024 * 1024, // 1GB
        multiple: false
    });

    const clearCompletedTasks = async () => {
        try {
            await axios.post(`${API_URL}/processing/clear-completed`);
            fetchTasks();
        } catch (err) {
            console.error('Failed to clear tasks:', err);
        }
    };

    const processExistingFiles = async () => {
        try {
            const response = await axios.post(`${API_URL}/files/process-existing`);
            console.log('Processing existing files:', response.data);
            fetchTasks();
        } catch (err) {
            console.error('Failed to process existing files:', err);
            setError(err.response?.data?.detail || err.message);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'text-green-400';
            case 'processing': return 'text-blue-400';
            case 'failed': return 'text-red-400';
            case 'queued': return 'text-yellow-400';
            default: return 'text-gray-400';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed': return '✅';
            case 'processing': return '⏳';
            case 'failed': return '❌';
            case 'queued': return '📋';
            default: return '❓';
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">High-Volume Audio Processing</h1>
                <p className="text-gray-400 mt-2">
                    Upload hundreds or thousands of audio files for batch threat analysis
                </p>
            </div>

            {/* Processing Status Dashboard */}
            {processingStats && (
                <div className="bg-gray-800 p-6 rounded-lg border border-blue-500">
                    <h3 className="text-2xl font-bold mb-4 text-blue-400">📊 PROCESSING STATUS</h3>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-gray-900 p-4 rounded text-center">
                            <p className="text-2xl font-bold text-yellow-400">{processingStats.queue_stats.queued}</p>
                            <p className="text-gray-400 text-sm">Queued</p>
                        </div>
                        <div className="bg-gray-900 p-4 rounded text-center">
                            <p className="text-2xl font-bold text-blue-400">{processingStats.queue_stats.processing}</p>
                            <p className="text-gray-400 text-sm">Processing</p>
                        </div>
                        <div className="bg-gray-900 p-4 rounded text-center">
                            <p className="text-2xl font-bold text-green-400">{processingStats.queue_stats.completed}</p>
                            <p className="text-gray-400 text-sm">Completed</p>
                        </div>
                        <div className="bg-gray-900 p-4 rounded text-center">
                            <p className="text-2xl font-bold text-red-400">{processingStats.queue_stats.failed}</p>
                            <p className="text-gray-400 text-sm">Failed</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gray-900 p-4 rounded">
                            <p className="text-gray-400 text-sm">Daily Quota Used:</p>
                            <p className="text-white text-lg font-bold">
                                {processingStats.queue_stats.daily_quota_used} / {processingStats.queue_stats.daily_quota_limit}
                            </p>
                            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                                <div
                                    className="bg-blue-500 h-2 rounded-full"
                                    style={{
                                        width: `${(processingStats.queue_stats.daily_quota_used / processingStats.queue_stats.daily_quota_limit) * 100}%`
                                    }}
                                ></div>
                            </div>
                        </div>
                        <div className="bg-gray-900 p-4 rounded">
                            <p className="text-gray-400 text-sm">Estimated Time Remaining:</p>
                            <p className="text-white text-lg font-bold">{processingStats.queue_stats.estimated_time_remaining}</p>
                        </div>
                        <div className="bg-gray-900 p-4 rounded">
                            <p className="text-gray-400 text-sm">Processing Speed:</p>
                            <p className="text-white text-lg font-bold">
                                {processingStats.queue_stats.current_throughput.toFixed(1)} files/min
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 flex gap-4">
                        <button
                            onClick={fetchTasks}
                            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-semibold"
                        >
                            🔄 Refresh Tasks
                        </button>
                        <button
                            onClick={clearCompletedTasks}
                            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-semibold"
                        >
                            🧹 Clear Completed
                        </button>
                        <button
                            onClick={processExistingFiles}
                            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold"
                        >
                            📁 Process Existing Files
                        </button>
                    </div>
                </div>
            )}

            {/* Upload Type Selector */}
            <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">Choose Upload Method</h3>
                <div className="flex gap-4 mb-4">
                    <button
                        onClick={() => setUploadType('files')}
                        className={`px-4 py-2 rounded font-semibold ${uploadType === 'files'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                    >
                        📁 Multiple Files
                    </button>
                    <button
                        onClick={() => setUploadType('zip')}
                        className={`px-4 py-2 rounded font-semibold ${uploadType === 'zip'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                    >
                        📦 ZIP Archive
                    </button>
                </div>

                {/* Multiple Files Upload */}
                {uploadType === 'files' && (
                    <div
                        {...getFilesRootProps()}
                        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition ${isFilesDragActive
                                ? 'border-blue-500 bg-blue-900/20'
                                : 'border-gray-600 hover:border-gray-500'
                            }`}
                    >
                        <input {...getFilesInputProps()} />
                        <div className="text-6xl mb-4">🎵</div>
                        {uploading ? (
                            <div>
                                <p className="text-lg mb-2">Uploading {selectedFiles.length} files...</p>
                                <p className="text-sm text-gray-400">Adding to processing queue...</p>
                            </div>
                        ) : isFilesDragActive ? (
                            <p className="text-lg">Drop the audio files here</p>
                        ) : (
                            <div>
                                <p className="text-lg mb-2">Drag & drop multiple audio files, or click to select</p>
                                <p className="text-sm text-gray-400">
                                    Supports: WAV, MP3, M4A, FLAC, OGG, AAC, WMA (max 100MB per file, up to 1000 files)
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* ZIP Upload */}
                {uploadType === 'zip' && (
                    <div
                        {...getZipRootProps()}
                        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition ${isZipDragActive
                                ? 'border-blue-500 bg-blue-900/20'
                                : 'border-gray-600 hover:border-gray-500'
                            }`}
                    >
                        <input {...getZipInputProps()} />
                        <div className="text-6xl mb-4">📦</div>
                        {uploading ? (
                            <div>
                                <p className="text-lg mb-2">Extracting ZIP archive...</p>
                                <p className="text-sm text-gray-400">Finding audio files and adding to queue...</p>
                            </div>
                        ) : isZipDragActive ? (
                            <p className="text-lg">Drop the ZIP file here</p>
                        ) : (
                            <div>
                                <p className="text-lg mb-2">Drag & drop ZIP archive, or click to select</p>
                                <p className="text-sm text-gray-400">
                                    ZIP file containing audio files (max 1GB)
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-900/30 border border-red-500 rounded p-4">
                    <p className="font-semibold text-red-400">Error</p>
                    <p className="text-sm text-gray-300">{error}</p>
                </div>
            )}

            {/* Task List */}
            {tasks && Object.keys(tasks).length > 0 && (
                <div className="bg-gray-800 p-6 rounded-lg">
                    <h3 className="text-xl font-bold mb-4">📋 Processing Tasks</h3>

                    {Object.entries(tasks).map(([status, taskList]) => (
                        taskList.length > 0 && (
                            <div key={status} className="mb-6">
                                <h4 className={`text-lg font-semibold mb-3 ${getStatusColor(status)}`}>
                                    {getStatusIcon(status)} {status.toUpperCase()} ({taskList.length})
                                </h4>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {taskList.map((task) => (
                                        <div key={task.id} className="bg-gray-900 p-3 rounded flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold">{task.filename}</p>
                                                <p className="text-sm text-gray-400">
                                                    Size: {(task.file_size / (1024 * 1024)).toFixed(2)} MB
                                                    {task.started_at && ` | Started: ${new Date(task.started_at).toLocaleTimeString()}`}
                                                    {task.completed_at && ` | Completed: ${new Date(task.completed_at).toLocaleTimeString()}`}
                                                </p>
                                                {task.error_message && (
                                                    <p className="text-sm text-red-400">Error: {task.error_message}</p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <span className={`font-semibold ${getStatusColor(task.status)}`}>
                                                    {getStatusIcon(task.status)}
                                                </span>
                                                {task.threat_score && (
                                                    <p className="text-sm text-yellow-400">
                                                        Threat: {task.threat_score.toFixed(1)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    ))}
                </div>
            )}

            {/* Instructions */}
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-bold mb-4">📖 Instructions</h3>
                <div className="space-y-3 text-gray-300">
                    <p><strong>Multiple Files:</strong> Select up to 1000 audio files at once. Each file will be processed individually.</p>
                    <p><strong>ZIP Archive:</strong> Upload a ZIP file containing audio files. The system will extract and process all audio files found.</p>
                    <p><strong>Processing:</strong> Files are processed in the background using 20 worker threads. You can continue using the system while processing happens.</p>
                    <p><strong>Rate Limits:</strong> The system respects Groq API limits (2000 transcriptions per day). Processing will pause when limits are reached.</p>
                    <p><strong>Progress:</strong> Monitor progress in real-time. Completed analyses will appear in the Analysis History page.</p>
                </div>
            </div>
        </div>
    );
}

export default BatchUpload;