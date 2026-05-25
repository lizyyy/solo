import React, { useRef, useState } from 'react';
import { Pipe } from './Pipe';
import { Valve } from './Valve';
import { Node } from './Node';
import type { GameState, Level } from '../engine/types';
import { buildConnectivity } from '../engine/solver';

interface PipeNetworkProps {
  gameState: GameState;
  level: Level;
  onValveClick: (valveId: string) => void;
  highlightedNodeId: string | null;
  highlightedValveId: string | null;
  onNodeHighlight: (nodeId: string | null) => void;
  onValveHighlight: (valveId: string | null) => void;
  disabled?: boolean;
}

export const PipeNetwork: React.FC<PipeNetworkProps> = ({
  gameState,
  level,
  onValveClick,
  highlightedNodeId,
  highlightedValveId,
  onNodeHighlight,
  onValveHighlight,
  disabled,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const sourceNodes = gameState.nodes.filter((n) => n.type === 'source');
  const uf = buildConnectivity(gameState.nodes, gameState.pipes, gameState.valves);

  const getIsDisconnected = (pipe: { fromNode: string; toNode: string }) => {
    return sourceNodes.every(
      (source) =>
        !uf.connected(source.id, pipe.fromNode) ||
        !uf.connected(source.id, pipe.toNode)
    );
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => Math.max(0.5, Math.min(2, s * delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setTranslate({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetView = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  const minX = Math.min(...gameState.nodes.map((n) => n.x)) - 50;
  const maxX = Math.max(...gameState.nodes.map((n) => n.x)) + 50;
  const minY = Math.min(...gameState.nodes.map((n) => n.y)) - 60;
  const maxY = Math.max(...gameState.nodes.map((n) => n.y)) + 60;
  const width = maxX - minX;
  const height = maxY - minY;

  return (
    <div className="relative w-full h-full bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
          className="w-10 h-10 bg-slate-700/80 hover:bg-slate-600 rounded-lg text-white flex items-center justify-center transition-all"
        >
          -
        </button>
        <button
          onClick={handleResetView}
          className="px-3 h-10 bg-slate-700/80 hover:bg-slate-600 rounded-lg text-white text-sm flex items-center justify-center transition-all"
        >
          重置视图
        </button>
        <button
          onClick={() => setScale((s) => Math.min(2, s + 0.1))}
          className="w-10 h-10 bg-slate-700/80 hover:bg-slate-600 rounded-lg text-white flex items-center justify-center transition-all"
        >
          +
        </button>
      </div>

      <div className="absolute bottom-4 right-4 z-10 px-3 py-1.5 bg-slate-700/80 rounded-lg text-slate-300 text-xs font-mono">
        {Math.round(scale * 100)}%
      </div>

      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <pattern
            id="grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="#1e293b"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        <g transform={`translate(${translate.x}, ${translate.y}) scale(${scale})`}>
          <rect
            x={minX}
            y={minY}
            width={width}
            height={height}
            fill="url(#grid)"
            className="pointer-events-none"
          />

          <g>
            {gameState.pipes.map((pipe) => (
              <Pipe
                key={pipe.id}
                pipe={pipe}
                nodes={gameState.nodes}
                isDisconnected={getIsDisconnected(pipe)}
              />
            ))}
          </g>

          <g>
            {gameState.valves.map((valve) => (
              <Valve
                key={valve.id}
                valve={valve}
                onClick={() => onValveClick(valve.id)}
                isHighlighted={highlightedValveId === valve.id}
                disabled={disabled}
                onMouseEnter={() => onValveHighlight(valve.id)}
                onMouseLeave={() => onValveHighlight(null)}
              />
            ))}
          </g>

          <g>
            {gameState.nodes.map((node) => (
              <Node
                key={node.id}
                node={node}
                leaks={gameState.leaks}
                userAreas={gameState.userAreas}
                isHighlighted={highlightedNodeId === node.id}
                onMouseEnter={() => onNodeHighlight(node.id)}
                onMouseLeave={() => onNodeHighlight(null)}
              />
            ))}
          </g>
        </g>
      </svg>

      {disabled && (
        <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center pointer-events-none">
          <div className="bg-slate-800/90 px-6 py-3 rounded-xl border border-slate-600">
            <p className="text-slate-300 text-lg font-medium">游戏已暂停</p>
          </div>
        </div>
      )}
    </div>
  );
};
