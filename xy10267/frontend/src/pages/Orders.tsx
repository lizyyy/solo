import { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  Order,
  Customer,
  Skill,
  Taboo,
  SKILL_LABELS,
  TABOO_LABELS,
  ORDER_STATUS_LABELS,
  DispatchCandidate
} from '../types';

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [candidates, setCandidates] = useState<DispatchCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    customerId: '',
    skillsRequired: [] as Skill[],
    startTime: '',
    endTime: '',
    customerTaboos: [] as Taboo[],
    specialRequirements: '',
    source: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [ordersRes, customersRes] = await Promise.all([
      api.orders.getAll(),
      api.customers.getAll()
    ]);

    if (ordersRes.success) {
      setOrders(ordersRes.data as Order[]);
    }
    if (customersRes.success) {
      setCustomers(customersRes.data as Customer[]);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const response = await api.orders.create(formData);

    if (response.success) {
      setShowModal(false);
      resetForm();
      loadData();
    } else {
      setError(response.error || '创建订单失败');
    }
  };

  const handleDispatch = async (order: Order) => {
    setSelectedOrder(order);
    setError('');
    setSelectedCandidate(null);
    
    const response = await api.assignments.getCandidates(order.id);
    if (response.success) {
      const data = response.data as { candidates: DispatchCandidate[] };
      setCandidates(data.candidates || []);
      setShowDispatchModal(true);
    } else {
      setError(response.error || '获取候选阿姨失败');
    }
  };

  const confirmDispatch = async () => {
    if (!selectedOrder || !selectedCandidate) {
      setError('请选择要派单的阿姨');
      return;
    }

    const response = await api.assignments.create({
      orderId: selectedOrder.id,
      auntId: selectedCandidate
    });

    if (response.success) {
      setShowDispatchModal(false);
      loadData();
    } else {
      setError(response.error || '派单失败');
    }
  };

  const handleDelete = async (order: Order) => {
    if (!confirm(`确定要删除订单 ${order.orderNo} 吗？`)) {
      return;
    }

    const response = await api.orders.delete(order.id);
    if (response.success) {
      loadData();
    } else {
      alert(response.error || '删除失败');
    }
  };

  const resetForm = () => {
    setFormData({
      customerId: '',
      skillsRequired: [],
      startTime: '',
      endTime: '',
      customerTaboos: [],
      specialRequirements: '',
      source: ''
    });
    setError('');
  };

  const toggleSkill = (skill: Skill) => {
    setFormData(prev => ({
      ...prev,
      skillsRequired: prev.skillsRequired.includes(skill)
        ? prev.skillsRequired.filter(s => s !== skill)
        : [...prev.skillsRequired, skill]
    }));
  };

  const toggleTaboo = (taboo: Taboo) => {
    setFormData(prev => ({
      ...prev,
      customerTaboos: prev.customerTaboos.includes(taboo)
        ? prev.customerTaboos.filter(t => t !== taboo)
        : [...prev.customerTaboos, taboo]
    }));
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer ? customer.name : '未知客户';
  };

  const getStatusClass = (status: string) => {
    const classMap: Record<string, string> = {
      pending_dispatch: 'status-tag status-warning',
      dispatched: 'status-tag status-info',
      in_progress: 'status-tag status-processing',
      completed: 'status-tag status-success',
      cancelled: 'status-tag',
      reassigned: 'status-tag status-danger'
    };
    return classMap[status] || 'status-tag';
  };

  const canDispatch = (status: string) => {
    return ['pending_dispatch', 'reassigned'].includes(status);
  };

  if (loading) {
    return <div className="card">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📦 订单管理</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          + 创建订单
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">📦</div>
          <div className="empty-text">暂无订单数据，点击上方按钮创建</div>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>订单号</th>
                <th>客户</th>
                <th>所需技能</th>
                <th>禁忌</th>
                <th>服务时间</th>
                <th>来源</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td>{order.orderNo}</td>
                  <td>{getCustomerName(order.customerId)}</td>
                  <td>
                    {order.skillsRequired.map(skill => (
                      <span key={skill} className="tag tag-skill">
                        {SKILL_LABELS[skill]}
                      </span>
                    ))}
                  </td>
                  <td>
                    {order.customerTaboos.length > 0 ? (
                      order.customerTaboos.map(taboo => (
                        <span key={taboo} className="tag tag-taboo">
                          {TABOO_LABELS[taboo]}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: '#999' }}>无</span>
                    )}
                  </td>
                  <td>
                    <div>{new Date(order.startTime).toLocaleString()}</div>
                    <div style={{ color: '#999', fontSize: '12px' }}>
                      {order.durationHours} 小时
                    </div>
                  </td>
                  <td>{order.source || '-'}</td>
                  <td>
                    <span className={getStatusClass(order.status)}>
                      {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {canDispatch(order.status) && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleDispatch(order)}
                        >
                          派单
                        </button>
                      )}
                      {order.status === 'pending_dispatch' && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(order)}
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 创建订单模态框 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">创建订单</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}

                {customers.length === 0 && (
                  <div className="alert alert-warning">
                    暂无客户数据，请先在「客户管理」页面添加客户
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">客户 *</label>
                  <select
                    className="form-select"
                    value={formData.customerId}
                    onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                    required
                  >
                    <option value="">请选择客户</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} ({customer.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">订单来源 *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="如：线上平台、线下门店、老客户转介绍等"
                    value={formData.source}
                    onChange={e => setFormData({ ...formData, source: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">所需技能 *（至少选择一项）</label>
                  <div className="checkbox-group">
                    {Object.entries(SKILL_LABELS).map(([key, label]) => (
                      <label key={key} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={formData.skillsRequired.includes(key as Skill)}
                          onChange={() => toggleSkill(key as Skill)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">服务禁忌（可选）</label>
                  <div className="checkbox-group">
                    {Object.entries(TABOO_LABELS).map(([key, label]) => (
                      <label key={key} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={formData.customerTaboos.includes(key as Taboo)}
                          onChange={() => toggleTaboo(key as Taboo)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
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
                  <label className="form-label">特殊要求</label>
                  <textarea
                    className="form-textarea"
                    value={formData.specialRequirements}
                    onChange={e =>
                      setFormData({ ...formData, specialRequirements: e.target.value })
                    }
                  />
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
                  创建订单
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 派单模态框 */}
      {showDispatchModal && selectedOrder && (
        <div className="modal-overlay" onClick={() => setShowDispatchModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">智能派单 - {selectedOrder.orderNo}</h3>
              <button className="modal-close" onClick={() => setShowDispatchModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}

              <div className="card" style={{ marginBottom: '16px' }}>
                <div>
                  <strong>订单信息：</strong>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <span style={{ marginRight: '16px' }}>
                    客户：{getCustomerName(selectedOrder.customerId)}
                  </span>
                  <span>
                    时间：{new Date(selectedOrder.startTime).toLocaleString()}
                  </span>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <span style={{ marginRight: '8px' }}>所需技能：</span>
                  {selectedOrder.skillsRequired.map(skill => (
                    <span key={skill} className="tag tag-skill">
                      {SKILL_LABELS[skill]}
                    </span>
                  ))}
                </div>
                {selectedOrder.customerTaboos.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <span style={{ marginRight: '8px' }}>禁忌：</span>
                    {selectedOrder.customerTaboos.map(taboo => (
                      <span key={taboo} className="tag tag-taboo">
                        {TABOO_LABELS[taboo]}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <h4 style={{ marginBottom: '12px' }}>推荐阿姨（按匹配度排序）：</h4>

              {candidates.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">👩</div>
                  <div className="empty-text">暂无可用的阿姨</div>
                </div>
              ) : (
                candidates.map((candidate, index) => (
                  <div
                    key={candidate.aunt.id}
                    className={`candidate-card ${selectedCandidate === candidate.aunt.id ? 'selected' : ''}`}
                    onClick={() => setSelectedCandidate(candidate.aunt.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="candidate-header">
                      <div>
                        <span className="candidate-name">
                          {index + 1}. {candidate.aunt.name}
                        </span>
                        <span style={{ marginLeft: '12px', color: '#666' }}>
                          ⭐ {candidate.aunt.rating} | {candidate.aunt.experienceYears}年经验
                        </span>
                      </div>
                      <div className="candidate-score">
                        {candidate.score > 0 ? `${candidate.score}分` : '不匹配'}
                      </div>
                    </div>
                    
                    <div className="candidate-meta">
                      <span>📍 {candidate.distanceKm.toFixed(2)} km</span>
                      <span>
                        匹配技能：
                        {candidate.matchedSkills.map(s => (
                          <span key={s} className="tag tag-skill" style={{ marginLeft: '4px' }}>
                            {SKILL_LABELS[s]}
                          </span>
                        ))}
                      </span>
                    </div>

                    {candidate.tabooConflicts.length > 0 && (
                      <div style={{ color: '#ff4d4f', fontSize: '13px' }}>
                        ⚠️ 禁忌冲突：
                        {candidate.tabooConflicts.map(t => TABOO_LABELS[t]).join('、')}
                      </div>
                    )}

                    <div className="candidate-reasons">
                      {candidate.reasons.map((reason, i) => (
                        <div
                          key={i}
                          className={`reason-item ${
                            reason.includes('完全') || reason.includes('优秀') || reason.includes('丰富') || reason.includes('近') || reason.includes('适中')
                              ? 'positive'
                              : reason.includes('冲突') || reason.includes('远') || reason.includes('不可用') || reason.includes('请假')
                              ? 'negative'
                              : ''
                          }`}
                        >
                          {reason}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-default"
                onClick={() => setShowDispatchModal(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmDispatch}
                disabled={!selectedCandidate}
              >
                确认派单
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
