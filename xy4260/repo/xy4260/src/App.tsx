import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SceneRenderer } from './scene/SceneRenderer';
import { RulesDetector } from './detection/RulesDetector';
import { LocalStoragePersistence } from './persistence/LocalStorage';
import { ImportExportManager } from './importExport/ImportExport';
import { createSampleLayout, createLayoutWithIssues, createEmptyLayout } from './data/sampleData';
import { createElement, getElementTypeName, updateElementPosition, updateElementRotation } from './utils/layoutUtils';
import { LayoutModel, LayoutElement, DetectionResult, ElementType } from './types';
import './App.css';

const App: React.FC = () => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const sceneRendererRef = useRef<SceneRenderer | null>(null);
  const rulesDetectorRef = useRef<RulesDetector | null>(null);
  const persistenceRef = useRef<LocalStoragePersistence | null>(null);
  const importExportRef = useRef<ImportExportManager | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [layoutModel, setLayoutModel] = useState<LayoutModel>(() => {
    const persistence = new LocalStoragePersistence();
    const saved = persistence.loadLayout();
    return saved || createSampleLayout();
  });

  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [selectedElement, setSelectedElement] = useState<LayoutElement | null>(null);
  const [showDetectionPanel, setShowDetectionPanel] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showHeatZones, setShowHeatZones] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    rulesDetectorRef.current = new RulesDetector();
    persistenceRef.current = new LocalStoragePersistence();
    importExportRef.current = new ImportExportManager();
  }, []);

  useEffect(() => {
    if (!canvasContainerRef.current || initialized) return;

    const init = () => {
      if (!canvasContainerRef.current) return;

      sceneRendererRef.current = new SceneRenderer({
        container: canvasContainerRef.current,
        hallWidth: layoutModel.hall.width,
        hallDepth: layoutModel.hall.depth,
      });

      sceneRendererRef.current.updateLayout(layoutModel);

      sceneRendererRef.current.setOnElementClick((elementId) => {
        const element = layoutModel.elements.find(e => e.id === elementId);
        setSelectedElement(element || null);
      });

      sceneRendererRef.current.setOnElementDrag((elementId, position) => {
        setLayoutModel(prev => {
          const updated = {
            ...prev,
            elements: prev.elements.map(el => {
              if (el.id === elementId) {
                return updateElementPosition(el, {
                  x: position.x,
                  y: el.position.y,
                  z: position.z,
                });
              }
              return el;
            }),
          };
          
          const element = updated.elements.find(e => e.id === elementId);
          if (element) {
            setSelectedElement(element);
          }
          
          return updated;
        });
      });

      setInitialized(true);
    };

    setTimeout(init, 100);

    return () => {
      if (sceneRendererRef.current) {
        sceneRendererRef.current.dispose();
        sceneRendererRef.current = null;
      }
    };
  }, [initialized, layoutModel.hall.width, layoutModel.hall.depth]);

  useEffect(() => {
    if (sceneRendererRef.current) {
      sceneRendererRef.current.updateLayout(layoutModel);
      
      if (showHeatZones && detectionResult) {
        sceneRendererRef.current.showHeatZones(detectionResult.heatZones);
      } else {
        sceneRendererRef.current.showHeatZones([]);
      }
    }
  }, [layoutModel, showHeatZones, detectionResult]);

  useEffect(() => {
    if (selectedElement && sceneRendererRef.current) {
      sceneRendererRef.current.selectElement(selectedElement.id);
    }
  }, [selectedElement]);

  const runDetection = useCallback(() => {
    if (!rulesDetectorRef.current) return;

    const result = rulesDetectorRef.current.detect(layoutModel);
    setDetectionResult(result);
    setShowDetectionPanel(true);

    if (result.totalIssues > 0) {
      showMessage(`检测完成，发现 ${result.totalIssues} 个问题`, 'info');
    } else {
      showMessage('检测完成，所有项均通过！', 'success');
    }
  }, [layoutModel]);

  const saveLayout = useCallback(() => {
    if (!persistenceRef.current) return;

    try {
      persistenceRef.current.saveLayout(layoutModel);
      if (detectionResult) {
        persistenceRef.current.saveDetectionResult(detectionResult);
      }
      showMessage('保存成功！刷新页面后可恢复', 'success');
    } catch (error) {
      showMessage('保存失败: ' + (error as Error).message, 'error');
    }
  }, [layoutModel, detectionResult]);

  const handleFileImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !importExportRef.current) return;

    importExportRef.current.importLayout(file)
      .then((model) => {
        setLayoutModel(model);
        setSelectedElement(null);
        setDetectionResult(null);
        setShowHeatZones(false);
        showMessage('导入成功！', 'success');
      })
      .catch((error) => {
        showMessage('导入失败: ' + (error as Error).message, 'error');
      });

    event.target.value = '';
  }, []);

  const exportJSON = useCallback(() => {
    if (!importExportRef.current) return;
    importExportRef.current.exportLayout(layoutModel);
    showMessage('JSON 方案已导出', 'success');
  }, [layoutModel]);

  const exportMarkdown = useCallback(() => {
    if (!importExportRef.current) return;
    
    const result = detectionResult || {
      heatZones: [],
      visionOcclusions: [],
      fireExitIssues: [],
      entranceExitConflicts: [],
      totalIssues: 0,
    };

    importExportRef.current.exportMarkdownReport({
      model: layoutModel,
      detectionResult: result,
      reportDate: new Date().toLocaleString('zh-CN'),
      reportVersion: '1.0.0',
    });
    showMessage('Markdown 报告已导出', 'success');
  }, [layoutModel, detectionResult]);

  const exportPackage = useCallback(() => {
    if (!importExportRef.current) return;
    
    const result = detectionResult || {
      heatZones: [],
      visionOcclusions: [],
      fireExitIssues: [],
      entranceExitConflicts: [],
      totalIssues: 0,
    };

    importExportRef.current.exportPackage(layoutModel, result);
    showMessage('方案包已导出', 'success');
  }, [layoutModel, detectionResult]);

  const loadSampleLayout = useCallback(() => {
    const model = createSampleLayout();
    setLayoutModel(model);
    setSelectedElement(null);
    setDetectionResult(null);
    setShowHeatZones(false);
    showMessage('示例布局已加载', 'success');
  }, []);

  const loadProblemLayout = useCallback(() => {
    const model = createLayoutWithIssues();
    setLayoutModel(model);
    setSelectedElement(null);
    setDetectionResult(null);
    setShowHeatZones(false);
    showMessage('问题演示布局已加载', 'info');
  }, []);

  const loadEmptyLayout = useCallback(() => {
    const model = createEmptyLayout();
    setLayoutModel(model);
    setSelectedElement(null);
    setDetectionResult(null);
    setShowHeatZones(false);
    showMessage('空布局已创建', 'success');
  }, []);

  const addElement = useCallback((type: ElementType) => {
    const name = `${getElementTypeName(type)} ${layoutModel.elements.filter(e => e.type === type).length + 1}`;
    const newElement = createElement(type, name);
    
    const newElementWithPos = {
      ...newElement,
      position: {
        x: Math.random() * 10 - 5,
        y: 0,
        z: Math.random() * 8 - 4,
      },
    };

    setLayoutModel(prev => ({
      ...prev,
      elements: [...prev.elements, newElementWithPos],
    }));
    setSelectedElement(newElementWithPos);
    showMessage(`已添加 ${getElementTypeName(type)}`, 'success');
  }, [layoutModel.elements]);

  const deleteSelectedElement = useCallback(() => {
    if (!selectedElement) return;

    setLayoutModel(prev => ({
      ...prev,
      elements: prev.elements.filter(e => e.id !== selectedElement.id),
    }));
    setSelectedElement(null);
    showMessage(`已删除 ${selectedElement.name}`, 'success');
  }, [selectedElement]);

  const rotateSelectedElement = useCallback((direction: number) => {
    if (!selectedElement || !sceneRendererRef.current) return;

    const deltaY = direction * (Math.PI / 8);
    sceneRendererRef.current.rotateSelectedElement(deltaY);

    setLayoutModel(prev => ({
      ...prev,
      elements: prev.elements.map(el => {
        if (el.id === selectedElement.id) {
          return updateElementRotation(el, {
            x: el.rotation.x,
            y: el.rotation.y + deltaY,
            z: el.rotation.z,
          });
        }
        return el;
      }),
    }));
  }, [selectedElement]);

  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'heatZones': return '🔥';
      case 'visionOcclusions': return '👁️';
      case 'fireExitIssues': return '🚨';
      case 'entranceExitConflicts': return '⚡';
      default: return '⚠️';
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🏛️ 展厅动线热区排布器</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={runDetection}>
            🔍 规则检测
          </button>
          <button className="btn btn-success" onClick={saveLayout}>
            💾 保存
          </button>
          <label className="btn btn-info file-input-label">
            📥 导入 JSON
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileImport}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </header>

      <div className="main-content">
        <aside className="sidebar left-sidebar">
          <div className="sidebar-section">
            <h3>📋 布局模板</h3>
            <div className="button-group">
              <button className="btn btn-sm" onClick={loadSampleLayout}>
                示例布局
              </button>
              <button className="btn btn-sm btn-warning" onClick={loadProblemLayout}>
                问题演示
              </button>
              <button className="btn btn-sm" onClick={loadEmptyLayout}>
                空布局
              </button>
            </div>
          </div>

          <div className="sidebar-section">
            <h3>➕ 添加元素</h3>
            <div className="button-group">
              <button 
                className="btn btn-sm" 
                style={{ backgroundColor: '#8B4513', color: 'white' }}
                onClick={() => addElement('cabinet')}
              >
                📦 展柜
              </button>
              <button 
                className="btn btn-sm"
                style={{ backgroundColor: '#00AA00', color: 'white' }}
                onClick={() => addElement('entrance')}
              >
                🚪 入口
              </button>
              <button 
                className="btn btn-sm"
                style={{ backgroundColor: '#CC0000', color: 'white' }}
                onClick={() => addElement('exit')}
              >
                🚪 出口
              </button>
              <button 
                className="btn btn-sm"
                style={{ backgroundColor: '#0000CC', color: 'white' }}
                onClick={() => addElement('interactive_screen')}
              >
                📺 互动屏
              </button>
              <button 
                className="btn btn-sm"
                style={{ backgroundColor: '#FF8C00', color: 'white' }}
                onClick={() => addElement('fire_exit')}
              >
                🚨 消防通道
              </button>
            </div>
          </div>

          <div className="sidebar-section">
            <h3>📤 导出</h3>
            <div className="button-group">
              <button className="btn btn-sm" onClick={exportJSON}>
                JSON 方案
              </button>
              <button className="btn btn-sm" onClick={exportMarkdown}>
                Markdown 报告
              </button>
              <button className="btn btn-sm" onClick={exportPackage}>
                完整方案包
              </button>
            </div>
          </div>

          <div className="sidebar-section">
            <h3>⚙️ 显示设置</h3>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showHeatZones}
                onChange={(e) => setShowHeatZones(e.target.checked)}
                disabled={!detectionResult}
              />
              显示人流热区
            </label>
          </div>

          {selectedElement && (
            <div className="sidebar-section">
              <h3>✏️ 编辑选中元素</h3>
              <div className="element-info">
                <p><strong>名称:</strong> {selectedElement.name}</p>
                <p><strong>类型:</strong> {getElementTypeName(selectedElement.type)}</p>
                <p><strong>位置:</strong> ({selectedElement.position.x.toFixed(1)}, {selectedElement.position.z.toFixed(1)})</p>
                <p><strong>旋转:</strong> {(selectedElement.rotation.y * 180 / Math.PI).toFixed(0)}°</p>
              </div>
              <div className="button-group">
                <button className="btn btn-sm" onClick={() => rotateSelectedElement(-1)}>
                  ⬅️ 左转
                </button>
                <button className="btn btn-sm" onClick={() => rotateSelectedElement(1)}>
                  右转 ➡️
                </button>
              </div>
              <button 
                className="btn btn-sm btn-danger" 
                onClick={deleteSelectedElement}
              >
                🗑️ 删除元素
              </button>
            </div>
          )}
        </aside>

        <main className="scene-container">
          <div ref={canvasContainerRef} className="canvas-container" />
          
          {message && (
            <div className={`message message-${message.type}`}>
              {message.text}
            </div>
          )}
        </main>

        {showDetectionPanel && detectionResult && (
          <aside className="sidebar right-sidebar">
            <div className="sidebar-header">
              <h3>📊 检测结果</h3>
              <button 
                className="btn-close" 
                onClick={() => setShowDetectionPanel(false)}
              >
                ✕
              </button>
            </div>

            <div className="detection-summary">
              <p className={detectionResult.totalIssues === 0 ? 'status-good' : 'status-warning'}>
                {detectionResult.totalIssues === 0 
                  ? '✅ 所有项均通过' 
                  : `⚠️ 发现 ${detectionResult.totalIssues} 个问题`}
              </p>
            </div>

            <div className="detection-details">
              {detectionResult.heatZones.length > 0 && (
                <div className="detection-group">
                  <h4>{getIssueIcon('heatZones')} 人流热区 ({detectionResult.heatZones.length})</h4>
                  {detectionResult.heatZones.map((zone, idx) => (
                    <div key={idx} className="issue-item warning">
                      <p><strong>强度:</strong> {(zone.intensity * 100).toFixed(0)}%</p>
                      <p><strong>半径:</strong> {zone.radius.toFixed(1)}m</p>
                      <p className="issue-reason">{zone.reason}</p>
                    </div>
                  ))}
                </div>
              )}

              {detectionResult.visionOcclusions.length > 0 && (
                <div className="detection-group">
                  <h4>{getIssueIcon('visionOcclusions')} 视线遮挡 ({Math.ceil(detectionResult.visionOcclusions.length / 2)})</h4>
                  {Array.from(new Set(detectionResult.visionOcclusions.map(o => 
                    [o.elementId, o.occludedBy].sort().join('-')
                  ))).map((pair, idx) => {
                    const occlusion = detectionResult.visionOcclusions.find(o => 
                      [o.elementId, o.occludedBy].sort().join('-') === pair
                    );
                    if (!occlusion) return null;
                    return (
                      <div key={idx} className="issue-item warning">
                        <p><strong>"{occlusion.elementName}"</strong> 被 <strong>"{occlusion.occludedByName}"</strong> 遮挡</p>
                        <p><strong>遮挡程度:</strong> {occlusion.occlusionPercentage}%</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {detectionResult.fireExitIssues.length > 0 && (
                <div className="detection-group">
                  <h4>{getIssueIcon('fireExitIssues')} 消防通道问题 ({detectionResult.fireExitIssues.length})</h4>
                  {detectionResult.fireExitIssues.map((issue, idx) => (
                    <div key={idx} className="issue-item danger">
                      <p><strong>{issue.elementName}</strong></p>
                      <p className="issue-type">
                        {issue.issue === 'width_insufficient' ? '宽度不足' : '被阻挡'}
                      </p>
                      <p className="issue-details">{issue.details}</p>
                    </div>
                  ))}
                </div>
              )}

              {detectionResult.entranceExitConflicts.length > 0 && (
                <div className="detection-group">
                  <h4>{getIssueIcon('entranceExitConflicts')} 入口出口冲突 ({detectionResult.entranceExitConflicts.length})</h4>
                  {detectionResult.entranceExitConflicts.map((conflict, idx) => (
                    <div key={idx} className="issue-item warning">
                      <p><strong>入口:</strong> {conflict.entranceName}</p>
                      <p><strong>出口:</strong> {conflict.exitName}</p>
                      <p><strong>当前距离:</strong> {conflict.distance}m</p>
                      <p><strong>要求:</strong> ≥ {conflict.minimumRequiredDistance}m</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      <footer className="app-footer">
        <p>🎯 使用说明: 鼠标左键拖动元素 | 选中后用按钮旋转 | 点击空白处取消选择</p>
      </footer>
    </div>
  );
};

export default App;
