import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import { formatDate, exportToCSV, getComplaintTypeText } from '../utils';
import type { ComplaintRecord, ComplaintType } from '../types';

const ComplaintManagement: React.FC = () => {
  const { state, dispatch } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintRecord | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolution, setResolution] = useState('');

  const [newComplaint, setNewComplaint] = useState({
    treeId: '',
    type: 'shading' as ComplaintType,
    description: '',
    complainant: '',
    contact: ''
  });

  const filteredComplaints = state.complaints.filter(c => {
    const tree = state.trees.find(t => t.id === c.treeId);
    const matchesSearch = 
      c.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.complainant.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tree?.location.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'resolved' ? c.resolved : !c.resolved);
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleAddComplaint = () => {
    if (!newComplaint.treeId || !newComplaint.description || !newComplaint.complainant) {
      alert('请填写完整信息');
      return;
    }

    const complaint: ComplaintRecord = {
      id: `C${Date.now()}`,
      ...newComplaint,
      createdAt: new Date().toISOString(),
      resolved: false
    };

    dispatch({ type: 'ADD_COMPLAINT', payload: complaint });
    dispatch({ type: 'REFRESH_WORK_ORDERS' });
    setShowAddModal(false);
    setNewComplaint({
      treeId: '',
      type: 'shading',
      description: '',
      complainant: '',
      contact: ''
    });
  };

  const handleResolveComplaint = () => {
    if (!selectedComplaint || !resolution) {
      alert('请填写处理结果');
      return;
    }

    dispatch({
      type: 'RESOLVE_COMPLAINT',
      payload: { id: selectedComplaint.id, resolution }
    });

    setShowResolveModal(false);
    setSelectedComplaint(null);
    setResolution('');
  };

  const handleExport = () => {
    const exportData = filteredComplaints.map(c => {
      const tree = state.trees.find(t => t.id === c.treeId);
      return {
        '投诉编号': c.id,
        '树木位置': tree?.location || '-',
        '楼栋': tree?.building || '-',
        '投诉类型': getComplaintTypeText(c.type),
        '投诉内容': c.description,
        '投诉人': c.complainant,
        '联系方式': c.contact,
        '投诉日期': formatDate(c.createdAt),
        '状态': c.resolved ? '已解决' : '待处理',
        '解决日期': c.resolvedAt ? formatDate(c.resolvedAt) : '-',
        '处理结果': c.resolution || ''
      };
    });
    exportToCSV(exportData, `投诉记录_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const treesNeedingAttention = state.trees.filter(t => 
    t.status === 'needs_trimming' || t.status === 'diseased'
  );

  return (
    <div>
      <div className="page-header">
        <h2>投诉标记管理</h2>
        <p>记录和处理居民关于树木的各类投诉，自动关联到工单优先级</p>
      </div>

      <div className="actions">
        <input
          type="text"
          className="search-input"
          placeholder="搜索投诉内容、投诉人或树木位置..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="filter-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">全部类型</option>
          <option value="shading">楼栋遮光</option>
          <option value="disease">病虫害</option>
          <option value="resident">居民投诉</option>
        </select>
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">全部状态</option>
          <option value="pending">待处理</option>
          <option value="resolved">已解决</option>
        </select>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          ➕ 新增投诉
        </button>
        <button className="btn btn-secondary" onClick={handleExport}>
          📥 导出CSV
        </button>
      </div>

      <div className="tree-info-panel" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="info-panel">
          <h4>📋 楼栋遮光投诉</h4>
          <ul className="info-list">
            <li>
              <span className="info-label">总数</span>
              <span>{state.complaints.filter(c => c.type === 'shading').length} 件</span>
            </li>
            <li>
              <span className="info-label">待处理</span>
              <span className="badge badge-yellow">
                {state.complaints.filter(c => c.type === 'shading' && !c.resolved).length}
              </span>
            </li>
          </ul>
        </div>
        <div className="info-panel">
          <h4>🐛 病虫害投诉</h4>
          <ul className="info-list">
            <li>
              <span className="info-label">总数</span>
              <span>{state.complaints.filter(c => c.type === 'disease').length} 件</span>
            </li>
            <li>
              <span className="info-label">待处理</span>
              <span className="badge badge-yellow">
                {state.complaints.filter(c => c.type === 'disease' && !c.resolved).length}
              </span>
            </li>
          </ul>
        </div>
        <div className="info-panel">
          <h4>👥 居民投诉</h4>
          <ul className="info-list">
            <li>
              <span className="info-label">总数</span>
              <span>{state.complaints.filter(c => c.type === 'resident').length} 件</span>
            </li>
            <li>
              <span className="info-label">待处理</span>
              <span className="badge badge-yellow">
                {state.complaints.filter(c => c.type === 'resident' && !c.resolved).length}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>📝 投诉记录列表 ({filteredComplaints.length} 条)</h3>
        </div>
        <div className="card-body">
          {filteredComplaints.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>投诉编号</th>
                    <th>树木位置</th>
                    <th>楼栋</th>
                    <th>类型</th>
                    <th>投诉人</th>
                    <th>投诉日期</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredComplaints.map(c => {
                    const tree = state.trees.find(t => t.id === c.treeId);
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.id}</td>
                        <td>{tree?.location || '-'}</td>
                        <td>{tree?.building || '-'}</td>
                        <td>
                          <span className={`complaint-tag complaint-tag-${c.type}`}>
                            {getComplaintTypeText(c.type)}
                          </span>
                        </td>
                        <td>{c.complainant}</td>
                        <td>{formatDate(c.createdAt)}</td>
                        <td>
                          <span className={`badge ${c.resolved ? 'badge-green' : 'badge-yellow'}`}>
                            {c.resolved ? '已解决' : '待处理'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setSelectedComplaint(c)}
                            >
                              详情
                            </button>
                            {!c.resolved && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  setSelectedComplaint(c);
                                  setShowResolveModal(true);
                                }}
                              >
                                处理
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
              <div className="empty-state-text">暂无投诉记录</div>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>➕ 新增投诉记录</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>选择树木 *</label>
                <select
                  value={newComplaint.treeId}
                  onChange={(e) => setNewComplaint({ ...newComplaint, treeId: e.target.value })}
                >
                  <option value="">请选择...</option>
                  {treesNeedingAttention.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.location} - {t.species}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>投诉类型 *</label>
                <select
                  value={newComplaint.type}
                  onChange={(e) => setNewComplaint({ ...newComplaint, type: e.target.value as ComplaintType })}
                >
                  <option value="shading">楼栋遮光</option>
                  <option value="disease">病虫害</option>
                  <option value="resident">居民投诉</option>
                </select>
              </div>
              <div className="form-group">
                <label>投诉内容 *</label>
                <textarea
                  value={newComplaint.description}
                  onChange={(e) => setNewComplaint({ ...newComplaint, description: e.target.value })}
                  placeholder="请详细描述投诉内容..."
                />
              </div>
              <div className="form-group">
                <label>投诉人 *</label>
                <input
                  type="text"
                  value={newComplaint.complainant}
                  onChange={(e) => setNewComplaint({ ...newComplaint, complainant: e.target.value })}
                  placeholder="请输入投诉人姓名"
                />
              </div>
              <div className="form-group">
                <label>联系方式</label>
                <input
                  type="text"
                  value={newComplaint.contact}
                  onChange={(e) => setNewComplaint({ ...newComplaint, contact: e.target.value })}
                  placeholder="请输入联系方式（选填）"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleAddComplaint}>
                提交
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedComplaint && !showResolveModal && (
        <div className="modal-overlay" onClick={() => setSelectedComplaint(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 投诉详情</h3>
              <button className="modal-close" onClick={() => setSelectedComplaint(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="label">投诉编号</div>
                  <div className="value">{selectedComplaint.id}</div>
                </div>
                <div className="detail-item">
                  <div className="label">投诉类型</div>
                  <div className="value">
                    <span className={`complaint-tag complaint-tag-${selectedComplaint.type}`}>
                      {getComplaintTypeText(selectedComplaint.type)}
                    </span>
                  </div>
                </div>
                <div className="detail-item">
                  <div className="label">相关树木</div>
                  <div className="value">
                    {state.trees.find(t => t.id === selectedComplaint.treeId)?.location || '-'}
                  </div>
                </div>
                <div className="detail-item">
                  <div className="label">投诉日期</div>
                  <div className="value">{formatDate(selectedComplaint.createdAt)}</div>
                </div>
                <div className="detail-item">
                  <div className="label">投诉人</div>
                  <div className="value">{selectedComplaint.complainant}</div>
                </div>
                <div className="detail-item">
                  <div className="label">联系方式</div>
                  <div className="value">{selectedComplaint.contact || '-'}</div>
                </div>
              </div>
              <div className="detail-item" style={{ marginTop: '1rem' }}>
                <div className="label">投诉内容</div>
                <div className="value">{selectedComplaint.description}</div>
              </div>
              <div className="detail-item" style={{ marginTop: '1rem' }}>
                <div className="label">当前状态</div>
                <div className="value">
                  <span className={`badge ${selectedComplaint.resolved ? 'badge-green' : 'badge-yellow'}`}>
                    {selectedComplaint.resolved ? '已解决' : '待处理'}
                  </span>
                </div>
              </div>
              {selectedComplaint.resolved && (
                <>
                  <div className="detail-item" style={{ marginTop: '1rem' }}>
                    <div className="label">解决日期</div>
                    <div className="value">{selectedComplaint.resolvedAt ? formatDate(selectedComplaint.resolvedAt) : '-'}</div>
                  </div>
                  <div className="detail-item" style={{ marginTop: '1rem' }}>
                    <div className="label">处理结果</div>
                    <div className="value">{selectedComplaint.resolution || '-'}</div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              {!selectedComplaint.resolved && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowResolveModal(true)}
                >
                  处理投诉
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setSelectedComplaint(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {showResolveModal && selectedComplaint && (
        <div className="modal-overlay" onClick={() => {
          setShowResolveModal(false);
          setSelectedComplaint(null);
          setResolution('');
        }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✅ 处理投诉</h3>
              <button className="modal-close" onClick={() => {
                setShowResolveModal(false);
                setSelectedComplaint(null);
                setResolution('');
              }}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-item">
                <div className="label">投诉编号</div>
                <div className="value">{selectedComplaint.id}</div>
              </div>
              <div className="detail-item" style={{ marginTop: '0.5rem' }}>
                <div className="label">投诉内容</div>
                <div className="value">{selectedComplaint.description}</div>
              </div>
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>处理结果 *</label>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="请输入处理结果详情..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowResolveModal(false);
                  setResolution('');
                }}
              >
                取消
              </button>
              <button className="btn btn-primary" onClick={handleResolveComplaint}>
                确认处理
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplaintManagement;
