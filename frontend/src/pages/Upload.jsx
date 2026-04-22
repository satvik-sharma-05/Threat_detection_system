import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const API_URL = 'http://localhost:8000';

const LANG_NAMES = {
    en: 'English', hi: 'Hindi', ur: 'Urdu', bn: 'Bengali', ps: 'Pashto',
    ar: 'Arabic', pa: 'Punjabi', ta: 'Tamil', te: 'Telugu', mr: 'Marathi',
    gu: 'Gujarati', fa: 'Farsi', zh: 'Chinese', ru: 'Russian', fr: 'French',
    de: 'German', es: 'Spanish', it: 'Italian', pt: 'Portuguese', ja: 'Japanese',
    ko: 'Korean', tr: 'Turkish', nl: 'Dutch', pl: 'Polish', sv: 'Swedish',
};
const langName = (code) => LANG_NAMES[code?.toLowerCase()] || code?.toUpperCase() || 'Unknown';
const RTL_LANGS = new Set(['ur', 'ar', 'fa', 'ps', 'he', 'yi']);

function Upload() {
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [fileName, setFileName] = useState('');
    const [fileSize, setFileSize] = useState(0);
    const [uploadDate, setUploadDate] = useState('');
    const [language, setLanguage] = useState('');  // '' = auto-detect

    const LANGUAGES = [
        { code: '', label: '🌐 Auto-Detect (Recommended)' },
        { code: 'en', label: '🇬🇧 English' },
        { code: 'hi', label: '🇮🇳 Hindi (हिन्दी)' },
        { code: 'ur', label: '🇵🇰 Urdu (اردو)' },
        { code: 'bn', label: '🇧🇩 Bengali (বাংলা)' },
        { code: 'ps', label: '🇦🇫 Pashto (پښتو)' },
        { code: 'ar', label: '🇸🇦 Arabic (العربية)' },
        { code: 'pa', label: '🇮🇳 Punjabi (ਪੰਜਾਬੀ)' },
        { code: 'ta', label: '🇮🇳 Tamil (தமிழ்)' },
        { code: 'te', label: '🇮🇳 Telugu (తెలుగు)' },
        { code: 'mr', label: '🇮🇳 Marathi (मराठी)' },
        { code: 'gu', label: '🇮🇳 Gujarati (ગુજરાતી)' },
        { code: 'fa', label: '🇮🇷 Farsi (فارسی)' },
        { code: 'zh', label: '🇨🇳 Chinese (中文)' },
        { code: 'ru', label: '🇷🇺 Russian (Русский)' },
    ];

    const onDrop = async (acceptedFiles) => {
        if (acceptedFiles.length === 0) return;

        const file = acceptedFiles[0];
        setFileName(file.name);
        setFileSize((file.size / (1024 * 1024)).toFixed(2));
        setUploadDate(new Date().toLocaleString('en-GB', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }));
        setUploading(true);
        setResult(null);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            // Build URL with optional language param
            const url = language
                ? `${API_URL}/upload?language=${language}`
                : `${API_URL}/upload`;

            const response = await axios.post(url, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setResult(response.data);
            setUploading(false);
        } catch (err) {
            console.error('Upload failed:', err);
            setError(err.response?.data?.detail || err.message);
            setUploading(false);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'audio/*': ['.wav', '.mp3', '.m4a', '.flac', '.ogg'],
            'text/*': ['.txt']
        },
        maxSize: 25 * 1024 * 1024,
        multiple: false
    });

    const getSeverityLevel = (score) => {
        if (score >= 90) return 'CRITICAL';
        if (score >= 75) return 'HIGH';
        if (score >= 50) return 'MEDIUM';
        return 'LOW';
    };

    const getRecommendedAction = (score) => {
        if (score >= 90) return 'IMMEDIATE ESCALATION TO ANTI-TERRORISM SQUAD';
        if (score >= 75) return 'REVIEW AND INTERCEPT WITHIN 24 HOURS';
        if (score >= 50) return 'MONITOR CLOSELY AND INVESTIGATE';
        return 'ROUTINE MONITORING';
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Upload Audio for Threat Analysis</h1>
                <p className="text-gray-400 mt-2">
                    System will automatically detect persons, locations, code words, dates, and assess threats
                </p>
            </div>

            {/* Language selector */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                    🌐 Audio Language
                </label>
                <select
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                    {LANGUAGES.map(l => (
                        <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                    Auto-detect works for most languages. Select manually for better accuracy with Hindi, Urdu, Pashto, etc.
                </p>
            </div>

            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition ${isDragActive
                    ? 'border-blue-500 bg-blue-900/20'
                    : 'border-gray-600 hover:border-gray-500'
                    }`}
            >
                <input {...getInputProps()} />
                <div className="text-6xl mb-4">🎤</div>
                {uploading ? (
                    <div>
                        <p className="text-lg mb-2">Processing Audio{language ? ` (${LANGUAGES.find(l => l.code === language)?.label})` : ''}...</p>
                        <p className="text-sm text-gray-400">
                            Transcribing → Analyzing → Detecting Entities → Decoding Code Words → Assessing Threats...
                        </p>
                    </div>
                ) : isDragActive ? (
                    <p className="text-lg">Drop the audio file here</p>
                ) : (
                    <div>
                        <p className="text-lg mb-2">Drag & drop audio file, or click to select</p>
                        <p className="text-sm text-gray-400">
                            Supports: WAV, MP3, M4A, FLAC, OGG, TXT (max 25MB) · Hindi, Urdu, English, Bengali, Pashto + more
                        </p>
                    </div>
                )}
            </div>
            {error && (
                <div className="bg-red-900/30 border border-red-500 rounded p-4">
                    <p className="font-semibold text-red-400">Error</p>
                    <p className="text-sm text-gray-300">{error}</p>
                </div>
            )}

            {result && (
                <div className="space-y-6">
                    {/* Safe destructure — handles duplicate-prevented responses that have no auto_detected */}
                    {(() => {
                        const ad = result.auto_detected || {};
                        const ta = result.threat_assessment || {};
                        const score = ta.score ?? 0;
                        return (<>
                            <div className="bg-gray-800 p-6 rounded-lg border-2 border-blue-500">
                                <h3 className="text-2xl font-bold mb-4 text-blue-400">📁 AUDIO METADATA</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-lg">
                                    <div className="bg-gray-900 p-4 rounded">
                                        <p className="text-gray-400 text-sm">File Name:</p>
                                        <p className="font-semibold text-white">{fileName}</p>
                                    </div>
                                    <div className="bg-gray-900 p-4 rounded">
                                        <p className="text-gray-400 text-sm">Upload Date:</p>
                                        <p className="font-semibold text-white">{uploadDate}</p>
                                    </div>
                                    <div className="bg-gray-900 p-4 rounded">
                                        <p className="text-gray-400 text-sm">Source Type:</p>
                                        <p className="font-semibold text-yellow-400">Unknown (Auto-detected from content)</p>
                                    </div>
                                    <div className="bg-gray-900 p-4 rounded">
                                        <p className="text-gray-400 text-sm">File Size:</p>
                                        <p className="font-semibold text-white">{fileSize} MB</p>
                                    </div>
                                    <div className="bg-gray-900 p-4 rounded">
                                        <p className="text-gray-400 text-sm">Language Detected:</p>
                                        <p className="font-semibold text-white">Unknown (Auto-detection in progress)</p>
                                    </div>
                                    <div className="bg-gray-900 p-4 rounded">
                                        <p className="text-gray-400 text-sm">Conversation ID:</p>
                                        <p className="font-semibold text-white">#{result.conversation_id}</p>
                                    </div>
                                </div>
                            </div>

                            {/* 9. THREAT ASSESSMENT - MOVED TO TOP FOR VISIBILITY */}
                            {ta && (
                                <div className={`p-6 rounded-lg border-2 ${(score) >= 75 ? 'bg-red-900/30 border-red-500' :
                                    (score) >= 50 ? 'bg-orange-900/30 border-orange-500' :
                                        'bg-gray-800 border-gray-700'
                                    }`}>
                                    <h3 className="text-2xl font-bold mb-4 text-red-400">⚠️ THREAT ASSESSMENT</h3>

                                    <div className="space-y-4">
                                        {/* Threat Score */}
                                        <div className="bg-gray-900 p-6 rounded">
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-xl font-semibold">Threat Score:</span>
                                                <div className="text-right">
                                                    <span className={`text-4xl font-bold ${(score) >= 75 ? 'text-red-500' :
                                                        (score) >= 50 ? 'text-orange-500' :
                                                            (score) >= 25 ? 'text-yellow-500' :
                                                                'text-green-500'
                                                        }`}>
                                                        {(score).toFixed(1)}
                                                    </span>
                                                    <span className="text-gray-400">/100</span>
                                                </div>
                                            </div>
                                            <div className="w-full bg-gray-700 rounded-full h-8 mb-2">
                                                <div
                                                    className={`h-8 rounded-full transition-all flex items-center justify-center text-white font-bold ${(score) >= 75 ? 'bg-red-500' :
                                                        (score) >= 50 ? 'bg-orange-500' :
                                                            (score) >= 25 ? 'bg-yellow-500' :
                                                                'bg-green-500'
                                                        }`}
                                                    style={{ width: `${Math.min(score, 100)}%` }}
                                                >
                                                    {getSeverityLevel(score)}
                                                </div>
                                            </div>
                                            <p className="text-gray-400 text-sm mt-2">
                                                Severity Level: <span className="font-bold text-white">{getSeverityLevel(score)}</span>
                                                {(score) >= 90 && ' (90+)'}
                                                {(score) >= 75 && (score) < 90 && ' (75-89)'}
                                                {(score) >= 50 && (score) < 75 && ' (50-74)'}
                                                {(score) < 50 && ' (<50)'}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-gray-900 p-4 rounded">
                                                <p className="text-gray-400 text-sm mb-2">Crime Type Predicted:</p>
                                                <p className="text-red-300 text-xl font-bold uppercase">
                                                    {ta.primary_crime}
                                                </p>
                                            </div>
                                            <div className="bg-gray-900 p-4 rounded">
                                                <p className="text-gray-400 text-sm mb-2">Confidence:</p>
                                                <p className="text-yellow-300 text-xl font-bold">
                                                    {(score).toFixed(0)}%
                                                </p>
                                            </div>
                                        </div>

                                        <div className="bg-gray-900 p-4 rounded">
                                            <p className="text-gray-400 text-sm mb-2">Predicted Harm:</p>
                                            <p className="text-gray-300 text-lg">
                                                {ta.harm_prediction || 'Analysis in progress'}
                                            </p>
                                        </div>

                                        {ta.reasoning && (
                                            <div className="bg-gray-900 p-4 rounded">
                                                <p className="text-gray-400 text-sm mb-2">Analysis Reasoning:</p>
                                                <p className="text-gray-300">
                                                    {ta.reasoning}
                                                </p>
                                            </div>
                                        )}

                                        <div className="bg-gray-900 p-4 rounded">
                                            <p className="text-gray-400 text-sm mb-2">Timeframe:</p>
                                            <p className="text-orange-300 text-lg font-semibold">
                                                Unknown (Check conversation for date references)
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 10. ALERT (if score > 75) */}
                            {result.alert?.created && ta && (
                                <div className="bg-red-900/40 border-4 border-red-500 rounded-lg p-6 animate-pulse">
                                    <h3 className="text-3xl font-bold text-red-400 mb-4 flex items-center">
                                        <span className="text-4xl mr-3">⚠️</span> ALERT TRIGGERED
                                    </h3>
                                    <div className="space-y-4 text-lg">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-gray-900 p-4 rounded">
                                                <p className="text-gray-400 text-sm">Alert ID:</p>
                                                <p className="font-bold text-white">ALERT-{result.alert.id}</p>
                                            </div>
                                            <div className="bg-gray-900 p-4 rounded">
                                                <p className="text-gray-400 text-sm">Alert Time:</p>
                                                <p className="font-bold text-white">{new Date().toLocaleString('en-GB')}</p>
                                            </div>
                                        </div>

                                        <div className="bg-gray-900 p-4 rounded">
                                            <p className="text-gray-400 text-sm mb-2">Severity:</p>
                                            <p className="text-red-300 text-2xl font-bold">{result.alert.severity}</p>
                                        </div>

                                        <div className="bg-gray-900 p-4 rounded">
                                            <p className="text-gray-400 text-sm mb-2">Description:</p>
                                            <p className="text-white text-lg">
                                                High-threat {ta.primary_crime} activity detected in conversation
                                            </p>
                                        </div>

                                        {ad.persons && ad.persons.length > 0 && (
                                            <div className="bg-gray-900 p-4 rounded">
                                                <p className="text-gray-400 text-sm mb-2">Involved Entities:</p>
                                                <p className="text-orange-300 font-semibold">
                                                    Persons: {ad.persons.map(p => (typeof p === "string" ? p : (p.name || String(p)))).join(', ')}
                                                </p>
                                            </div>
                                        )}

                                        <div className="bg-gray-900 p-4 rounded">
                                            <p className="text-gray-400 text-sm mb-2">Evidence Summary:</p>
                                            <ul className="text-gray-300 space-y-1">
                                                <li>• Threat Score: {(score).toFixed(1)}/100</li>
                                                <li>• Crime Type: {ta.primary_crime}</li>
                                                {ad.decoded_codes && ad.decoded_codes.length > 0 && (
                                                    <li>• Code Words Detected: {ad.decoded_codes.length}</li>
                                                )}
                                                {ad.relationships && ad.relationships.length > 0 && (
                                                    <li>• Connections Found: {ad.relationships.length}</li>
                                                )}
                                            </ul>
                                        </div>

                                        <div className="bg-gray-900 p-4 rounded border-2 border-orange-500">
                                            <p className="text-gray-400 text-sm mb-2">Recommended Action:</p>
                                            <p className="text-orange-300 text-xl font-bold">
                                                {getRecommendedAction(score)}
                                            </p>
                                        </div>

                                        <div className="bg-gray-900 p-4 rounded">
                                            <p className="text-gray-400 text-sm mb-2">Status:</p>
                                            <p className="text-green-400 font-semibold">ACTIVE</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 6. CONVERSATION SUMMARY */}
                            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                                <h3 className="text-2xl font-bold mb-4">📝 CONVERSATION SUMMARY</h3>

                                <div className="space-y-4">
                                    {/* Language badge */}
                                    {result.detected_language && (
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className="text-gray-400 text-sm">Detected Language:</span>
                                            <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${result.is_translated
                                                ? 'bg-orange-900/40 border-orange-500 text-orange-300'
                                                : 'bg-blue-900/40 border-blue-500 text-blue-300'
                                                }`}>
                                                {langName(result.detected_language)}
                                            </span>
                                            {result.is_translated && (
                                                <span className="px-3 py-1 bg-green-900/40 border border-green-500 text-green-300 rounded-full text-sm">
                                                    ✓ Auto-translated to English
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Original transcript */}
                                    <div className="bg-gray-900 p-4 rounded border border-gray-700">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-gray-400 text-sm font-semibold">📄 FULL TRANSCRIPT</span>
                                            {result.detected_language && result.detected_language !== 'en' && (
                                                <span className="text-xs px-2 py-0.5 bg-orange-900/40 border border-orange-600 text-orange-300 rounded">
                                                    {langName(result.detected_language)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="bg-black p-4 rounded border border-gray-600 max-h-64 overflow-y-auto">
                                            <p className="text-gray-300 whitespace-pre-wrap leading-relaxed"
                                                style={{ direction: RTL_LANGS.has(result.detected_language) ? 'rtl' : 'ltr', textAlign: RTL_LANGS.has(result.detected_language) ? 'right' : 'left' }}>
                                                {result.transcript}
                                            </p>
                                        </div>
                                    </div>

                                    {/* English translation — only if different language */}
                                    {result.is_translated && result.transcript_english && (
                                        <div className="bg-gray-900 p-4 rounded border border-green-700">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-green-400 text-sm font-semibold">🌐 ENGLISH TRANSLATION</span>
                                                <span className="text-xs px-2 py-0.5 bg-green-900/40 border border-green-600 text-green-300 rounded">
                                                    Translated from {langName(result.detected_language)}
                                                </span>
                                            </div>
                                            <div className="bg-black p-4 rounded border border-green-900 max-h-64 overflow-y-auto">
                                                <p className="text-green-100 whitespace-pre-wrap leading-relaxed">
                                                    {result.transcript_english}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-gray-900 p-4 rounded">
                                        <p className="text-gray-400 text-sm mb-2">Speakers Identified:</p>
                                        <p className="text-white">
                                            {ad.persons && ad.persons.length > 0
                                                ? ad.persons.map(p => (typeof p === "string" ? p : (p.name || String(p)))).join(', ')
                                                : 'Unknown speakers'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* 2. DETECTED PERSONS */}
                            {ad.persons && ad.persons.length > 0 && (
                                <div className="bg-gray-800 p-6 rounded-lg border border-blue-500">
                                    <h3 className="text-2xl font-bold mb-4 text-blue-400">
                                        👥 DETECTED PERSONS ({ad.persons.length} Found)
                                    </h3>
                                    <div className="space-y-4">
                                        {ad.persons.map((person, idx) => (
                                            <div key={idx} className="bg-blue-900/20 border border-blue-500 p-5 rounded">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-gray-400 text-sm">Person Found:</p>
                                                        <p className="text-blue-300 text-2xl font-bold">{typeof person === "string" ? person : (person.name || String(person))}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-400 text-sm">Role/Risk:</p>
                                                        <p className="text-white text-lg">{person.role || 'Participant in conversation'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-400 text-sm">Detection Confidence:</p>
                                                        <p className="text-green-400 font-semibold">{(person.confidence * 100).toFixed(0)}%</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-400 text-sm">Total Mentions Across All Calls:</p>
                                                        <p className="text-white font-semibold">1 time (this conversation)</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 3. DETECTED LOCATIONS */}
                            {ad.locations && ad.locations.length > 0 && (
                                <div className="bg-gray-800 p-6 rounded-lg border border-green-500">
                                    <h3 className="text-2xl font-bold mb-4 text-green-400">
                                        📍 DETECTED LOCATIONS ({ad.locations.length} Found)
                                    </h3>
                                    <div className="space-y-4">
                                        {ad.locations.map((location, idx) => (
                                            <div key={idx} className="bg-green-900/20 border border-green-500 p-5 rounded">
                                                <p className="text-green-300 text-2xl font-bold">{location.name || String(location)}</p>
                                                {location.type && <p className="text-gray-400 text-sm mt-1">Type: <span className="text-white">{location.type}</span></p>}
                                                {location.context && <p className="text-gray-400 text-sm mt-1">Context: <span className="text-white">{location.context}</span></p>}
                                                {location.significance && <p className="text-gray-400 text-sm mt-1">Significance: <span className="text-orange-300">{location.significance}</span></p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 5. DETECTED CODE WORDS */}
                            {ad.decoded_codes && ad.decoded_codes.length > 0 && (
                                <div className="bg-gray-800 p-6 rounded-lg border border-yellow-500">
                                    <h3 className="text-2xl font-bold mb-4 text-yellow-400">
                                        🔓 DETECTED CODE WORDS ({ad.decoded_codes.length} Found)
                                    </h3>
                                    <div className="space-y-4">
                                        {ad.decoded_codes.map((code, idx) => (
                                            <div key={idx} className="bg-yellow-900/20 border border-yellow-500 p-5 rounded">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-gray-400 text-sm">Code Word:</p>
                                                        <p className="text-yellow-300 text-2xl font-bold">"{code.term}"</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-400 text-sm">Decoded Meaning:</p>
                                                        <p className="text-red-300 text-xl font-semibold">{code.decoded_meaning}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-400 text-sm">Crime Category:</p>
                                                        <p className="text-white uppercase">{code.crime_type}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-400 text-sm">Confidence:</p>
                                                        <p className="text-green-400 font-semibold">
                                                            {code.confidence >= 0.8 ? 'HIGH' : code.confidence >= 0.5 ? 'MEDIUM' : 'LOW'} ({(code.confidence * 100).toFixed(0)}%)
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-400 text-sm">First Seen:</p>
                                                        <p className="text-white">This conversation</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-400 text-sm">Times Used:</p>
                                                        <p className="text-white">1 time across conversations</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* DETECTED ORGANIZATIONS */}
                            {ad.organizations && ad.organizations.length > 0 && (
                                <div className="bg-gray-800 p-6 rounded-lg border border-purple-500">
                                    <h3 className="text-2xl font-bold mb-4 text-purple-400">
                                        🏢 DETECTED ORGANIZATIONS ({ad.organizations.length} Found)
                                    </h3>
                                    <div className="space-y-4">
                                        {ad.organizations.map((org, idx) => (
                                            <div key={idx} className="bg-purple-900/20 border border-purple-500 p-5 rounded">
                                                <p className="text-purple-300 text-2xl font-bold">{org.name || String(org)}</p>
                                                {org.type && <p className="text-gray-400 text-sm mt-1">Type: <span className="text-white">{org.type}</span></p>}
                                                {org.context && <p className="text-gray-400 text-sm mt-1">Context: <span className="text-white">{org.context}</span></p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* DETECTED DATES & TIMES */}
                            {ad.dates_times && ad.dates_times.length > 0 && (
                                <div className="bg-gray-800 p-6 rounded-lg border border-cyan-500">
                                    <h3 className="text-2xl font-bold mb-4 text-cyan-400">
                                        🕐 DETECTED DATES & TIMES ({ad.dates_times.length} Found)
                                    </h3>
                                    <div className="space-y-4">
                                        {ad.dates_times.map((dt, idx) => (
                                            <div key={idx} className="bg-cyan-900/20 border border-cyan-500 p-5 rounded">
                                                <p className="text-cyan-300 text-xl font-bold">
                                                    {typeof dt === 'string' ? dt : (dt.date || dt.time || dt.context || dt.reference || JSON.stringify(dt))}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* DETECTED VEHICLES */}
                            {ad.vehicles && ad.vehicles.length > 0 && (
                                <div className="bg-gray-800 p-6 rounded-lg border border-indigo-500">
                                    <h3 className="text-2xl font-bold mb-4 text-indigo-400">
                                        🚗 DETECTED VEHICLES ({ad.vehicles.length} Found)
                                    </h3>
                                    <div className="space-y-4">
                                        {ad.vehicles.map((vehicle, idx) => (
                                            <div key={idx} className="bg-indigo-900/20 border border-indigo-500 p-5 rounded">
                                                <p className="text-indigo-300 text-2xl font-bold">
                                                    {typeof vehicle === 'string' ? vehicle : (vehicle.type || vehicle.name || vehicle.context || 'Unknown vehicle')}
                                                </p>
                                                {typeof vehicle === 'object' && vehicle.details && <p className="text-gray-400 text-sm mt-1">Details: <span className="text-white">{vehicle.details}</span></p>}
                                                {typeof vehicle === 'object' && vehicle.context && vehicle.context !== vehicle.type && <p className="text-gray-400 text-sm mt-1">Context: <span className="text-white">{vehicle.context}</span></p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* DETECTED WEAPONS */}
                            {ad.weapons && ad.weapons.length > 0 && (
                                <div className="bg-gray-800 p-6 rounded-lg border border-red-500">
                                    <h3 className="text-2xl font-bold mb-4 text-red-400">
                                        🔫 DETECTED WEAPONS ({ad.weapons.length} Found)
                                    </h3>
                                    <div className="space-y-4">
                                        {ad.weapons.map((weapon, idx) => (
                                            <div key={idx} className="bg-red-900/20 border border-red-500 p-5 rounded">
                                                <p className="text-red-300 text-2xl font-bold">
                                                    {typeof weapon === 'string' ? weapon : (weapon.type || weapon.name || weapon.context || 'Unknown weapon')}
                                                </p>
                                                {typeof weapon === 'object' && weapon.quantity && <p className="text-gray-400 text-sm mt-1">Quantity: <span className="text-white">{weapon.quantity}</span></p>}
                                                {typeof weapon === 'object' && weapon.context && weapon.context !== weapon.type && <p className="text-gray-400 text-sm mt-1">Context: <span className="text-white">{weapon.context}</span></p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* DETECTED MONEY */}
                            {ad.money && ad.money.length > 0 && (
                                <div className="bg-gray-800 p-6 rounded-lg border border-yellow-500">
                                    <h3 className="text-2xl font-bold mb-4 text-yellow-400">
                                        💰 DETECTED MONEY TRANSACTIONS ({ad.money.length} Found)
                                    </h3>
                                    <div className="space-y-4">
                                        {ad.money.map((money, idx) => (
                                            <div key={idx} className="bg-yellow-900/20 border border-yellow-500 p-5 rounded">
                                                <p className="text-yellow-300 text-2xl font-bold">
                                                    {typeof money === 'string' ? money : (money.amount || money.value || money.context || 'Unknown amount')}
                                                </p>
                                                {typeof money === 'object' && money.purpose && <p className="text-gray-400 text-sm mt-1">Purpose: <span className="text-white">{money.purpose}</span></p>}
                                                {typeof money === 'object' && money.context && money.context !== money.amount && <p className="text-gray-400 text-sm mt-1">Context: <span className="text-white">{money.context}</span></p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 7. CONNECTED DOTS */}
                            {ad.relationships && ad.relationships.length > 0 && (
                                <div className="bg-gray-800 p-6 rounded-lg border border-orange-500">
                                    <h3 className="text-2xl font-bold mb-4 text-orange-400">
                                        🔗 CONNECTED DOTS ({ad.relationships.length} Connection{ad.relationships.length > 1 ? 's' : ''} Found)
                                    </h3>
                                    <div className="space-y-4">
                                        {ad.relationships.map((rel, idx) => (
                                            <div key={idx} className="bg-orange-900/20 border border-orange-500 p-5 rounded">
                                                <p className="text-xl font-bold text-orange-300 mb-4">Connection Found!</p>
                                                <div className="space-y-3">
                                                    <div className="bg-gray-900 p-4 rounded">
                                                        <p className="text-gray-400 text-sm">Link Type:</p>
                                                        <p className="text-white font-semibold">{rel.type}</p>
                                                    </div>
                                                    <div className="bg-gray-900 p-4 rounded">
                                                        <p className="text-gray-400 text-sm">Connection:</p>
                                                        <p className="text-white">
                                                            <span className="text-orange-300 font-bold">{rel.person_a}</span> and{' '}
                                                            <span className="text-orange-300 font-bold">{rel.person_b}</span> are connected
                                                        </p>
                                                    </div>
                                                    <div className="bg-gray-900 p-4 rounded">
                                                        <p className="text-gray-400 text-sm">Evidence:</p>
                                                        <p className="text-white">{rel.evidence}</p>
                                                    </div>
                                                    <div className="bg-gray-900 p-4 rounded">
                                                        <p className="text-gray-400 text-sm">Connection Strength:</p>
                                                        <p className="text-yellow-300 font-semibold">STRONG (Cross-conversation link detected)</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 12. MANUAL EDIT SECTION */}
                            <div className="bg-gray-800 p-6 rounded-lg border border-purple-500">
                                <h3 className="text-2xl font-bold mb-4 text-purple-400">✏️ MANUAL EDIT SECTION (OPTIONAL)</h3>
                                <p className="text-gray-400 mb-4">Click to edit if auto-detection missed anything:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button className="bg-purple-900/30 border border-purple-500 p-4 rounded hover:bg-purple-900/50 transition">
                                        <p className="text-white font-semibold">📝 Edit Person Names</p>
                                        <p className="text-gray-400 text-sm">Add or correct detected persons</p>
                                    </button>
                                    <button className="bg-purple-900/30 border border-purple-500 p-4 rounded hover:bg-purple-900/50 transition">
                                        <p className="text-white font-semibold">📍 Edit Locations</p>
                                        <p className="text-gray-400 text-sm">Add or correct detected locations</p>
                                    </button>
                                    <button className="bg-purple-900/30 border border-purple-500 p-4 rounded hover:bg-purple-900/50 transition">
                                        <p className="text-white font-semibold">🔓 Edit Decoded Meanings</p>
                                        <p className="text-gray-400 text-sm">Correct code word interpretations</p>
                                    </button>
                                    <button className="bg-purple-900/30 border border-purple-500 p-4 rounded hover:bg-purple-900/50 transition">
                                        <p className="text-white font-semibold">🔗 Add Missing Connections</p>
                                        <p className="text-gray-400 text-sm">Link to other conversations</p>
                                    </button>
                                </div>
                            </div>
                        </>);
                    })()}
                </div>
            )}
        </div>
    );
}

export default Upload;

