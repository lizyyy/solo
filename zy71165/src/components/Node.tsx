import React from 'react';
import type { Node as NodeType, Leak, UserArea } from '../engine/types';

interface NodeProps {
  node: NodeType;
  leaks: Leak[];
  userAreas: UserArea[];
  isHighlighted?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const Node: React.FC<NodeProps> = ({
  node,
  leaks,
  userAreas,
  isHighlighted,
  onMouseEnter,
  onMouseLeave,
}) => {
  const leak = leaks.find((l) => l.nodeId === node.id);
  const userArea = userAreas.find((u) => u.nodeId === node.id);

  const getRadius = () => {
    if (node.type === 'source') return 20;
    if (leak) return 18;
    if (userArea) return 16;
    return 10;
  };

  const getFillColor = () => {
      if (node.type === 'source') return '#3b82f6';
      if (leak) return leak.isIsolated ? '#6b7280' : '#ef4444';
      if (userArea) return userArea.isAffected ? '#f97316' : '#22c55e';
      return '#60a5fa';
  };

  const getStrokeColor = () => {
    if (isHighlighted) return '#fbbf24';
    if (node.type === 'source') return '#1d4ed8';
    if (leak) return leak.isIsolated ? '#4b5563' : '#dc2626';
    if (userArea) return userArea.isAffected ? '#ea580c' : '#16a34a';
    return '#3b82f6';
  };

  const radius = getRadius();

  return (
    <g
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="cursor-pointer"
    >
      {leak && !leak.isIsolated && (
        <>
          <circle
            cx={node.x}
            cy={node.y}
            r={radius + 10}
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeDasharray="4 2"
            opacity="0.6"
          >
            <animate
              attributeName="r"
              values={`${radius + 6};${radius + 14};${radius + 6}`}
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.8;0.3;0.8"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
        </>
      )}

      <circle
        cx={node.x}
        cy={node.y}
        r={radius + 3}
        fill="none"
        stroke={getStrokeColor()}
        strokeWidth={isHighlighted ? 3 : 2}
        className="transition-all duration-200"
      />

      <circle
        cx={node.x}
        cy={node.y}
        r={radius}
        fill={getFillColor()}
        className="transition-all duration-200"
      />

      {node.type === 'source' && (
        <text
          x={node.x}
          y={node.y + 4}
          textAnchor="middle"
        >
          💧
        </text>
      )}

      {userArea && (
        <text
          x={node.x}
          y={node.y + 4}
          textAnchor="middle"
          fontSize="12"
        >
          🏠
        </text>
      )}

      {leak && (
        <text
          x={node.x}
          y={node.y + 4}
          textAnchor="middle"
          fontSize="12"
        >
          {leak.isIsolated ? '✅' : '⚠️'}
        </text>
      )}

      {node.label && (
        <text
          x={node.x}
          y={node.y + radius + 16}
          textAnchor="middle"
          className="fill-gray-300 text-xs"
        >
          {node.label}
        </text>
      )}

      {node.pressure > 0 && (
        <text
          x={node.x}
          y={node.y - radius - 6}
          textAnchor="middle"
          className={`text-xs font-mono font-bold ${
            node.pressure < 60 ? 'fill-red-400' : 'fill-green-400'
          }`}
        >
          {node.pressure.toFixed(1)}
        </text>
      )}

      {userArea && (
        <text
          x={node.x}
          y={node.y + radius + 30}
          textAnchor="middle"
          className={`text-xs font-mono ${
            userArea.isAffected ? 'fill-orange-400' : 'fill-gray-400'
          }`}
        >
          {userArea.userCount}户
        </text>
      )}
    </g>
  );
};
