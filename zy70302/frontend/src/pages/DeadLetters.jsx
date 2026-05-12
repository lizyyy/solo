import { useState, useEffect } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { DiffViewer } from '../components/DiffViewer';

export function DeadLetters({ selectedDeadLetterId, onBack }) {
  const [deadLetters, setDeadLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', taskType: '', needManual: '' });
  const [selectedDeadLetter, setSelectedDeadLetter] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [replayHistory, setReplayHistory] = useState([]);
  const [modifications, setModifications] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [showReplayConfirm, setShowReplayConfirm] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [modifiedPayload, setModifiedPayload] = useState('');
  const [modifyReason, setModifyReason] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [isReplaying, setIsReplaying] = useState(false);
  const { showToast } = useToast();

  const loadDeadLetters = async () => {
    try {
      setLoading(true);
      const data = await api.getDeadLetters(filters);
      setDeadLetters(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadDeadLetterDetail = async (id) => {
    try {
      const [detail, history, mods, snaps] = await Promise.all([
        api.getDeadLetter(id),
        api.getReplayHistory(id),
        api.getModifications(id),
        api.getSnapshots(id)
      ]);
      setSelectedDeadLetter(detail);
      setReplayHistory(history);
      setModifications(mods);
      setSnapshots(snaps);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    loadDeadLetters();
  }, [filters]);

  useEffect(() => {
    if (selectedDeadLetterId) {
      const dl = deadLetters.find(d => d.task_id === selectedDeadLetterId);
      if (dl) {
        loadDeadLetterDetail(dl.id);
      }
    }
  }, [selectedDeadLetterId, deadLetters]);

  const handleViewDetail = (deadLetter) => {
    loadDeadLetterDetail(deadLetter.id);
  };

  const handleModifyPayload = async () => {
    try {
      let payload;
      try {
        payload = JSON.parse(modifiedPayload);
      } catch {
        throw new Error('Payload 必须是有效的 JSON');
      }
      await api.modifyPayload(selectedDeadLetter.task_id, payload, modifyReason);
      showToast('Payload 修改成功', 'success');
      setShowModifyModal(false);
      loadDeadLetterDetail(selectedDeadLetter.id);
      loadDeadLetters();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleReplay = async () => {
    try {
      setIsReplaying(true);
      const result = await api.replayDeadLetter(selectedDeadLetter.id);
      if (result.status === 'success') {
        showToast('重放成功！', 'success');
      } else {
        showToast('重放失败: ' + (result.errorMessage || '未知错误'), 'error');
      }
      setShowReplayConfirm(false);
      loadDeadLetterDetail(selectedDeadLetter.id);
      loadDeadLetters();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsReplaying(false);
    }
  };

  const handleClose = async () => {
    try {
      await api.closeDeadLetter(selectedDeadLetter.id, closeReason);
      showToast('死信已关闭', 'success');
      setShowCloseModal(false);
      loadDeadLetterDetail(selectedDeadLetter.id);
      loadDeadLetters();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const getSideEffectWarning = (dl) => {
    if (!dl.has_side_effect) return null;
    const type = dl.side_effect_type || dl.task_type;
    const warnings = {
      sms: '重放将发送短信到用户手机，请确认不会造成重复打扰。',
      inventory: '重放将扣减库存，请确认不会造成重复扣减。库存扣减具有幂等性保护。'
    };
    return warnings[type] || '此任务可能产生副作用，请谨慎操作。';
  };

  const canReplay = selectedDeadLetter && 
    selectedDeadLetter.status !== 'resolved' && 
    selectedDeadLetter.status !== 'closed';

  if (selectedDeadLetter) {
    return (
      <div className="container">
        <button 
          className="btn btn-secondary btn-sm" 
          style={{ marginBottom: 20 }}
          onClick={() => {
            setSelectedDeadLetter(null);
            if (onBack) onBack();
          }}
        >
          ← 返回列表
        </button>

        <div className="card">
          <div className="card-header">
            <h2>死信详情</h2>
            <div className="action-bar">
              {canReplay && (
                <>
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setModifiedPayload(JSON.stringify(selectedDeadLetter.current_payload, null, 2));
                      setModifyReason('');
                      setShowModifyModal(true);
                    }}
                  >
                    修改 Payload
                  </button>
                  <button 
                    className="btn btn-success btn-sm"
                    onClick={() => setShowReplayConfirm(true)}
                  >
                    重放任务
                  </button>
                </>
              )}
              {selectedDeadLetter.status === 'active' && (
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setCloseReason('');
                    setShowCloseModal(true);
                  }}
                >
                  关闭
                </button>
              )}
            </div>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="label">任务名称</span>
                <span className="value">{selectedDeadLetter.task_name}</span>
              </div>
              <div className="detail-item">
                <span className="label">任务类型</span>
                <span className="value">
                  <span className={`badge badge-${selectedDeadLetter.task_type}`}>
                    {getTaskTypeName(selectedDeadLetter.task_type)}
                  </span>
                </span>
              </div>
              <div className="detail-item">
                <span className="label">业务号</span>
                <span className="value">{selectedDeadLetter.business_no}</span>
              </div>
              <div className="detail-item">
                <span className="label">状态</span>
                <span className="value">
                  <span className={`badge badge-${getDeadLetterStatusClass(selectedDeadLetter.status)}`}>
                    {getDeadLetterStatusName(selectedDeadLetter.status)}
                  </span>
                </span>
              </div>
              <div className="detail-item">
                <span className="label">重试次数</span>
                <span className="value">{selectedDeadLetter.retry_count}</span>
              </div>
              <div className="detail-item">
                <span className="label">失败分类</span>
                <span className="value">
                  <span className={`badge badge-${selectedDeadLetter.error_category || 'unknown'}`}>
                    {getCategoryName(selectedDeadLetter.error_category)}
                  </span>
                </span>
              </div>
              {selectedDeadLetter.need_manual && (
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <span className="label">⚠️ 需要人工处理</span>
                  <span className="value">已超过最大重试次数，请人工确认后再操作</span>
                </div>
              )}
            </div>

            <div className="tabs">
              <div 
                className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >概览</div>
              <div 
                className={`tab ${activeTab === 'payload' ? 'active' : ''}`}
                onClick={() => setActiveTab('payload')}
              >Payload</div>
              <div 
                className={`tab ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >重放历史</div>
              <div 
                className={`tab ${activeTab === 'modifications' ? 'active' : ''}`}
                onClick={() => setActiveTab('modifications')}
              >修改记录</div>
              <div 
                className={`tab ${activeTab === 'snapshots' ? 'active' : ''}`}
                onClick={() => setActiveTab('snapshots')}
              >业务快照</div>
            </div>

            {activeTab === 'overview' && (
              <div>
                <div className="section-title">错误信息</div>
                <div className="risk-warning">
                  <p>{selectedDeadLetter.error_message}</p>
                </div>

                {selectedDeadLetter.error_stack && (
                  <div>
                    <div className="section-title">错误堆栈</div>
                    <pre className="stack-trace">{selectedDeadLetter.error_stack}</pre>
                  </div>
                )}

                {selectedDeadLetter.has_side_effect && (
                  <div className="risk-warning">
                    <h4>⚠️ 副作用风险提示</h4>
                    <p>{getSideEffectWarning(selectedDeadLetter)}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'payload' && (
              <div>
                <DiffViewer 
                  diff={modifications.length > 0 ? modifications[0].diff : null}
                  before={selectedDeadLetter.payload_snapshot}
                  after={selectedDeadLetter.current_payload}
                  title={modifications.length > 0 ? 'Payload 变更对比' : '当前 Payload'}
                />
                <div className="section-title">原始 Payload</div>
                <pre className="json-viewer">
                  {JSON.stringify(selectedDeadLetter.original_payload, null, 2)}
                </pre>
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                {replayHistory.length > 0 ? (
                  <div className="timeline">
                    {replayHistory.map((h, i) => (
                      <div key={h.id} className={`timeline-item ${h.status}`}>
                        <div className="timeline-content">
                          <div className="time">{formatDate(h.created_at)}</div>
                          <div className="title">
                            重放 {i + 1} - 
                            <span className={`badge badge-${h.status === 'success' ? 'resolved' : 'dead-letter'}`}>
                              {h.status === 'success' ? '成功' : '失败'}
                            </span>
                          </div>
                          <div className="desc">操作人: {h.operator}</div>
                          {h.error_message && (
                            <div className="desc" style={{ color: '#ef4444' }}>
                              错误: {h.error_message}
                            </div>
                          )}
                          {h.diff && h.diff.length > 0 && (
                            <div style={{ marginTop: 12 }}>
                              <DiffViewer diff={h.diff} />
                            </div>
                          )}
                          {h.result && (
                            <div className="business-diff">
                              <h4>执行结果</h4>
                              <pre className="json-viewer" style={{ maxHeight: 200 }}>
                                {JSON.stringify(h.result, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="icon">📜</div>
                    <div>暂无重放历史</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'modifications' && (
              <div>
                {modifications.length > 0 ? (
                  <div className="timeline">
                    {modifications.map((m, i) => (
                      <div key={m.id} className="timeline-item">
                        <div className="timeline-content">
                          <div className="time">{formatDate(m.created_at)}</div>
                          <div className="title">修改记录 {i + 1}</div>
                          <div className="desc">操作人: {m.operator}</div>
                          {m.reason && <div className="desc">原因: {m.reason}</div>}
                          <div style={{ marginTop: 12 }}>
                            <DiffViewer diff={m.diff} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="icon">✏️</div>
                    <div>暂无修改记录</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'snapshots' && (
              <div>
                {snapshots.length > 0 ? (
                  snapshots.map((s, i) => (
                    <div key={s.id} className="business-diff" style={{ marginBottom: 16 }}>
                      <h4>
                        #{i + 1} {getTaskTypeName(s.business_type)} 状态变更
                        <span style={{ float: 'right', fontSize: 12, color: '#6b7280' }}>
                          {formatDate(s.created_at)}
                        </span>
                      </h4>
                      {s.diff && s.diff.length > 0 ? (
                        <DiffViewer diff={s.diff} />
                      ) : (
                        <div className="diff-viewer">
                          <div className="diff-section">
                            <h4>变更前</h4>
                            <pre className="json-viewer" style={{ maxHeight: 150 }}>
                              {JSON.stringify(s.snapshot_before, null, 2)}
                            </pre>
                          </div>
                          <div className="diff-section">
                            <h4>变更后</h4>
                            <pre className="json-viewer" style={{ maxHeight: 150 }}>
                              {JSON.stringify(s.snapshot_after, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <div className="icon">📸</div>
                    <div>暂无业务快照，重放成功后会自动记录</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {showModifyModal && (
          <div className="modal-overlay" onClick={() => setShowModifyModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>修改 Payload</h3>
                <button className="close-btn" onClick={() => setShowModifyModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="risk-warning">
                  <h4>⚠️ 安全提示</h4>
                  <p>修改 Payload 会记录完整的变更历史。建议只修改安全字段（如备注、回调地址等），
                  避免修改核心业务字段导致数据不一致。</p>
                </div>
                <div className="form-group">
                  <label>修改原因</label>
                  <input
                    type="text"
                    placeholder="请输入修改原因..."
                    value={modifyReason}
                    onChange={e => setModifyReason(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>新 Payload (JSON)</label>
                  <textarea
                    value={modifiedPayload}
                    onChange={e => setModifiedPayload(e.target.value)}
                    style={{ minHeight: 300 }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModifyModal(false)}>取消</button>
                <button className="btn btn-primary" onClick={handleModifyPayload}>确认修改</button>
              </div>
            </div>
          </div>
        )}

        {showReplayConfirm && (
          <div className="modal-overlay" onClick={() => setShowReplayConfirm(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>确认重放</h3>
                <button className="close-btn" onClick={() => setShowReplayConfirm(false)}>×</button>
              </div>
              <div className="modal-body">
                {selectedDeadLetter.has_side_effect && (
                  <div className="risk-warning">
                    <h4>⚠️ 高风险操作确认</h4>
                    <p>{getSideEffectWarning(selectedDeadLetter)}</p>
                    <p style={{ marginTop: 8 }}>
                      <strong>系统已启用幂等性保护：</strong>同一任务成功重放后将无法再次重放。
                      但请确认业务逻辑不会产生重复副作用。
                    </p>
                  </div>
                )}
                <p>确定要重放此死信任务吗？</p>
                <div className="section-title">当前 Payload</div>
                <pre className="json-viewer" style={{ maxHeight: 200 }}>
                  {JSON.stringify(selectedDeadLetter.current_payload, null, 2)}
                </pre>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowReplayConfirm(false)}>取消</button>
                <button 
                  className="btn btn-success" 
                  onClick={handleReplay}
                  disabled={isReplaying}
                >
                  {isReplaying ? '重放中...' : '确认重放'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showCloseModal && (
          <div className="modal-overlay" onClick={() => setShowCloseModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>关闭死信</h3>
                <button className="close-btn" onClick={() => setShowCloseModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="risk-warning">
                  <h4>⚠️ 确认关闭</h4>
                  <p>关闭后此死信将不再显示在待处理列表中，且无法再重放。请谨慎操作。</p>
                </div>
                <div className="form-group">
                  <label>关闭原因</label>
                  <textarea
                    placeholder="请输入关闭原因..."
                    value={closeReason}
                    onChange={e => setCloseReason(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowCloseModal(false)}>取消</button>
                <button className="btn btn-danger" onClick={handleClose}>确认关闭</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h2>死信队列</h2>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => api.exportData('dead_letters', filters)}
          >
            导出
          </button>
        </div>
        <div className="card-body">
          <div className="filters">
            <div className="filter-group">
              <label>状态:</label>
              <select value={filters.status} onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}>
                <option value="">全部</option>
                <option value="active">待处理</option>
                <option value="resolved">已成功</option>
                <option value="closed">已关闭</option>
              </select>
            </div>
            <div className="filter-group">
              <label>类型:</label>
              <select value={filters.taskType} onChange={e => setFilters(prev => ({ ...prev, taskType: e.target.value }))}>
                <option value="">全部</option>
                <option value="invoice">发票</option>
                <option value="sms">短信</option>
                <option value="inventory">库存</option>
              </select>
            </div>
            <div className="filter-group">
              <label>需人工:</label>
              <select value={filters.needManual} onChange={e => setFilters(prev => ({ ...prev, needManual: e.target.value }))}>
                <option value="">全部</option>
                <option value="true">是</option>
                <option value="false">否</option>
              </select>
            </div>
          </div>

          {deadLetters.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>任务名称</th>
                    <th>类型</th>
                    <th>业务号</th>
                    <th>失败原因</th>
                    <th>重试次数</th>
                    <th>状态</th>
                    <th>副作用</th>
                    <th>需人工</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {deadLetters.map(dl => (
                    <tr key={dl.id}>
                      <td>{dl.task_name}</td>
                      <td>
                        <span className={`badge badge-${dl.task_type}`}>
                          {getTaskTypeName(dl.task_type)}
                        </span>
                      </td>
                      <td>{dl.business_no}</td>
                      <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <span className={`badge badge-${dl.error_category || 'unknown'}`}>
                          {getCategoryName(dl.error_category)}
                        </span>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                          {dl.error_message}
                        </div>
                      </td>
                      <td>{dl.retry_count}</td>
                      <td>
                        <span className={`badge badge-${getDeadLetterStatusClass(dl.status)}`}>
                          {getDeadLetterStatusName(dl.status)}
                        </span>
                      </td>
                      <td>
                        {dl.has_side_effect ? (
                          <span className={`badge badge-${dl.side_effect_type || dl.task_type}`}>
                            有
                          </span>
                        ) : (
                          <span className="badge badge-closed">无</span>
                        )}
                      </td>
                      <td>
                        {dl.need_manual ? (
                          <span className="badge badge-manual-required">是</span>
                        ) : (
                          <span className="badge badge-closed">否</span>
                        )}
                      </td>
                      <td>{formatDate(dl.created_at)}</td>
                      <td>
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => handleViewDetail(dl)}
                        >
                          查看详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="icon">📭</div>
              <div>暂无死信数据</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getTaskTypeName(type) {
  const names = { invoice: '发票', sms: '短信', inventory: '库存' };
  return names[type] || type;
}

function getCategoryName(cat) {
  const names = {
    network: '网络错误',
    timeout: '超时',
    business: '业务错误',
    data: '数据错误',
    system: '系统错误',
    unknown: '未知'
  };
  return names[cat] || cat;
}

function getDeadLetterStatusName(status) {
  const names = { active: '待处理', resolved: '已成功', closed: '已关闭' };
  return names[status] || status;
}

function getDeadLetterStatusClass(status) {
  const classes = { active: 'active', resolved: 'resolved', closed: 'closed' };
  return classes[status] || 'closed';
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString('zh-CN');
}
