import React, { useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { downloadStateAsFile, loadStateFromFile, presetScenes } from '../utils/sceneManager';
import { createLogEntry } from '../utils/syncEngine';
import './ImportExport.css';

export const ImportExport: React.FC = () => {
  const { state, loadState, resetState, addLog } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    downloadStateAsFile(state);
    
    const log = createLogEntry(
      'sync',
      'system',
      'user',
      '用户导出了当前状态为 JSON 文件',
      {
        timestamp: Date.now(),
        exportVersion: state.server.currentVersion,
        deviceCount: state.devices.length,
        logCount: state.logs.length
      }
    );
    addLog(log);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const importedState = await loadStateFromFile(file);
    
    if (importedState) {
      loadState(importedState);
      
      const log = createLogEntry(
        'sync',
        'system',
        'user',
        `成功导入状态文件: ${file.name}`,
        {
          fileName: file.name,
          fileSize: file.size,
          importedVersion: importedState.server.currentVersion
        }
      );
      addLog(log);
    } else {
      alert('导入失败：无效的状态文件格式');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLoadScene = (sceneIndex: number) => {
    const scene = presetScenes[sceneIndex];
    if (scene) {
      loadState(scene.initialState);
      
      const log = createLogEntry(
        'sync',
        'system',
        'user',
        `加载预置场景: ${scene.name}`,
        {
          sceneName: scene.name,
          sceneDescription: scene.description
        }
      );
      addLog(log);
    }
  };

  const handleReset = () => {
    if (confirm('确定要重置所有状态吗？所有未保存的数据将丢失。')) {
      resetState();
    }
  };

  return (
    <div className="import-export-container">
      <div className="import-export-header">
        <h3>数据管理</h3>
      </div>

      <div className="import-export-content">
        <div className="section">
          <h4>快速操作</h4>
          <div className="action-buttons">
            <button className="action-btn export-btn" onClick={handleExport}>
              📤 导出当前状态
            </button>
            <button className="action-btn import-btn" onClick={handleImportClick}>
              📥 导入状态文件
            </button>
            <button className="action-btn reset-btn" onClick={handleReset}>
              🔄 重置为初始状态
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <div className="section">
          <h4>预置场景</h4>
          <div className="preset-scenes">
            {presetScenes.map((scene, index) => (
              <div key={index} className="scene-card">
                <div className="scene-header">
                  <span className="scene-icon">
                    {index === 0 ? '⚠️' : index === 1 ? '🔄' : '📋'}
                  </span>
                  <span className="scene-name">{scene.name}</span>
                </div>
                <p className="scene-description">{scene.description}</p>
                <button
                  className="scene-load-btn"
                  onClick={() => handleLoadScene(index)}
                >
                  加载场景
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="section info-section">
          <h4>使用说明</h4>
          <div className="info-content">
            <div className="info-item">
              <span className="info-icon">💡</span>
              <div className="info-text">
                <strong>导出功能：</strong>将当前所有状态（设备草稿、服务端版本、同步日志）导出为 JSON 文件，方便分享和存档。
              </div>
            </div>
            <div className="info-item">
              <span className="info-icon">💡</span>
              <div className="info-text">
                <strong>导入功能：</strong>从 JSON 文件恢复之前保存的状态，可用于复现特定的冲突场景。
              </div>
            </div>
            <div className="info-item">
              <span className="info-icon">💡</span>
              <div className="info-text">
                <strong>预置场景：</strong>快速加载预设的冲突演练场景，一键体验同步冲突的完整流程。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
