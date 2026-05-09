import { useState, useCallback } from 'react';
import Scene3D from './components/Scene3D';
import { INSTRUMENT_TYPES } from './utils/instrumentUtils';
import {
  saveSetup,
  getAllSetups,
  deleteSetup,
  exportSetupAsJSON,
  generateValidationReport,
  exportReport
} from './utils/storageUtils';
import './App.css';

export default function App() {
  const [instruments, setInstruments] = useState({});
  const [validationResults, setValidationResults] = useState(null);
  const [validationSummary, setValidationSummary] = useState(null);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState(null);
  const [triggerAddInstrument, setTriggerAddInstrument] = useState(null);
  const [loadedSetup, setLoadedSetup] = useState(null);
  const [savedSetups, setSavedSetups] = useState(getAllSetups());
  const [triggerRecordFrame, setTriggerRecordFrame] = useState(null);
  const [triggerPlayback, setTriggerPlayback] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [setupName, setSetupName] = useState('');
  const [activeTab, setActiveTab] = useState('instruments');

  const handleInstrumentsChange = useCallback((instrumentsObj) => {
    setInstruments(instrumentsObj);
  }, []);

  const handleValidationChange = useCallback((results, summary) => {
    setValidationResults(results);
    setValidationSummary(summary);
  }, []);

  const handleInstrumentSelect = useCallback((id) => {
    setSelectedInstrumentId(id);
  }, []);

  const handleAddInstrument = useCallback((typeKey) => {
    setTriggerAddInstrument({ typeKey, timestamp: Date.now() });
  }, []);

  const handleSaveSetup = () => {
    if (!setupName.trim()) {
      alert('请输入方案名称');
      return;
    }
    
    try {
      saveSetup(setupName, instruments, validationResults);
      setSavedSetups(getAllSetups());
      setSetupName('');
      alert('方案保存成功！');
    } catch (error) {
      alert('保存失败：' + error.message);
    }
  };

  const handleLoadSetup = useCallback((setup) => {
    setLoadedSetup({ ...setup, timestamp: Date.now() });
    setSelectedInstrumentId(null);
  }, []);

  const handleDeleteSetup = (setupId) => {
    if (confirm('确定要删除此方案吗？')) {
      deleteSetup(setupId);
      setSavedSetups(getAllSetups());
    }
  };

  const handleExportSetup = (setup) => {
    exportSetupAsJSON(setup);
  };

  const handleExportReport = () => {
    if (!validationResults) {
      alert('请先放置器械进行校验');
      return;
    }
    
    const setup = {
      name: setupName || '未命名方案',
      id: 'current',
      createdAt: new Date().toISOString()
    };
    
    const report = generateValidationReport(setup, validationResults, instruments);
    const format = confirm('导出为JSON格式？\n(点击"取消"导出为文本格式)') ? 'json' : 'text';
    exportReport(report, format);
  };

  const handleStartRecording = () => {
    setIsRecording(true);
    setTriggerRecordFrame({ action: 'start', timestamp: Date.now() });
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    setTriggerRecordFrame({ action: 'stop', timestamp: Date.now() });
  };

  const handleRecordFrame = () => {
    setTriggerRecordFrame({ action: 'record', timestamp: Date.now() });
  };

  const handlePlay = () => {
    setTriggerPlayback({ action: 'play', timestamp: Date.now() });
  };

  const handlePause = () => {
    setTriggerPlayback({ action: 'pause', timestamp: Date.now() });
  };

  const handleStopPlayback = () => {
    setTriggerPlayback({ action: 'stop', timestamp: Date.now() });
  };

  const instrumentList = Object.values(instruments);
  const instrumentTypesList = Object.entries(INSTRUMENT_TYPES);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🏥 医疗器械摆台三维校验系统</h1>
        <div className="header-status">
          {validationSummary && (
            <span className={`status-badge ${validationSummary.isValid ? 'valid' : 'invalid'}`}>
              {validationSummary.isValid 
                ? (validationSummary.hasWarnings ? '⚠️ 通过（有警告）' : '✅ 通过')
                : '❌ 不通过'
              }
            </span>
          )}
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <div className="tabs">
            <button 
              className={`tab ${activeTab === 'instruments' ? 'active' : ''}`}
              onClick={() => setActiveTab('instruments')}
            >
              🧰 器械库
            </button>
            <button 
              className={`tab ${activeTab === 'placed' ? 'active' : ''}`}
              onClick={() => setActiveTab('placed')}
            >
              📦 已放置 ({instrumentList.length})
            </button>
            <button 
              className={`tab ${activeTab === 'validation' ? 'active' : ''}`}
              onClick={() => setActiveTab('validation')}
            >
              ✅ 校验结果
            </button>
            <button 
              className={`tab ${activeTab === 'setups' ? 'active' : ''}`}
              onClick={() => setActiveTab('setups')}
            >
              💾 方案管理
            </button>
            <button 
              className={`tab ${activeTab === 'replay' ? 'active' : ''}`}
              onClick={() => setActiveTab('replay')}
            >
              🎬 回放控制
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'instruments' && (
              <div className="panel">
                <h3>添加器械</h3>
                <div className="instrument-grid">
                  {instrumentTypesList.map(([key, config]) => (
                    <button
                      key={key}
                      className="instrument-btn"
                      onClick={() => handleAddInstrument(key)}
                      title={`最小间距: ${config.minDistance}m`}
                    >
                      <div className="instrument-icon">🔧</div>
                      <div className="instrument-name">{config.name}</div>
                    </button>
                  ))}
                </div>
                <div className="tips">
                  <p>💡 提示：</p>
                  <ul>
                    <li>点击按钮添加器械</li>
                    <li>拖拽器械调整位置</li>
                    <li>按 R/E 键旋转选中的器械</li>
                    <li>绿色区域为无菌区</li>
                    <li>蓝色区域为取用路径</li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'placed' && (
              <div className="panel">
                <h3>已放置器械</h3>
                {instrumentList.length === 0 ? (
                  <p className="empty-message">尚未放置任何器械</p>
                ) : (
                  <div className="instrument-list">
                    {instrumentList.map(instrument => (
                      <div
                        key={instrument.userData.id}
                        className={`instrument-item ${selectedInstrumentId === instrument.userData.id ? 'selected' : ''}`}
                        onClick={() => setSelectedInstrumentId(instrument.userData.id)}
                      >
                        <span className="item-icon">🔧</span>
                        <span className="item-name">{instrument.userData.name}</span>
                        <span className="item-pos">
                          X: {instrument.position.x.toFixed(2)}m<br/>
                          Z: {instrument.position.z.toFixed(2)}m
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'validation' && (
              <div className="panel">
                <h3>校验结果</h3>
                {!validationSummary ? (
                  <p className="empty-message">请先放置器械进行校验</p>
                ) : (
                  <div className="validation-results">
                    <div className="summary-stats">
                      <div className="stat-item">
                        <span className="stat-label">高严重度</span>
                        <span className={`stat-value high`}>{validationSummary.high}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">中严重度</span>
                        <span className={`stat-value medium`}>{validationSummary.medium}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">低严重度</span>
                        <span className={`stat-value low`}>{validationSummary.low}</span>
                      </div>
                    </div>

                    <div className="issues-detail">
                      <h4>问题详情</h4>
                      {validationResults.issues.length === 0 ? (
                        <p className="success-message">🎉 所有校验通过！</p>
                      ) : (
                        <div className="issues-list">
                          {validationResults.issues.map((issue, index) => (
                            <div 
                              key={index} 
                              className={`issue-item severity-${issue.severity}`}
                            >
                              <span className="issue-type">
                                {issue.type === 'collision' && '💥 碰撞'}
                                {issue.type === 'min_distance' && '📏 间距不足'}
                                {issue.type === 'boundary' && '🚧 越界'}
                                {issue.type === 'pathway' && '🛤️ 遮挡路径'}
                              </span>
                              <span className="issue-desc">
                                {issue.type === 'collision' && `${issue.instrument1Name} 和 ${issue.instrument2Name}`}
                                {issue.type === 'min_distance' && `${issue.instrument1Name} 和 ${issue.instrument2Name} (差 ${issue.deficit.toFixed(3)}m)`}
                                {issue.type === 'boundary' && issue.instrumentName}
                                {issue.type === 'pathway' && issue.instrumentName}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button 
                      className="action-btn primary"
                      onClick={handleExportReport}
                    >
                      📄 导出校验报告
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'setups' && (
              <div className="panel">
                <h3>方案管理</h3>
                
                <div className="save-section">
                  <input
                    type="text"
                    placeholder="输入方案名称..."
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    className="name-input"
                  />
                  <button 
                    className="action-btn primary"
                    onClick={handleSaveSetup}
                    disabled={instrumentList.length === 0}
                  >
                    💾 保存当前方案
                  </button>
                </div>

                <h4>已保存的方案</h4>
                {savedSetups.length === 0 ? (
                  <p className="empty-message">暂无保存的方案</p>
                ) : (
                  <div className="setups-list">
                    {savedSetups.map(setup => (
                      <div key={setup.id} className="setup-item">
                        <div className="setup-info">
                          <div className="setup-name">{setup.name}</div>
                          <div className="setup-meta">
                            {new Date(setup.createdAt).toLocaleString('zh-CN')}
                            <br/>
                            器械数: {setup.instruments?.length || 0}
                            {setup.validation && (
                              <span className={`setup-status ${setup.validation.isValid ? 'valid' : 'invalid'}`}>
                                {setup.validation.isValid ? ' ✓ 通过' : ' ✗ 不通过'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="setup-actions">
                          <button
                            className="icon-btn"
                            onClick={() => handleLoadSetup(setup)}
                            title="加载"
                          >
                            📂
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => handleExportSetup(setup)}
                            title="导出JSON"
                          >
                            ⬇️
                          </button>
                          <button
                            className="icon-btn danger"
                            onClick={() => handleDeleteSetup(setup.id)}
                            title="删除"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'replay' && (
              <div className="panel">
                <h3>回放控制</h3>
                
                <div className="recording-controls">
                  {!isRecording ? (
                    <button 
                      className="action-btn primary"
                      onClick={handleStartRecording}
                    >
                      ⏺ 开始录制
                    </button>
                  ) : (
                    <>
                      <button 
                        className="action-btn success"
                        onClick={handleRecordFrame}
                      >
                        📷 记录当前帧
                      </button>
                      <button 
                        className="action-btn danger"
                        onClick={handleStopRecording}
                      >
                        ⏹ 停止录制
                      </button>
                    </>
                  )}
                </div>

                <div className="playback-controls">
                  <h4>播放控制</h4>
                  <div className="control-buttons">
                    <button 
                      className="icon-btn large"
                      onClick={handlePlay}
                      title="播放"
                    >
                      ▶
                    </button>
                    <button 
                      className="icon-btn large"
                      onClick={handlePause}
                      title="暂停"
                    >
                      ⏸
                    </button>
                    <button 
                      className="icon-btn large"
                      onClick={handleStopPlayback}
                      title="停止"
                    >
                      ⏹
                    </button>
                  </div>
                </div>

                <div className="tips">
                  <p>💡 录制说明：</p>
                  <ul>
                    <li>点击"开始录制"开始</li>
                    <li>每次调整器械后点击"记录当前帧"</li>
                    <li>点击"停止录制"结束</li>
                    <li>使用播放控制回放操作过程</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="main-content">
          <Scene3D
            onInstrumentsChange={handleInstrumentsChange}
            onValidationChange={handleValidationChange}
            selectedInstrumentId={selectedInstrumentId}
            onInstrumentSelect={handleInstrumentSelect}
            triggerAddInstrument={triggerAddInstrument}
            loadedSetup={loadedSetup}
            triggerRecordFrame={triggerRecordFrame}
            triggerPlayback={triggerPlayback}
          />
        </main>
      </div>

      <footer className="app-footer">
        <div className="legend">
          <span className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#38a169' }}></span>
            无菌区 (器械必须放置在此区域内)
          </span>
          <span className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#4299e1' }}></span>
            取用路径 (器械不能遮挡此区域)
          </span>
          <span className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#ff4444' }}></span>
            异常标记 (碰撞/越界/遮挡)
          </span>
        </div>
        <div className="version-info">
          医疗器械摆台三维校验系统 v1.0
        </div>
      </footer>
    </div>
  );
}
