import { useState } from 'react';
import { useApp } from '../context/AppContext';
import ImportPanel from './ImportPanel';
import MatchResults from './MatchResults';
import ConflictQueue from './ConflictQueue';
import ManualConfirm from './ManualConfirm';
import ExportPanel from './ExportPanel';

export default function AppLayout() {
  const { state, dispatch, createBatch, selectBatch, deleteBatch } = useApp();
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [newBatchName, setNewBatchName] = useState('');

  const tabs = [
    { id: 'import', label: '数据导入', icon: '📁' },
    { id: 'results', label: '匹配结果', icon: '🔍' },
    { id: 'conflicts', label: '冲突队列', icon: '⚠️' },
    { id: 'manual', label: '人工处理', icon: '✋' },
    { id: 'export', label: '导出报告', icon: '📊' },
  ];

  const handleCreateBatch = async () => {
    if (!newBatchName.trim()) return;
    await createBatch(newBatchName.trim());
    setNewBatchName('');
    setShowNewBatchModal(false);
  };

  const renderContent = () => {
    switch (state.activeTab) {
      case 'import':
        return <ImportPanel />;
      case 'results':
        return <MatchResults />;
      case 'conflicts':
        return <ConflictQueue />;
      case 'manual':
        return <ManualConfirm />;
      case 'export':
        return <ExportPanel />;
      default:
        return <ImportPanel />;
    }
  };

  const currentBatch = state.batches.find((b) => b.id === state.currentBatchId);

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-left">
          <h1>🏦 银企流水凭证清洗工具</h1>
          <p className="subtitle">智能匹配 · 冲突检测 · 全程追溯</p>
        </div>
        <div className="header-right">
          {currentBatch && (
            <div className="current-batch">
              <span className="batch-label">当前批次：</span>
              <span className="batch-name">{currentBatch.name}</span>
            </div>
          )}
        </div>
      </header>

      <div className="main-container">
        <aside className="sidebar">
          <div className="sidebar-section">
            <button
              className="btn-primary btn-block"
              onClick={() => setShowNewBatchModal(true)}
            >
              + 新建批次
            </button>
          </div>

          <div className="sidebar-section">
            <h3>批次列表</h3>
            <div className="batch-list">
              {state.batches.length === 0 ? (
                <p className="empty-text">暂无批次，请先创建</p>
              ) : (
                state.batches.map((batch) => (
                  <div
                    key={batch.id}
                    className={`batch-item ${batch.id === state.currentBatchId ? 'active' : ''}`}
                    onClick={() => selectBatch(batch.id)}
                  >
                    <div className="batch-info">
                      <span className="batch-title">{batch.name}</span>
                      <span className="batch-stats">
                        {batch.statistics.totalTransactions} 条流水 · {batch.statistics.totalVouchers} 条凭证
                      </span>
                    </div>
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('确定要删除这个批次吗？')) {
                          deleteBatch(batch.id);
                        }
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <nav className="sidebar-nav">
            <h3>功能导航</h3>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`nav-item ${state.activeTab === tab.id ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab.id })}
                disabled={!state.currentBatchId && tab.id !== 'import'}
              >
                <span className="nav-icon">{tab.icon}</span>
                <span className="nav-label">{tab.label}</span>
              </button>
            ))}
          </nav>

          {currentBatch && (
            <div className="sidebar-section">
              <h3>批次统计</h3>
              <div className="stats-list">
                <div className="stat-row">
                  <span>流水总数</span>
                  <span>{currentBatch.statistics.totalTransactions}</span>
                </div>
                <div className="stat-row">
                  <span>凭证总数</span>
                  <span>{currentBatch.statistics.totalVouchers}</span>
                </div>
                <div className="stat-row stat-success">
                  <span>已匹配</span>
                  <span>{currentBatch.statistics.matchedCount}</span>
                </div>
                <div className="stat-row stat-warning">
                  <span>待确认</span>
                  <span>{currentBatch.statistics.pendingCount}</span>
                </div>
                <div className="stat-row stat-danger">
                  <span>有冲突</span>
                  <span>{currentBatch.statistics.conflictCount}</span>
                </div>
              </div>
            </div>
          )}
        </aside>

        <main className="main-content">
          {!state.currentBatchId ? (
            <div className="welcome-screen">
              <div className="welcome-card">
                <h2>👋 欢迎使用银企流水凭证清洗工具</h2>
                <p>请先创建一个新批次或选择已有批次开始工作</p>
                <div className="welcome-features">
                  <div className="feature">
                    <span className="feature-icon">📁</span>
                    <h4>多类型导入</h4>
                    <p>支持银行流水、凭证、发票、合同等多种Excel格式</p>
                  </div>
                  <div className="feature">
                    <span className="feature-icon">🔍</span>
                    <h4>智能匹配</h4>
                    <p>基于模糊匹配算法，自动识别匹配关系</p>
                  </div>
                  <div className="feature">
                    <span className="feature-icon">⚠️</span>
                    <h4>冲突检测</h4>
                    <p>识别同名误配、金额不平、红冲占用等异常</p>
                  </div>
                  <div className="feature">
                    <span className="feature-icon">📊</span>
                    <h4>完整追溯</h4>
                    <p>每一步操作都有记录，导出完整报告</p>
                  </div>
                </div>
                <button
                  className="btn-primary btn-large"
                  onClick={() => setShowNewBatchModal(true)}
                >
                  创建第一个批次
                </button>
              </div>
            </div>
          ) : (
            <div className="content-panel">
              <div className="tab-bar">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`tab-button ${state.activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab.id })}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>
              <div className="tab-content">{renderContent()}</div>
            </div>
          )}
        </main>
      </div>

      {showNewBatchModal && (
        <div className="modal-overlay" onClick={() => setShowNewBatchModal(false)}>
          <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>新建批次</h4>
              <button className="modal-close" onClick={() => setShowNewBatchModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>批次名称</label>
                <input
                  type="text"
                  placeholder="例如：2024年5月银企对账"
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateBatch()}
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setShowNewBatchModal(false)}
                >
                  取消
                </button>
                <button
                  className="btn-primary"
                  onClick={handleCreateBatch}
                  disabled={!newBatchName.trim()}
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {state.loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>处理中...</p>
        </div>
      )}
    </div>
  );
}
