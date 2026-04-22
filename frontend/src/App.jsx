import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import BatchUpload from './pages/BatchUpload';
import EntityExplorer from './pages/EntityExplorer';
import Connections from './pages/Connections';
import Alerts from './pages/Alerts';
import AnalysisHistory from './pages/AnalysisHistory';

const queryClient = new QueryClient();

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <Router>
                <div className="min-h-screen bg-gray-900 text-white">
                    <nav className="bg-gray-800 border-b border-gray-700">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="flex items-center justify-between h-16">
                                <div className="flex items-center">
                                    <span className="text-xl font-bold text-red-500">
                                        🛡️ Threat Detection System
                                    </span>
                                </div>
                                <div className="flex space-x-4">
                                    <Link
                                        to="/"
                                        className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition"
                                    >
                                        Dashboard
                                    </Link>
                                    <Link
                                        to="/upload"
                                        className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition"
                                    >
                                        Upload
                                    </Link>
                                    <Link
                                        to="/batch-upload"
                                        className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition"
                                    >
                                        Batch Upload
                                    </Link>
                                    <Link
                                        to="/history"
                                        className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition"
                                    >
                                        Analysis History
                                    </Link>
                                    <Link
                                        to="/entities"
                                        className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition"
                                    >
                                        Entities
                                    </Link>
                                    <Link
                                        to="/connections"
                                        className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition"
                                    >
                                        Connections
                                    </Link>
                                    <Link
                                        to="/alerts"
                                        className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition"
                                    >
                                        Alerts
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </nav>

                    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/upload" element={<Upload />} />
                            <Route path="/batch-upload" element={<BatchUpload />} />
                            <Route path="/history" element={<AnalysisHistory />} />
                            <Route path="/entities" element={<EntityExplorer />} />
                            <Route path="/connections" element={<Connections />} />
                            <Route path="/alerts" element={<Alerts />} />
                        </Routes>
                    </main>
                </div>
            </Router>
        </QueryClientProvider>
    );
}

export default App;
