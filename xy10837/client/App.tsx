import React, { useState, useEffect, useCallback } from 'react';
import { DeadLetterMessage, ReplayBatch, SkipRule, MessageStatus, DeadReason } from './types';
import { api } from './api';

const STATUS_LABELS: Record<MessageStatus, string> = {
  dead: '死信',
  pending: '等待中',
  replaying: '重放中',
  success: '成功',
  failed: '失败',
  skipped: '已跳过',
};

const REASON_LABELS: Record<DeadReason, string> = {
  timeout: '超时',
  exception: '异常',
  validation_error: '验证错误',
  business_error: '业务错误',
  unknown: '未知',
};

export default function App() {
  const [messages, setMessages] = useState<DeadLetterMessage[]>([]);
  const [batches, setBatches] = useState<ReplayBatch[]>([]);
  const [rules, setRules] = useState<SkipRule[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<'messages' | 'batches' | 'rules'>('messages');
  
  const [filterTopic, setFilterTopic] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<MessageStatus | ''>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [showDetail, setShowDetail] = useState<DeadLetterMessage | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [showSkipModal, setShowSkipModal] = useState<string | null>(null);
  
  const [batchName, setBatchName] = useState('');
  const [batchRateLimit, setBatchRateLimit] = useState(10);
  const [ruleName, setRuleName] = useState('');
  const [ruleTopic, setRuleTopic] = useState('');
  const [ruleReason, setRuleReason] = useState<DeadReason | ''>('');
  const [rulePattern, setRulePattern] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [operator] = useState('developer');

  const loadData = useCallback(async () => {
    const [messagesData, batchesData, rulesData, topicsData] = await Promise.all([
      api.getMessages(filterTopic && filterStatus ? { topic: filterTopic, status: filterStatus } : filterTopic ? { topic: filterTopic } : filterStatus ? { status: filterStatus } : undefined),
      api.getBatches(),
      api.getRules(),
      api.getTopics(),
    ]);
    setMessages(messagesData);
    setBatches(batchesData);
    setRules(rulesData);
    setTopics(topicsData);
  }, [filterTopic, filterStatus]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  const stats = {
    dead: messages.filter(m => m.status === 'dead').length,
    pending: messages.filter(m => m.status === 'pending').length,
    replaying: messages.filter(m => m.status === 'replaying').length,
    success: messages.filter(m => m.status === 'success').length,
    failed: messages.filter(m => m.status === 'failed').length,
    skipped: messages.filter(m => m.status === 'skipped').length,
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === messages.filter(m => m.status === 'dead').length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(messages.filter(m => m.status === 'dead').map(m => m.id)));
    }
  };

  const handleReplay = async (id: string) => {
    await api.replayMessage(id, operator);
    loadData();
  };

  const handleSkip = async (id: string) => {
    if (!skipReason) return;
    await api.skipMessage(id, operator, skipReason);
    setSkipReason('');
    setShowSkipModal(null);
    loadData();
  };

  const handleCreateBatch = async () => {
    if (!batchName || selectedIds.size === 0) return;
    setLoading(true);
    try {
      await api.createBatch({
        name: batchName,
        topic: filterTopic || 'mixed',
        messageIds: Array.from(selectedIds),
        rateLimit: batchRateLimit,
        operator,
      });
      setShowBatchModal(false);
      setBatchName('');
      setSelectedIds(new Set());
      loadData();
    } finally {
      setLoading(false);
    }
  };

  const handleStartBatch = async (id: string) => {
    await api.startBatch(id);
    loadData();
  };

  const handlePauseBatch = async (id: string) => {
    await api.pauseBatch(id);
    loadData();
  };

  const handleCreateRule = async () => {
    if (!ruleName) return;
    setLoading(true);
    try {
      await api.createRule({
        name: ruleName,
        topic: ruleTopic || undefined,
        deadReason: ruleReason || undefined,
        payloadPattern: rulePattern || undefined,
        enabled: true,
      });
      setShowRuleModal(false);
      setRuleName('');
      setRuleTopic('');
      setRuleReason('');
      setRulePattern('');
      loadData();
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRule = async (id: string) => {
    const rule = rules.find(r => r.id === id);
    if (rule) {
      await api.updateRule(id, { enabled: !rule.enabled });
      loadData();
    }
  };

  const handleDeleteRule = async (id: string) => {
    await api.deleteRule(id);
    loadData();
  };

  const handleExport = (format: string) => {
    const url = api.export({
      topic: filterTopic || undefined,
      status: filterStatus || undefined,
      format,
    });
    window.open(url, '_blank');
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString('zh-CN');
  };

  return (
    <div className="app">
      <header className="header">
        <h1>📨 死信队列重放台</h1>
        <p>Dead Letter Queue Replay Console - 精细化控制每条消息的重放流程</p>
      </header>

      <div className="container">
        <div className="tabs">
          <button className={`tab ${selectedTab === 'messages' ? 'active' : ''}`} onClick={() => setSelectedTab('messages')}>
            消息队列
          </button>
          <button className={`tab ${selectedTab === 'batches' ? 'active' : ''}`} onClick={() => setSelectedTab('batches')}>
            重放批次
          </button>
          <button className={`tab ${selectedTab === 'rules' ? 'active' : ''}`} onClick={() => setSelectedTab('rules')}>
            跳过规则
          </button>
        </div>

        {selectedTab === 'messages' && (
          <>
            <div className="stats">
              {Object.entries(stats).map(([status, count]) => (
                <div key={status} className={`stat-card ${status}`}>
                  <div className="stat-value">{count}</div>
                  <div className="stat-label">{STATUS_LABELS[status as MessageStatus]}</div>
                </div>
              ))}
            </div>

            <div className="filters">
              <div className="filter-group">
                <label>主题:</label>
                <select value={filterTopic} onChange={(e) => setFilterTopic(e.target.value)}>
                  <option value="">全部</option>
                  {topics.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="filter-group">
                <label>状态:</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as MessageStatus | '')}>
                  <option value="">全部</option>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <button className="btn btn-primary" onClick={() => setShowBatchModal(true)} disabled={selectedIds.size === 0}>
                  📦 批量重放 ({selectedIds.size})
                </button>
              </div>
              <div className="filter-group">
                <button className="btn btn-success" onClick={() => handleExport('json')}>
                  📥 导出 JSON
                </button>
                <button className="btn btn-success" onClick={() => handleExport('csv')}>
                  📊 导出 CSV
                </button>
              </div>
            </div>

            {selectedIds.size > 0 && (
              <div className="batch-panel">
                <h3>已选择 {selectedIds.size} 条消息准备批量重放</h3>
                <div className="filter-group">
                  <label>批次名称:</label>
                  <input value={batchName} onChange={(e) => setBatchName(e.target.value)} placeholder="输入批次名称" />
                </div>
                <div className="filter-group">
                  <label>限速 (条/秒):</label>
                  <input type="number" value={batchRateLimit} onChange={(e) => setBatchRateLimit(Number(e.target.value))} min={1} max={100} />
                </div>
                <button className="btn btn-primary" onClick={handleCreateBatch} disabled={!batchName || loading}>
                  {loading ? '创建中...' : '✅ 创建重放批次'}
                </button>
              </div>
            )}

            <div className="message-list">
              <div className="message-header">
                <div>
                  <input type="checkbox" className="checkbox" checked={selectedIds.size > 0 && selectedIds.size === messages.filter(m => m.status === 'dead').length} onChange={selectAll} />
                </div>
                <div>消息主题</div>
                <div>状态</div>
                <div>死信原因</div>
                <div>载荷摘要</div>
                <div>负责节点</div>
                <div>操作</div>
              </div>
              {messages.length === 0 ? (
                <div className="empty">暂无消息</div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`message-row ${selectedIds.has(msg.id) ? 'selected' : ''}`} onClick={() => setShowDetail(msg)}>
                    <div onClick={(e) => { e.stopPropagation(); if (msg.status === 'dead') toggleSelect(msg.id); }}>
                      <input type="checkbox" className="checkbox" checked={selectedIds.has(msg.id)} disabled={msg.status !== 'dead'} onChange={() => {}} />
                    </div>
                    <div className="topic">{msg.topic}</div>
                    <div><span className={`status-badge status-${msg.status}`}>{STATUS_LABELS[msg.status]}</span></div>
                    <div className="reason" title={msg.deadReasonDesc}>{msg.deadReasonDesc}</div>
                    <div className="payload" title={msg.payloadSummary}>{msg.payloadSummary}</div>
                    <div className="node">{msg.responsibleNode}</div>
                    <div className="actions" onClick={(e) => e.stopPropagation()}>
                      {msg.status === 'dead' && (
                        <>
                          <button className="btn btn-success" onClick={() => handleReplay(msg.id)}>重放</button>
                          <button className="btn btn-warning" onClick={() => setShowSkipModal(msg.id)}>跳过</button>
                        </>
                      )}
                      {msg.status === 'pending' && <span className="status-badge status-pending">等待中</span>}
                      {msg.status === 'replaying' && <span className="status-badge status-replaying">重放中</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {selectedTab === 'batches' && (
          <div className="batches-list">
            {batches.length === 0 ? (
              <div className="empty">暂无批次，从消息列表选择消息创建重放批次</div>
            ) : (
              batches.map(batch => (
                <div key={batch.id} className="batch-item">
                  <div className="batch-info">
                    <h4>{batch.name} <span className={`status-badge status-${batch.status}`}>{batch.status}</span></h4>
                    <p>主题: {batch.topic} | 消息数: {batch.messageIds.length} | 限速: {batch.rateLimit}条/秒 | 创建人: {batch.operator}</p>
                    <div className="batch-stats">
                      <span className="batch-stat success">成功: {batch.successCount}</span>
                      <span className="batch-stat failed">失败: {batch.failedCount}</span>
                      <span className="batch-stat skipped">跳过: {batch.skippedCount}</span>
                    </div>
                    <p style={{ marginTop: 4 }}>创建时间: {formatTime(batch.createdAt)}</p>
                  </div>
                  <div className="batch-actions">
                    {batch.status === 'created' && (
                      <button className="btn btn-primary" onClick={() => handleStartBatch(batch.id)}>▶ 开始</button>
                    )}
                    {batch.status === 'running' && (
                      <button className="btn btn-warning" onClick={() => handlePauseBatch(batch.id)}>⏸ 暂停</button>
                    )}
                    {batch.status === 'paused' && (
                      <button className="btn btn-primary" onClick={() => handleStartBatch(batch.id)}>▶ 继续</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {selectedTab === 'rules' && (
          <>
            <div className="filters">
              <button className="btn btn-primary" onClick={() => setShowRuleModal(true)}>
                ➕ 添加跳过规则
              </button>
            </div>
            <div className="rules-list">
              {rules.length === 0 ? (
                <div className="empty">暂无跳过规则</div>
              ) : (
                rules.map(rule => (
                  <div key={rule.id} className="rule-item">
                    <div className="rule-info">
                      <h4>{rule.name} {!rule.enabled && <span className="status-badge status-skipped">已禁用</span>}</h4>
                      <p>
                        {rule.topic && `主题: ${rule.topic}`}
                        {rule.deadReason && ` | 原因: ${REASON_LABELS[rule.deadReason]}`}
                        {rule.payloadPattern && ` | 匹配: ${rule.payloadPattern}`}
                      </p>
                      <p>创建时间: {formatTime(rule.createdAt)}</p>
                    </div>
                    <div className="rule-actions">
                      <button className={`btn ${rule.enabled ? 'btn-warning' : 'btn-success'}`} onClick={() => handleToggleRule(rule.id)}>
                        {rule.enabled ? '禁用' : '启用'}
                      </button>
                      <button className="btn btn-error" onClick={() => handleDeleteRule(rule.id)}>删除</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>消息详情</h2>
              <button className="modal-close" onClick={() => setShowDetail(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <h3>基本信息</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">ID:</span>
                    <span className="detail-value">{showDetail.id}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">主题:</span>
                    <span className="detail-value">{showDetail.topic}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">状态:</span>
                    <span className="detail-value"><span className={`status-badge status-${showDetail.status}`}>{STATUS_LABELS[showDetail.status]}</span></span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">负责节点:</span>
                    <span className="detail-value">{showDetail.responsibleNode}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">重试次数:</span>
                    <span className="detail-value">{showDetail.retryCount}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">原始队列:</span>
                    <span className="detail-value">{showDetail.originalQueue}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>死信原因</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">类型:</span>
                    <span className="detail-value">{REASON_LABELS[showDetail.deadReason]}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">描述:</span>
                    <span className="detail-value">{showDetail.deadReasonDesc}</span>
                  </div>
                </div>
                {showDetail.lastError && (
                  <div style={{ marginTop: 12 }} className="payload-detail">
                    最后错误: {showDetail.lastError}
                  </div>
                )}
              </div>

              <div className="detail-section">
                <h3>载荷内容</h3>
                <p style={{ marginBottom: 8, fontSize: 13 }}>{showDetail.payloadSummary}</p>
                <div className="payload-detail">
                  {JSON.stringify(showDetail.payload, null, 2)}
                </div>
              </div>

              <div className="detail-section">
                <h3>处理轨迹</h3>
                <div className="history-timeline">
                  {showDetail.history.slice().reverse().map((h, i) => (
                    <div key={i} className="history-item">
                      <div className="history-time">{formatTime(h.timestamp)}</div>
                      <div className="history-action">{h.action} <span className={`status-badge status-${h.status}`}>{STATUS_LABELS[h.status]}</span></div>
                      {h.note && <div className="history-note">{h.note}</div>}
                      <div className="history-operator">操作人: {h.operator}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSkipModal && (
        <div className="modal-overlay" onClick={() => setShowSkipModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>跳过消息</h2>
              <button className="modal-close" onClick={() => setShowSkipModal(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>跳过原因</label>
                <textarea value={skipReason} onChange={(e) => setSkipReason(e.target.value)} placeholder="请输入跳过原因..." />
              </div>
              <div className="form-actions">
                <button className="btn btn-secondary" onClick={() => setShowSkipModal(null)}>取消</button>
                <button className="btn btn-warning" onClick={() => handleSkip(showSkipModal)} disabled={!skipReason}>
                  确认跳过
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRuleModal && (
        <div className="modal-overlay" onClick={() => setShowRuleModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>添加跳过规则</h2>
              <button className="modal-close" onClick={() => setShowRuleModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>规则名称 *</label>
                <input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="例如: 跳过手机号格式错误" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>消息主题</label>
                  <select value={ruleTopic} onChange={(e) => setRuleTopic(e.target.value)}>
                    <option value="">全部主题</option>
                    {topics.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>死信原因</label>
                  <select value={ruleReason} onChange={(e) => setRuleReason(e.target.value as DeadReason | '')}>
                    <option value="">全部原因</option>
                    {Object.entries(REASON_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>载荷匹配模式 (正则)</label>
                <input value={rulePattern} onChange={(e) => setRulePattern(e.target.value)} placeholder="例如: invalid-phone" />
              </div>
              <div className="form-actions">
                <button className="btn btn-secondary" onClick={() => setShowRuleModal(false)}>取消</button>
                <button className="btn btn-primary" onClick={handleCreateRule} disabled={!ruleName || loading}>
                  {loading ? '创建中...' : '创建规则'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
