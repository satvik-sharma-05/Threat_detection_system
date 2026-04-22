import React, { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:8000';

function Alerts() {
    const navigate = useNavigate();
    const [selectedAlert, setSelectedAlert] = useState(null);
    const [audioPlaying, setAudioPlaying] = useState(null);

    const { data, isLoading } = useQuery('alerts', async () => {
        const response = await axios.get(`${API_URL}/alerts`);
        return response.data;
    });

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'Critical':
                return 'bg-red-900/20 border-red-500 text-red-400';
            case 'High':
                return 'bg-orange-900/20 border-orange-500 text-orange-400';
            default:
                return 'bg-yellow-900/20 border-yellow-500 text-yellow-400';
        }
    };

    const playAudio = (audioPath) => {
        if (audioPlaying === audioPath) {
            setAudioPlaying(null);
        } else {
            setAudioPlaying(audioPath);
        }
    };

    if (selectedAlert) {
        return (
            <div className="space-y-6">
                <button
                    onClick={() => setSelectedAlert(null)}
                    className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded transition"
                >
                    ← Back to Alerts
                </button>

                <div className={`p-8 rounded-lg border-2 ${getSeverityColor(selectedAlert.severity)}`}>
                    {/* Alert Header */}
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-3xl font-bold mb-2">🚨 {selectedAlert.severity} THREAT ALERT</h2>
                            <p className="text-lg">Alert ID: ALERT-{selectedAlert.id}</p>
                            <p className="text-sm text-gray-400">
                                {new Date(selectedAlert.created_at).toLocaleString('en-GB')}
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="text-4xl font-bold">{selectedAlert.score.toFixed(1)}</div>
                            <div className="text-sm text-gray-400">Threat Score</div>
                        </div>
                    </div>

                    {/* Attack Type */}
                    <div className="bg-gray-900 p-6 rounded-lg mb-6">
                        <h3 className="text-2xl font-bold mb-4 text-red-400">⚔️ ATTACK TYPE</h3>
                        <p className="text-3xl font-bold text-red-300 mb-2">
                            {selectedAlert.attack_info?.attack_type || selectedAlert.crime_type.toUpperCase()}
                        </p>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div>
                                <p className="text-gray-400 text-sm">Threat Level</p>
                                <p className="text-xl font-bold text-red-300">{selectedAlert.attack_info?.threat_level || 'High'}</p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Urgency</p>
                                <p className="text-xl font-bold text-orange-300">{selectedAlert.attack_info?.urgency || 'Immediate'}</p>
                            </div>
                        </div>
                        {/* Recommended Action */}
                        {selectedAlert.recommended_action && (
                            <div className={`mt-4 p-4 rounded-lg border-2 font-bold text-lg ${selectedAlert.score >= 90 ? 'bg-red-900/40 border-red-500 text-red-200' :
                                    selectedAlert.score >= 75 ? 'bg-orange-900/40 border-orange-500 text-orange-200' :
                                        'bg-yellow-900/40 border-yellow-500 text-yellow-200'
                                }`}>
                                ⚡ RECOMMENDED ACTION: {selectedAlert.recommended_action}
                            </div>
                        )}
                    </div>

                    {/* Source Audio */}
                    <div className="bg-gray-900 p-6 rounded-lg mb-6">
                        <h3 className="text-2xl font-bold mb-4 text-blue-400">📁 SOURCE AUDIO FILE</h3>
                        <p className="text-xl mb-4">{selectedAlert.source_audio?.filename || 'Unknown'}</p>

                        {selectedAlert.source_audio?.file_path && (
                            <div>
                                <button
                                    onClick={() => playAudio(selectedAlert.source_audio.file_path)}
                                    className={`px-6 py-3 rounded font-semibold transition text-lg ${audioPlaying === selectedAlert.source_audio.file_path
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-green-600 hover:bg-green-700'
                                        }`}
                                >
                                    {audioPlaying === selectedAlert.source_audio.file_path ? '⏹️ Stop Audio' : '▶️ Play Audio'}
                                </button>
                                {audioPlaying === selectedAlert.source_audio.file_path && (
                                    <div className="mt-4">
                                        <audio
                                            controls
                                            autoPlay
                                            onEnded={() => setAudioPlaying(null)}
                                            className="w-full"
                                        >
                                            <source src={`${API_URL}/uploads/${selectedAlert.source_audio.file_path.split('/').pop()}`} type="audio/mpeg" />
                                            <source src={`${API_URL}/uploads/${selectedAlert.source_audio.file_path.split('/').pop()}`} type="audio/wav" />
                                        </audio>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Connected Audio Files */}
                    {selectedAlert.connected_conversations && selectedAlert.connected_conversations.length > 0 && (
                        <div className="bg-gray-900 p-6 rounded-lg mb-6">
                            <h3 className="text-2xl font-bold mb-4 text-orange-400">
                                🔗 CONNECTED AUDIO FILES ({selectedAlert.connected_conversations.length})
                            </h3>
                            <p className="text-gray-300 mb-4">These audio files are connected to the source audio:</p>

                            <div className="space-y-4">
                                {selectedAlert.connected_conversations.map((conn, idx) => (
                                    <div key={idx} className="bg-gray-800 p-4 rounded border-l-4 border-orange-500">
                                        {/* File Info */}
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="text-xl font-bold text-orange-300">📁 {conn.filename}</p>
                                                <p className="text-sm text-gray-400">
                                                    Threat Score: {conn.threat_score.toFixed(1)} | Crime: {conn.crime_type}
                                                </p>
                                            </div>
                                            <span className="bg-orange-900/50 px-3 py-1 rounded text-sm font-bold">
                                                Connection Strength: {conn.strength}
                                            </span>
                                        </div>

                                        {/* Why Connected */}
                                        <div className="mb-3">
                                            <p className="font-bold text-yellow-400 mb-2">Why These Files Are Connected:</p>
                                            <ul className="space-y-1">
                                                {conn.evidence && conn.evidence.map((ev, i) => (
                                                    <li key={i} className="text-gray-300 text-sm">
                                                        <span className="text-yellow-400">•</span> {ev}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Audio Playback */}
                                        {conn.audio_file_path && (
                                            <div>
                                                <button
                                                    onClick={() => playAudio(conn.audio_file_path)}
                                                    className={`px-4 py-2 rounded font-semibold transition ${audioPlaying === conn.audio_file_path
                                                        ? 'bg-red-600 hover:bg-red-700'
                                                        : 'bg-green-600 hover:bg-green-700'
                                                        }`}
                                                >
                                                    {audioPlaying === conn.audio_file_path ? '⏹️ Stop' : '▶️ Play This Audio'}
                                                </button>
                                                {audioPlaying === conn.audio_file_path && (
                                                    <div className="mt-3">
                                                        <audio
                                                            controls
                                                            autoPlay
                                                            onEnded={() => setAudioPlaying(null)}
                                                            className="w-full"
                                                        >
                                                            <source src={`${API_URL}/uploads/${conn.audio_file_path.split('/').pop()}`} type="audio/mpeg" />
                                                            <source src={`${API_URL}/uploads/${conn.audio_file_path.split('/').pop()}`} type="audio/wav" />
                                                        </audio>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* No Connections */}
                    {(!selectedAlert.connected_conversations || selectedAlert.connected_conversations.length === 0) && (
                        <div className="bg-gray-900 p-6 rounded-lg mb-6">
                            <h3 className="text-2xl font-bold mb-4 text-gray-400">🔗 CONNECTED AUDIO FILES</h3>
                            <p className="text-gray-400">No connected audio files found for this threat.</p>
                        </div>
                    )}

                    {/* Threat Details */}
                    <div className="bg-gray-900 p-6 rounded-lg mb-6">
                        <h3 className="text-2xl font-bold mb-4 text-purple-400">🎯 THREAT DETAILS</h3>
                        <div className="space-y-3">
                            <div>
                                <p className="text-gray-400 text-sm">Predicted Harm:</p>
                                <p className="text-red-300 font-semibold text-lg">
                                    {selectedAlert.threat_details?.harm_prediction || 'Potential threat to public safety'}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Assessment:</p>
                                <p className="text-gray-300">
                                    {selectedAlert.threat_details?.reasoning || 'Automated threat assessment based on conversation analysis'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Evidence */}
                    <div className="bg-gray-900 p-6 rounded-lg">
                        <h3 className="text-2xl font-bold mb-4 text-yellow-400">📋 EVIDENCE</h3>
                        <ul className="space-y-2">
                            {selectedAlert.evidence?.map((item, idx) => (
                                <li key={idx} className="text-gray-300">
                                    <span className="text-yellow-400">•</span> {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold">🚨 Threat Alerts</h1>
                    <p className="text-gray-400 text-sm mt-1">Total: {data?.count || 0} alerts</p>
                </div>
                {/* Export buttons */}
                <div className="flex gap-2">
                    <a
                        href={`${API_URL}/alerts/export?format=json`}
                        download="raw_alerts.json"
                        className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded-lg font-medium transition"
                    >
                        ⬇ Export JSON
                    </a>
                    <a
                        href={`${API_URL}/alerts/export?format=csv`}
                        download="raw_alerts.csv"
                        className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm rounded-lg font-medium transition"
                    >
                        ⬇ Export CSV
                    </a>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-12">Loading...</div>
            ) : (
                <div className="space-y-4">
                    {data?.alerts?.map((alert) => (
                        <div
                            key={alert.id}
                            className={`p-6 rounded-lg border cursor-pointer hover:shadow-lg transition ${getSeverityColor(alert.severity)}`}
                            onClick={() => setSelectedAlert(alert)}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-semibold">🚨 {alert.severity} Threat</h3>
                                    <p className="text-sm text-gray-400 mt-1">
                                        {new Date(alert.created_at).toLocaleString('en-GB')}
                                    </p>
                                    <p className="text-sm mt-1">
                                        📁 {alert.source_audio?.filename || 'Unknown file'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold">{alert.score.toFixed(1)}</div>
                                    <div className="text-xs text-gray-400">Threat Score</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <p className="text-sm text-gray-400">Attack Type</p>
                                    <p className="font-semibold">{alert.attack_info?.attack_type || alert.crime_type}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">Connected Files</p>
                                    <p className="font-semibold">{alert.connected_conversations?.length || 0} file(s)</p>
                                </div>
                            </div>

                            {/* Recommended Action */}
                            {alert.recommended_action && (
                                <div className={`text-xs font-bold px-3 py-2 rounded mb-3 ${alert.score >= 90 ? 'bg-red-900/60 text-red-200 border border-red-600' :
                                    alert.score >= 75 ? 'bg-orange-900/60 text-orange-200 border border-orange-600' :
                                        'bg-yellow-900/60 text-yellow-200 border border-yellow-600'
                                    }`}>
                                    ⚡ {alert.recommended_action}
                                </div>
                            )}

                            <div className="text-blue-400 text-sm font-semibold">
                                Click to view full details →
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {data && data.alerts && data.alerts.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                    <div className="text-6xl mb-4">🛡️</div>
                    <h3 className="text-xl font-semibold mb-2">No Threat Alerts</h3>
                    <p>No high-threat conversations detected yet.</p>
                </div>
            )}
        </div>
    );
}

export default Alerts;