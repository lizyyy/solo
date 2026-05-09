import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Artwork, Light, Wall, IlluminationResult, DataValidationError } from './types';
import { abnormalWalls, normalWalls } from './data/samples';
import { calculateArtworkIllumination } from './utils/calculations';
import { validateWall } from './utils/validation';

type SelectedItem = 
  | { type: 'artwork'; id: string }
  | { type: 'light'; id: string }
  | null;

function App() {
  const [walls, setWalls] = useState<Wall[]>([...normalWalls]);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [dragging, setDragging] = useState<{
    type: 'artwork' | 'light';
    id: string;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const allWalls = useMemo(() => {
    return [
      ...walls,
      ...abnormalWalls.map((aw) => aw.wall)
    ];
  }, [walls]);

  const selectedWall = useMemo(() => {
    if (!selectedWallId) return null;
    return allWalls.find(w => w.id === selectedWallId) || null;
  }, [allWalls, selectedWallId]);

  const illuminationResults = useMemo((): IlluminationResult[] => {
    if (selectedWall) {
      return selectedWall.artworks.map(artwork => 
        calculateArtworkIllumination(artwork, selectedWall.lights)
      );
    }
    return [];
  }, [selectedWall]);

  const validationErrors = useMemo((): DataValidationError[] => {
    if (selectedWall) {
      return validateWall(selectedWall);
    }
    return [];
  }, [selectedWall]);

  const selectedArtwork = useMemo(() => {
    if (selectedItem?.type === 'artwork' && selectedWall) {
      return selectedWall.artworks.find(a => a.id === selectedItem.id) || null;
    }
    return null;
  }, [selectedItem, selectedWall]);

  const selectedLight = useMemo(() => {
    if (selectedItem?.type === 'light' && selectedWall) {
      return selectedWall.lights.find(l => l.id === selectedItem.id) || null;
    }
    return null;
  }, [selectedItem, selectedWall]);

  const updateArtwork = useCallback((id: string, updates: Partial<Artwork>) => {
    setWalls(prev => prev.map(wall => {
      if (wall.id === selectedWallId) {
        return {
          ...wall,
          artworks: wall.artworks.map(a => a.id === id ? { ...a, ...updates } : a)
        };
      }
      const abnormalIndex = abnormalWalls.findIndex(aw => aw.wall.id === selectedWallId);
      if (abnormalIndex !== -1) {
        const aw = abnormalWalls[abnormalIndex];
        aw.wall = {
          ...aw.wall,
          artworks: aw.wall.artworks.map(a => a.id === id ? { ...a, ...updates } : a)
        };
      }
      return wall;
    }));
  }, [selectedWallId]);

  const updateLight = useCallback((id: string, updates: Partial<Light>) => {
    setWalls(prev => prev.map(wall => {
      if (wall.id === selectedWallId) {
        return {
          ...wall,
          lights: wall.lights.map(l => l.id === id ? { ...l, ...updates } : l)
        };
      }
      const abnormalIndex = abnormalWalls.findIndex(aw => aw.wall.id === selectedWallId);
      if (abnormalIndex !== -1) {
        const aw = abnormalWalls[abnormalIndex];
        aw.wall = {
          ...aw.wall,
          lights: aw.wall.lights.map(l => l.id === id ? { ...l, ...updates } : l)
        };
      }
      return wall;
    }));
  }, [selectedWallId]);

  const handleMouseDown = useCallback((
    e: React.MouseEvent,
    type: 'artwork' | 'light',
    id: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    let offsetX: number;
    let offsetY: number;

    if (type === 'artwork' && selectedWall) {
      const artwork = selectedWall.artworks.find(a => a.id === id);
      if (artwork) {
        offsetX = e.clientX - rect.left - artwork.x;
        offsetY = e.clientY - rect.top - artwork.y;
      } else {
        return;
      }
    } else if (type === 'light' && selectedWall) {
      const light = selectedWall.lights.find(l => l.id === id);
      if (light) {
        offsetX = e.clientX - rect.left - light.x;
        offsetY = e.clientY - rect.top - light.y;
      } else {
        return;
      }
    } else {
      return;
    }

    setDragging({
      type,
      id,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: offsetX as number,
      offsetY: offsetY as number
    });
    setSelectedItem({ type, id });
  }, [selectedWall]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !canvasRef.current || !selectedWall) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = e.clientX - rect.left - dragging.offsetX;
    const newY = e.clientY - rect.top - dragging.offsetY;

    const itemWidth = dragging.type === 'artwork'
      ? (selectedWall.artworks.find(a => a.id === dragging.id)?.width || 0)
      : 0;
    const itemHeight = dragging.type === 'artwork'
      ? (selectedWall.artworks.find(a => a.id === dragging.id)?.height || 0)
      : 0;

    const clampedX = Math.max(0, Math.min(newX, selectedWall.width - itemWidth));
    const clampedY = Math.max(0, Math.min(newY, selectedWall.height - itemHeight));

    if (dragging.type === 'artwork') {
      updateArtwork(dragging.id, { x: clampedX, y: clampedY });
    } else {
      updateLight(dragging.id, { x: clampedX, y: clampedY });
    }
  }, [dragging, selectedWall, updateArtwork, updateLight]);

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      setDragging(null);
    }
  }, [dragging]);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  const getStatStatus = (result: IlluminationResult): 'normal' | 'warning' | 'error' => {
    if (result.errors.length > 0) {
      if (result.averageLux < 50 || result.shadowIntensity > 80) {
        return 'error';
      }
      return 'warning';
    }
    return 'normal';
  };

  const getLuxStatus = (lux: number): 'good' | 'warning' | 'error' => {
    if (lux < 50) return 'warning';
    if (lux > 2000) return 'error';
    return 'good';
  };

  const renderLightBeam = (light: Light) => {
    const beamLength = 300;
    const spreadRad = (light.spread / 2) * (Math.PI / 180);
    const angleRad = light.angle * (Math.PI / 180);
    
    const bottomLeft = {
      x: Math.cos(angleRad - spreadRad) * beamLength,
      y: -Math.sin(angleRad - spreadRad) * beamLength
    };
    const bottomRight = {
      x: Math.cos(angleRad + spreadRad) * beamLength,
      y: -Math.sin(angleRad + spreadRad) * beamLength
    };

    return (
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          overflow: 'visible'
        }}
      >
        <polygon
          points={`${light.x},${light.y} ${light.x + bottomLeft.x},${light.y + bottomLeft.y} ${light.x + bottomRight.x},${light.y + bottomRight.y}`}
          fill="rgba(255, 255, 200, 0.15)"
        />
        <line
          x1={light.x}
          y1={light.y}
          x2={light.x + Math.cos(angleRad) * 50}
          y2={light.y - Math.sin(angleRad) * 50}
          stroke="#ffd700"
          strokeWidth="2"
        />
      </svg>
    );
  };

  return (
    <div className="app">
      <header className="header">
        <h1>画廊布展灯位试算器</h1>
        <p>调整作品位置与灯位角度，实时计算照度与阴影效果</p>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <div className="wall-list">
            <div className="section-title">正常样例</div>
            {walls.map(wall => (
              <div
                key={wall.id}
                className={`wall-item ${selectedWallId === wall.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedWallId(wall.id);
                  setSelectedItem(null);
                }}
              >
                <div className="wall-item-name">{wall.name}</div>
                <div className="wall-item-desc">
                  {wall.artworks.length} 件作品 · {wall.lights.length} 盏灯
                </div>
              </div>
            ))}
          </div>

          <div className="abnormal-list">
            <div className="section-title">异常样例</div>
            {abnormalWalls.map((item, index) => (
              <div
                key={`abnormal-${index}`}
                className={`wall-item abnormal ${selectedWallId === item.wall.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedWallId(item.wall.id);
                  setSelectedItem(null);
                }}
              >
                <div className="wall-item-name">{item.name}</div>
                <div className="wall-item-desc">{item.description}</div>
              </div>
            ))}
          </div>
        </aside>

        <main className="canvas-area">
          {!selectedWall ? (
            <div className="empty-state">
              <div className="empty-state-icon">🖼️</div>
              <div className="empty-state-text">请从左侧选择一个墙面</div>
              <div className="empty-state-hint">点击墙面布局作为入口，开始灯位试算</div>
            </div>
          ) : (
            <>
              <div className="canvas-header">
                <div className="canvas-title">{selectedWall.name}</div>
                <div className="canvas-dimensions">
                  墙面尺寸: {selectedWall.width} × {selectedWall.height}
                </div>
              </div>

              <div
                ref={canvasRef}
                className="gallery-canvas"
                style={{
                  width: selectedWall.width,
                  height: selectedWall.height
                }}
                onClick={() => setSelectedItem(null)}
              >
                <div
                  className="wall-bg"
                  style={{
                    position: 'absolute',
                    inset: 0,
                  }}
                />

                {selectedWall.lights.map(light => (
                  <React.Fragment key={`beam-${light.id}`}>
                    {renderLightBeam(light)}
                  </React.Fragment>
                ))}

                {selectedWall.artworks.map(artwork => {
                  const result = illuminationResults.find(r => r.artworkId === artwork.id);
                  const isSelected = selectedItem?.type === 'artwork' && selectedItem.id === artwork.id;
                  const isDragging = dragging?.type === 'artwork' && dragging.id === artwork.id;
                  
                  return (
                    <div
                      key={artwork.id}
                      className={`artwork ${isDragging ? 'dragging' : ''}`}
                      style={{
                        left: artwork.x,
                        top: artwork.y,
                        width: artwork.width,
                        height: artwork.height,
                        borderColor: isSelected ? '#4285f4' : undefined
                      }}
                      onMouseDown={(e) => handleMouseDown(e, 'artwork', artwork.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItem({ type: 'artwork', id: artwork.id });
                      }}
                    >
                      <div className="artwork-label">{artwork.name}</div>
                      {result && (
                        <div className="artwork-stats">
                          {result.averageLux.toFixed(0)} lux
                        </div>
                      )}
                    </div>
                  );
                })}

                {selectedWall.lights.map(light => {
                  const isSelected = selectedItem?.type === 'light' && selectedItem.id === light.id;
                  const isDragging = dragging?.type === 'light' && dragging.id === light.id;
                  
                  return (
                    <div
                      key={light.id}
                      className={`light ${isDragging ? 'dragging' : ''}`}
                      style={{
                        left: light.x,
                        top: light.y
                      }}
                      onMouseDown={(e) => handleMouseDown(e, 'light', light.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItem({ type: 'light', id: light.id });
                      }}
                    >
                      <div
                        className="light-glow"
                        style={{
                          boxShadow: isSelected ? '0 0 20px rgba(66, 133, 244, 0.8)' : undefined
                        }}
                      />
                      <div
                        className="light-body"
                        style={{
                          borderColor: isSelected ? '#4285f4' : '#fff'
                        }}
                      />
                    </div>
                  );
                })}

                <div className="drag-hint">拖拽作品和灯光调整位置</div>
              </div>

              <div className="stats-panel">
                <div className="stats-title">照度统计</div>
                {illuminationResults.length === 0 ? (
                  <div className="no-selection">该墙面暂无作品</div>
                ) : (
                  <div className="artwork-stats-grid">
                    {illuminationResults.map(result => {
                      const status = getStatStatus(result);
                      
                      return (
                        <div
                          key={result.artworkId}
                          className={`artwork-stat-card ${status}`}
                        >
                          <div className="artwork-stat-name">{result.artworkName}</div>
                          
                          <div className="stat-item">
                            <span className="stat-label">平均照度</span>
                            <span className={`stat-value ${getLuxStatus(result.averageLux)}`}>
                              {result.averageLux.toFixed(1)} lux
                            </span>
                          </div>
                          
                          <div className="stat-item">
                            <span className="stat-label">照度范围</span>
                            <span className="stat-value">
                              {result.minLux.toFixed(1)} - {result.maxLux.toFixed(1)} lux
                            </span>
                          </div>
                          
                          <div className="stat-item">
                            <span className="stat-label">阴影强度</span>
                            <span className={`stat-value ${result.shadowIntensity > 80 ? 'error' : 'good'}`}>
                              {result.shadowIntensity.toFixed(1)}%
                            </span>
                          </div>

                          {result.lightAngles.length > 0 && (
                            <div className="stat-item">
                              <span className="stat-label">照射角度</span>
                              <span className="stat-value">
                                {result.lightAngles.map(la => `${la.angle.toFixed(1)}°`).join(', ')}
                              </span>
                            </div>
                          )}
                          
                          {result.errors.length > 0 && (
                            <div className="error-list">
                              {result.errors.map((err, idx) => (
                                <div key={idx} className="error-item">⚠ {err}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        <aside className="property-panel">
          {!selectedItem ? (
            <div className="panel-section">
              <div className="panel-title">
                <span className="panel-icon">📋</span>
                属性面板
              </div>
              <div className="no-selection">点击画布中的作品或灯光查看详情</div>
            </div>
          ) : selectedArtwork ? (
            <div className="panel-section">
              <div className="panel-title">
                <span className="panel-icon artwork">🖼️</span>
                作品属性
              </div>
              
              <div className="selected-item-card">
                <div className="selected-item-name">{selectedArtwork.name}</div>
                <div className="selected-item-id">ID: {selectedArtwork.id}</div>
              </div>

              <div className="property-group">
                <label className="property-label">名称</label>
                <input
                  className="property-input"
                  type="text"
                  value={selectedArtwork.name}
                  onChange={(e) => updateArtwork(selectedArtwork.id, { name: e.target.value })}
                />
              </div>

              <div className="property-row">
                <div className="property-group">
                  <label className="property-label">X 坐标</label>
                  <input
                    className="property-input"
                    type="number"
                    value={selectedArtwork.x}
                    onChange={(e) => updateArtwork(selectedArtwork.id, { x: Number(e.target.value) })}
                  />
                </div>
                <div className="property-group">
                  <label className="property-label">Y 坐标</label>
                  <input
                    className="property-input"
                    type="number"
                    value={selectedArtwork.y}
                    onChange={(e) => updateArtwork(selectedArtwork.id, { y: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="property-row">
                <div className="property-group">
                  <label className="property-label">宽度</label>
                  <input
                    className="property-input"
                    type="number"
                    value={selectedArtwork.width}
                    onChange={(e) => updateArtwork(selectedArtwork.id, { width: Number(e.target.value) })}
                  />
                </div>
                <div className="property-group">
                  <label className="property-label">高度</label>
                  <input
                    className="property-input"
                    type="number"
                    value={selectedArtwork.height}
                    onChange={(e) => updateArtwork(selectedArtwork.id, { height: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          ) : selectedLight ? (
            <div className="panel-section">
              <div className="panel-title">
                <span className="panel-icon light">💡</span>
                灯光属性
              </div>
              
              <div className="selected-item-card">
                <div className="selected-item-name">{selectedLight.name}</div>
                <div className="selected-item-id">ID: {selectedLight.id}</div>
              </div>

              <div className="property-group">
                <label className="property-label">名称</label>
                <input
                  className="property-input"
                  type="text"
                  value={selectedLight.name}
                  onChange={(e) => updateLight(selectedLight.id, { name: e.target.value })}
                />
              </div>

              <div className="property-row">
                <div className="property-group">
                  <label className="property-label">X 坐标</label>
                  <input
                    className="property-input"
                    type="number"
                    value={selectedLight.x}
                    onChange={(e) => updateLight(selectedLight.id, { x: Number(e.target.value) })}
                  />
                </div>
                <div className="property-group">
                  <label className="property-label">Y 坐标</label>
                  <input
                    className="property-input"
                    type="number"
                    value={selectedLight.y}
                    onChange={(e) => updateLight(selectedLight.id, { y: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="property-group">
                <label className="property-label">照射角度 (°)</label>
                <input
                  className="property-input"
                  type="number"
                  value={selectedLight.angle}
                  onChange={(e) => updateLight(selectedLight.id, { angle: Number(e.target.value) })}
                />
                <div className="angle-display">
                  <span className="angle-arrow">↓</span>
                  0°=右 → 90°=上 → 180°=左 → 270°=下
                </div>
              </div>

              <div className="property-row">
                <div className="property-group">
                  <label className="property-label">强度</label>
                  <input
                    className="property-input"
                    type="number"
                    value={selectedLight.intensity}
                    onChange={(e) => updateLight(selectedLight.id, { intensity: Number(e.target.value) })}
                  />
                </div>
                <div className="property-group">
                  <label className="property-label">扩散角 (°)</label>
                  <input
                    className="property-input"
                    type="number"
                    value={selectedLight.spread}
                    onChange={(e) => updateLight(selectedLight.id, { spread: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {selectedWall && validationErrors.length > 0 && (
            <div className="panel-section">
              <div className="panel-title">
                <span className="panel-icon validation">⚠️</span>
                数据校验
              </div>
              <div className="validation-list">
                {validationErrors.map((error, index) => (
                  <div key={index} className={`validation-item ${error.type}`}>
                    <div className={`validation-type ${error.type}`}>
                      {error.type === 'duplicate' ? '重复' :
                       error.type === 'missing' ? '缺失' : '无效'}
                    </div>
                    <div>{error.message}</div>
                    {error.id && (
                      <div style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>
                        ID: {error.id}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default App;
