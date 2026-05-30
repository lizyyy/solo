import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { baseBlocks } from '../../data/levels';
import { snapToGrid } from '../../engine/geometry';
import { PolygonState } from '../../types';

interface DragState {
  isDragging: boolean;
  instanceId: string | null;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    instanceId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0
  });
  const [previewPosition, setPreviewPosition] = useState<{ x: number; y: number } | null>(null);
  const [previewBlockId, setPreviewBlockId] = useState<string | null>(null);

  const {
    currentLevel,
    placedPolygons,
    selectedInstanceId,
    isSimulating,
    simulationResult,
    replayFrameIndex,
    addPolygon,
    updatePolygon,
    removePolygon,
    selectPolygon
  } = useGameStore();

  const getCurrentPolygonStates = useCallback(() => {
    if (!simulationResult || !simulationResult.replayData.length) {
      return new Map<string, PolygonState>();
    }
    const frame = simulationResult.replayData[Math.min(replayFrameIndex, simulationResult.replayData.length - 1)];
    const stateMap = new Map<string, PolygonState>();
    frame.polygonStates.forEach(s => {
      stateMap.set(s.instanceId, s.state);
    });
    return stateMap;
  }, [simulationResult, replayFrameIndex]);

  const getCurrentTruckPosition = useCallback(() => {
    if (!simulationResult || !simulationResult.replayData.length) {
      return currentLevel?.truck.position || { x: 0, y: 0 };
    }
    const frame = simulationResult.replayData[Math.min(replayFrameIndex, simulationResult.replayData.length - 1)];
    return frame.truckPosition;
  }, [simulationResult, replayFrameIndex, currentLevel]);

  const handleCanvasMouseDown = (_e: React.MouseEvent) => {
    if (isSimulating || !canvasRef.current) return;
    selectPolygon(null);
  };

  const handlePolygonMouseDown = (e: React.MouseEvent, instanceId: string) => {
    e.stopPropagation();
    if (isSimulating || !canvasRef.current) return;
    const polygon = placedPolygons.find(p => p.instanceId === instanceId);
    if (!polygon) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDragState({
      isDragging: true,
      instanceId,
      startX: x,
      startY: y,
      offsetX: x - polygon.position.x,
      offsetY: y - polygon.position.y
    });
    selectPolygon(instanceId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (dragState.isDragging && dragState.instanceId && !isSimulating) {
      const polygon = placedPolygons.find(p => p.instanceId === dragState.instanceId);
      if (polygon) {
        const newX = snapToGrid({ x: x - dragState.offsetX, y: 0 }, 10).x;
        const newY = snapToGrid({ x: 0, y: y - dragState.offsetY }, 10).y;
        updatePolygon(dragState.instanceId, { x: newX, y: newY }, polygon.rotation);
      }
    }
    if (previewBlockId) {
      setPreviewPosition(snapToGrid({ x, y }, 10));
    }
  };

  const handleMouseUp = () => {
    setDragState(prev => ({ ...prev, isDragging: false, instanceId: null }));
  };

  const handleCanvasClick = () => {
    if (previewBlockId && previewPosition && !isSimulating) {
      addPolygon(previewBlockId, previewPosition, 0);
      setPreviewBlockId(null);
      setPreviewPosition(null);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isSimulating || !selectedInstanceId) return;
    const polygon = placedPolygons.find(p => p.instanceId === selectedInstanceId);
    if (!polygon) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      removePolygon(selectedInstanceId);
    } else if (e.key === 'r' || e.key === 'R') {
      const newRotation = (polygon.rotation + 15) % 360;
      updatePolygon(selectedInstanceId, polygon.position, newRotation);
    } else if (e.key === 'ArrowLeft') {
      updatePolygon(selectedInstanceId, { x: polygon.position.x - 10, y: polygon.position.y }, polygon.rotation);
    } else if (e.key === 'ArrowRight') {
      updatePolygon(selectedInstanceId, { x: polygon.position.x + 10, y: polygon.position.y }, polygon.rotation);
    } else if (e.key === 'ArrowUp') {
      updatePolygon(selectedInstanceId, { x: polygon.position.x, y: polygon.position.y - 10 }, polygon.rotation);
    } else if (e.key === 'ArrowDown') {
      updatePolygon(selectedInstanceId, { x: polygon.position.x, y: polygon.position.y + 10 }, polygon.rotation);
    }
  }, [selectedInstanceId, placedPolygons, isSimulating, removePolygon, updatePolygon]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const blockId = e.dataTransfer?.getData('blockId');
      if (blockId) {
        setPreviewBlockId(blockId);
        setPreviewPosition(snapToGrid({ 
          x: e.clientX - rect.left, 
          y: e.clientY - rect.top 
        }, 10));
      }
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      if (!canvasRef.current || isSimulating) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const blockId = e.dataTransfer?.getData('blockId');
      if (blockId) {
        const pos = snapToGrid({ 
          x: e.clientX - rect.left, 
          y: e.clientY - rect.top 
        }, 10);
        addPolygon(blockId, pos, 0);
      }
      setPreviewBlockId(null);
      setPreviewPosition(null);
    };
    const handleDragLeave = () => {
      setPreviewBlockId(null);
      setPreviewPosition(null);
    };
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('dragover', handleDragOver);
      canvas.addEventListener('drop', handleDrop);
      canvas.addEventListener('dragleave', handleDragLeave);
    }
    return () => {
      if (canvas) {
        canvas.removeEventListener('dragover', handleDragOver);
        canvas.removeEventListener('drop', handleDrop);
        canvas.removeEventListener('dragleave', handleDragLeave);
      }
    };
  }, [addPolygon, isSimulating]);

  const getPolygonColor = (instanceId: string, baseColor: string): string => {
    const states = getCurrentPolygonStates();
    const state = states.get(instanceId);
    if (state === 'broken') return '#ef4444';
    if (state === 'stressed') return '#f97316';
    return baseColor;
  };



  if (!currentLevel) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900/50 rounded-xl">
        <p className="text-slate-400">请先选择关卡</p>
      </div>
    );
  }

  const truckPos = getCurrentTruckPosition();

  return (
    <div className="relative">
      <svg
        ref={canvasRef}
        width="600"
        height="450"
        className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl cursor-crosshair shadow-2xl"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <rect
          x={50}
          y={380}
          width={500}
          height={50}
          fill="#1e3a5f"
          opacity="0.5"
        />
        <text x="300" y="420" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="12">
          地面
        </text>
        {currentLevel.piers.map(pier => (
          <g key={pier.id}>
            <rect
              x={pier.position.x - pier.width / 2}
              y={pier.position.y - pier.height / 2}
              width={pier.width}
              height={pier.height}
              fill="#475569"
              stroke="#64748b"
              strokeWidth="2"
              rx="4"
            />
            <rect
              x={pier.position.x - pier.width / 2 - 5}
              y={pier.position.y - pier.height / 2 - 8}
              width={pier.width + 10}
              height={10}
              fill="#64748b"
              rx="2"
            />
            <text
              x={pier.position.x}
              y={pier.position.y + 5}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="10"
            >
              桥墩
            </text>
          </g>
        ))}
        {placedPolygons.map(polygon => {
          const block = currentLevel.availableBlocks.find(b => b.id === polygon.blockId) ||
                        baseBlocks.find(b => b.id === polygon.blockId);
          if (!block) return null;
          const isSelected = selectedInstanceId === polygon.instanceId;
          const color = getPolygonColor(polygon.instanceId, block.color);
          const states = getCurrentPolygonStates();
          const state = states.get(polygon.instanceId);
          return (
            <g key={polygon.instanceId} style={{ cursor: isSimulating ? 'default' : 'move' }}>
              <polygon
                points={polygon.vertices.map(v => `${v.x},${v.y}`).join(' ')}
                fill={color}
                stroke={isSelected ? '#f97316' : '#1e293b'}
                strokeWidth={isSelected ? 3 : 2}
                filter={state === 'stressed' ? 'url(#glow)' : undefined}
                opacity={state === 'broken' ? 0.5 : 1}
                onMouseDown={(e) => handlePolygonMouseDown(e, polygon.instanceId)}
                className="transition-all duration-200"
                style={{ cursor: isSimulating ? 'default' : 'move' }}
              />
              {isSelected && !isSimulating && (
                <polygon
                  points={polygon.vertices.map(v => `${v.x},${v.y}`).join(' ')}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="1"
                  strokeDasharray="5,5"
                  opacity="0.5"
                />
              )}
            </g>
          );
        })}
        {previewBlockId && previewPosition && (
          <g opacity="0.5">
            {(() => {
              const block = currentLevel.availableBlocks.find(b => b.id === previewBlockId) ||
                            baseBlocks.find(b => b.id === previewBlockId);
              if (!block) return null;
              const offsetVertices = block.vertices.map(v => ({
                x: v.x + previewPosition.x,
                y: v.y + previewPosition.y
              }));
              return (
                <polygon
                  points={offsetVertices.map(v => `${v.x},${v.y}`).join(' ')}
                  fill={block.color}
                  stroke="#fff"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              );
            })()}
          </g>
        )}
        <g transform={`translate(${truckPos.x - 20}, ${truckPos.y - 15})`}>
          <rect x="0" y="0" width="40" height="20" fill="#dc2626" rx="3" />
          <rect x="5" y="-8" width="15" height="10" fill="#b91c1c" rx="2" />
          <circle cx="10" cy="22" r="6" fill="#1e293b" stroke="#475569" strokeWidth="2" />
          <circle cx="30" cy="22" r="6" fill="#1e293b" stroke="#475569" strokeWidth="2" />
          <circle cx="10" cy="22" r="2" fill="#64748b" />
          <circle cx="30" cy="22" r="2" fill="#64748b" />
        </g>
        {simulationResult?.failurePoint && (
          <g>
            <circle
              cx={simulationResult.failurePoint.x}
              cy={simulationResult.failurePoint.y - 20}
              r="15"
              fill="#ef4444"
              opacity="0.3"
            />
            <text
              x={simulationResult.failurePoint.x}
              y={simulationResult.failurePoint.y - 45}
              textAnchor="middle"
              fill="#ef4444"
              fontSize="20"
            >
              💥
            </text>
          </g>
        )}
      </svg>
      {!isSimulating && (
        <div className="absolute bottom-4 left-4 text-xs text-slate-400 bg-slate-900/80 px-3 py-2 rounded-lg">
          <p>💡 拖拽多边形移动 | R键旋转 | Delete删除 | 方向键微调</p>
        </div>
      )}
      {previewBlockId && (
        <div className="absolute top-4 left-4 text-xs text-accent-400 bg-slate-900/80 px-3 py-2 rounded-lg animate-pulse">
          点击画布放置多边形
        </div>
      )}
    </div>
  );
};

export default GameCanvas;
