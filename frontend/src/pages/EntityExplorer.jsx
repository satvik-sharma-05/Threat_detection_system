import React, { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';

const API_URL = 'http://localhost:8000';

const TYPE_CONFIG = {
    Person: { color: 'border-blue-500', bg: 'bg-blue-900/20', badge: 'bg-blue-900/40 text-blue-300', icon: '👤' },
    Location: { color: 'border-green-500', bg: 'bg-green-900/20', badge: 'bg-green-900/40 text-green-300', icon: '📍' },
};

function ThreatBar({ score }) {
    const pct = Math.min(100, Math.max(0, score || 0));
    const color = pct >= 75 ? 'bg-red-500' : pct >= 50 ? 'bg-orange-500' : 'bg-yellow-500';
    return (
        <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Threat Score</span><span>{pct.toFixed(0)}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
                <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

function EntityCard({ entity }) {
    const [expanded, setExpanded] = useState(false);
    const cfg = TYPE_CONFIG[entity.type] || TYPE_CONFIG.Person;

    return (
        <div
            className={`${cfg.bg} border ${cfg.color} rounded-lg cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:shadow-lg hover:shadow-black/40`}
            onClick={() => setExpanded(e => !e)}
        >
            {/* Header - always visible */}
            <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl flex-shrink-0">{cfg.icon}</span>
                        <div className="min-w-0">
                            <h3 className="font-bold text-white text-base truncate">{entity.name}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.badge}`}>{entity.type}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {entity.type === 'Person' && entity.threat_score >= 75 && (
                            <span className="text-xs bg-red-900/50 border border-red-500 text-red-300 px-2 py-0.5 rounded-full">HIGH RISK</span>
                        )}
                        <span className="text-gray-400 text-lg select-none">{expanded ? '▲' : '▼'}</span>
                    </div>
                </div>

                {/* Quick stats - always visible */}
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    {entity.type === 'Person' && (
                        <>
                            <span className="text-gray-300">Mentions: <strong className="text-white">{entity.total_mentions || 0}</strong></span>
                            <span className="text-gray-300">Crime: <strong className="text-orange-300">{entity.crime_type || 'Unknown'}</strong></span>
                        </>
                    )}
                    {entity.type === 'Location' && (
                        <>
                            <span className="text-gray-300">Events: <strong className="text-white">{entity.event_count || 0}</strong></span>
                            <span className="text-gray-300">Threat Level: <strong className="text-orange-300">{entity.threat_level || 0}</strong></span>
                        </>
                    )}
                </div>

                {entity.type === 'Person' && <ThreatBar score={entity.threat_score} />}
            </div>

            {/* Expanded section */}
            {expanded && (
                <div className={`border-t ${cfg.color} border-opacity-40 p-4 space-y-3`}>
                    {entity.type === 'Person' && (
                        <>
                            <Row label="Full Name" value={entity.name} />
                            <Row label="Threat Score" value={`${(entity.threat_score || 0).toFixed(1)} / 100`} highlight={entity.threat_score >= 75} />
                            <Row label="Crime Type" value={entity.crime_type || 'Unknown'} />
                            <Row label="Total Mentions" value={entity.total_mentions || 0} />
                            {entity.aliases && <Row label="Known Aliases" value={entity.aliases} />}
                            {entity.first_seen && <Row label="First Seen" value={new Date(entity.first_seen).toLocaleDateString()} />}
                            {entity.last_seen && <Row label="Last Seen" value={new Date(entity.last_seen).toLocaleDateString()} />}
                            <div className="pt-2">
                                <span className="text-xs text-gray-400">Risk Assessment</span>
                                <p className="text-sm text-white mt-1">
                                    {entity.threat_score >= 90 ? '🔴 Critical threat — immediate action required' :
                                        entity.threat_score >= 75 ? '🟠 High threat — monitor closely' :
                                            entity.threat_score >= 50 ? '🟡 Medium threat — under surveillance' :
                                                '🟢 Low threat — flagged for review'}
                                </p>
                            </div>
                        </>
                    )}
                    {entity.type === 'Location' && (
                        <>
                            <Row label="Location Name" value={entity.name} />
                            <Row label="Threat Level" value={entity.threat_level || 0} highlight={(entity.threat_level || 0) >= 3} />
                            <Row label="Event Count" value={entity.event_count || 0} />
                            {entity.coordinates && <Row label="Coordinates" value={entity.coordinates} />}
                            <div className="pt-2">
                                <span className="text-xs text-gray-400">Location Risk</span>
                                <p className="text-sm text-white mt-1">
                                    {(entity.event_count || 0) >= 5 ? '🔴 High activity location — multiple incidents' :
                                        (entity.event_count || 0) >= 2 ? '🟠 Moderate activity — recurring mentions' :
                                            '🟡 Low activity — mentioned in conversation'}
                                </p>
                            </div>
                        </>
                    )}
                    <div className="pt-1">
                        <span className="text-xs bg-blue-900/30 border border-blue-500 text-blue-300 px-2 py-1 rounded">
                            ✓ Auto-Detected by AI
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

function Row({ label, value, highlight }) {
    return (
        <div className="flex justify-between items-start gap-4">
            <span className="text-gray-400 text-sm flex-shrink-0">{label}</span>
            <span className={`text-sm font-medium text-right ${highlight ? 'text-red-400' : 'text-white'}`}>{value}</span>
        </div>
    );
}

export default function EntityExplorer() {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('All');

    const { data, isLoading } = useQuery(['entities', search], async () => {
        const res = await axios.get(`${API_URL}/entities`, { params: { query: search || undefined } });
        return res.data;
    });

    const entities = data?.entities || [];
    const filtered = filter === 'All' ? entities : entities.filter(e => e.type === filter);
    const persons = entities.filter(e => e.type === 'Person');
    const locations = entities.filter(e => e.type === 'Location');
    const highRisk = persons.filter(e => (e.threat_score || 0) >= 75);

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Entity Explorer</h1>
                    <p className="text-gray-400 mt-1">Click any card to expand full details</p>
                </div>
                <div className="text-right text-sm text-gray-400">
                    <div>{entities.length} total entities</div>
                    {highRisk.length > 0 && (
                        <div className="text-red-400 font-bold">{highRisk.length} high risk</div>
                    )}
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Persons', count: persons.length, color: 'border-blue-500', icon: '👤' },
                    { label: 'Locations', count: locations.length, color: 'border-green-500', icon: '📍' },
                    { label: 'High Risk', count: highRisk.length, color: 'border-red-500', icon: '🚨' },
                ].map(s => (
                    <div key={s.label} className={`bg-gray-800 border ${s.color} rounded-lg p-4 text-center`}>
                        <div className="text-2xl">{s.icon}</div>
                        <div className="text-2xl font-bold text-white mt-1">{s.count}</div>
                        <div className="text-gray-400 text-sm">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Search + Filter */}
            <div className="flex gap-3">
                <input
                    type="text"
                    placeholder="Search entities..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
                {['All', 'Person', 'Location'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Cards */}
            {isLoading ? (
                <div className="text-center py-16 text-gray-400">Loading entities...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    {entities.length === 0 ? 'No entities found. Upload audio to auto-detect.' : 'No results for this filter.'}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(entity => (
                        <EntityCard key={`${entity.type}-${entity.id}`} entity={entity} />
                    ))}
                </div>
            )}
        </div>
    );
}
