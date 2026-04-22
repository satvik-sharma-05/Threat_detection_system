import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import ForceGraph2D from 'react-force-graph-2d';

const API_URL = 'http://localhost:8000';

const NODE_COLORS = {
    person: '#3b82f6',
    location: '#22c55e',
    conversation: '#f59e0b',
    crime: '#ef4444',
    weapon: '#dc2626',
    organization: '#a855f7',
    code_word: '#06b6d4',
};

const NODE_ICONS = {
    person: '👤',
    location: '📍',
    conversation: '🎙️',
    crime: '⚠️',
    weapon: '🔫',
    organization: '🏢',
    code_word: '🔑',
};

const NODE_RADIUS = {
    conversation: 12,
    person: 9,
    crime: 8,
    weapon: 7,
    location: 7,
    organization: 7,
    code_word: 6,
};

// ─── Threat taxonomy ────────────────────────────────────────────────────────
const THREAT_TAXONOMY = [
    {
        category: 'Terrorism & Extremism',
        color: '#ef4444',
        icon: '💣',
        threats: [
            'Bomb making / IED construction',
            'Suicide bombing planning',
            'Mass casualty attack planning',
            'Recruitment for extremist groups',
            'Radicalization / incitement',
            'Financing of terrorism',
            'Propaganda distribution',
            'Targeting of critical infrastructure',
        ],
    },
    {
        category: 'Weapons Trafficking',
        color: '#dc2626',
        icon: '🔫',
        threats: [
            'Illegal arms trade',
            'Smuggling of firearms',
            'Explosives trafficking',
            'Ammunition supply chains',
            'Weapons cache coordination',
            'Cross-border arms movement',
        ],
    },
    {
        category: 'Drug Operations',
        color: '#7c3aed',
        icon: '💊',
        threats: [
            'Drug manufacturing / labs',
            'Narcotics distribution network',
            'Drug smuggling routes',
            'Money laundering from drugs',
            'Cartel coordination',
            'Synthetic drug production',
        ],
    },
    {
        category: 'Kidnapping & Extortion',
        color: '#f97316',
        icon: '🔒',
        threats: [
            'Kidnapping for ransom',
            'Hostage negotiation',
            'Child abduction',
            'Extortion threats',
            'Human trafficking',
            'Forced labor coordination',
        ],
    },
    {
        category: 'Cybercrime',
        color: '#06b6d4',
        icon: '💻',
        threats: [
            'Ransomware deployment',
            'Data breach planning',
            'Phishing campaign coordination',
            'Critical infrastructure hacking',
            'Financial fraud / scams',
            'Identity theft operations',
        ],
    },
    {
        category: 'Financial Crime',
        color: '#eab308',
        icon: '💰',
        threats: [
            'Money laundering',
            'Hawala / informal transfers',
            'Cryptocurrency fraud',
            'Bank fraud coordination',
            'Corruption / bribery',
            'Tax evasion schemes',
        ],
    },
    {
        category: 'Organized Crime',
        color: '#84cc16',
        icon: '🕵️',
        threats: [
            'Gang coordination',
            'Contract killing / hitman',
            'Protection racket',
            'Robbery planning',
            'Carjacking coordination',
            'Smuggling of contraband',
        ],
    },
    {
        category: 'Political Violence',
        color: '#f43f5e',
        icon: '🏛️',
        threats: [
            'Assassination planning',
            'Coup / overthrow planning',
            'Election interference',
            'Targeted harassment campaigns',
            'Incitement to riot',
            'Sabotage of government assets',
        ],
    },
];

// ─── Graph builder ───────────────────────────────────────────────────────────
function buildGraphData(connections, conversations) {
    const nodesMap = new Map();
    const links = [];

    const addNode = (id, label, type, meta = {}) => {
        if (!nodesMap.has(id)) nodesMap.set(id, { id, label, type, ...meta });
    };

    (conversations || []).forEach(conv => {
        const convId = `conv_${conv.id}`;
        const filename = (conv.audio_file_path || '')
            .split('/').pop().split('\\').pop() || `Conv #${conv.id}`;
        addNode(convId, filename, 'conversation', {
            threat_score: conv.threat_score,
            crime_type: conv.crime_type,
            conv_id: conv.id,
        });

        if (conv.crime_type && conv.crime_type !== 'Unknown') {
            const crimeId = `crime_${conv.crime_type.toLowerCase().replace(/\s+/g, '_')}`;
            addNode(crimeId, conv.crime_type, 'crime');
            links.push({ source: convId, target: crimeId, label: 'crime type', strength: 50 });
        }

        (conv.persons || []).forEach(p => {
            const pid = `person_${p.id}`;
            addNode(pid, p.name, 'person', { threat_score: p.threat_score });
            links.push({ source: pid, target: convId, label: 'speaks in', strength: 70 });
        });

        const ent = conv.extracted_entities || {};
        (ent.locations || []).forEach(loc => {
            const name = typeof loc === 'string' ? loc : (loc.name || '');
            if (!name) return;
            const lid = `loc_${name.toLowerCase().replace(/\s+/g, '_')}`;
            addNode(lid, name, 'location');
            links.push({ source: convId, target: lid, label: 'location', strength: 40 });
        });
        (ent.organizations || []).forEach(org => {
            const name = typeof org === 'string' ? org : (org.name || '');
            if (!name) return;
            const oid = `org_${name.toLowerCase().replace(/\s+/g, '_')}`;
            addNode(oid, name, 'organization');
            links.push({ source: convId, target: oid, label: 'organization', strength: 40 });
        });
        (ent.weapons || []).forEach(w => {
            const name = typeof w === 'string' ? w : (w.type || '');
            if (!name) return;
            const wid = `weapon_${name.toLowerCase().replace(/\s+/g, '_')}`;
            addNode(wid, name, 'weapon');
            links.push({ source: convId, target: wid, label: 'weapon', strength: 60 });
        });
        const sem = ent.semantic_features || {};
        (sem.code_words || []).forEach(cw => {
            const term = typeof cw === 'string' ? cw : (cw.term || '');
            if (!term) return;
            const cwid = `cw_${term.toLowerCase().replace(/\s+/g, '_')}`;
            addNode(cwid, `"${term}"`, 'code_word', { meaning: cw.likely_meaning });
            links.push({ source: convId, target: cwid, label: 'code word', strength: 55 });
        });
    });

    (connections || []).forEach(conn => {
        if (conn.type === 'conversation_connection' && conn.conversation_a && conn.conversation_b) {
            const aId = `conv_${conn.conversation_a.id}`;
            const bId = `conv_${conn.conversation_b.id}`;
            addNode(aId, conn.conversation_a.filename || `Conv #${conn.conversation_a.id}`, 'conversation', {
                threat_score: conn.conversation_a.threat_score,
                crime_type: conn.conversation_a.crime_type,
                conv_id: conn.conversation_a.id,
            });
            addNode(bId, conn.conversation_b.filename || `Conv #${conn.conversation_b.id}`, 'conversation', {
                threat_score: conn.conversation_b.threat_score,
                crime_type: conn.conversation_b.crime_type,
                conv_id: conn.conversation_b.id,
            });
            links.push({
                source: aId, target: bId,
                label: `Connected (${conn.strength}%)`,
                strength: conn.strength,
                evidence: conn.evidence,
                isSemanticLink: true,
            });
        }
        if (conn.type === 'person_relationship' && conn.person_a && conn.person_b) {
            const aId = `person_${conn.person_a.id}`;
            const bId = `person_${conn.person_b.id}`;
            addNode(aId, conn.person_a.name, 'person');
            addNode(bId, conn.person_b.name, 'person');
            links.push({
                source: aId, target: bId,
                label: conn.connection_type || 'related',
                strength: conn.strength,
                evidence: conn.common_terms,
                isSemanticLink: true,
            });
        }
    });

    return { nodes: Array.from(nodesMap.values()), links };
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function LegendItem({ color, label }) {
    return (
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-300 capitalize">{label.replace('_', ' ')}</span>
        </div>
    );
}

function Row({ label, value, highlight }) {
    return (
        <div className="flex justify-between gap-3">
            <span className="text-gray-400 text-xs flex-shrink-0">{label}</span>
            <span className={`text-xs font-medium text-right ${highlight ? 'text-red-400' : 'text-white'}`}>{value}</span>
        </div>
    );
}

function DetailPanel({ selected, onClose }) {
    if (!selected) return null;
    const isLink = selected._isLink;
    return (
        <div className="absolute top-4 right-4 w-72 bg-gray-900 border border-gray-600 rounded-xl shadow-2xl z-20 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                <span className="font-bold text-white text-sm">
                    {isLink ? '🔗 Connection' : `${NODE_ICONS[selected.type] || '●'} ${(selected.type || '').toUpperCase()}`}
                </span>
                <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                {isLink ? (
                    <>
                        <Row label="From" value={selected.source?.label || selected.source} />
                        <Row label="To" value={selected.target?.label || selected.target} />
                        <Row label="Relationship" value={selected.label} />
                        <Row label="Strength" value={`${selected.strength || 0}%`} highlight={(selected.strength || 0) >= 70} />
                        {selected.evidence && (
                            <div className="pt-2">
                                <p className="text-gray-400 text-xs mb-1">Evidence:</p>
                                <ul className="space-y-1">
                                    {(Array.isArray(selected.evidence) ? selected.evidence : [selected.evidence]).map((ev, i) => (
                                        <li key={i} className="text-gray-200 text-xs bg-gray-800 rounded p-2">• {ev}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <Row label="Name" value={selected.label} />
                        <Row label="Type" value={selected.type} />
                        {selected.threat_score !== undefined && (
                            <Row label="Threat Score" value={(selected.threat_score || 0).toFixed(1)} highlight={(selected.threat_score || 0) >= 75} />
                        )}
                        {selected.crime_type && <Row label="Crime Type" value={selected.crime_type} />}
                        {selected.meaning && <Row label="Likely Meaning" value={selected.meaning} />}
                        <div className="pt-2 text-xs text-gray-500 italic">
                            {selected.type === 'person' ? 'Drag to reposition. Node stays pinned.' :
                                selected.type === 'conversation' ? 'Audio file node. Drag freely.' :
                                    'Drag to reposition anywhere.'}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function ThreatTaxonomyPanel({ onClose }) {
    const [expanded, setExpanded] = useState(null);
    return (
        <div className="absolute top-4 left-4 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-20 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 flex-shrink-0">
                <span className="font-bold text-white text-sm">🎯 Threat Taxonomy</span>
                <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto flex-1">
                <div className="p-2 text-xs text-gray-400 px-4 pt-3 pb-1">
                    All threat types the system can detect from audio conversations:
                </div>
                {THREAT_TAXONOMY.map((cat, i) => (
                    <div key={i} className="border-b border-gray-800 last:border-0">
                        <button
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition text-left"
                            onClick={() => setExpanded(expanded === i ? null : i)}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-base">{cat.icon}</span>
                                <span className="text-sm font-semibold text-white">{cat.category}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{cat.threats.length}</span>
                                <span className="text-gray-400 text-xs">{expanded === i ? '▲' : '▼'}</span>
                            </div>
                        </button>
                        {expanded === i && (
                            <div className="px-4 pb-3 space-y-1">
                                {cat.threats.map((t, j) => (
                                    <div key={j} className="flex items-start gap-2 text-xs text-gray-300 py-0.5">
                                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: cat.color }} />
                                        {t}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                <div className="px-4 py-3 bg-gray-800/50 text-xs text-gray-400">
                    <strong className="text-white">Total:</strong> {THREAT_TAXONOMY.reduce((s, c) => s + c.threats.length, 0)} specific threat patterns across {THREAT_TAXONOMY.length} categories
                </div>
            </div>
        </div>
    );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function Connections() {
    const graphRef = useRef();
    const containerRef = useRef();
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [selected, setSelected] = useState(null);
    const [hoveredNode, setHoveredNode] = useState(null);
    const [filterType, setFilterType] = useState('All');
    const [showTaxonomy, setShowTaxonomy] = useState(false);

    const { data: connData, isLoading: connLoading } = useQuery('connections', async () => {
        const res = await axios.get(`${API_URL}/connections`);
        return res.data;
    });

    const { data: convData, isLoading: convLoading } = useQuery('conversations_graph', async () => {
        const res = await axios.get(`${API_URL}/conversations`);
        return res.data;
    });

    useEffect(() => {
        const measure = () => {
            if (containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                setDimensions({ width, height: Math.max(500, height) });
            }
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);

    const rawGraph = useMemo(
        () => buildGraphData(connData?.connections || [], convData?.conversations || []),
        [connData, convData]
    );

    const graphData = useMemo(() => {
        if (filterType === 'All') return rawGraph;
        const typeMap = {
            Persons: ['person', 'conversation'],
            Locations: ['location', 'conversation'],
            Crimes: ['crime', 'conversation'],
            'Code Words': ['code_word', 'conversation'],
            Weapons: ['weapon', 'conversation'],
        };
        const allowed = new Set((typeMap[filterType] || []).flatMap(t =>
            rawGraph.nodes.filter(n => n.type === t).map(n => n.id)
        ));
        return {
            nodes: rawGraph.nodes.filter(n => allowed.has(n.id)),
            links: rawGraph.links.filter(l => {
                const s = typeof l.source === 'object' ? l.source.id : l.source;
                const t = typeof l.target === 'object' ? l.target.id : l.target;
                return allowed.has(s) && allowed.has(t);
            }),
        };
    }, [rawGraph, filterType]);

    // ── Drag: pin node after drag (like Neo4j) ──────────────────────────────
    const handleNodeDragEnd = useCallback(node => {
        // Fix position so physics doesn't pull it back
        node.fx = node.x;
        node.fy = node.y;
    }, []);

    // Double-click to unpin
    const handleNodeDoubleClick = useCallback(node => {
        node.fx = undefined;
        node.fy = undefined;
    }, []);

    const handleNodeClick = useCallback(node => {
        setSelected(node);
    }, []);

    const handleLinkClick = useCallback(link => {
        setSelected({ ...link, _isLink: true });
    }, []);

    // ── Custom node drawing ─────────────────────────────────────────────────
    const drawNode = useCallback((node, ctx, globalScale) => {
        const color = NODE_COLORS[node.type] || '#888';
        const r = NODE_RADIUS[node.type] || 7;
        const isPinned = node.fx !== undefined;

        // Red glow for high-threat
        if ((node.threat_score || 0) >= 75) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 5, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(239,68,68,0.2)';
            ctx.fill();
        }

        // Hover ring
        if (hoveredNode?.id === node.id) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fill();
        }

        // Main circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();

        // Selection ring
        if (selected?.id === node.id) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2.5;
            ctx.stroke();
        }

        // Pin indicator (small dot at top-right when pinned)
        if (isPinned) {
            ctx.beginPath();
            ctx.arc(node.x + r * 0.7, node.y - r * 0.7, 2.5, 0, 2 * Math.PI);
            ctx.fillStyle = '#fbbf24';
            ctx.fill();
        }

        // Label
        const fontSize = Math.max(7, 10 / globalScale);
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        const label = node.label.length > 20 ? node.label.slice(0, 18) + '…' : node.label;
        ctx.fillText(label, node.x, node.y + r + 2);
    }, [hoveredNode, selected]);

    const isLoading = connLoading || convLoading;
    const totalNodes = graphData.nodes.length;
    const totalLinks = graphData.links.length;
    const semanticLinks = graphData.links.filter(l => l.isSemanticLink).length;

    return (
        <div className="flex flex-col bg-gray-950 text-white" style={{ height: '100vh' }}>
            {/* Top bar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold">Knowledge Graph</h1>
                    <p className="text-gray-400 text-xs mt-0.5">
                        Drag nodes freely • Double-click to unpin • Click to inspect
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-5 text-sm">
                        {[
                            { label: 'Nodes', value: totalNodes, color: 'text-blue-400' },
                            { label: 'Edges', value: totalLinks, color: 'text-amber-400' },
                            { label: 'Semantic', value: semanticLinks, color: 'text-green-400' },
                        ].map(s => (
                            <div key={s.label} className="text-center">
                                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                                <div className="text-gray-500 text-xs">{s.label}</div>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => setShowTaxonomy(v => !v)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${showTaxonomy
                                ? 'bg-red-900/40 border-red-500 text-red-300'
                                : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400'
                            }`}
                    >
                        🎯 Threat Types
                    </button>
                </div>
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-2 px-6 py-2 border-b border-gray-800 flex-shrink-0 bg-gray-900/50">
                <span className="text-gray-500 text-xs mr-1">Filter:</span>
                {['All', 'Persons', 'Locations', 'Crimes', 'Weapons', 'Code Words'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilterType(f)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition ${filterType === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        {f}
                    </button>
                ))}
                <div className="ml-auto flex items-center gap-3 text-xs text-gray-600">
                    <span>🟡 = pinned node</span>
                    <span>🔴 glow = high threat</span>
                </div>
            </div>

            {/* Graph area */}
            <div className="flex-1 relative overflow-hidden">
                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-gray-900/90 border border-gray-700 rounded-xl p-3 z-10 space-y-1.5 pointer-events-none">
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Node Types</p>
                    {Object.entries(NODE_COLORS).map(([type, color]) => (
                        <LegendItem key={type} color={color} label={type} />
                    ))}
                    <div className="border-t border-gray-700 pt-2 mt-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-0.5 bg-orange-400" />
                            <span className="text-xs text-gray-400">Semantic link</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-0.5 bg-gray-600" />
                            <span className="text-xs text-gray-400">Entity link</span>
                        </div>
                    </div>
                </div>

                {/* Taxonomy panel */}
                {showTaxonomy && <ThreatTaxonomyPanel onClose={() => setShowTaxonomy(false)} />}

                {/* Detail panel */}
                {!showTaxonomy && <DetailPanel selected={selected} onClose={() => setSelected(null)} />}

                {/* Graph canvas */}
                <div ref={containerRef} className="w-full h-full">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            <div className="text-center">
                                <div className="text-4xl mb-3 animate-spin">⚙️</div>
                                <p>Building knowledge graph...</p>
                            </div>
                        </div>
                    ) : totalNodes === 0 ? (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            <div className="text-center space-y-3">
                                <div className="text-6xl">🕸️</div>
                                <p className="text-xl font-semibold">No graph data yet</p>
                                <p className="text-sm">Upload conversations to build the knowledge graph</p>
                            </div>
                        </div>
                    ) : (
                        <ForceGraph2D
                            ref={graphRef}
                            graphData={graphData}
                            width={dimensions.width}
                            height={dimensions.height}
                            backgroundColor="#030712"
                            // Node rendering
                            nodeCanvasObject={drawNode}
                            nodeCanvasObjectMode={() => 'replace'}
                            nodeLabel={node =>
                                `${NODE_ICONS[node.type] || ''} ${node.label}` +
                                (node.crime_type ? `\nCrime: ${node.crime_type}` : '') +
                                (node.threat_score !== undefined ? `\nThreat: ${(node.threat_score || 0).toFixed(0)}` : '') +
                                (node.meaning ? `\nMeaning: ${node.meaning}` : '') +
                                (node.fx !== undefined ? '\n📌 Pinned (double-click to unpin)' : '')
                            }
                            // Link rendering
                            linkColor={link => link.isSemanticLink ? '#f97316' : 'rgba(100,116,139,0.5)'}
                            linkWidth={link => link.isSemanticLink ? Math.max(1.5, (link.strength || 50) / 30) : 1}
                            linkDirectionalArrowLength={link => link.isSemanticLink ? 6 : 3}
                            linkDirectionalArrowRelPos={1}
                            linkLabel={link => link.label || ''}
                            linkCurvature={link => link.isSemanticLink ? 0.25 : 0}
                            // Interaction
                            onNodeClick={handleNodeClick}
                            onNodeDblClick={handleNodeDoubleClick}
                            onNodeDragEnd={handleNodeDragEnd}
                            onLinkClick={handleLinkClick}
                            onNodeHover={setHoveredNode}
                            // Physics
                            cooldownTicks={150}
                            d3AlphaDecay={0.015}
                            d3VelocityDecay={0.25}
                            nodeRelSize={1}
                            // Enable drag
                            enableNodeDrag={true}
                            enableZoomInteraction={true}
                            enablePanInteraction={true}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
