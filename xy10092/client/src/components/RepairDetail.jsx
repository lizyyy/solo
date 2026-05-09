import React, { useState, useEffect } from 'react';

function RepairDetail({ repair, onClose, onRefresh, onToast }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [confirmForm, setConfirmForm] = useState({
    studentName: repair.studentName,
    discrepancyNote: ''
  });
  const [resolutionNote, setResolutionNote] = useState('');

  const [newItem, setNewItem] = useState({
    materialId: '',
    type: 'claim',
    quantity: 1
  });

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      const response = await fetch('/api/materials');
      if (response.ok) {
        const data = await response.json();
        setMaterials(data);
      }
    } catch (error) {
      onToast('获取材料列表失败', 'error');
    }
  };

  const getStatusText = (status) => {
    const statusMap = {
      pending_verification: '待确认',
      discrepancy: '异常待处理',
      completed: '已完成'
    };
    return statusMap[status] || status;
  };

  const getStatusClass = (status) => {
    const classMap = {
      pending_verification: 'status-pending',
      discrepancy: 'status-discrepancy',
      completed: 'status-completed'
    };
    return classMap[status] || '';
  };

  const addMaterialItem = async () => {
    if (!newItem.materialId || !newItem.quantity) {
      onToast('请选择材料并填写数量', 'warning');
      return;
    }

    const material = materials.find(m => m.id === newItem.materialId);
    setLoading(true);
    try {
      const response = await fetch(`/api/repairs/${repair.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newItem,
          quantity: parseFloat(newItem.quantity),
          unitPrice: material?.unitPrice || 0
        })
      });

      if (response.ok) {
        onToast(`${newItem.type === 'claim' ? '领用' : '退回'}材料成功`, 'success');
        setNewItem({ materialId: '', type: 'claim', quantity: 1 });
        onRefresh();
      } else {
        const error = await response.json();
        onToast(error.error || '操作失败', 'error');
      }
    } catch (error) {
      onToast('操作失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteMaterialItem = async (itemId) => {
    if (!window.confirm('确定要删除这条材料记录吗？')) return;

    try {
      const response = await fetch(`/api/repairs/${repair.id}/items/${itemId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        onToast('删除成功', 'success');
        onRefresh();
      } else {
        const error = await response.json();
        onToast(error.error || '删除失败', 'error');
      }
    } catch (error) {
      onToast('删除失败', 'error');
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/repairs/${repair.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmForm)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === 'discrepancy') {
          onToast('确认完成，但发现数据差异，已转入异常处理', 'warning');
        } else {
          onToast('学生确认完成', 'success');
        }
        setShowConfirmModal(false);
        onRefresh();
      } else {
        const error = await response.json();
        onToast(error.error || '确认失败', 'error');
      }
    } catch (error) {
      onToast('确认失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!resolutionNote.trim()) {
      onToast('请填写处理说明', 'warning');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/repairs/${repair.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionNote })
      });

      if (response.ok) {
        onToast('异常处理完成', 'success');
        setShowResolveModal(false);
        setResolutionNote('');
        onRefresh();
      } else {
        const error = await response.json();
        onToast(error.error || '处理失败', 'error');
      }
    } catch (error) {
      onToast('处理失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const claimItems = repair.items.filter(i => i.type === 'claim');
  const returnItems = repair.items.filter(i => i.type === 'return');
  const analysis = repair.discrepancyAnalysis || { hasIssues: false, issues: [], totals: {} };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-large" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <h3 style={{ display: 'inline-block', marginRight: 12 }}>
                维修单详情 - {repair.id}
              </h3>
              <span className={`status-badge ${getStatusClass(repair.status)}`}>
                {getStatusText(repair.status)}
              </span>
              {repair.hasDiscrepancy && (
                <span className="status-badge status-discrepancy" style={{ marginLeft: 8 }}>
                  存在差异
                </span>
              )}
            </div>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>

          <div className="modal-body">
            <div className="tabs">
              <button
                className={activeTab === 'overview' ? 'active' : ''}
                onClick={() => setActiveTab('overview')}
              >
                概览
              </button>
              <button
                className={activeTab === 'materials' ? 'active' : ''}
                onClick={() => setActiveTab('materials')}
              >
                材料明细
              </button>
              <button
                className={activeTab === 'history' ? 'active' : ''}
                onClick={() => setActiveTab('history')}
              >
                操作历史
              </button>
            </div>

            {activeTab === 'overview' && (
              <div>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>维修单编号</label>
                    <div className="value">{repair.id}</div>
                  </div>
                  <div className="detail-item">
                    <label>维修类型</label>
                    <div className="value">{repair.repairType}</div>
                  </div>
                  <div className="detail-item">
                    <label>学生姓名</label>
                    <div className="value">{repair.studentName}</div>
                  </div>
                  <div className="detail-item">
                    <label>学生电话</label>
                    <div className="value">{repair.studentPhone}</div>
                  </div>
                  <div className="detail-item">
                    <label>宿舍楼</label>
                    <div className="value">{repair.dormBuilding}</div>
                  </div>
                  <div className="detail-item">
                    <label>宿舍号</label>
                    <div className="value">{repair.dormNumber}</div>
                  </div>
                  <div className="detail-item">
                    <label>维修日期</label>
                    <div className="value">{repair.repairDate}</div>
                  </div>
                  <div className="detail-item">
                    <label>维修人员</label>
                    <div className="value">{repair.workerName || '-'}</div>
                  </div>
                </div>

                {repair.description && (
                  <div className="detail-item" style={{ marginBottom: 20 }}>
                    <label>问题描述</label>
                    <div className="value">{repair.description}</div>
                  </div>
                )}

                <div className="divider" />

                <h4 className="section-title">材料统计</h4>
                <div className="stats-grid" style={{ marginTop: 16 }}>
                  <div className="stat-card">
                    <h3>领用材料</h3>
                    <div className="value">{claimItems.length}项</div>
                    <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
                      {claimItems.reduce((s, i) => s + i.quantity, 0)}件
                    </div>
                  </div>
                  <div className="stat-card">
                    <h3>退回材料</h3>
                    <div className="value">{returnItems.length}项</div>
                    <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
                      {returnItems.reduce((s, i) => s + i.quantity, 0)}件
                    </div>
                  </div>
                  <div className="stat-card primary">
                    <h3>领用金额</h3>
                    <div className="value">¥{analysis.totals?.totalClaim?.toFixed(2) || '0.00'}</div>
                  </div>
                  <div className="stat-card warning">
                    <h3>退回金额</h3>
                    <div className="value">¥{analysis.totals?.totalReturn?.toFixed(2) || '0.00'}</div>
                  </div>
                  <div className="stat-card success">
                    <h3>核销金额</h3>
                    <div className="value">
                      ¥{(analysis.totals?.net || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {analysis.hasIssues && (
                  <>
                    <div className="divider" />
                    <h4 className="section-title" style={{ borderColor: '#ff4d4f' }}>
                      差异分析
                    </h4>
                    <ul className="issue-list">
                      {analysis.issues?.map((issue, index) => (
                        <li key={index}>⚠️ {issue.message}</li>
                      ))}
                    </ul>
                    {repair.discrepancyNote && (
                      <div className="alert alert-warning" style={{ marginTop: 16 }}>
                        <strong>学生备注：</strong> {repair.discrepancyNote}
                      </div>
                    )}
                    {repair.resolutionNote && (
                      <div className="alert alert-success" style={{ marginTop: 16 }}>
                        <strong>处理说明：</strong> {repair.resolutionNote}
                      </div>
                    )}
                  </>
                )}

                {repair.studentConfirmationDate && (
                  <>
                    <div className="divider" />
                    <div className="detail-grid">
                      <div className="detail-item">
                        <label>确认人</label>
                        <div className="value">{repair.confirmedByStudent}</div>
                      </div>
                      <div className="detail-item">
                        <label>确认时间</label>
                        <div className="value">
                          {new Date(repair.studentConfirmationDate).toLocaleString('zh-CN')}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="divider" />
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>创建时间</label>
                    <div className="value">
                      {new Date(repair.createdAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <div className="detail-item">
                    <label>最后更新</label>
                    <div className="value">
                      {new Date(repair.updatedAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'materials' && (
              <div>
                {claimItems.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <h4 className="section-title">领用材料</h4>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>材料名称</th>
                            <th>规格</th>
                            <th>数量</th>
                            <th>单位</th>
                            <th>单价</th>
                            <th>金额</th>
                            <th>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {claimItems.map(item => (
                            <tr key={item.id}>
                              <td>{item.material?.name || item.materialId}</td>
                              <td>{item.material?.specification || '-'}</td>
                              <td>{item.quantity}</td>
                              <td>{item.material?.unit || '-'}</td>
                              <td>¥{item.unitPrice}</td>
                              <td>¥{(item.quantity * item.unitPrice).toFixed(2)}</td>
                              <td>
                                {repair.status === 'pending_verification' && (
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => deleteMaterialItem(item.id)}
                                  >
                                    删除
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {returnItems.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <h4 className="section-title" style={{ borderColor: '#faad14' }}>
                      退回材料
                    </h4>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>材料名称</th>
                            <th>规格</th>
                            <th>数量</th>
                            <th>单位</th>
                            <th>单价</th>
                            <th>金额</th>
                            <th>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {returnItems.map(item => (
                            <tr key={item.id}>
                              <td>{item.material?.name || item.materialId}</td>
                              <td>{item.material?.specification || '-'}</td>
                              <td>{item.quantity}</td>
                              <td>{item.material?.unit || '-'}</td>
                              <td>¥{item.unitPrice}</td>
                              <td>¥{(item.quantity * item.unitPrice).toFixed(2)}</td>
                              <td>
                                {repair.status === 'pending_verification' && (
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => deleteMaterialItem(item.id)}
                                  >
                                    删除
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {repair.items.length === 0 && (
                  <div className="empty-state">
                    <p>暂无材料记录</p>
                  </div>
                )}

                {repair.status === 'pending_verification' && (
                  <>
                    <div className="divider" />
                    <h4 className="section-title">添加材料</h4>
                    <div className="form-row" style={{ marginTop: 16 }}>
                      <div className="form-group">
                        <label>类型</label>
                        <select
                          value={newItem.type}
                          onChange={e => setNewItem({ ...newItem, type: e.target.value })}
                        >
                          <option value="claim">领用</option>
                          <option value="return">退回</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>材料</label>
                        <select
                          value={newItem.materialId}
                          onChange={e => setNewItem({ ...newItem, materialId: e.target.value })}
                        >
                          <option value="">请选择材料</option>
                          {materials.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.specification})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>数量</label>
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={newItem.quantity}
                          onChange={e => setNewItem({ ...newItem, quantity: e.target.value })}
                        />
                      </div>
                      <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-primary"
                          onClick={addMaterialItem}
                          disabled={loading}
                        >
                          {loading ? '处理中...' : '添加'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                {repair.history && repair.history.length > 0 ? (
                  <div className="timeline">
                    {[...repair.history].reverse().map((item, index) => (
                      <div key={item.id || index} className="timeline-item">
                        <div className="time">
                          {new Date(item.timestamp).toLocaleString('zh-CN')}
                        </div>
                        <div className="action">{item.action}</div>
                        <div className="actor">操作人：{item.actor}</div>
                        {item.details && (
                          <div className="details">
                            {JSON.stringify(item.details)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>暂无操作历史</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            {repair.status === 'pending_verification' && (
              <button
                className="btn btn-success"
                onClick={() => setShowConfirmModal(true)}
              >
                学生确认
              </button>
            )}
            {repair.status === 'discrepancy' && (
              <button
                className="btn btn-warning"
                onClick={() => setShowResolveModal(true)}
              >
                处理异常
              </button>
            )}
            <button className="btn btn-secondary" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>
      </div>

      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>学生确认</h3>
              <button
                className="modal-close"
                onClick={() => setShowConfirmModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              {analysis.hasIssues && (
                <div className="alert alert-warning">
                  <strong>检测到数据差异：</strong>
                  <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                    {analysis.issues?.map((issue, index) => (
                      <li key={index}>{issue.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="form-group">
                <label>确认人姓名</label>
                <input
                  type="text"
                  value={confirmForm.studentName}
                  onChange={e => setConfirmForm({ ...confirmForm, studentName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>备注（如有差异请说明）</label>
                <textarea
                  rows={3}
                  value={confirmForm.discrepancyNote}
                  onChange={e => setConfirmForm({ ...confirmForm, discrepancyNote: e.target.value })}
                  placeholder="如果材料领用/退回数量有差异，请在此说明..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowConfirmModal(false)}
              >
                取消
              </button>
              <button
                className="btn btn-success"
                onClick={handleConfirm}
                disabled={loading}
              >
                {loading ? '确认中...' : '确认提交'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showResolveModal && (
        <div className="modal-overlay" onClick={() => setShowResolveModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>异常处理</h3>
              <button
                className="modal-close"
                onClick={() => setShowResolveModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              {analysis.hasIssues && (
                <div className="alert alert-warning">
                  <strong>当前差异问题：</strong>
                  <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                    {analysis.issues?.map((issue, index) => (
                      <li key={index}>{issue.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="form-group">
                <label>处理说明 *</label>
                <textarea
                  rows={4}
                  value={resolutionNote}
                  onChange={e => setResolutionNote(e.target.value)}
                  placeholder="请详细说明如何处理这个差异问题..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowResolveModal(false)}
              >
                取消
              </button>
              <button
                className="btn btn-warning"
                onClick={handleResolve}
                disabled={loading}
              >
                {loading ? '处理中...' : '完成处理'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default RepairDetail;