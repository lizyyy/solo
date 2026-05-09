import { useState, useEffect, useCallback } from 'react';
import { invoices, STATUS_MAP, EXCEPTION_TYPE_MAP, ACTION_MAP } from '../api';
import dayjs from 'dayjs';

function InvoiceList() {
  const [invoicesList, setInvoicesList] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({
    keyword: '',
    status: 'all',
    hasException: '',
    sortBy: 'created_at',
    sortOrder: 'DESC'
  });
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [detailModal, setDetailModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [message, setMessage] = useState(null);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== '' && v !== null))
      };
      const res = await invoices.list(params);
      setInvoicesList(res.data.items);
      setPagination((prev) => ({
        ...prev,
        total: res.data.total,
        totalPages: res.data.totalPages
      }));
    } catch (err) {
      showMessage('error', '加载票据列表失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filters]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (page) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === invoicesList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(invoicesList.map((i) => i.id));
    }
  };

  const openDetail = async (id) => {
    try {
      const res = await invoices.get(id);
      setDetailModal(res.data);
    } catch (err) {
      showMessage('error', '加载票据详情失败');
    }
  };

  const openEdit = (invoice) => {
    setEditModal({ ...invoice });
  };

  const handleReview = async (id, action, comments = '') => {
    try {
      await invoices.review(id, { action, comments, operator: '当前用户' });
      showMessage('success', action === 'approve' ? '审核通过' : action === 'reject' ? '已拒绝' : '已标记审核中');
      setDetailModal(null);
      loadInvoices();
    } catch (err) {
      showMessage('error', '操作失败');
    }
  };

  const handleSaveEdit = async () => {
    try {
      await invoices.update(editModal.id, editModal);
      showMessage('success', '保存成功');
      setEditModal(null);
      loadInvoices();
    } catch (err) {
      showMessage('error', '保存失败');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这条票据吗？')) return;
    try {
      await invoices.delete(id);
      showMessage('success', '已删除');
      loadInvoices();
    } catch (err) {
      showMessage('error', '删除失败');
    }
  };

  const handleBatchDelete = async () => {
    if (!confirm(`确定要删除选中的 ${selectedIds.length} 条票据吗？`)) return;
    try {
      await invoices.batchDelete(selectedIds);
      showMessage('success', '批量删除成功');
      setSelectedIds([]);
      loadInvoices();
    } catch (err) {
      showMessage('error', '批量删除失败');
    }
  };

  const detectIssues = (invoice) => {
    const issues = [];
    if (
      invoice.approval_amount &&
      invoice.amount !== invoice.approval_amount
    ) {
      issues.push({
        type: 'amount_mismatch',
        field: '金额',
        expected: invoice.approval_amount,
        actual: invoice.amount
      });
    }
    if (!invoice.approver_name) {
      issues.push({ type: 'approval_missing', field: '审批人' });
    }
    return issues;
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">票据管理</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={loadInvoices}>
            🔄 刷新
          </button>
        </div>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="filter-bar">
            <div className="filter-group">
              <input
                type="text"
                className="input-field"
                placeholder="搜索票据号、供应商、税号..."
                style={{ width: '280px' }}
                value={filters.keyword}
                onChange={(e) => handleFilterChange('keyword', e.target.value)}
              />
            </div>

            <div className="filter-group">
              <select
                className="select-field"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="all">全部状态</option>
                {Object.entries(STATUS_MAP).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <select
                className="select-field"
                value={filters.hasException}
                onChange={(e) => handleFilterChange('hasException', e.target.value)}
              >
                <option value="">全部异常</option>
                <option value="true">有异常</option>
                <option value="false">无异常</option>
              </select>
            </div>

            <div className="filter-group">
              <select
                className="select-field"
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              >
                <option value="created_at">按创建时间</option>
                <option value="invoice_date">按开票日期</option>
                <option value="amount">按金额</option>
                <option value="exception_count">按异常数</option>
              </select>
            </div>

            <div className="filter-group">
              <select
                className="select-field"
                value={filters.sortOrder}
                onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
              >
                <option value="DESC">降序</option>
                <option value="ASC">升序</option>
              </select>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="batch-actions">
              <span className="batch-count">
                已选择 <strong>{selectedIds.length}</strong> 条
              </span>
              <button className="btn btn-sm btn-danger" onClick={handleBatchDelete}>
                批量删除
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setSelectedIds([])}
              >
                取消选择
              </button>
            </div>
          )}

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={
                        invoicesList.length > 0 &&
                        selectedIds.length === invoicesList.length
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>票据号</th>
                  <th>供应商</th>
                  <th>金额</th>
                  <th>税额</th>
                  <th>开票日期</th>
                  <th>状态</th>
                  <th>异常</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" className="empty-state">
                      加载中...
                    </td>
                  </tr>
                ) : invoicesList.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="empty-state">
                      <div className="empty-state-icon">📭</div>
                      <div>暂无数据</div>
                    </td>
                  </tr>
                ) : (
                  invoicesList.map((inv) => {
                    const statusInfo = STATUS_MAP[inv.status] || STATUS_MAP.pending;
                    const issues = detectIssues(inv);

                    return (
                      <tr key={inv.id}>
                        <td className="checkbox-cell">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(inv.id)}
                            onChange={() => toggleSelect(inv.id)}
                          />
                        </td>
                        <td style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                        <td>{inv.vendor_name || '-'}</td>
                        <td style={{ fontWeight: 600, color: '#2563eb' }}>
                          ¥{inv.amount?.toLocaleString()}
                        </td>
                        <td>¥{inv.tax_amount?.toLocaleString() || 0}</td>
                        <td>{inv.invoice_date || '-'}</td>
                        <td>
                          <span className={`status-badge ${statusInfo.class}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td>
                          {inv.exception_count > 0 ? (
                            <span
                              style={{
                                background: '#fee2e2',
                                color: '#dc2626',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 600
                              }}
                            >
                              {inv.exception_count} 项
                            </span>
                          ) : (
                            <span style={{ color: '#6b7280', fontSize: '12px' }}>-</span>
                          )}
                        </td>
                        <td>
                          <div className="action-cell">
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => openDetail(inv.id)}
                            >
                              详情
                            </button>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => openEdit(inv)}
                            >
                              编辑
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {pagination.total > 0 && (
            <div className="pagination">
              <div className="pagination-info">
                共 {pagination.total} 条，第 {pagination.page} / {pagination.totalPages} 页
              </div>
              <div className="pagination-controls">
                <button
                  className="pagination-btn"
                  disabled={pagination.page <= 1}
                  onClick={() => handlePageChange(1)}
                >
                  首页
                </button>
                <button
                  className="pagination-btn"
                  disabled={pagination.page <= 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  上一页
                </button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let page;
                  if (pagination.totalPages <= 5) {
                    page = i + 1;
                  } else if (pagination.page <= 3) {
                    page = i + 1;
                  } else if (pagination.page >= pagination.totalPages - 2) {
                    page = pagination.totalPages - 4 + i;
                  } else {
                    page = pagination.page - 2 + i;
                  }
                  return (
                    <button
                      key={page}
                      className={`pagination-btn ${pagination.page === page ? 'active' : ''}`}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  className="pagination-btn"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  下一页
                </button>
                <button
                  className="pagination-btn"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => handlePageChange(pagination.totalPages)}
                >
                  末页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {detailModal && (
        <InvoiceDetailModal
          invoice={detailModal.invoice}
          history={detailModal.history}
          exceptions={detailModal.exceptions}
          onClose={() => setDetailModal(null)}
          onReview={handleReview}
          onEdit={() => {
            setDetailModal(null);
            openEdit(detailModal.invoice);
          }}
        />
      )}

      {editModal && (
        <InvoiceEditModal
          invoice={editModal}
          onClose={() => setEditModal(null)}
          onChange={(data) => setEditModal({ ...editModal, ...data })}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}

function InvoiceDetailModal({ invoice, history, exceptions, onClose, onReview, onEdit }) {
  const [activeTab, setActiveTab] = useState('info');
  const [reviewComments, setReviewComments] = useState('');

  const statusInfo = STATUS_MAP[invoice.status] || STATUS_MAP.pending;
  const hasAmountMismatch =
    invoice.approval_amount && invoice.amount !== invoice.approval_amount;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            票据详情 - {invoice.invoice_number}
            <span
              className={`status-badge ${statusInfo.class}`}
              style={{ marginLeft: '12px' }}
            >
              {statusInfo.label}
            </span>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'info' ? 'active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              基本信息
            </button>
            <button
              className={`tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              操作历史
            </button>
            <button
              className={`tab ${activeTab === 'review' ? 'active' : ''}`}
              onClick={() => setActiveTab('review')}
            >
              审核操作
            </button>
          </div>

          {activeTab === 'info' && (
            <>
              {exceptions && exceptions.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div className="stat-label" style={{ marginBottom: '8px' }}>
                    异常项 ({exceptions.length})
                  </div>
                  {exceptions.map((ex) => (
                    <div className="exception-card" key={ex.id}>
                      <div className="exception-type">
                        {EXCEPTION_TYPE_MAP[ex.type] || ex.type}
                      </div>
                      <div className="exception-desc">{ex.description}</div>
                      {ex.expected_value && ex.actual_value && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                          期望: {ex.expected_value} | 实际: {ex.actual_value}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="detail-grid">
                <div>
                  <div className="detail-item">
                    <div className="detail-label">票据号</div>
                    <div className="detail-value">{invoice.invoice_number}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">开票日期</div>
                    <div className="detail-value">{invoice.invoice_date || '-'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">供应商</div>
                    <div className="detail-value">{invoice.vendor_name || '-'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">供应商税号</div>
                    <div className="detail-value">{invoice.vendor_tax_number || '-'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">税号</div>
                    <div className="detail-value">{invoice.tax_number || '-'}</div>
                  </div>
                </div>
                <div>
                  <div className="detail-item">
                    <div className="detail-label">金额</div>
                    <div className={`detail-value ${hasAmountMismatch ? 'mismatch' : ''}`}>
                      ¥{invoice.amount?.toLocaleString()}
                    </div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">税额</div>
                    <div className="detail-value">¥{invoice.tax_amount?.toLocaleString() || 0}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">价税合计</div>
                    <div className="detail-value" style={{ color: '#16a34a' }}>
                      ¥{((invoice.amount || 0) + (invoice.tax_amount || 0)).toLocaleString()}
                    </div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">审批金额</div>
                    <div className={`detail-value ${hasAmountMismatch ? 'mismatch' : ''}`}>
                      {invoice.approval_amount
                        ? `¥${invoice.approval_amount.toLocaleString()}`
                        : '-'}
                      {hasAmountMismatch && (
                        <span style={{ fontSize: '11px', marginLeft: '8px' }}>
                          ⚠️ 与票据金额不一致
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">审批人</div>
                    <div
                      className={`detail-value ${!invoice.approver_name ? 'mismatch' : ''}`}
                    >
                      {invoice.approver_name || '-'}
                    </div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">审批日期</div>
                    <div className="detail-value">{invoice.approval_date || '-'}</div>
                  </div>
                </div>
              </div>

              {invoice.approval_comments && (
                <div className="detail-item">
                  <div className="detail-label">审批意见</div>
                  <div className="detail-value">{invoice.approval_comments}</div>
                </div>
              )}

              <div className="detail-grid" style={{ marginTop: '12px' }}>
                <div className="detail-item">
                  <div className="detail-label">创建时间</div>
                  <div className="detail-value">{invoice.created_at}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">最后更新</div>
                  <div className="detail-value">{invoice.updated_at}</div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div className="timeline">
              {history && history.length > 0 ? (
                history.map((item) => (
                  <div className="timeline-item" key={item.id}>
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className="timeline-action">
                          {ACTION_MAP[item.action] || item.action}
                        </span>
                        <span className="timeline-time">{item.created_at}</span>
                      </div>
                      {item.notes && (
                        <div className="timeline-notes">{item.notes}</div>
                      )}
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                        操作人: {item.operator}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">暂无操作历史</div>
              )}
            </div>
          )}

          {activeTab === 'review' && (
            <div>
              <div className="form-group">
                <label className="form-label">审核意见</label>
                <textarea
                  className="form-input"
                  rows="4"
                  placeholder="请输入审核意见..."
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  className="btn btn-success"
                  onClick={() => onReview(invoice.id, 'approve', reviewComments)}
                >
                  ✓ 通过
                </button>
                <button
                  className="btn btn-warning"
                  onClick={() => onReview(invoice.id, 'reviewing', reviewComments)}
                >
                  标记审核中
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => onReview(invoice.id, 'reject', reviewComments)}
                >
                  ✗ 拒绝
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onEdit}>
            编辑票据
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

function InvoiceEditModal({ invoice, onClose, onChange, onSave }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">编辑票据</div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">票据号 *</label>
              <input
                className="form-input"
                value={invoice.invoice_number || ''}
                onChange={(e) => onChange({ invoice_number: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">开票日期</label>
              <input
                type="date"
                className="form-input"
                value={invoice.invoice_date || ''}
                onChange={(e) => onChange({ invoice_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">供应商</label>
              <input
                className="form-input"
                value={invoice.vendor_name || ''}
                onChange={(e) => onChange({ vendor_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">供应商税号</label>
              <input
                className="form-input"
                value={invoice.vendor_tax_number || ''}
                onChange={(e) => onChange({ vendor_tax_number: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">金额 *</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={invoice.amount || ''}
                onChange={(e) =>
                  onChange({ amount: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">税额</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={invoice.tax_amount || ''}
                onChange={(e) =>
                  onChange({ tax_amount: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">税号</label>
              <input
                className="form-input"
                value={invoice.tax_number || ''}
                onChange={(e) => onChange({ tax_number: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">审批金额</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={invoice.approval_amount || ''}
                onChange={(e) =>
                  onChange({
                    approval_amount: e.target.value
                      ? parseFloat(e.target.value)
                      : null
                  })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">审批人</label>
              <input
                className="form-input"
                value={invoice.approver_name || ''}
                onChange={(e) => onChange({ approver_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">审批日期</label>
              <input
                type="date"
                className="form-input"
                value={invoice.approval_date || ''}
                onChange={(e) => onChange({ approval_date: e.target.value })}
              />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label">审批意见</label>
            <textarea
              className="form-input"
              rows="3"
              value={invoice.approval_comments || ''}
              onChange={(e) => onChange({ approval_comments: e.target.value })}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={onSave}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export default InvoiceList;
