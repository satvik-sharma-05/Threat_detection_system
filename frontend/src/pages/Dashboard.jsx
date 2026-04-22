import React, { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const API_URL = 'http://localhost:8000';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => (n ?? 0).toFixed(1);
const ago = (iso) => {
    const d = new Date(iso);
    const s = Math.floor((Date.now() - d) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return d.toLocaleDateString();
};

const THREAT_PIE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#06b6d4', '#84cc16'];

// ── sub-components ────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = 'text-white', border = 'border-gray-700', onClick }) {
    return (
        <div
            onClick={onClick}
            className={`bg-gray-800 border ${border} rounded-xl p-5 flex flex-col gap-1 ${onClick ? 'cursor-pointer hover:brightness-110 transition' : ''}`}
        >
            <div className="flex items-center justify-between">
                <span className="text-2xl">{icon}</span>
                {sub && <span className="text-xs text-gray-500">{sub}</span>}
            </div>
            <div className={`text-3xl font-bold mt-1 ${color}`}>{value}</div>
            <div className="text-sm text-gray-400">{label}</div>
        </div>
    );
}

function SectionTitle({ children }) {
    return <h2 className="text-lg font-bold text-white border-b border-gray-700 pb-2 mb-4">{children}</h2>;
}

function ThreatBadge({ score }) {
    const level = score >= 90 ? 'Critical' : score >= 75 ? 'High' : score >= 50 ? 'Medium' : 'Low';
    const colors = { Critical: 'bg-red-900/50 text-red-300 border-red-600', High: 'bg-orange-900/50 text-orange-300 border-orange-600', Medium: 'bg-yellow-900/50 text-yellow-300 border-yellow-600', Low: 'bg-green-900/50 text-green-300 border-green-600' };
    return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[level]}`}>{level} {fmt(score)}</span>;
}

function MiniBar({ value, max, color }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
    );
}

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
            <p className="font-bold mb-1">{label}</p>
            {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>)}
        </div>
    );
};

// ── main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
    const navigate = useNavigate();
    const [alertFilter, setAlertFilter] = useState('all');

    const { data: stats, isLoading, refetch } = useQuery('dashboardStats', async () => {
        const r = await axios.get(`${API_URL}/dashboard/stats`);
        return r.data;
    }, { refetchInterval: 30000 });

    const { data: alertsData } = useQuery('recentAlerts', async () => {
        const r = await axios.get(`${API_URL}/alerts`);
        return r.data;
    }, { refetchInterval: 30000 });

    const { data: connData } = useQuery('connectionsCount', async () => {
        const r = await axios.get(`${API_URL}/connections`);
        return r.data;
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-400">
                <div className="text-center">
                    <div className="text-4xl mb-3 animate-pulse">🛡️</div>
                    <p>Loading dashboard...</p>
                </div>
            </div>
        );
    }

    const s = stats || {};
    const alerts = alertsData?.alerts || [];
    const filteredAlerts = alertFilter === 'all' ? alerts : alerts.filter(a => a.severity?.toLowerCase() === alertFilter);

    // Threat level donut data
    const threatLevels = [
        { name: 'Critical', value: s.threat_levels?.critical || 0, color: '#ef4444' },
        { name: 'High', value: s.threat_levels?.high || 0, color: '#f97316' },
        { name: 'Medium', value: s.threat_levels?.medium || 0, color: '#eab308' },
        { name: 'Low', value: s.threat_levels?.low || 0, color: '#22c55e' },
    ].filter(d => d.value > 0);

    const crimeData = (s.crime_breakdown || []).slice(0, 8);
    const rl = s.rate_limit || {};
    const rlColor = rl.usage_percent >= 90 ? '#ef4444' : rl.usage_percent >= 70 ? '#f97316' : '#22c55e';

    return (
        <div className="space-y-6 p-6 bg-gray-950 min-h-screen text-white">

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">🛡️ Threat Detection Dashboard</h1>
                    <p className="text-gray-400 text-sm mt-1">Real-time intelligence overview — auto-refreshes every 30s</p>
                </div>
                <button
                    onClick={() => refetch()}
                    className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition"
                >
                    ↻ Refresh
                </button>
            </div>

            {/* ── Top KPI row ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <StatCard icon="🎙️" label="Conversations" value={s.total_conversations ?? 0} color="text-blue-400" border="border-blue-800" onClick={() => navigate('/analysis-history')} />
                <StatCard icon="👤" label="Persons Detected" value={s.auto_detected_persons ?? 0} color="text-green-400" border="border-green-800" onClick={() => navigate('/entities')} />
                <StatCard icon="📍" label="Locations" value={s.auto_detected_locations ?? 0} color="text-teal-400" border="border-teal-800" onClick={() => navigate('/entities')} />
                <StatCard icon="🔗" label="Connections" value={s.auto_discovered_connections ?? 0} color="text-purple-400" border="border-purple-800" onClick={() => navigate('/connections')} />
                <StatCard icon="🚨" label="Active Alerts" value={s.auto_generated_alerts ?? 0} color="text-red-400" border="border-red-800" onClick={() => navigate('/alerts')} sub={s.critical_alerts > 0 ? `${s.critical_alerts} critical` : undefined} />
                <StatCard icon="📊" label="Avg Threat Score" value={fmt(s.avg_threat_score)} color="text-orange-400" border="border-orange-800" />
                <StatCard icon="🔥" label="Max Threat Score" value={fmt(s.max_threat_score)} color="text-red-400" border="border-red-800" />
            </div>

            {/* ── Row 2: Charts ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Threat level donut */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                    <SectionTitle>Threat Level Distribution</SectionTitle>
                    {threatLevels.length === 0 ? (
                        <div className="flex items-center justify-center h-40 text-gray-500 text-sm">No data yet</div>
                    ) : (
                        <>
                            <ResponsiveContainer width="100%" height={180}>
                                <PieChart>
                                    <Pie data={threatLevels} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                                        {threatLevels.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {threatLevels.map(t => (
                                    <div key={t.name} className="flex items-center gap-2 text-sm">
                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                                        <span className="text-gray-300">{t.name}</span>
                                        <span className="ml-auto font-bold text-white">{t.value}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Crime type bar chart */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 lg:col-span-2">
                    <SectionTitle>Crime Type Breakdown</SectionTitle>
                    {crimeData.length === 0 ? (
                        <div className="flex items-center justify-center h-40 text-gray-500 text-sm">No data yet</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={crimeData} margin={{ top: 0, right: 10, left: -20, bottom: 40 }}>
                                <XAxis dataKey="crime" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="count" name="Conversations" radius={[4, 4, 0, 0]}>
                                    {crimeData.map((_, i) => <Cell key={i} fill={THREAT_PIE_COLORS[i % THREAT_PIE_COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* ── Row 3: Recent convs + Top persons ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Recent conversations */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <SectionTitle>Recent Conversations</SectionTitle>
                        <button onClick={() => navigate('/analysis-history')} className="text-xs text-blue-400 hover:underline -mt-2">View all →</button>
                    </div>
                    {(s.recent_conversations || []).length === 0 ? (
                        <div className="text-gray-500 text-sm text-center py-8">No conversations yet. Upload audio to begin.</div>
                    ) : (
                        <div className="space-y-3">
                            {(s.recent_conversations || []).map(c => (
                                <div key={c.id} className="flex items-center justify-between gap-3 p-3 bg-gray-900 rounded-lg border border-gray-700 hover:border-gray-500 transition cursor-pointer" onClick={() => navigate('/analysis-history')}>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-white truncate">{c.filename}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{c.crime_type || 'Unknown'} · {ago(c.timestamp)}</p>
                                    </div>
                                    <ThreatBadge score={c.threat_score || 0} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Top persons */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <SectionTitle>Top Threat Persons</SectionTitle>
                        <button onClick={() => navigate('/entities')} className="text-xs text-blue-400 hover:underline -mt-2">View all →</button>
                    </div>
                    {(s.top_persons || []).length === 0 ? (
                        <div className="text-gray-500 text-sm text-center py-8">No persons detected yet.</div>
                    ) : (
                        <div className="space-y-3">
                            {(s.top_persons || []).map((p, i) => (
                                <div key={i} className="p-3 bg-gray-900 rounded-lg border border-gray-700">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-500 text-xs w-4">{i + 1}.</span>
                                            <span className="text-white font-medium text-sm">👤 {p.name}</span>
                                        </div>
                                        <ThreatBadge score={p.threat_score || 0} />
                                    </div>
                                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                        <span>Crime: <strong className="text-orange-300">{p.crime_type || 'Unknown'}</strong></span>
                                        <span>Mentions: <strong className="text-white">{p.mentions}</strong></span>
                                    </div>
                                    <MiniBar value={p.threat_score || 0} max={100} color={p.threat_score >= 75 ? '#ef4444' : '#f97316'} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Row 4: Alerts + System status ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Alerts panel */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <SectionTitle>Active Alerts</SectionTitle>
                        <div className="flex items-center gap-2 -mt-2">
                            {['all', 'critical', 'high'].map(f => (
                                <button key={f} onClick={() => setAlertFilter(f)}
                                    className={`px-2 py-0.5 rounded text-xs capitalize transition ${alertFilter === f ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                                    {f}
                                </button>
                            ))}
                            <button onClick={() => navigate('/alerts')} className="text-xs text-blue-400 hover:underline ml-2">View all →</button>
                        </div>
                    </div>
                    {filteredAlerts.length === 0 ? (
                        <div className="text-gray-500 text-sm text-center py-8">No alerts. System is monitoring.</div>
                    ) : (
                        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                            {filteredAlerts.slice(0, 8).map(alert => (
                                <div key={alert.id} className={`p-4 rounded-lg border cursor-pointer hover:brightness-110 transition ${alert.severity === 'Critical' ? 'bg-red-900/20 border-red-700' :
                                    alert.severity === 'High' ? 'bg-orange-900/20 border-orange-700' :
                                        'bg-yellow-900/20 border-yellow-700'
                                    }`} onClick={() => navigate('/alerts')}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${alert.severity === 'Critical' ? 'bg-red-600 text-white' :
                                                    alert.severity === 'High' ? 'bg-orange-600 text-white' :
                                                        'bg-yellow-600 text-black'
                                                    }`}>{alert.severity}</span>
                                                <span className="text-sm font-semibold text-white truncate">{alert.crime_type || 'Unknown Threat'}</span>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1 truncate">
                                                📁 {alert.source_audio?.filename || 'Unknown file'}
                                            </p>
                                            {alert.evidence?.length > 0 && (
                                                <p className="text-xs text-gray-500 mt-1 truncate">• {alert.evidence[0]}</p>
                                            )}
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-lg font-bold text-white">{fmt(alert.score)}</div>
                                            <div className="text-xs text-gray-500">{ago(alert.created_at)}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* System status + rate limit */}
                <div className="space-y-4">

                    {/* System status */}
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                        <SectionTitle>System Status</SectionTitle>
                        <div className="space-y-2.5">
                            {[
                                { label: 'Transcription (Whisper)', status: true },
                                { label: 'Threat Analysis (LLM)', status: true },
                                { label: 'Semantic Connector', status: true },
                                { label: 'Entity Extraction', status: true },
                                { label: 'Connection Discovery', status: true },
                                { label: 'File Watcher', status: false, note: 'disabled (prevents duplicates)' },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.status ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                    <span className="text-gray-300 flex-1">{item.label}</span>
                                    {item.note && <span className="text-xs text-gray-600">{item.note}</span>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Rate limit */}
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                        <SectionTitle>API Usage Today</SectionTitle>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-400">Tokens Used</span>
                                    <span className="font-bold" style={{ color: rlColor }}>
                                        {(rl.tokens_used || 0).toLocaleString()} / {(rl.tokens_limit || 95000).toLocaleString()}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2.5">
                                    <div className="h-2.5 rounded-full transition-all" style={{ width: `${Math.min(100, rl.usage_percent || 0)}%`, backgroundColor: rlColor }} />
                                </div>
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>{(rl.usage_percent || 0).toFixed(1)}% used</span>
                                    <span>{(rl.tokens_remaining || 0).toLocaleString()} remaining</span>
                                </div>
                            </div>
                            <div className={`text-xs px-3 py-2 rounded-lg border ${rl.status === 'OK' ? 'bg-green-900/20 border-green-700 text-green-300' :
                                rl.status === 'WARNING' ? 'bg-yellow-900/20 border-yellow-700 text-yellow-300' :
                                    'bg-red-900/20 border-red-700 text-red-300'
                                }`}>
                                {rl.status === 'OK' ? '✅ Operating normally' :
                                    rl.status === 'WARNING' ? '⚠️ Approaching daily limit' :
                                        '❌ Daily limit reached — resets at midnight'}
                            </div>
                            {/* Models */}
                            <div className="pt-1 space-y-1">
                                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Active Models</p>
                                {s.models && Object.entries(s.models).filter(([k]) => k !== 'strategy').map(([k, v]) => (
                                    <div key={k} className="flex justify-between text-xs">
                                        <span className="text-gray-500 capitalize">{k.replace('_', ' ')}</span>
                                        <span className="text-gray-300 font-mono">{v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Row 5: Connections summary ── */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <SectionTitle>Connection Intelligence</SectionTitle>
                    <button onClick={() => navigate('/connections')} className="text-xs text-blue-400 hover:underline -mt-2">Open Graph →</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { icon: '🔗', label: 'Total Connections', value: s.auto_discovered_connections ?? 0, color: 'text-purple-400' },
                        { icon: '🎙️', label: 'Conv-to-Conv Links', value: s.conversation_connections ?? 0, color: 'text-amber-400' },
                        { icon: '👥', label: 'Person Relations', value: (s.auto_discovered_connections ?? 0) - (s.conversation_connections ?? 0), color: 'text-blue-400' },
                        { icon: '🧠', label: 'Semantic Matches', value: connData?.connections?.filter(c => c.type === 'conversation_connection').length ?? 0, color: 'text-cyan-400' },
                    ].map((item, i) => (
                        <div key={i} className="bg-gray-900 rounded-lg p-4 border border-gray-700 text-center">
                            <div className="text-2xl mb-1">{item.icon}</div>
                            <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                            <div className="text-xs text-gray-400 mt-1">{item.label}</div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}
