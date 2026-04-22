import React, { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';

const API_URL = 'http://localhost:8000';

const LANG_NAMES = {
    en: 'English', hi: 'Hindi', ur: 'Urdu', bn: 'Bengali', ps: 'Pashto',
    ar: 'Arabic', pa: 'Punjabi', ta: 'Tamil', te: 'Telugu', mr: 'Marathi',
    gu: 'Gujarati', fa: 'Farsi', zh: 'Chinese', ru: 'Russian', fr: 'French',
};
const langName = (code) => LANG_NAMES[code?.toLowerCase()] || code?.toUpperCase() || 'Unknown';
const RTL_LANGS = new Set(['ur', 'ar', 'fa', 'ps', 'he', 'yi']);

function AnalysisHistory() {
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
    const [audioPlaying, setAudioPlaying] = useState(null);

    const { data: conversationsData, isLoading, refetch } = useQuery('conversations', async () => {
        const response = await axios.get(`${API_URL}/conversations`);
        return response.data;
    });

    const { data: detailData } = useQuery(
        ['conversation', selectedConversation],
        async () => {
            if (!selectedConversation) return null;
            const response = await axios.get(`${API_URL}/conversations/${selectedConversation}`);
            return response.data;
        },
        { enabled: !!selectedConversation }
    );

    const handleDelete = async (conversationId) => {
        try {
            await axios.delete(`${API_URL}/conversations/${conversationId}`);
            setDeleteConfirm(null);
            setSelectedConversation(null);
            refetch(); // Refresh the list
            alert('Conversation deleted successfully');
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Failed to delete conversation: ' + (error.response?.data?.detail || error.message));
        }
    };

    const handleDeleteAll = async () => {
        try {
            const conversations = conversationsData?.conversations || [];
            for (const conv of conversations) {
                await axios.delete(`${API_URL}/conversations/${conv.id}`);
            }
            setDeleteAllConfirm(false);
            setSelectedConversation(null);
            refetch();
            alert(`Deleted ${conversations.length} conversations successfully`);
        } catch (error) {
            console.error('Delete all failed:', error);
            alert('Failed to delete all conversations: ' + (error.response?.data?.detail || error.message));
        }
    };

    const handleCardDelete = async (e, conversationId) => {
        e.stopPropagation(); // Prevent card click
        setDeleteConfirm(conversationId);
    };

    const playAudio = (audioPath) => {
        if (audioPlaying === audioPath) {
            setAudioPlaying(null);
        } else {
            setAudioPlaying(audioPath);
        }
    };

    const getSeverityColor = (score) => {
        if (score >= 75) return 'border-red-500 bg-red-900/20';
        if (score >= 50) return 'border-orange-500 bg-orange-900/20';
        if (score >= 25) return 'border-yellow-500 bg-yellow-900/20';
        return 'border-green-500 bg-green-900/20';
    };

    const getSeverityLevel = (score) => {
        if (score >= 90) return 'CRITICAL';
        if (score >= 75) return 'HIGH';
        if (score >= 50) return 'MEDIUM';
        return 'LOW';
    };

    if (isLoading) {
        return <div className="text-center py-12">Loading conversations...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Analysis History</h1>
                    <p className="text-gray-400 mt-2">
                        View all analyzed conversations and their threat assessments
                    </p>
                </div>
                {conversationsData?.conversations?.length > 0 && (
                    <button
                        onClick={() => setDeleteAllConfirm(true)}
                        className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition font-semibold"
                    >
                        🗑️ Delete All Conversations
                    </button>
                )}
            </div>

            {/* Delete All Confirmation Modal */}
            {deleteAllConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-gray-800 p-8 rounded-lg border-2 border-red-500 max-w-md">
                        <h3 className="text-2xl font-bold text-red-400 mb-4">⚠️ Delete All Conversations</h3>
                        <p className="text-white mb-6">
                            Are you sure you want to delete ALL {conversationsData?.conversations?.length} conversations?
                            This action cannot be undone and will remove all analysis data.
                        </p>
                        <div className="flex space-x-4">
                            <button
                                onClick={handleDeleteAll}
                                className="flex-1 bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-semibold"
                            >
                                Yes, Delete All
                            </button>
                            <button
                                onClick={() => setDeleteAllConfirm(false)}
                                className="flex-1 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded font-semibold"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedConversation && detailData ? (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <button
                            onClick={() => setSelectedConversation(null)}
                            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded transition"
                        >
                            ← Back to List
                        </button>
                        <button
                            onClick={() => setDeleteConfirm(detailData.id)}
                            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition"
                        >
                            🗑️ Delete Conversation
                        </button>
                    </div>

                    {/* Delete Confirmation Modal */}
                    {deleteConfirm === detailData.id && (
                        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                            <div className="bg-gray-800 p-8 rounded-lg border-2 border-red-500 max-w-md">
                                <h3 className="text-2xl font-bold text-red-400 mb-4">⚠️ Confirm Delete</h3>
                                <p className="text-white mb-6">
                                    Are you sure you want to delete Conversation #{detailData.id}?
                                    This action cannot be undone.
                                </p>
                                <div className="flex space-x-4">
                                    <button
                                        onClick={() => handleDelete(detailData.id)}
                                        className="flex-1 bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-semibold"
                                    >
                                        Yes, Delete
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirm(null)}
                                        className="flex-1 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded font-semibold"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Card Delete Confirmation Modal */}
                    {deleteConfirm && deleteConfirm !== detailData?.id && (
                        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                            <div className="bg-gray-800 p-8 rounded-lg border-2 border-red-500 max-w-md">
                                <h3 className="text-2xl font-bold text-red-400 mb-4">⚠️ Confirm Delete</h3>
                                <p className="text-white mb-6">
                                    Are you sure you want to delete Conversation #{deleteConfirm}?
                                    This action cannot be undone.
                                </p>
                                <div className="flex space-x-4">
                                    <button
                                        onClick={() => handleDelete(deleteConfirm)}
                                        className="flex-1 bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-semibold"
                                    >
                                        Yes, Delete
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirm(null)}
                                        className="flex-1 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded font-semibold"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Full Analysis View */}
                    <div className="space-y-6">
                        {/* Audio Metadata */}
                        <div className="bg-gray-800 p-6 rounded-lg border-2 border-blue-500">
                            <h3 className="text-2xl font-bold mb-4 text-blue-400">📁 CONVERSATION DETAILS</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-gray-900 p-4 rounded">
                                    <p className="text-gray-400 text-sm">Conversation ID:</p>
                                    <p className="font-semibold text-white">#{detailData.id}</p>
                                </div>
                                <div className="bg-gray-900 p-4 rounded">
                                    <p className="text-gray-400 text-sm">Analyzed On:</p>
                                    <p className="font-semibold text-white">
                                        {new Date(detailData.timestamp).toLocaleString('en-GB')}
                                    </p>
                                </div>
                                <div className="bg-gray-900 p-4 rounded">
                                    <p className="text-gray-400 text-sm">Source Type:</p>
                                    <p className="font-semibold text-yellow-400">{detailData.source}</p>
                                </div>
                                <div className="bg-gray-900 p-4 rounded">
                                    <p className="text-gray-400 text-sm">Language:</p>
                                    <p className="font-semibold text-white">{detailData.language}</p>
                                </div>
                                {detailData.audio_file_path && (
                                    <div className="bg-gray-900 p-4 rounded">
                                        <p className="text-gray-400 text-sm mb-2">Audio File:</p>
                                        <button
                                            onClick={() => playAudio(detailData.audio_file_path)}
                                            className={`px-4 py-2 rounded font-semibold transition ${audioPlaying === detailData.audio_file_path
                                                ? 'bg-red-600 hover:bg-red-700'
                                                : 'bg-green-600 hover:bg-green-700'
                                                }`}
                                        >
                                            {audioPlaying === detailData.audio_file_path ? '⏹️ Stop' : '▶️ Play Audio'}
                                        </button>
                                        {audioPlaying === detailData.audio_file_path && (
                                            <div className="mt-3">
                                                <audio
                                                    controls
                                                    autoPlay
                                                    onEnded={() => setAudioPlaying(null)}
                                                    className="w-full"
                                                >
                                                    <source src={`${API_URL}/uploads/${detailData.audio_file_path.split('/').pop()}`} type="audio/mpeg" />
                                                    <source src={`${API_URL}/uploads/${detailData.audio_file_path.split('/').pop()}`} type="audio/wav" />
                                                    <source src={`${API_URL}/uploads/${detailData.audio_file_path.split('/').pop()}`} type="audio/mp3" />
                                                    Your browser does not support the audio element.
                                                </audio>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Threat Assessment */}
                        <div className={`p-6 rounded-lg border-2 ${getSeverityColor(detailData.threat_score)}`}>
                            <h3 className="text-2xl font-bold mb-4 text-red-400">⚠️ THREAT ASSESSMENT</h3>
                            <div className="space-y-4">
                                <div className="bg-gray-900 p-6 rounded">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-xl font-semibold">Threat Score:</span>
                                        <div className="text-right">
                                            <span className={`text-4xl font-bold ${detailData.threat_score >= 75 ? 'text-red-500' :
                                                detailData.threat_score >= 50 ? 'text-orange-500' :
                                                    'text-green-500'
                                                }`}>
                                                {detailData.threat_score.toFixed(1)}
                                            </span>
                                            <span className="text-gray-400">/100</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-8">
                                        <div
                                            className={`h-8 rounded-full flex items-center justify-center text-white font-bold ${detailData.threat_score >= 75 ? 'bg-red-500' :
                                                detailData.threat_score >= 50 ? 'bg-orange-500' :
                                                    'bg-green-500'
                                                }`}
                                            style={{ width: `${Math.min(detailData.threat_score, 100)}%` }}
                                        >
                                            {getSeverityLevel(detailData.threat_score)}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-900 p-4 rounded">
                                    <p className="text-gray-400 text-sm mb-2">Crime Type:</p>
                                    <p className="text-red-300 text-xl font-bold uppercase">{detailData.crime_type}</p>
                                </div>
                            </div>
                        </div>

                        {/* Alert */}
                        {detailData.alert && (
                            <div className="bg-red-900/40 border-4 border-red-500 rounded-lg p-6">
                                <h3 className="text-3xl font-bold text-red-400 mb-4">🚨 ALERT</h3>
                                <div className="space-y-3">
                                    <p><strong>Alert ID:</strong> ALERT-{detailData.alert.id}</p>
                                    <p><strong>Severity:</strong> <span className="text-red-300 text-xl">{detailData.alert.severity}</span></p>
                                    <p><strong>Status:</strong> <span className="text-green-400">{detailData.alert.status.toUpperCase()}</span></p>
                                    <p><strong>Created:</strong> {new Date(detailData.alert.created_at).toLocaleString('en-GB')}</p>
                                </div>
                            </div>
                        )}

                        {/* Transcript */}
                        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                            {/* Language badge row */}
                            <div className="flex items-center gap-3 mb-4 flex-wrap">
                                <h3 className="text-2xl font-bold">📝 FULL TRANSCRIPT</h3>
                                {detailData.detected_language && (
                                    <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${detailData.is_translated
                                        ? 'bg-orange-900/40 border-orange-500 text-orange-300'
                                        : 'bg-blue-900/40 border-blue-500 text-blue-300'
                                        }`}>
                                        {langName(detailData.detected_language)}
                                    </span>
                                )}
                                {detailData.is_translated && (
                                    <span className="px-3 py-1 bg-green-900/40 border border-green-500 text-green-300 rounded-full text-sm">
                                        ✓ Translated to English
                                    </span>
                                )}
                            </div>

                            {/* Original */}
                            <div className="mb-1 text-xs text-gray-500 font-semibold uppercase tracking-wide">
                                Original — {langName(detailData.detected_language || 'en')}
                            </div>
                            <div className="bg-black p-4 rounded border border-gray-600 max-h-64 overflow-y-auto mb-4">
                                <p className="text-gray-300 whitespace-pre-wrap leading-relaxed"
                                    style={{
                                        direction: RTL_LANGS.has(detailData.detected_language) ? 'rtl' : 'ltr',
                                        textAlign: RTL_LANGS.has(detailData.detected_language) ? 'right' : 'left'
                                    }}>
                                    {detailData.transcript}
                                </p>
                            </div>

                            {/* English translation */}
                            {detailData.is_translated && detailData.transcript_english && (
                                <>
                                    <div className="mb-1 text-xs text-green-400 font-semibold uppercase tracking-wide">
                                        🌐 English Translation — from {langName(detailData.detected_language)}
                                    </div>
                                    <div className="bg-black p-4 rounded border border-green-800 max-h-64 overflow-y-auto">
                                        <p className="text-green-100 whitespace-pre-wrap leading-relaxed">
                                            {detailData.transcript_english}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Detected Persons */}
                        {detailData.persons && detailData.persons.length > 0 && (
                            <div className="bg-gray-800 p-6 rounded-lg border border-blue-500">
                                <h3 className="text-2xl font-bold mb-4 text-blue-400">
                                    👥 DETECTED PERSONS ({detailData.persons.length})
                                </h3>
                                <div className="space-y-3">
                                    {detailData.persons.map((person) => (
                                        <div key={person.id} className="bg-blue-900/20 border border-blue-500 p-4 rounded">
                                            <p className="text-blue-300 text-xl font-bold">{person.name}</p>
                                            <p className="text-gray-400">Threat Score: {person.threat_score.toFixed(1)}</p>
                                            <p className="text-gray-400">Crime Type: {person.crime_type}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ALL EXTRACTED ENTITIES */}
                        {detailData.extracted_entities && (
                            <>
                                {/* Detected Locations */}
                                {detailData.extracted_entities.locations && detailData.extracted_entities.locations.length > 0 && (
                                    <div className="bg-gray-800 p-6 rounded-lg border border-green-500">
                                        <h3 className="text-2xl font-bold mb-4 text-green-400">
                                            📍 DETECTED LOCATIONS ({detailData.extracted_entities.locations.length} Found)
                                        </h3>
                                        <div className="space-y-3">
                                            {detailData.extracted_entities.locations.map((location, idx) => (
                                                <div key={idx} className="bg-green-900/20 border border-green-500 p-4 rounded">
                                                    <p className="text-green-300 text-xl font-bold">{location.name || String(location)}</p>
                                                    {location.type && <p className="text-white text-sm mt-1">Type: {location.type}</p>}
                                                    {location.context && <p className="text-white text-sm">Context: {location.context}</p>}
                                                    {location.significance && <p className="text-orange-300 text-sm">Significance: {location.significance}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Detected Organizations */}
                                {detailData.extracted_entities.organizations && detailData.extracted_entities.organizations.length > 0 && (
                                    <div className="bg-gray-800 p-6 rounded-lg border border-purple-500">
                                        <h3 className="text-2xl font-bold mb-4 text-purple-400">
                                            🏢 DETECTED ORGANIZATIONS ({detailData.extracted_entities.organizations.length})
                                        </h3>
                                        <div className="space-y-3">
                                            {detailData.extracted_entities.organizations.map((org, idx) => (
                                                <div key={idx} className="bg-purple-900/20 border border-purple-500 p-4 rounded">
                                                    <p className="text-purple-300 text-xl font-bold">{org.name}</p>
                                                    <p className="text-white">Type: {org.type}</p>
                                                    <p className="text-white">Context: {org.context}</p>
                                                    {org.relationship && (
                                                        <p className="text-orange-300">Relationship: {org.relationship}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Detected Dates & Times */}
                                {detailData.extracted_entities.dates_times && detailData.extracted_entities.dates_times.length > 0 && (
                                    <div className="bg-gray-800 p-6 rounded-lg border border-cyan-500">
                                        <h3 className="text-2xl font-bold mb-4 text-cyan-400">
                                            🕐 DETECTED DATES & TIMES ({detailData.extracted_entities.dates_times.length} Found)
                                        </h3>
                                        <div className="space-y-3">
                                            {detailData.extracted_entities.dates_times.map((dt, idx) => (
                                                <div key={idx} className="bg-cyan-900/20 border border-cyan-500 p-4 rounded">
                                                    <p className="text-cyan-300 text-lg font-bold">
                                                        {typeof dt === 'string' ? dt : (dt.date || dt.time || dt.context || dt.reference || JSON.stringify(dt))}
                                                    </p>
                                                    {typeof dt === 'object' && dt.urgency && <p className="text-orange-300 font-bold text-sm mt-1">⚠️ Urgency: {dt.urgency.toUpperCase()}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Detected Vehicles */}
                                {detailData.extracted_entities.vehicles && detailData.extracted_entities.vehicles.length > 0 && (
                                    <div className="bg-gray-800 p-6 rounded-lg border border-indigo-500">
                                        <h3 className="text-2xl font-bold mb-4 text-indigo-400">
                                            🚗 DETECTED VEHICLES ({detailData.extracted_entities.vehicles.length} Found)
                                        </h3>
                                        <div className="space-y-3">
                                            {detailData.extracted_entities.vehicles.map((vehicle, idx) => (
                                                <div key={idx} className="bg-indigo-900/20 border border-indigo-500 p-4 rounded">
                                                    <p className="text-indigo-300 text-xl font-bold">{vehicle.type || vehicle.name || String(vehicle)}</p>
                                                    {vehicle.details && <p className="text-white text-sm mt-1">Details: {vehicle.details}</p>}
                                                    {vehicle.context && <p className="text-white text-sm">Context: {vehicle.context}</p>}
                                                    {vehicle.location && <p className="text-green-300 text-sm">Location: {vehicle.location}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Detected Weapons */}
                                {detailData.extracted_entities.weapons && detailData.extracted_entities.weapons.length > 0 && (
                                    <div className="bg-gray-800 p-6 rounded-lg border border-red-500">
                                        <h3 className="text-2xl font-bold mb-4 text-red-400">
                                            🔫 DETECTED WEAPONS ({detailData.extracted_entities.weapons.length} Found)
                                        </h3>
                                        <div className="space-y-3">
                                            {detailData.extracted_entities.weapons.map((weapon, idx) => {
                                                const name = typeof weapon === 'string' ? weapon : (weapon.type || weapon.name || JSON.stringify(weapon));
                                                const qty = typeof weapon === 'object' ? weapon.quantity : null;
                                                const ctx = typeof weapon === 'object' ? weapon.context : null;
                                                return (
                                                    <div key={idx} className="bg-red-900/20 border border-red-500 p-4 rounded">
                                                        <p className="text-red-300 text-xl font-bold">{name}</p>
                                                        {qty && <p className="text-white">Quantity: {qty}</p>}
                                                        {ctx && <p className="text-white">Context: {ctx}</p>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Detected Money */}
                                {detailData.extracted_entities.money && detailData.extracted_entities.money.length > 0 && (
                                    <div className="bg-gray-800 p-6 rounded-lg border border-yellow-500">
                                        <h3 className="text-2xl font-bold mb-4 text-yellow-400">
                                            💰 DETECTED MONEY TRANSACTIONS ({detailData.extracted_entities.money.length})
                                        </h3>
                                        <div className="space-y-3">
                                            {detailData.extracted_entities.money.map((money, idx) => (
                                                <div key={idx} className="bg-yellow-900/20 border border-yellow-500 p-4 rounded">
                                                    <p className="text-yellow-300 text-xl font-bold">{money.amount}</p>
                                                    <p className="text-white">Purpose: {money.purpose}</p>
                                                    <p className="text-white">Context: {money.context}</p>
                                                    {money.method && <p className="text-green-300">Method: {money.method}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Detected Communications */}
                                {detailData.extracted_entities.communications && detailData.extracted_entities.communications.length > 0 && (
                                    <div className="bg-gray-800 p-6 rounded-lg border border-pink-500">
                                        <h3 className="text-2xl font-bold mb-4 text-pink-400">
                                            📱 DETECTED COMMUNICATIONS ({detailData.extracted_entities.communications.length})
                                        </h3>
                                        <div className="space-y-3">
                                            {detailData.extracted_entities.communications.map((comm, idx) => (
                                                <div key={idx} className="bg-pink-900/20 border border-pink-500 p-4 rounded">
                                                    <p className="text-pink-300 text-xl font-bold">{comm.type}</p>
                                                    {comm.details && <p className="text-white">Details: {comm.details}</p>}
                                                    <p className="text-white">Context: {comm.context}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Decoded Code Words */}
                        {detailData.decoded_codes && detailData.decoded_codes.length > 0 && (
                            <div className="bg-gray-800 p-6 rounded-lg border border-yellow-500">
                                <h3 className="text-2xl font-bold mb-4 text-yellow-400">
                                    🔓 DETECTED CODE WORDS ({detailData.decoded_codes.length})
                                </h3>
                                <div className="space-y-3">
                                    {detailData.decoded_codes.map((code, idx) => (
                                        <div key={idx} className="bg-yellow-900/20 border border-yellow-500 p-4 rounded">
                                            <p className="text-yellow-300 text-xl">"{code.term}"</p>
                                            <p className="text-red-300">→ {code.decoded_meaning}</p>
                                            <p className="text-gray-400 text-sm">Crime: {code.crime_type}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Connections */}
                        {detailData.connections && detailData.connections.length > 0 && (
                            <div className="bg-gray-800 p-6 rounded-lg border border-orange-500">
                                <h3 className="text-2xl font-bold mb-4 text-orange-400">
                                    🔗 CONNECTED DOTS ({detailData.connections.length})
                                </h3>
                                <div className="space-y-4">
                                    {detailData.connections.map((conn, idx) => (
                                        <div key={idx} className="bg-orange-900/20 border border-orange-500 p-4 rounded">
                                            <p className="text-xl font-bold text-orange-300 mb-2">Connection Found!</p>
                                            <p className="text-white mb-2">
                                                <span className="text-orange-300">{conn.person_a.name}</span> ↔{' '}
                                                <span className="text-orange-300">{conn.person_b.name}</span>
                                            </p>
                                            <p className="text-gray-400">Type: {conn.type}</p>
                                            <p className="text-gray-400">Strength: {conn.strength}</p>
                                            {conn.evidence && conn.evidence.length > 0 && (
                                                <div className="mt-2">
                                                    <p className="text-gray-400 text-sm">Evidence:</p>
                                                    <ul className="text-gray-300 text-sm">
                                                        {conn.evidence.map((ev, i) => (
                                                            <li key={i}>• {ev}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {conversationsData?.conversations?.map((conv) => (
                        <div
                            key={conv.id}
                            className={`p-6 rounded-lg border-2 cursor-pointer hover:shadow-lg transition relative ${getSeverityColor(conv.threat_score)}`}
                        >
                            {/* Delete button on card */}
                            <button
                                onClick={(e) => handleCardDelete(e, conv.id)}
                                className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold transition z-10"
                                title="Delete conversation"
                            >
                                ×
                            </button>

                            <div
                                onClick={() => setSelectedConversation(conv.id)}
                                className="pr-10" // Add padding to avoid delete button
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-gray-400 text-sm">Conversation ID</p>
                                        <p className="text-2xl font-bold text-white">#{conv.id}</p>
                                    </div>
                                    <div className={`px-3 py-1 rounded font-bold ${conv.threat_score >= 75 ? 'bg-red-500' :
                                        conv.threat_score >= 50 ? 'bg-orange-500' :
                                            'bg-green-500'
                                        }`}>
                                        {conv.threat_score.toFixed(0)}
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm">
                                    <p>
                                        <strong>Date:</strong>{' '}
                                        {new Date(conv.timestamp).toLocaleDateString('en-GB')}
                                    </p>
                                    <p>
                                        <strong>Time:</strong>{' '}
                                        {new Date(conv.timestamp).toLocaleTimeString('en-GB')}
                                    </p>
                                    <p>
                                        <strong>Crime Type:</strong>{' '}
                                        <span className="uppercase text-red-300">{conv.crime_type}</span>
                                    </p>
                                    <p>
                                        <strong>Persons:</strong> {conv.persons.length}
                                        {conv.persons.length > 0 && (
                                            <span className="text-blue-300 ml-2">
                                                ({conv.persons.map(p => p.name).join(', ')})
                                            </span>
                                        )}
                                    </p>
                                    <p>
                                        <strong>Code Words:</strong> {conv.decoded_codes.length}
                                    </p>
                                    {conv.location && (
                                        <p>
                                            <strong>Location:</strong>{' '}
                                            <span className="text-green-300">{conv.location.name}</span>
                                        </p>
                                    )}

                                    {/* Show additional entities if available */}
                                    {conv.extracted_entities && (
                                        <>
                                            {conv.extracted_entities.vehicles && conv.extracted_entities.vehicles.length > 0 && (
                                                <p>
                                                    <strong>Vehicles:</strong>{' '}
                                                    <span className="text-indigo-300">
                                                        {conv.extracted_entities.vehicles.length} detected
                                                    </span>
                                                </p>
                                            )}
                                            {conv.extracted_entities.money && conv.extracted_entities.money.length > 0 && (
                                                <p>
                                                    <strong>Money:</strong>{' '}
                                                    <span className="text-yellow-300">
                                                        {conv.extracted_entities.money.length} transactions
                                                    </span>
                                                </p>
                                            )}
                                            {conv.extracted_entities.weapons && conv.extracted_entities.weapons.length > 0 && (
                                                <p>
                                                    <strong>Weapons:</strong>{' '}
                                                    <span className="text-red-300">
                                                        {conv.extracted_entities.weapons.length} detected
                                                    </span>
                                                </p>
                                            )}
                                            {conv.extracted_entities.dates_times && conv.extracted_entities.dates_times.length > 0 && (
                                                <p>
                                                    <strong>Dates/Times:</strong>{' '}
                                                    <span className="text-cyan-300">
                                                        {conv.extracted_entities.dates_times.length} references
                                                    </span>
                                                </p>
                                            )}
                                            {conv.extracted_entities.organizations && conv.extracted_entities.organizations.length > 0 && (
                                                <p>
                                                    <strong>Organizations:</strong>{' '}
                                                    <span className="text-purple-300">
                                                        {conv.extracted_entities.organizations.length} mentioned
                                                    </span>
                                                </p>
                                            )}
                                        </>
                                    )}

                                    {conv.alert && (
                                        <div className="mt-3 pt-3 border-t border-gray-600">
                                            <p className="text-red-400 font-bold">🚨 ALERT: {conv.alert.severity}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 pt-4 border-t border-gray-600">
                                    <p className="text-blue-400 text-sm font-semibold">Click to view full analysis →</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {conversationsData && conversationsData.conversations && conversationsData.conversations.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                    No conversations analyzed yet. Upload audio files to start.
                </div>
            )}
        </div>
    );
}

export default AnalysisHistory;

