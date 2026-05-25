import React from 'react';
import type { Pipe as PipeType, Node } from '../engine/types';

interface PipeProps {
  pipe: PipeType;
  nodes: Node[];
  hasValve?: boolean;
  isDisconnected?: boolean;
}

export const Pipe: React.FC<PipeProps> = ({ pipe, nodes, isDisconnected }) => {
  const fromNode = nodes.find((n) => n.id === pipe.fromNode);
  const toNode = nodes.find((n) => n.id === pipe.toNode);

  if (!fromNode || !toNode) return null;

  const strokeWidth = Math.max(2, pipe.diameter * 2);
  const strokeColor = isDisconnected ? '#4b5563' : '#3b82f6';

  return (
    <line
      x1={fromNode.x}
      y1={fromNode.y}
      x2={toNode.x}
      y2={toNode.y}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      className="transition-all duration-300"
      opacity={isDisconnected ? 0.4 : 1}
    />
  );
};
