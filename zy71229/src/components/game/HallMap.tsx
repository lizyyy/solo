import React, { useMemo } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { MAP_BOUNDS } from '../../mock/halls';
import { DataSource } from '../../game/types';

export const HallMap: React.FC = () => {
  const { state, addToRoute, openAnomalyModal, startMove } = useGameStore();
  const isMoving = state.isMoving;
  const { markDataSourceViewed } = useGameStore();
  const { setActiveDataPanel } = useUIStore();

  const pendingAnomalies = useMemo(() => {
    return state.anomalies.filter(a => a.detectedTime !== null && a.status === 'pending');
  }, [state.anomalies]);

  const handleHallClick = (hallId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const hall = state.halls.find(h => h.id === hallId);
    if (!hall) return;

    const centerX = hall.position.x + hall.position.width / 2;
    const centerY = hall.position.y + hall.position.height / 2;

    if (e.shiftKey) {
      addToRoute(hallId, { x: centerX, y: centerY }, 'hall', hallId);
    } else if (!isMoving) {
      startMove({ x: centerX, y: centerY });
    }

    markDataSourceViewed(DataSource.HALL);
    setActiveDataPanel(DataSource.HALL);
  };

  const handleCornerClick = (cornerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const corner = state.corners.find(c => c.id === cornerId);
    if (!corner) return;

    if (e.shiftKey) {
      addToRoute(corner.hallId, corner.position, 'corner', cornerId);
    } else if (!isMoving) {
      startMove(corner.position);
    }
  };

  const handleAnomalyClick = (anomalyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    openAnomalyModal(anomalyId);
  };

  const getAnomalyPosition = (anomalyId: string) => {
    const anomaly = state.anomalies.find(a => a.id === anomalyId);
    if (!anomaly) return null;

    const corner = state.corners.find(c => c.id === anomaly.relatedEntityId);
    if (corner) return corner.position;

    const artwork = state.artworks.find(a => a.id === anomaly.relatedEntityId);
    if (artwork) return artwork.position;

    const door = state.doors.find(d => d.id === anomaly.relatedEntityId);
    if (door) return door.position;

    const light = state.lights.find(l => l.id === anomaly.relatedEntityId);
    if (light) return light.position;

    const hall = state.halls.find(h => h.id === anomaly.relatedEntityId);
    if (hall) {
      return {
        x: hall.position.x + hall.position.width / 2,
        y: hall.position.y + hall.position.height / 2,
      };
    }

    return null;
  };

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <span className="panel-title">展厅平面图</span>
        <span className="text-xs text-gray-500 font-mono">
          提示: 按住Shift点击添加到路线
        </span>
      </div>
      <div className="flex-1 overflow-auto p-4 scrollbar-thin">
        <svg
          width={MAP_BOUNDS.width}
          height={MAP_BOUNDS.height}
          className="mx-auto bg-night-700 border border-gray-700"
        >
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {state.halls.map(hall => (
            <g key={hall.id}>
              <rect
                x={hall.position.x}
                y={hall.position.y}
                width={hall.position.width}
                height={hall.position.height}
                className={`map-hall ${hall.isPatrolled ? 'patrolled' : ''} ${state.currentHallId === hall.id ? 'current' : ''}`}
                onClick={(e) => handleHallClick(hall.id, e)}
              />
              <text
                x={hall.position.x + hall.position.width / 2}
                y={hall.position.y + 20}
                textAnchor="middle"
                className="fill-gray-400 text-xs font-mono pointer-events-none select-none"
              >
                {hall.name}
              </text>
            </g>
          ))}

          {state.corners.map(corner => (
            <circle
              key={corner.id}
              cx={corner.position.x}
              cy={corner.position.y}
              r={12}
              className={`map-corner ${corner.isPatrolled ? 'patrolled' : 'unpatrolled'}`}
              onClick={(e) => handleCornerClick(corner.id, e)}
            />
          ))}

          {state.plannedRoute.length > 0 && (
            <polyline
              points={[
                state.currentPosition,
                ...state.plannedRoute.map(n => n.position),
              ].map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2"
              strokeDasharray="5,5"
              opacity="0.7"
            />
          )}

          {state.plannedRoute.map((node, index) => (
            <g key={node.id}>
              <circle
                cx={node.position.x}
                cy={node.position.y}
                r={8}
                fill="#06b6d4"
                opacity="0.8"
              />
              <text
                x={node.position.x}
                y={node.position.y + 4}
                textAnchor="middle"
                className="fill-white text-xs font-mono pointer-events-none select-none"
              >
                {index + 1}
              </text>
            </g>
          ))}

          {pendingAnomalies.map(anomaly => {
            const pos = getAnomalyPosition(anomaly.id);
            if (!pos) return null;
            return (
              <g key={anomaly.id} onClick={(e) => handleAnomalyClick(anomaly.id, e)}>
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={18}
                  fill="rgba(220, 38, 38, 0.2)"
                  className="animate-pulse-slow"
                />
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={12}
                  fill="#dc2626"
                  className="cursor-pointer hover:fill-red-400 transition-colors"
                />
                <text
                  x={pos.x}
                  y={pos.y + 4}
                  textAnchor="middle"
                  className="fill-white text-xs font-bold pointer-events-none select-none"
                >
                  !
                </text>
              </g>
            );
          })}

          <g>
            <circle
              cx={state.currentPosition.x}
              cy={state.currentPosition.y}
              r={14}
              fill="rgba(37, 99, 235, 0.3)"
              className="animate-pulse-slow"
            />
            <circle
              cx={state.currentPosition.x}
              cy={state.currentPosition.y}
              r={10}
              fill="#2563eb"
              stroke="#fff"
              strokeWidth="2"
            />
            <text
              x={state.currentPosition.x}
              y={state.currentPosition.y + 4}
              textAnchor="middle"
              className="fill-white text-xs font-bold pointer-events-none select-none"
            >
              你
            </text>
          </g>

          {state.doors.filter(d => d.hallId).map(door => (
            <g key={door.id}>
              <rect
                x={door.position.x - 8}
                y={door.position.y - 4}
                width={16}
                height={8}
                fill={door.status === 'locked' ? '#6b7280' : door.status === 'open' ? '#059669' : '#f59e0b'}
                rx={1}
              />
            </g>
          ))}

          {state.artworks.map(art => (
            <g key={art.id}>
              <rect
                x={art.position.x - 6}
                y={art.position.y - 8}
                width={12}
                height={16}
                fill="#8b5cf6"
                opacity="0.7"
                rx={1}
              />
            </g>
          ))}

          {state.lights.filter(l => l.hallId).map(light => (
            <g key={light.id}>
              <circle
                cx={light.position.x}
                cy={light.position.y}
                r={5}
                fill={light.status === 'on' || light.status === 'dimmed' ? '#eab308' : '#374151'}
                opacity={light.status === 'dimmed' ? 0.5 : 1}
              />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};
