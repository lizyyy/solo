import React, { useState, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { HoldLibrary } from './components/HoldLibrary';
import { RouteList } from './components/RouteList';
import { RiskPanel } from './components/RiskPanel';
import { WallCanvas2D } from './components/WallCanvas2D';
import { WallCanvas3D } from './components/WallCanvas3D';
import { HoldShape, HoldSize, Route, WallConfig, DifficultyLevel, ViewMode, UserProfile } from './types';
import { ROUTE_COLORS, DIFFICULTY_NAMES, GRADE_OPTIONS, DIFFICULTY_LEVELS } from './data/sampleData';
import { exportAsJSON, importFromJSON, downloadJSON } from './utils/localStorage';
import { generateReport, exportAsMarkdown, exportAsHTML } from './utils/exportReport';
import { v4 as uuidv4 } from 'uuid';

function AppContent() {
  const {
    state,
    activeWall,
    activeRoute,
    wallRoutes,
    dispatch,
    createNewRoute,
  } = useApp();

  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editingWall, setEditingWall] = useState<WallConfig | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleViewModeChange = (mode: ViewMode) => {
    dispatch({ type: 'SET_VIEW_MODE', payload: mode });
  };

  const handleSelectRoute = (routeId: string | null) => {
    dispatch({ type: 'SET_ACTIVE_ROUTE', payload: routeId });
  };

  const handleEditRoute = (route: Route) => {
    setEditingRoute({ ...route });
  };

  const handleSaveRoute = () => {
    if (editingRoute) {
      dispatch({ type: 'UPDATE_ROUTE', payload: editingRoute });
      setEditingRoute(null);
    }
  };

  const handleDeleteRoute = (routeId: string) => {
    if (confirm('确定要删除这条线路吗？')) {
      dispatch({ type: 'DELETE_ROUTE', payload: routeId });
    }
  };

  const handleSaveWall = () => {
    if (editingWall) {
      dispatch({ type: 'UPDATE_WALL', payload: editingWall });
      setEditingWall(null);
    }
  };

  const handleCreateNewWall = () => {
    const newWall: WallConfig = {
      id: uuidv4(),
      name: '新墙面',
      width: 400,
      height: 300,
      angle: 5,
      zones: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    dispatch({ type: 'ADD_WALL', payload: newWall });
    setEditingWall(newWall);
  };

  const handleExportJSON = () => {
    const json = exportAsJSON(state);
    downloadJSON(json, `climbing-routes-${Date.now()}.json`);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const imported = importFromJSON(content);
      if (imported) {
        dispatch({ type: 'IMPORT_DATA', payload: imported });
        setShowImportModal(false);
      } else {
        alert('导入失败：文件格式不正确');
      }
    };
    reader.readAsText(file);
  };

  const handleExportReport = (format: 'markdown' | 'html') => {
    if (!activeWall) return;

    const report = generateReport(activeWall, state.routes, state.userProfile);
    
    if (format === 'markdown') {
      const md = exportAsMarkdown(report);
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.title.replace(/\s/g, '-')}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const html = exportAsHTML(report);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.title.replace(/\s/g, '-')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    
    setShowExportModal(false);
  };

  const handleDragStart = (_shape: HoldShape, _size: HoldSize) => {
  };

  const handleUpdateUserProfile = (updates: Partial<UserProfile>) => {
    dispatch({ type: 'UPDATE_USER_PROFILE', payload: updates });
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🧗 攀岩馆线路摆点预演器</h1>
        <div className="header-actions">
          <select
            className="form-select"
            style={{ width: '200px' }}
            value={state.activeWallId || ''}
            onChange={(e) => {
              if (e.target.value) {
                dispatch({ type: 'SET_ACTIVE_WALL', payload: e.target.value });
              }
            }}
          >
            {state.walls.map((wall) => (
              <option key={wall.id} value={wall.id}>
                {wall.name}
              </option>
            ))}
          </select>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (activeWall) {
                setEditingWall({ ...activeWall });
              }
            }}
            disabled={!activeWall}
          >
            编辑墙面
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleCreateNewWall}
          >
            + 新建墙面
          </button>
          <div className="divider" style={{ width: '1px', height: '24px', margin: '0 4px' }} />
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowUserProfileModal(true)}
          >
            ⚙️ 设置
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowImportModal(true)}
          >
            📥 导入
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowExportModal(true)}
          >
            📤 导出
          </button>
        </div>
      </header>

      <main className="main-content">
        <aside className="left-panel">
          <HoldLibrary onDragStart={handleDragStart} />
          <div className="divider" />
          <RouteList
            routes={wallRoutes}
            activeRouteId={state.activeRouteId}
            onSelectRoute={handleSelectRoute}
            onEditRoute={handleEditRoute}
          />
          
          {activeRoute && (
            <div className="panel-section">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3 className="panel-title" style={{ marginBottom: 0 }}>当前线路</h3>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDeleteRoute(activeRoute.id)}
                >
                  删除
                </button>
              </div>
              <div className="stats-grid" style={{ marginTop: '12px' }}>
                <div className="stat-card">
                  <div className="stat-label">岩点数量</div>
                  <div className="stat-value">{activeRoute.holds.length}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">难度</div>
                  <div className="stat-value">{DIFFICULTY_NAMES[activeRoute.difficulty]}</div>
                </div>
              </div>
            </div>
          )}
        </aside>

        <section className="center-panel">
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${state.viewMode === '2d' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('2d')}
            >
              2D 编辑
            </button>
            <button
              className={`view-toggle-btn ${state.viewMode === '3d' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('3d')}
            >
              3D 预览
            </button>
          </div>

          {state.viewMode === '2d' ? (
            <WallCanvas2D />
          ) : (
            <WallCanvas3D />
          )}

          <div className="toolbar">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {activeRoute 
                ? `当前编辑: ${activeRoute.name} (${DIFFICULTY_NAMES[activeRoute.difficulty]})`
                : activeWall 
                  ? `墙面: ${activeWall.name} (${activeWall.width}×${activeWall.height}cm, 倾角${activeWall.angle}°)`
                  : '请先选择或创建一面墙'}
            </div>
          </div>
        </section>

        <aside className="right-panel">
          <RiskPanel />
          <div className="divider" />
          
          {activeWall && (
            <div className="panel-section">
              <h3 className="panel-title">墙面信息</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">宽度</div>
                  <div className="stat-value">{activeWall.width}cm</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">高度</div>
                  <div className="stat-value">{activeWall.height}cm</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">倾角</div>
                  <div className="stat-value">{activeWall.angle}°</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">分区</div>
                  <div className="stat-value">{activeWall.zones.length}</div>
                </div>
              </div>
              
              {activeWall.zones.length > 0 && (
                <div className="zone-grid" style={{ marginTop: '12px' }}>
                  {activeWall.zones.map((zone) => (
                    <div key={zone.id} className="zone-item">
                      <span>{zone.name}</span>
                      <div className="zone-color" style={{ backgroundColor: zone.color }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </main>

      {editingRoute && (
        <div className="modal-overlay" onClick={() => setEditingRoute(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>编辑线路</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingRoute(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">线路名称</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingRoute.name}
                  onChange={(e) => setEditingRoute({ ...editingRoute, name: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">线路颜色</label>
                <div className="color-picker">
                  {ROUTE_COLORS.map((color) => (
                    <div
                      key={color}
                      className={`color-option ${editingRoute.color === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setEditingRoute({ ...editingRoute, color })}
                    />
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">难度等级</label>
                <select
                  className="form-select"
                  value={editingRoute.difficulty}
                  onChange={(e) => setEditingRoute({ ...editingRoute, difficulty: e.target.value as DifficultyLevel })}
                >
                  {DIFFICULTY_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {DIFFICULTY_NAMES[level]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">预估难度 (可选)</label>
                <select
                  className="form-select"
                  value={editingRoute.estimatedGrade}
                  onChange={(e) => setEditingRoute({ ...editingRoute, estimatedGrade: e.target.value })}
                >
                  <option value="">未设置</option>
                  {GRADE_OPTIONS.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">备注</label>
                <textarea
                  className="form-input"
                  style={{ height: '80px' }}
                  value={editingRoute.notes || ''}
                  onChange={(e) => setEditingRoute({ ...editingRoute, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setEditingRoute(null)}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveRoute}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {editingWall && (
        <div className="modal-overlay" onClick={() => setEditingWall(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>编辑墙面</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingWall(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">墙面名称</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingWall.name}
                  onChange={(e) => setEditingWall({ ...editingWall, name: e.target.value })}
                />
              </div>
              
              <div className="wall-config">
                <div className="form-group">
                  <label className="form-label">宽度 (cm)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editingWall.width}
                    onChange={(e) => setEditingWall({ ...editingWall, width: parseInt(e.target.value) || 400 })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">高度 (cm)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editingWall.height}
                    onChange={(e) => setEditingWall({ ...editingWall, height: parseInt(e.target.value) || 300 })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">倾角 (°)</label>
                <input
                  type="number"
                  className="form-input"
                  value={editingWall.angle}
                  onChange={(e) => setEditingWall({ ...editingWall, angle: parseInt(e.target.value) || 0 })}
                  min="-45"
                  max="45"
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  正值表示仰角（适合练习），负值表示俯角（更有挑战性）
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">分区 (当前 {editingWall.zones.length} 个)</label>
                <div className="zone-grid">
                  {editingWall.zones.map((zone) => (
                    <div key={zone.id} className="zone-item">
                      <span>{zone.name}</span>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setEditingWall({
                          ...editingWall,
                          zones: editingWall.zones.filter(z => z.id !== zone.id),
                        })}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '8px' }}
                  onClick={() => {
                    const newZone = {
                      id: uuidv4(),
                      name: `分区 ${editingWall.zones.length + 1}`,
                      color: 'rgba(59, 130, 246, 0.1)',
                      x: 0,
                      y: 0,
                      width: editingWall.width,
                      height: editingWall.height / 2,
                      riskMultiplier: 1.0,
                    };
                    setEditingWall({
                      ...editingWall,
                      zones: [...editingWall.zones, newZone],
                    });
                  }}
                >
                  + 添加分区
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setEditingWall(null)}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveWall}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>导出</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowExportModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">导出格式</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleExportJSON}
                  >
                    📄 导出 JSON (项目数据)
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleExportReport('markdown')}
                  >
                    📄 导出 Markdown 报告
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleExportReport('html')}
                  >
                    🌐 导出 HTML 报告
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>导入</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowImportModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">选择 JSON 文件</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  style={{ marginTop: '8px' }}
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                提示：导入将覆盖当前所有数据
              </p>
            </div>
          </div>
        </div>
      )}

      {showUserProfileModal && (
        <div className="modal-overlay" onClick={() => setShowUserProfileModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>用户设置</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowUserProfileModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="form-label" style={{ marginBottom: '12px' }}>
                这些设置用于计算风险评估（臂展、身高）
              </p>
              
              <div className="form-group">
                <label className="form-label">身高 (cm)</label>
                <input
                  type="number"
                  className="form-input"
                  value={state.userProfile.height}
                  onChange={(e) => handleUpdateUserProfile({ height: parseInt(e.target.value) || 170 })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">臂展 (cm)</label>
                <input
                  type="number"
                  className="form-input"
                  value={state.userProfile.armSpan}
                  onChange={(e) => handleUpdateUserProfile({ armSpan: parseInt(e.target.value) || 175 })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">技术等级</label>
                <select
                  className="form-select"
                  value={state.userProfile.skillLevel}
                  onChange={(e) => handleUpdateUserProfile({ skillLevel: e.target.value as DifficultyLevel })}
                >
                  {DIFFICULTY_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {DIFFICULTY_NAMES[level]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={() => setShowUserProfileModal(false)}
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
