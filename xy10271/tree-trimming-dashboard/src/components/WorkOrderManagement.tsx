import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import { formatDate, exportToCSV, getStatusText, getStatusColor } from '../utils';
import type { WorkOrder } from '../types';

const WorkOrderManagement: React.FC = () => {
  const { state, dispatch } = useApp();
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [assignedTo, setAssignedTo] = useState('');
  const [result, setResult] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const filteredOrders = state.workOrders.filter(wo => {
    const matchesStatus = statusFilter === 'all' || wo.status === statusFilter;
    let matchesPriority = true;
    if (priorityFilter === 'urgent') matchesPriority = wo.priority >= 80;
    else if (priorityFilter === 'high') matchesPriority = wo.priority >= 60 && wo.priority < 80;
    else if (priorityFilter === 'medium') matchesPriority = wo.priority >= 40 && wo.priority < 60;
    else if (priorityFilter === 'low') matchesPriority = wo.priority < 40;
    return matchesStatus && matchesPriority;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => b.priority - a.priority);

  const handleStart = () => {
    if (!selectedOrder || !assignedTo) {
      alert('请填写负责人信息');
      return;
    }
    dispatch({ type: 'START_WORK_ORDER', payload: { id: selectedOrder.id, assignedTo } });
    setShowStartModal(false);
    setSelectedOrder(null);
    setAssignedTo('');
  };

  const handleComplete = () => {
    if (!selectedOrder || !result) {
      alert('请填写处理结果');
      return;
    }
    dispatch({ type: 'COMPLETE_WORK_ORDER', payload: { id: selectedOrder.id, result } });
    setShowCompleteModal(false);
    setSelectedOrder(null);
    setResult('');
  };

  const handlePublish = (order: WorkOrder) => {
    if (confirm(`确定要将此工单公示吗？公示后居民可以看到处理结果。`)) {
      dispatch({ type: 'PUBLISH_WORK_ORDER', payload: { id: order.id } });
    }
  };

  const handleRefresh = () => {
    dispatch({ type: 'REFRESH_WORK_ORDERS' });
  };

  const handleExport = () => {
    const exportData = sortedOrders.map(wo => {
      const tree = state.trees.find(t => t.id === wo.treeId);
      const complaints = state.complaints.filter(c => wo.complaintIds.includes(c.id));
      return {
        '工单编号': wo.id,
        '树木位置': tree?.location || '-',
        '楼栋': tree?.building || '-',
        '树种': tree?.species || '-',
        '优先级': wo.priority,
        '遮光评分': wo.shadingScore,
        '病虫害评分': wo.diseaseScore,
        '投诉评分': wo.complaintScore,
        '综合评分': wo.totalScore.toFixed(1),
        '关联投诉数': complaints.length,
        '状态': getStatusText(wo.status),
        '负责人': wo.assignedTo || '-',
        '创建时间': formatDate(wo.createdAt),
        '开始时间': wo.startedAt ? formatDate(wo.startedAt) : '-',
        '完成时间': wo.completedAt ? formatDate(wo.completedAt) : '-',
        '处理结果': wo.result || '-',
        '是否公示': wo.isPublic ? '是' : '否'
      };
    });
    exportToCSV(exportData, `修剪工单_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const getPriorityClass = (priority: number) => {
    if (priority >= 80) return 'priority-urgent';
    if (priority >= 60) return 'priority-high';
    if (priority >= 40) return 'priority-medium';
    return 'priority-low';
  };

  const getPriorityText = (priority: number) => {
    if (priority >= 80) return '紧急';
    if (priority >= 60) return '高';
    if (priority >= 40) return '中';
    return '低';
  };

  const getProgressBarColor = (score: number) => {
    if (score >= 70) return 'red';
    if (score >= 40) return 'yellow';
    return 'green';
  };

  return (
    <div>
      <div className="page-header">
        <h2>工单优先级排序</h2>
        <p>根据楼栋遮光、病虫害和居民投诉自动计算优先级，支持手动调整和处理</p>
      </div>

      <div className="tree-info-panel" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="info-panel">
          <h4>📊 优先级计算规则</h4>
          <ul className="info-list">
            <li>
              <span className="info-label">遮光权重</span>
              <span>40%</span>
            </li>
            <li>
              <span className="info-label">病虫害权重</span>
              <span>35%</span>
            </li>
            <li>
              <span className="info-label">投诉权重</span>
              <span>25%</span>
            </li>
          </ul>
        </div>
        <div className="info-panel">
          <h4>🔴 紧急工单</h4>
          <ul className="info-list">
            <li>
              <span className="info-label">数量</span>
              <span className="badge badge-red">
                {state.workOrders.filter(wo => wo.priority >= 80).length}
              </span>
            </li>
            <li>
              <span className="info-label">待处理</span>
              <span>
                {state.workOrders.filter(wo => wo.priority >= 80 && wo.status === 'pending').length}
              </span>
            </li>
          </ul>
        </div>
        <div className="info-panel">
          <h4>🟠 高优先级</h4>
          <ul className="info-list">
            <li>
              <span className="info-label">数量</span>
              <span className="badge badge-yellow">
                {state.workOrders.filter(wo => wo.priority >= 60 && wo.priority < 80).length}
              </span>
            </li>
            <li>
              <span className="info-label">待处理</span>
              <span>
                {state.workOrders.filter(wo => wo.priority >= 60 && wo.priority < 80 && wo.status === 'pending').length}
              </span>
            </li>
          </ul>
        </div>
        <div className="info-panel">
          <h4>✅ 已完成</h4>
          <ul className="info-list">
            <li>
              <span className="info-label">数量</span>
              <span className="badge badge-green">
                {state.workOrders.filter(wo => wo.status === 'completed').length}
              </span>
            </li>
            <li>
              <span className="info-label">已公示</span>
              <span>
                {state.workOrders.filter(wo => wo.status === 'completed' && wo.isPublic).length}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="actions">
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">全部状态</option>
          <option value="pending">待处理</option>
          <option value="processing">处理中</option>
          <option value="completed">已完成</option>
        </select>
        <select
          className="filter-select"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="all">全部优先级</option>
          <option value="urgent">紧急 (≥80)</option>
          <option value="high">高 (60-79)</option>
          <option value="medium">中 (40-59)</option>
          <option value="low">低 (≤39)</option>
        </select>
        <button className="btn btn-secondary" onClick={handleRefresh}>
          🔄 刷新工单
        </button>
        <button className="btn btn-primary" onClick={handleExport}>
          📥 导出CSV
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>📋 工单列表 ({sortedOrders.length} 条)</h3>
        </div>
        <div className="card-body">
          {sortedOrders.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>优先级</th>
                    <th>树木位置</th>
                    <th>楼栋</th>
                    <th>关联投诉</th>
                    <th>负责人</th>
                    <th>状态</th>
                    <th>是否公示</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOrders.map(wo => {
                    const tree = state.trees.find(t => t.id === wo.treeId);
                    const complaints = state.complaints.filter(c => wo.complaintIds.includes(c.id));
                    return (
                      <tr key={wo.id}>
                        <td>
                          <span className={`priority-badge ${getPriorityClass(wo.priority)}`}>
                            {getPriorityText(wo.priority)} ({wo.priority})
                          </span>
                        </td>
                        <td>{tree?.location || '-'}</td>
                        <td>{tree?.building || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {complaints.map(c => (
                              <span
                                key={c.id}
                                className={`complaint-tag complaint-tag-${c.type}`}
                              >
                                {c.type === 'shading' ? '遮光' : c.type === 'disease' ? '病虫' : '投诉'}
                              </span>
                            ))}
                            {complaints.length === 0 && (
                              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>无</span>
                            )}
                          </div>
                        </td>
                        <td>{wo.assignedTo || '-'}</td>
                        <td>
                          <span className={`badge ${getStatusColor(wo.status)}`}>
                            {getStatusText(wo.status)}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${wo.isPublic ? 'badge-green' : 'badge-gray'}`}>
                            {wo.isPublic ? '已公示' : '未公示'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setSelectedOrder(wo)}
                            >
                              详情
                            </button>
                            {wo.status === 'pending' && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  setSelectedOrder(wo);
                                  setShowStartModal(true);
                                }}
                              >
                                开始
                              </button>
                            )}
                            {wo.status === 'processing' && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  setSelectedOrder(wo);
                                  setShowCompleteModal(true);
                                }}
                              >
                                完成
                              </button>
                            )}
                            {wo.status === 'completed' && !wo.isPublic && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handlePublish(wo)}
                              >
                                公示
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-text">暂无工单，请点击"刷新工单"生成</div>
            </div>
          )}
        </div>
      </div>

      {selectedOrder && !showStartModal && !showCompleteModal && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 工单详情</h3>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="label">工单编号</div>
                  <div className="value" style={{ fontWeight: 600 }}>{selectedOrder.id}</div>
                </div>
                <div className="detail-item">
                  <div className="label">优先级</div>
                  <div className="value">
                    <span className={`priority-badge ${getPriorityClass(selectedOrder.priority)}`}>
                      {getPriorityText(selectedOrder.priority)} ({selectedOrder.priority})
                    </span>
                  </div>
                </div>
                <div className="detail-item">
                  <div className="label">状态</div>
                  <div className="value">
                    <span className={`badge ${getStatusColor(selectedOrder.status)}`}>
                      {getStatusText(selectedOrder.status)}
                    </span>
                  </div>
                </div>
                <div className="detail-item">
                  <div className="label">负责人</div>
                  <div className="value">{selectedOrder.assignedTo || '-'}</div>
                </div>
              </div>

              <div className="detail-item" style={{ marginTop: '1rem' }}>
                <div className="label">相关树木</div>
                <div className="value">
                  {(() => {
                    const tree = state.trees.find(t => t.id === selectedOrder.treeId);
                    return tree ? `${tree.location} - ${tree.species}` : '-';
                  })()}
                </div>
              </div>

              <div className="score-breakdown">
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                  📊 优先级评分明细
                </h4>
                <div className="score-item">
                  <span className="score-label">楼栋遮光 (40%)</span>
                  <span className="score-value">{selectedOrder.shadingScore} 分</span>
                </div>
                <div className="progress-bar" style={{ marginBottom: '0.75rem' }}>
                  <div
                    className={`progress-bar-fill ${getProgressBarColor(selectedOrder.shadingScore)}`}
                    style={{ width: `${selectedOrder.shadingScore}%` }}
                  />
                </div>
                <div className="score-item">
                  <span className="score-label">病虫害 (35%)</span>
                  <span className="score-value">{selectedOrder.diseaseScore} 分</span>
                </div>
                <div className="progress-bar" style={{ marginBottom: '0.75rem' }}>
                  <div
                    className={`progress-bar-fill ${getProgressBarColor(selectedOrder.diseaseScore)}`}
                    style={{ width: `${selectedOrder.diseaseScore}%` }}
                  />
                </div>
                <div className="score-item">
                  <span className="score-label">居民投诉 (25%)</span>
                  <span className="score-value">{selectedOrder.complaintScore} 分</span>
                </div>
                <div className="progress-bar" style={{ marginBottom: '0.75rem' }}>
                  <div
                    className={`progress-bar-fill ${getProgressBarColor(selectedOrder.complaintScore)}`}
                    style={{ width: `${selectedOrder.complaintScore}%` }}
                  />
                </div>
                <div className="score-item" style={{ marginTop: '0.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem' }}>
                  <span className="score-label" style={{ fontWeight: 600 }}>综合评分</span>
                  <span className="score-value" style={{ color: '#059669', fontWeight: 700 }}>
                    {selectedOrder.totalScore.toFixed(1)} 分
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                  📋 关联投诉 ({selectedOrder.complaintIds.length} 条)
                </h4>
                {selectedOrder.complaintIds.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {state.complaints
                      .filter(c => selectedOrder.complaintIds.includes(c.id))
                      .map(c => (
                        <div key={c.id} className="detail-item">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <span className={`complaint-tag complaint-tag-${c.type}`}>
                              {c.type === 'shading' ? '遮光' : c.type === 'disease' ? '病虫害' : '居民投诉'}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              {formatDate(c.createdAt)}
                            </span>
                          </div>
                          <div className="value" style={{ fontSize: '0.875rem' }}>{c.description}</div>
                          <div style={{ marginTop: '0.25rem' }}>
                            <span className={`badge ${c.resolved ? 'badge-green' : 'badge-yellow'}`}>
                              {c.resolved ? '已解决' : '待处理'}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '1.5rem' }}>
                    <div className="empty-state-text">暂无关联投诉</div>
                  </div>
                )}
              </div>

              <div className="detail-grid" style={{ marginTop: '1.5rem' }}>
                <div className="detail-item">
                  <div className="label">创建时间</div>
                  <div className="value">{formatDate(selectedOrder.createdAt)}</div>
                </div>
                <div className="detail-item">
                  <div className="label">开始时间</div>
                  <div className="value">{selectedOrder.startedAt ? formatDate(selectedOrder.startedAt) : '-'}</div>
                </div>
                <div className="detail-item">
                  <div className="label">完成时间</div>
                  <div className="value">{selectedOrder.completedAt ? formatDate(selectedOrder.completedAt) : '-'}</div>
                </div>
                <div className="detail-item">
                  <div className="label">公示状态</div>
                  <div className="value">
                    <span className={`badge ${selectedOrder.isPublic ? 'badge-green' : 'badge-gray'}`}>
                      {selectedOrder.isPublic ? '已公示' : '未公示'}
                    </span>
                  </div>
                </div>
              </div>

              {selectedOrder.result && (
                <div className="detail-item" style={{ marginTop: '1rem' }}>
                  <div className="label">处理结果</div>
                  <div className="value">{selectedOrder.result}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {selectedOrder.status === 'pending' && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowStartModal(true)}
                >
                  开始处理
                </button>
              )}
              {selectedOrder.status === 'processing' && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowCompleteModal(true)}
                >
                  完成处理
                </button>
              )}
              {selectedOrder.status === 'completed' && !selectedOrder.isPublic && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    handlePublish(selectedOrder);
                    setSelectedOrder(null);
                  }}
                >
                  公示结果
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {showStartModal && selectedOrder && (
        <div className="modal-overlay" onClick={() => {
          setShowStartModal(false);
          setSelectedOrder(null);
          setAssignedTo('');
        }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>▶️ 开始处理工单</h3>
              <button className="modal-close" onClick={() => {
                setShowStartModal(false);
                setSelectedOrder(null);
                setAssignedTo('');
              }}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-item">
                <div className="label">工单编号</div>
                <div className="value">{selectedOrder.id}</div>
              </div>
              <div className="detail-item" style={{ marginTop: '0.5rem' }}>
                <div className="label">相关树木</div>
                <div className="value">
                  {state.trees.find(t => t.id === selectedOrder.treeId)?.location || '-'}
                </div>
              </div>
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>负责人 *</label>
                <input
                  type="text"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  placeholder="请输入负责人姓名"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowStartModal(false);
                  setAssignedTo('');
                }}
              >
                取消
              </button>
              <button className="btn btn-primary" onClick={handleStart}>
                确认开始
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompleteModal && selectedOrder && (
        <div className="modal-overlay" onClick={() => {
          setShowCompleteModal(false);
          setSelectedOrder(null);
          setResult('');
        }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✅ 完成工单</h3>
              <button className="modal-close" onClick={() => {
                setShowCompleteModal(false);
                setSelectedOrder(null);
                setResult('');
              }}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-item">
                <div className="label">工单编号</div>
                <div className="value">{selectedOrder.id}</div>
              </div>
              <div className="detail-item" style={{ marginTop: '0.5rem' }}>
                <div className="label">负责人</div>
                <div className="value">{selectedOrder.assignedTo || '-'}</div>
              </div>
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>处理结果 *</label>
                <textarea
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  placeholder="请详细描述修剪处理情况、病虫害防治措施等..."
                />
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                💡 完成工单后，相关投诉将自动标记为已解决，树木状态将更新为"已修剪"
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowCompleteModal(false);
                  setResult('');
                }}
              >
                取消
              </button>
              <button className="btn btn-primary" onClick={handleComplete}>
                确认完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkOrderManagement;
