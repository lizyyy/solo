import React, { useRef, useState, useCallback, useMemo } from 'react';
import { Hold, HoldShape, HoldSize } from '../types';
import { useApp } from '../context/AppContext';
import { HOLD_SIZE_PIXELS, SHAPE_NAMES, ROUTE_COLORS } from '../data/sampleData';
import { calculateRiskAssessment } from '../utils/riskCalculator';

interface WallCanvas2DProps {
  onHoldSelect?: (hold: Hold | null) => void;
}

export function WallCanvas2D({ onHoldSelect }: WallCanvas2DProps) {
  const { activeWall, activeRoute, wallRoutes, state, dispatch, createNewHold } = useApp();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedHold, setSelectedHold] = useState<Hold | null>(null);
  const [draggingHold, setDraggingHold] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const heatmapData = useMemo(() => {
    if (!activeRoute || !activeWall) return [];
    const assessment = calculateRiskAssessment(activeRoute, activeWall, state.userProfile);
    return assessment.heatmapData;
  }, [activeRoute, activeWall, state.userProfile]);

  const canvasScale = useMemo(() => {
    if (!activeWall) return 1;
    const maxWidth = 600;
    const maxHeight = 500;
    const scaleX = maxWidth / activeWall.width;
    const scaleY = maxHeight / activeWall.height;
    return Math.min(scaleX, scaleY, 1.5);
  }, [activeWall]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!activeRoute || !canvasRef.current) return;

    const shape = e.dataTransfer.getData('holdShape') as HoldShape;
    const size = e.dataTransfer.getData('holdSize') as HoldSize;

    if (!shape) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / canvasScale;
    const y = (e.clientY - rect.top) / canvasScale;

    const clampedX = Math.max(0, Math.min(activeWall?.width || 400, x));
    const clampedY = Math.max(0, Math.min(activeWall?.height || 300, y));

    createNewHold(activeRoute.id, shape, size, activeRoute.color, {
      x: clampedX,
      y: clampedY,
    });
  }, [activeRoute, canvasScale, createNewHold, activeWall]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleHoldMouseDown = useCallback((e: React.MouseEvent, hold: Hold) => {
    e.stopPropagation();
    if (!canvasRef.current) return;

    setSelectedHold(hold);
    onHoldSelect?.(hold);
    setDraggingHold(hold.id);

    const rect = canvasRef.current.getBoundingClientRect();
    setDragOffset({
      x: (e.clientX - rect.left) / canvasScale - hold.position.x,
      y: (e.clientY - rect.top) / canvasScale - hold.position.y,
    });
  }, [canvasScale, onHoldSelect]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingHold || !activeRoute || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / canvasScale - dragOffset.x;
    const y = (e.clientY - rect.top) / canvasScale - dragOffset.y;

    const clampedX = Math.max(0, Math.min(activeWall?.width || 400, x));
    const clampedY = Math.max(0, Math.min(activeWall?.height || 300, y));

    dispatch({
      type: 'UPDATE_HOLD',
      payload: {
        routeId: activeRoute.id,
        holdId: draggingHold,
        updates: {
          position: { x: clampedX, y: clampedY },
        },
      },
    });
  }, [draggingHold, activeRoute, canvasScale, dragOffset, dispatch, activeWall]);

  const handleCanvasMouseUp = useCallback(() => {
    setDraggingHold(null);
  }, []);

  const handleCanvasClick = useCallback(() => {
    setSelectedHold(null);
    onHoldSelect?.(null);
  }, [onHoldSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Delete' && selectedHold && activeRoute) {
      dispatch({
        type: 'DELETE_HOLD',
        payload: {
          routeId: activeRoute.id,
          holdId: selectedHold.id,
        },
      });
      setSelectedHold(null);
      onHoldSelect?.(null);
    }
  }, [selectedHold, activeRoute, dispatch, onHoldSelect]);

  const renderHold = (hold: Hold, isActiveRoute: boolean) => {
    const sizePixels = HOLD_SIZE_PIXELS[hold.size];
    const scaledSize = sizePixels * canvasScale;

    return (
      <div
        key={hold.id}
        className={`hold-on-wall ${hold.id === selectedHold?.id ? 'selected' : ''} ${hold.isStart ? 'is-start' : ''} ${hold.isEnd ? 'is-end' : ''}`}
        style={{
          left: (hold.position.x - sizePixels / 2) * canvasScale,
          top: (hold.position.y - sizePixels / 2) * canvasScale,
          width: scaledSize,
          height: scaledSize,
          opacity: isActiveRoute ? 1 : 0.4,
        }}
        onMouseDown={(e) => isActiveRoute && handleHoldMouseDown(e, hold)}
        title={`${SHAPE_NAMES[hold.shape]} - ${hold.isStart ? '(起点)' : ''}${hold.isEnd ? '(终点)' : ''}`}
      >
        <div
          className={`hold-shape ${hold.shape}`}
          style={{
            backgroundColor: hold.color,
            width: '80%',
            height: '80%',
          }}
        />
        {hold.isStart && (
          <span className="hold-label">起点</span>
        )}
        {hold.isEnd && (
          <span className="hold-label">终点</span>
        )}
      </div>
    );
  };

  const renderHeatmap = () => {
    if (heatmapData.length === 0) return null;

    return (
      <svg
        className="heatmap-overlay"
        style={{
          width: (activeWall?.width || 400) * canvasScale,
          height: (activeWall?.height || 300) * canvasScale,
        }}
      >
        <defs>
          <linearGradient id="heatGradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(16, 185, 129, 0)" />
            <stop offset="50%" stopColor="rgba(245, 158, 11, 0.3)" />
            <stop offset="100%" stopColor="rgba(239, 68, 68, 0.6)" />
          </linearGradient>
        </defs>
        {heatmapData.map((cell, index) => (
          <rect
            key={index}
            x={cell.x * canvasScale}
            y={cell.y * canvasScale}
            width={40 * canvasScale}
            height={40 * canvasScale}
            fill={`rgba(239, 68, 68, ${cell.intensity * 0.4})`}
          />
        ))}
      </svg>
    );
  };

  if (!activeWall) {
    return (
      <div className="canvas-container">
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          <p>请先创建或选择一面墙</p>
        </div>
      </div>
    );
  }

  return (
    <div className="canvas-container" onKeyDown={handleKeyDown} tabIndex={0}>
      <div
        ref={canvasRef}
        className="wall-canvas"
        style={{
          width: activeWall.width * canvasScale,
          height: activeWall.height * canvasScale,
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onClick={handleCanvasClick}
      >
        <div className="wall-grid" />

        {activeWall.zones.map((zone) => (
          <div
            key={zone.id}
            style={{
              position: 'absolute',
              left: zone.x * canvasScale,
              top: zone.y * canvasScale,
              width: zone.width * canvasScale,
              height: zone.height * canvasScale,
              backgroundColor: zone.color,
              pointerEvents: 'none',
            }}
            title={zone.name}
          />
        ))}

        {wallRoutes.map((route) =>
          route.holds.map((hold) => renderHold(hold, route.id === activeRoute?.id))
        )}

        {activeRoute && renderHeatmap()}
      </div>

      {!activeRoute && (
        <div style={{
          position: 'absolute',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '8px',
          fontSize: '0.875rem',
        }}>
          选择一条线路后，然后从左侧岩点库拖拽岩点到墙面
        </div>
      )}

      {selectedHold && (
        <HoldEditor
          hold={selectedHold}
          routeColor={activeRoute?.color || ROUTE_COLORS[3]}
          onClose={() => {
            setSelectedHold(null);
            onHoldSelect?.(null);
          }}
          onUpdate={(updates) => {
            if (activeRoute) {
              dispatch({
                type: 'UPDATE_HOLD',
                payload: {
                  routeId: activeRoute.id,
                  holdId: selectedHold.id,
                  updates,
                },
              });
              setSelectedHold({ ...selectedHold, ...updates });
            }
          }}
          onDelete={() => {
            if (activeRoute) {
              dispatch({
                type: 'DELETE_HOLD',
                payload: {
                  routeId: activeRoute.id,
                  holdId: selectedHold.id,
                },
              });
              setSelectedHold(null);
              onHoldSelect?.(null);
            }
          }}
        />
      )}
    </div>
  );
}

interface HoldEditorProps {
  hold: Hold;
  routeColor: string;
  onClose: () => void;
  onUpdate: (updates: Partial<Hold>) => void;
  onDelete: () => void;
}

function HoldEditor({ hold, routeColor, onClose, onUpdate, onDelete }: HoldEditorProps) {
  const colors = [
    '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
    '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
  ];

  const sizes: HoldSize[] = ['small', 'medium', 'large'];
  const shapes: HoldShape[] = ['jug', 'crimp', 'pocket', 'edge', 'sloper'];

  return (
    <div className="hold-editor">
      <div className="editor-header">
        <h3>编辑岩点</h3>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="form-group">
        <label className="form-label">颜色</label>
        <div className="color-picker">
          {colors.map((color) => (
            <div
              key={color}
              className={`color-option ${hold.color === color ? 'selected' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => onUpdate({ color })}
            />
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">尺寸</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {sizes.map((size) => (
            <button
              key={size}
              className={`btn btn-sm ${hold.size === size ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onUpdate({ size })}
            >
              {size === 'small' ? '小' : size === 'medium' ? '中' : '大'}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">类型</label>
        <select
          className="form-select"
          value={hold.shape}
          onChange={(e) => onUpdate({ shape: e.target.value as HoldShape })}
        >
          {shapes.map((shape) => (
            <option key={shape} value={shape}>
              {SHAPE_NAMES[shape]}
            </option>
          ))}
        </select>
      </div>

      <div className="checkbox-group">
        <input
          type="checkbox"
          id="isStart"
          checked={hold.isStart}
          onChange={(e) => onUpdate({ isStart: e.target.checked })}
        />
        <label htmlFor="isStart" style={{ fontSize: '0.8125rem' }}>设为起点</label>
      </div>

      <div className="checkbox-group">
        <input
          type="checkbox"
          id="isEnd"
          checked={hold.isEnd}
          onChange={(e) => onUpdate({ isEnd: e.target.checked })}
        />
        <label htmlFor="isEnd" style={{ fontSize: '0.8125rem' }}>设为终点</label>
      </div>

      <div className="divider" />

      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-danger btn-sm" onClick={onDelete} style={{ flex: 1 }}>
          删除岩点
        </button>
      </div>
    </div>
  );
}
