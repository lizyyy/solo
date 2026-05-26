import React, { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../game/state';
import { MapNode } from '../game/types';

interface GameCanvasProps {
  width?: number;
  height?: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ width = 900, height = 450 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { currentLevel, currentNode, visitedNodes, moveToNode, status, team, activeEvent } = useGameStore();
  const hoveredNodeRef = useRef<string | null>(null);

  const getNodeColor = (node: MapNode, isCurrent: boolean, isVisited: boolean, isConnected: boolean): string => {
    if (isCurrent) return '#4ade80';
    if (node.type === 'start') return '#22c55e';
    if (node.type === 'end') return '#eab308';
    if (node.type === 'supply') return '#3b82f6';
    if (isVisited) return '#6b7280';
    if (isConnected) return '#a3e635';
    return '#9ca3af';
  };

  const getNodeIcon = (node: MapNode): string => {
    switch (node.type) {
      case 'start': return '🏁';
      case 'end': return '🎯';
      case 'supply': return '🏪';
      default: return '📍';
    }
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentLevel) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f0fdf4');
    gradient.addColorStop(1, '#dcfce7');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    const currentNodeData = currentLevel.nodes.find(n => n.id === currentNode);
    const connectedNodes = currentNodeData?.connections || [];

    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    currentLevel.nodes.forEach(node => {
      node.connections.forEach(connId => {
        const connNode = currentLevel.nodes.find(n => n.id === connId);
        if (!connNode) return;

        const isVisitedPath = visitedNodes.includes(node.id) && visitedNodes.includes(connId);
        const isCurrentPath = node.id === currentNode || connId === currentNode;

        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(connNode.x, connNode.y);

        if (isVisitedPath && isCurrentPath) {
          ctx.strokeStyle = '#4ade80';
        } else if (isVisitedPath) {
          ctx.strokeStyle = '#86efac';
        } else {
          ctx.strokeStyle = '#d1d5db';
        }
        ctx.stroke();
      });
    });

    currentLevel.nodes.forEach(node => {
      const isCurrent = node.id === currentNode;
      const isVisited = visitedNodes.includes(node.id);
      const isConnected = connectedNodes.includes(node.id);
      const isHovered = hoveredNodeRef.current === node.id;

      const color = getNodeColor(node, isCurrent, isVisited, isConnected);
      const radius = isCurrent ? 28 : isHovered ? 26 : 22;

      if (isCurrent || isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 8, 0, Math.PI * 2);
        ctx.fillStyle = isCurrent ? 'rgba(74, 222, 128, 0.3)' : 'rgba(163, 230, 53, 0.3)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = isCurrent ? '#166534' : isConnected ? '#4d7c0f' : '#4b5563';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(getNodeIcon(node), node.x, node.y);

      ctx.font = 'bold 11px "Noto Sans SC", sans-serif';
      ctx.fillStyle = '#1f2937';
      ctx.textAlign = 'center';
      ctx.fillText(node.name, node.x, node.y + radius + 14);
    });

    if (currentNodeData) {
      ctx.font = 'bold 14px "Noto Sans SC", sans-serif';
      ctx.fillStyle = '#166534';
      ctx.textAlign = 'left';
      ctx.fillText(`📍 当前位置: ${currentNodeData.name}`, 15, 25);
    }
  }, [currentLevel, currentNode, visitedNodes, width, height]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !currentLevel) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const currentNodeData = currentLevel.nodes.find(n => n.id === currentNode);
    const connectedNodes = currentNodeData?.connections || [];

    let foundNode: string | null = null;
    for (const node of currentLevel.nodes) {
      const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      if (distance < 28 && connectedNodes.includes(node.id)) {
        foundNode = node.id;
        break;
      }
    }

    if (foundNode !== hoveredNodeRef.current) {
      hoveredNodeRef.current = foundNode;
      canvas.style.cursor = foundNode ? 'pointer' : 'default';
      draw();
    }
  }, [currentLevel, currentNode, width, height, draw]);

  const handleClick = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !currentLevel || status !== 'playing' || activeEvent) return;
    if (team.actionPoints < 1) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const currentNodeData = currentLevel.nodes.find(n => n.id === currentNode);
    const connectedNodes = currentNodeData?.connections || [];

    for (const node of currentLevel.nodes) {
      const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      if (distance < 28 && connectedNodes.includes(node.id)) {
        moveToNode(node.id);
        break;
      }
    }
  }, [currentLevel, currentNode, status, activeEvent, team.actionPoints, moveToNode, width, height]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
    };
  }, [handleMouseMove, handleClick]);

  return (
    <div className="game-card p-4">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full rounded-lg border-2 border-primary-200"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
      <div className="flex flex-wrap gap-4 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-green-500"></span>
          <span>当前位置</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-lime-400"></span>
          <span>可前往</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-blue-500"></span>
          <span>补给点</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-yellow-500"></span>
          <span>终点</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-gray-400"></span>
          <span>未探索</span>
        </div>
      </div>
    </div>
  );
};
