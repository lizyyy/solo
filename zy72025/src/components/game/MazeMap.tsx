import { useMemo } from 'react';
import type { Level, LevelNode } from '@/types';
import { Play, Flag, CircleDot } from 'lucide-react';

interface MazeMapProps {
  level: Level;
  currentNodeId: string;
  visitedNodeIds: string[];
  highlightNodeId?: string | null;
  onNodeClick?: (nodeId: string) => void;
}

export function MazeMap({
  level,
  currentNodeId,
  visitedNodeIds,
  highlightNodeId,
  onNodeClick,
}: MazeMapProps) {
  const viewBox = useMemo(() => {
    const padding = 60;
    const positions = level.nodes.map((n) => n.position);
    const minX = Math.min(...positions.map((p) => p.x)) - padding;
    const maxX = Math.max(...positions.map((p) => p.x)) + padding;
    const minY = Math.min(...positions.map((p) => p.y)) - padding;
    const maxY = Math.max(...positions.map((p) => p.y)) + padding;
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  }, [level]);

  const getNodeColor = (node: LevelNode) => {
    if (node.id === currentNodeId || node.id === highlightNodeId) {
      return '#d4af37';
    }
    if (visitedNodeIds.includes(node.id)) {
      return '#2d5f9e';
    }
    return '#475569';
  };

  const getNodeStrokeColor = (node: LevelNode) => {
    if (node.id === currentNodeId || node.id === highlightNodeId) {
      return '#f4df95';
    }
    if (visitedNodeIds.includes(node.id)) {
      return '#4d80b8';
    }
    return '#64748b';
  };

  const isPathVisited = (from: string, to: string) => {
    const fromVisited = visitedNodeIds.includes(from);
    const toVisited = visitedNodeIds.includes(to);
    return fromVisited && toVisited;
  };

  return (
    <div className="card h-full flex flex-col">
      <h3 className="text-lg font-bold text-accent-400 mb-4">利率迷宫地图</h3>
      
      <div className="flex-1 min-h-[300px] relative">
        <svg
          viewBox={viewBox}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2d5f9e" />
              <stop offset="100%" stopColor="#d4af37" />
            </linearGradient>
          </defs>

          {level.paths.map((path, index) => {
            const fromNode = level.nodes.find((n) => n.id === path.from);
            const toNode = level.nodes.find((n) => n.id === path.to);
            if (!fromNode || !toNode) return null;

            const isVisited = isPathVisited(path.from, path.to);
            const midX = (fromNode.position.x + toNode.position.x) / 2;
            const midY = (fromNode.position.y + toNode.position.y) / 2;

            return (
              <g key={`path-${index}`}>
                <line
                  x1={fromNode.position.x}
                  y1={fromNode.position.y}
                  x2={toNode.position.x}
                  y2={toNode.position.y}
                  stroke={isVisited ? 'url(#pathGradient)' : '#334155'}
                  strokeWidth={isVisited ? 3 : 2}
                  strokeDasharray={isVisited ? 'none' : '5,5'}
                  opacity={isVisited ? 1 : 0.5}
                />
                
                <text
                  x={midX}
                  y={midY - 8}
                  textAnchor="middle"
                  fill={isVisited ? '#94a3b8' : '#64748b'}
                  fontSize="10"
                  className="select-none pointer-events-none"
                >
                  {path.decisions.length} 选项
                </text>
              </g>
            );
          })}

          {level.nodes.map((node) => {
            const isCurrent = node.id === currentNodeId || node.id === highlightNodeId;
            const isVisited = visitedNodeIds.includes(node.id);
            const radius = node.type === 'start' || node.type === 'end' ? 28 : 24;

            return (
              <g
                key={node.id}
                onClick={() => onNodeClick?.(node.id)}
                className={`cursor-pointer transition-all duration-300 ${isCurrent ? 'animate-pulse-slow' : ''}`}
                style={{
                  filter: isCurrent ? 'url(#glow)' : undefined,
                }}
              >
                <circle
                  cx={node.position.x}
                  cy={node.position.y}
                  r={radius + 4}
                  fill="transparent"
                  stroke={getNodeStrokeColor(node)}
                  strokeWidth={2}
                  opacity={isCurrent ? 1 : isVisited ? 0.7 : 0.3}
                />
                
                <circle
                  cx={node.position.x}
                  cy={node.position.y}
                  r={radius}
                  fill={getNodeColor(node)}
                  stroke={getNodeStrokeColor(node)}
                  strokeWidth={isCurrent ? 3 : 2}
                  opacity={isVisited ? 1 : 0.6}
                />
                
                {node.type === 'start' && (
                  <foreignObject
                    x={node.position.x - 10}
                    y={node.position.y - 10}
                    width="20"
                    height="20"
                  >
                    <Play className="w-5 h-5 text-white fill-white" />
                  </foreignObject>
                )}
                
                {node.type === 'end' && (
                  <foreignObject
                    x={node.position.x - 10}
                    y={node.position.y - 10}
                    width="20"
                    height="20"
                  >
                    <Flag className="w-5 h-5 text-white fill-white" />
                  </foreignObject>
                )}
                
                {node.type === 'decision' && isCurrent && (
                  <foreignObject
                    x={node.position.x - 10}
                    y={node.position.y - 10}
                    width="20"
                    height="20"
                  >
                    <CircleDot className="w-5 h-5 text-white fill-white" />
                  </foreignObject>
                )}
                
                <text
                  x={node.position.x}
                  y={node.position.y + radius + 16}
                  textAnchor="middle"
                  fill={isCurrent ? '#f4df95' : isVisited ? '#e2e8f0' : '#94a3b8'}
                  fontSize="12"
                  fontWeight={isCurrent ? 600 : 400}
                  className="select-none pointer-events-none"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent-500" />
          <span className="text-xs text-white/70">当前位置</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary-500" />
          <span className="text-xs text-white/70">已访问</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-500" />
          <span className="text-xs text-white/70">未访问</span>
        </div>
      </div>
    </div>
  );
}
