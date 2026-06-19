import { useAppStore } from '@/store/useAppStore';
import { attributionTypeColors, attributionTypeLabels } from '@/data/seedData';
import { useState, useEffect } from 'react';

export default function PathGraph() {
  const { graph, selectedNodeId, selectNode } = useAppStore();
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const vbW = 640;
  const vbH = 360;

  const getNodeRadius = (errorCount: number) => {
    return 26 + Math.min(errorCount, 5) * 5;
  };

  return (
    <div className="paper-card p-6 relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-serif text-lg font-semibold text-ink-800">
            知识路径图
          </h2>
          <p className="text-xs text-ink-500 mt-0.5">
            点击节点可查看对应错题明细
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          {Object.entries(attributionTypeLabels).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: attributionTypeColors[key] }}
              />
              <span className="text-ink-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative bg-paper-50/50 rounded-lg border border-paper-200/50">
        <svg
          viewBox={`0 0 ${vbW} ${vbH}`}
          className="w-full h-auto"
          style={{ maxHeight: '340px' }}
        >
          <defs>
            <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <marker
              id="arrow"
              markerWidth="9"
              markerHeight="7"
              refX="8.5"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 9 3.5, 0 7" fill="#93B4BE" />
            </marker>
            <marker
              id="arrowActive"
              markerWidth="9"
              markerHeight="7"
              refX="8.5"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 9 3.5, 0 7" fill="#0F4C5C" />
            </marker>
          </defs>

          {graph.edges.map((edge, idx) => {
            const from = graph.nodes.find((n) => n.id === edge.from);
            const to = graph.nodes.find((n) => n.id === edge.to);
            if (!from || !to) return null;

            const isActive = selectedNodeId === edge.from || selectedNodeId === edge.to;
            const r1 = getNodeRadius(from.errorCount);
            const r2 = getNodeRadius(to.errorCount);

            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) return null;

            const x1 = from.x + (dx / dist) * r1;
            const y1 = from.y + (dy / dist) * r1;
            const x2 = to.x - (dx / dist) * (r2 + 6);
            const y2 = to.y - (dy / dist) * (r2 + 6);

            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2 - 5;

            const opacity = visible ? (isActive ? 1 : 0.55) : 0;
            const stroke = isActive ? '#0F4C5C' : '#93B4BE';
            const sw = isActive ? 2 : 1.5;
            const delay = idx * 70;

            return (
              <g key={edge.id}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={stroke}
                  strokeWidth={sw}
                  strokeOpacity={opacity}
                  markerEnd={isActive ? 'url(#arrowActive)' : 'url(#arrow)'}
                  style={{
                    transition: 'all 0.35s ease',
                    transitionDelay: `${delay}ms`,
                  }}
                />
                {edge.label && (
                  <text
                    x={mx}
                    y={my}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#5E8B99"
                    fillOpacity={visible ? 0.8 : 0}
                    style={{
                      transition: 'fill-opacity 0.3s ease',
                      transitionDelay: `${delay + 150}ms`,
                      userSelect: 'none',
                    }}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {graph.nodes.map((node, idx) => {
            const isSelected = selectedNodeId === node.id;
            const isHovered = hoveredNodeId === node.id;
            const r = getNodeRadius(node.errorCount);
            const color = attributionTypeColors[node.attributionType];
            const opacity = visible ? 1 : 0;
            const delay = 200 + idx * 80;

            const ringR = isSelected ? r + 12 : isHovered ? r + 6 : r;
            const ringOpacity = isSelected ? 0.5 : isHovered ? 0.15 : 0;

            return (
              <g
                key={node.id}
                style={{
                  cursor: 'pointer',
                  opacity,
                  transition: 'opacity 0.4s ease',
                  transitionDelay: `${delay}ms`,
                }}
                onClick={() => selectNode(isSelected ? null : node.id)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={ringR}
                  fill={isHovered && !isSelected ? color : 'none'}
                  stroke={isSelected ? color : 'none'}
                  strokeWidth={isSelected ? 2 : 0}
                  strokeDasharray={isSelected ? '4 4' : '0'}
                  fillOpacity={ringOpacity}
                  style={{ transition: 'all 0.25s ease' }}
                />

                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r}
                  fill={color}
                  fillOpacity={isSelected ? 1 : 0.88}
                  stroke="white"
                  strokeWidth={3}
                  filter={isSelected ? 'url(#nodeGlow)' : undefined}
                  style={{ transition: 'all 0.25s ease' }}
                />

                <text
                  x={node.x}
                  y={node.y - 2}
                  textAnchor="middle"
                  fill="white"
                  fontSize="12"
                  fontWeight="600"
                  style={{
                    userSelect: 'none',
                    pointerEvents: 'none',
                    textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                    transition: 'all 0.25s ease',
                  }}
                >
                  {node.name}
                </text>

                <text
                  x={node.x}
                  y={node.y + 14}
                  textAnchor="middle"
                  fill="white"
                  fontSize="10"
                  fillOpacity={0.9}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {node.errorCount} 条
                </text>

                <text
                  x={node.x}
                  y={node.y + r + 16}
                  textAnchor="middle"
                  fill="#3C6B7A"
                  fontSize="9"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {node.category}
                </text>
              </g>
            );
          })}
        </svg>

        {selectedNodeId && (
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-md px-3 py-1.5 text-xs text-ink-700 shadow-sm border border-paper-200 animate-fade-in">
            已选中：
            <span className="font-medium">
              {graph.nodes.find((n) => n.id === selectedNodeId)?.name}
            </span>
            <button
              onClick={() => selectNode(null)}
              className="ml-2 text-ink-400 hover:text-ink-600"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
