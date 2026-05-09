import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Leave, Aunt, Order, ORDER_STATUS_LABELS } from '../types';

const Leaves = () => {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [aunts, setAunts] = useState<Aunt[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    auntId: '',
    startTime: '',
    endTime: '',
    reason: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [leavesRes, auntsRes, ordersRes] = await Promise.all([
      api.leaves.getAll(),
      api.aunts.getAll(),
      api.orders.getAll()
    ]);

    if (leavesRes.success) {
      setLeaves(leavesRes.data as Leave[]);
    }
    if (auntsRes.success) {
      setAunts(auntsRes.data as Aunt[]);
    }
    if (ordersRes.success) {
      setOrders(ordersRes.data as Order[]);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const response = await api.leaves.create(formData);

    if (response.success) {
      setShowModal(false);
      resetForm();
      loadData();
      
      const data = response.data as { warning?: string };
      if (data.warning) {
        alert(data.warning);
      }
    } else {
      setError(response.error || '申请请假失败');
    }
  };

  const handleApprove = async (leave: Leave) => {
    if (leave.affectedOrders.length > 0) {
      const affectedOrderNos = leave.affectedOrders
        .map(id => {
          const order = orders.find(o => o.id === id);
          return order ? order.orderNo : id;
        })
        .join('、');
      
      if (
        !confirm(
          `批准此请假将影响以下 ${leave.affectedOrders.length} 个订单：\n${affectedOrderNos}\n\n这些订单将被标记为「需重新派单」，是否继续？`
        )
      ) {
        return;
      }
    }

    const response = await api.leaves.approve(leave.id);
    if (response.success) {
      loadData();
      const data = response.data as { affectedOrders?: string[] };
      if (data.affectedOrders && data.affectedOrders.length > 0) {
        alert(
          `请假已批准，${data.affectedOrders.length} 个订单需要重新派单，请前往订单管理页面处理。`
        );
      }
    } else {
      alert(response.error || '批准失败');
    }
  };

  const handleReject = async (leaveId: string) => {
    if (!confirm('确定要拒绝此请假申请吗？')) {
      return;
    }

    const response = await api.leaves.reject(leaveId);
    if (response.success) {
      loadData();
    } else {
      alert(response.error || '拒绝失败');
    }
  };

  const resetForm = () => {
    setFormData({
      auntId: '',
      startTime: '',
      endTime: '',
      reason: ''
    });
    setError('');
  };

  const getAuntName = (auntId: string) => {
    const aunt = aunts.find(a => a.id === auntId);
    return aunt ? aunt.name : '未知阿姨';
  };

  const getStatusClass = (isApproved: boolean) => {
    return isApproved ? 'status-tag status-success' : 'status-tag status-warning';
  };

  const getStatusText = (isApproved: boolean) => {
    return isApproved ? '已批准' : '待审批';
  };

  if (loading) {
    return <div className="card">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📅 请假管理</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          + 申请请假
        </button>
      </div>

      {leaves.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">📅</div>
          <div className="empty-text">暂无请假记录</div>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>阿姨</th>
                <th>开始时间</th>
                <th>结束时间</th>
                <th>请假原因</th>
                <th>受影响订单</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map(leave => (
                <tr key={leave.id}>
                  <td>{getAuntName(leave.auntId)}</td>
                  <td>{new Date(leave.startTime).toLocaleString()}</td>
                  <td>{new Date(leave.endTime).toLocaleString()}</td>
                  <td>{leave.reason}</td>
                  <td>
                    {leave.affectedOrders.length > 0 ? (
                      <div>
                        <span className="status-tag status-danger">
                          影响 {leave.affectedOrders.length} 个订单
                        </span>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                          {leave.affectedOrders
                            .map(id => {
                              const order = orders.find(o => o.id === id);
                              return order
                                ? `${order.orderNo} (${ORDER_STATUS_LABELS[order.status]})`
                                : id;
                            })
                            .join('、')}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: '#52c41a' }}>无</span>
                    )}
                  </td>
                  <td>
                    <span className={getStatusClass(leave.isApproved)}>
                      {getStatusText(leave.isApproved)}
                    </span>
                  </td>
                  <td>
                    {!leave.isApproved && (
                      <div className="flex gap-2">
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleApprove(leave)}
                        >
                          批准
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleReject(leave.id)}
                        >
                          拒绝
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 申请请假模态框 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">申请请假</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}

                {aunts.length === 0 && (
                  <div className="alert alert-warning">
                    暂无阿姨数据，请先在「阿姨管理」页面添加阿姨
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">阿姨 *</label>
                  <select
                    className="form-select"
                    value={formData.auntId}
                    onChange={e => setFormData({ ...formData, auntId: e.target.value })}
                    required
                  >
                    <option value="">请选择阿姨</option>
                    {aunts.map(aunt => (
                      <option key={aunt.id} value={aunt.id}>
                        {aunt.name} ({aunt.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">开始时间 *</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={formData.startTime}
                    onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">结束时间 *</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={formData.endTime}
                    onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">请假原因 *</label>
                  <textarea
                    className="form-textarea"
                    placeholder="请输入请假原因"
                    value={formData.reason}
                    onChange={e => setFormData({ ...formData, reason: e.target.value })}
                    required
                  />
                </div>

                <div className="alert alert-info">
                  💡 系统会自动检测请假时间段内是否有已派单的订单，
                  如果有，批准请假时会自动将这些订单标记为「需重新派单」。
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-default"
                  onClick={() => setShowModal(false)}
                >
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  提交申请
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaves;
