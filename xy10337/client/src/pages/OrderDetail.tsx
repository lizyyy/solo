import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { OrderDetail, Nanny, Settlement, Leave } from '../types';

const statusLabels: Record<string, string> = {
  pending: '待开始',
  in_service: '服务中',
  completed: '已完成',
  cancelled: '已取消',
};

const eventTypeLabels: Record<string, string> = {
  order_created: '订单创建',
  status_changed: '状态变更',
  leave_created: '请假申请',
  leave_approved: '请假批准',
  replacement_created: '安排替班',
  evaluation_created: '客户评价',
};

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [nannies, setNannies] = useState<Nanny[]>([]);
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(true);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showReplacementModal, setShowReplacementModal] = useState(false);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [availableNannies, setAvailableNannies] = useState<Nanny[]>([]);

  const [leaveForm, setLeaveForm] = useState({
    startDate: '',
    endDate: '',
    reason: '',
  });

  const [replacementForm, setReplacementForm] = useState({
    replacementNannyId: '',
  });

  const [evaluationForm, setEvaluationForm] = useState({
    rating: 5,
    comment: '',
    deductionAmount: 0,
    deductionReason: '',
  });

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  async function loadData() {
    if (!id) return;
    setLoading(true);
    try {
      const [detailRes, nanniesRes] = await Promise.all([
        api.orders.getDetail(parseInt(id)),
        api.nannies.getAll(),
      ]);
      setDetail(detailRes.data);
      setNannies(nanniesRes.data);
    } catch (error) {
      console.error('加载订单详情失败:', error);
    } finally {
      setLoading(false);
    }
  }

  const getNannyName = (id: number) => {
    const nanny = nannies.find(n => n.id === id);
    return nanny ? nanny.name : `月嫂${id}`;
  };

  async function handleCreateLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    try {
      await api.leaves.create({
        orderId: detail.order.id,
        nannyId: detail.order.nannyId,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason,
      });
      setShowLeaveModal(false);
      setLeaveForm({ startDate: '', endDate: '', reason: '' });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || '创建请假失败');
    }
  }

  async function handleApproveLeave(leave: Leave) {
    setSelectedLeave(leave);
    try {
      const res = await api.nannies.getAvailable(leave.startDate, leave.endDate);
      setAvailableNannies(res.data);
      setShowReplacementModal(true);
    } catch (error: any) {
      alert(error.response?.data?.error || '获取可用月嫂失败');
    }
  }

  async function handleCreateReplacement(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLeave || !detail) return;
    try {
      await api.leaves.approve(selectedLeave.id);
      await api.replacements.create({
        leaveId: selectedLeave.id,
        orderId: detail.order.id,
        originalNannyId: selectedLeave.nannyId,
        replacementNannyId: parseInt(replacementForm.replacementNannyId),
        startDate: selectedLeave.startDate,
        endDate: selectedLeave.endDate,
      });
      setShowReplacementModal(false);
      setSelectedLeave(null);
      setReplacementForm({ replacementNannyId: '' });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || '安排替班失败');
    }
  }

  async function handleCreateEvaluation(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    try {
      await api.evaluations.create({
        orderId: detail.order.id,
        nannyId: detail.order.nannyId,
        rating: evaluationForm.rating,
        comment: evaluationForm.comment,
        deductionAmount: evaluationForm.deductionAmount,
        deductionReason: evaluationForm.deductionReason,
      });
      setShowEvaluationModal(false);
      setEvaluationForm({ rating: 5, comment: '', deductionAmount: 0, deductionReason: '' });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || '提交评价失败');
    }
  }

  async function handleUpdateStatus(status: string) {
    if (!detail) return;
    try {
      await api.orders.updateStatus(detail.order.id, status as any);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || '更新状态失败');
    }
  }

  async function handleLoadSettlement() {
    if (!detail) return;
    try {
      const res = await api.settlement.get(detail.order.id);
      setSettlement(res.data);
      setShowSettlementModal(true);
    } catch (error: any) {
      alert(error.response?.data?.error || '加载结算失败');
    }
  }

  async function handleExportSettlement() {
    if (!detail) return;
    try {
      const res = await api.settlement.export(detail.order.id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `settlement_${detail.order.orderNo}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      alert(error.response?.data?.error || '导出失败');
    }
  }

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (!detail) {
    return <div className="empty-state">订单不存在</div>;
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>订单详情 - {detail.order.orderNo}</h1>
          <p>查看和管理订单详情、请假、评价和结算</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn" onClick={() => navigate('/orders')}>返回列表</button>
          {detail.order.status === 'pending' && (
            <button className="btn btn-primary" onClick={() => handleUpdateStatus('in_service')}>
              开始服务
            </button>
          )}
          {detail.order.status === 'in_service' && (
            <button className="btn btn-success" onClick={() => handleUpdateStatus('completed')}>
              完成服务
            </button>
          )}
        </div>
      </div>

      <div className="tabs">
        <div className={`tab ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>基本信息</div>
        <div className={`tab ${activeTab === 'leaves' ? 'active' : ''}`} onClick={() => setActiveTab('leaves')}>请假记录</div>
        <div className={`tab ${activeTab === 'replacements' ? 'active' : ''}`} onClick={() => setActiveTab('replacements')}>换人记录</div>
        <div className={`tab ${activeTab === 'evaluation' ? 'active' : ''}`} onClick={() => setActiveTab('evaluation')}>客户评价</div>
        <div className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>历史变更</div>
        <div className={`tab ${activeTab === 'settlement' ? 'active' : ''}`} onClick={() => setActiveTab('settlement')}>结算预览</div>
      </div>

      {activeTab === 'info' && (
        <div className="card">
          <h3>订单信息</h3>
          <div className="info-grid">
            <div className="info-item">
              <div className="label">订单编号</div>
              <div className="value">{detail.order.orderNo}</div>
            </div>
            <div className="info-item">
              <div className="label">订单状态</div>
              <div className="value">
                <span className={`badge badge-${detail.order.status}`}>
                  {statusLabels[detail.order.status]}
                </span>
              </div>
            </div>
            <div className="info-item">
              <div className="label">客户姓名</div>
              <div className="value">{detail.customer.name}</div>
            </div>
            <div className="info-item">
              <div className="label">客户电话</div>
              <div className="value">{detail.customer.phone}</div>
            </div>
            <div className="info-item">
              <div className="label">服务月嫂</div>
              <div className="value">{detail.nanny.name} ({detail.nanny.level})</div>
            </div>
            <div className="info-item">
              <div className="label">日薪资</div>
              <div className="value">¥{detail.nanny.dailyRate}/天</div>
            </div>
            <div className="info-item">
              <div className="label">服务开始日期</div>
              <div className="value">{detail.order.startDate}</div>
            </div>
            <div className="info-item">
              <div className="label">服务结束日期</div>
              <div className="value">{detail.order.endDate}</div>
            </div>
            <div className="info-item">
              <div className="label">总服务天数</div>
              <div className="value">{detail.order.totalDays} 天</div>
            </div>
            <div className="info-item">
              <div className="label">已收定金</div>
              <div className="value">¥{detail.order.deposit.toFixed(0)}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'leaves' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <h3 style={{ margin: 0 }}>请假记录</h3>
            {detail.order.status === 'in_service' && (
              <button className="btn btn-warning btn-sm" onClick={() => setShowLeaveModal(true)}>
                + 申请请假
              </button>
            )}
          </div>
          {detail.leaves.length === 0 ? (
            <div className="empty-state">暂无请假记录</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>开始日期</th>
                  <th>结束日期</th>
                  <th>天数</th>
                  <th>请假原因</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {detail.leaves.map(leave => (
                  <tr key={leave.id}>
                    <td>{leave.startDate}</td>
                    <td>{leave.endDate}</td>
                    <td>{leave.days} 天</td>
                    <td>{leave.reason}</td>
                    <td>
                      <span className={`badge badge-${leave.status}`}>
                        {leave.status === 'pending' ? '待审批' : leave.status === 'approved' ? '已批准' : '已拒绝'}
                      </span>
                    </td>
                    <td>
                      {leave.status === 'pending' && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleApproveLeave(leave)}
                        >
                          批准并安排替班
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'replacements' && (
        <div className="card">
          <h3>换人(替班)记录</h3>
          {detail.replacements.length === 0 ? (
            <div className="empty-state">暂无换人记录</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>原月嫂</th>
                  <th>替班月嫂</th>
                  <th>开始日期</th>
                  <th>结束日期</th>
                  <th>天数</th>
                </tr>
              </thead>
              <tbody>
                {detail.replacements.map(rep => (
                  <tr key={rep.id}>
                    <td>{getNannyName(rep.originalNannyId)}</td>
                    <td>{getNannyName(rep.replacementNannyId)}</td>
                    <td>{rep.startDate}</td>
                    <td>{rep.endDate}</td>
                    <td>{rep.days} 天</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'evaluation' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <h3 style={{ margin: 0 }}>客户评价</h3>
            {!detail.evaluation && detail.order.status === 'completed' && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowEvaluationModal(true)}>
                + 添加评价
              </button>
            )}
          </div>
          {!detail.evaluation ? (
            <div className="empty-state">暂无评价记录</div>
          ) : (
            <div className="settlement-preview">
              <div className="settlement-row">
                <span className="label">评分</span>
                <span className="value">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} style={{ color: i < detail.evaluation!.rating ? '#f39c12' : '#ddd' }}>★</span>
                  ))}
                </span>
              </div>
              <div className="settlement-row">
                <span className="label">评价内容</span>
                <span className="value">{detail.evaluation.comment}</span>
              </div>
              {detail.evaluation.deductionAmount > 0 && (
                <>
                  <div className="settlement-row">
                    <span className="label">扣款金额</span>
                    <span className="value" style={{ color: '#e74c3c' }}>-¥{detail.evaluation.deductionAmount.toFixed(0)}</span>
                  </div>
                  <div className="settlement-row">
                    <span className="label">扣款原因</span>
                    <span className="value">{detail.evaluation.deductionReason}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card">
          <h3>历史变更记录</h3>
          {detail.historyLogs.length === 0 ? (
            <div className="empty-state">暂无历史记录</div>
          ) : (
            detail.historyLogs.map(log => (
              <div key={log.id} className="history-item">
                <div className="time">{log.createdAt}</div>
                <div className="event">{eventTypeLabels[log.eventType] || log.eventType}</div>
                {log.eventData && (
                  <div className="data">{log.eventData}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'settlement' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <h3 style={{ margin: 0 }}>结算预览</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary btn-sm" onClick={handleLoadSettlement}>
                查看结算
              </button>
              <button className="btn btn-success btn-sm" onClick={handleExportSettlement}>
                导出Excel
              </button>
            </div>
          </div>
          {settlement && (
            <div className="settlement-preview">
              <div className="settlement-row">
                <span className="label">总服务天数</span>
                <span className="value">{settlement.totalDays} 天</span>
              </div>
              <div className="settlement-row">
                <span className="label">换人服务天数</span>
                <span className="value">{settlement.replacementDays} 天</span>
              </div>
              <div className="settlement-row">
                <span className="label">基础服务天数</span>
                <span className="value">{settlement.details.baseDays} 天</span>
              </div>
              <div className="settlement-row">
                <span className="label">基础服务费用</span>
                <span className="value">¥{settlement.details.baseAmount.toFixed(0)}</span>
              </div>
              <div className="settlement-row">
                <span className="label">换人服务费用</span>
                <span className="value">¥{settlement.details.replacementAmount.toFixed(0)}</span>
              </div>
              <div className="settlement-row">
                <span className="label">总金额</span>
                <span className="value">¥{settlement.totalAmount.toFixed(0)}</span>
              </div>
              <div className="settlement-row">
                <span className="label">已收定金</span>
                <span className="value">-¥{settlement.deposit.toFixed(0)}</span>
              </div>
              <div className="settlement-row">
                <span className="label">差评扣款</span>
                <span className="value" style={{ color: '#e74c3c' }}>-¥{settlement.deductionAmount.toFixed(0)}</span>
              </div>
              <div className="settlement-row total">
                <span className="label">待收尾款</span>
                <span className="value">¥{settlement.finalAmount.toFixed(0)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {showLeaveModal && (
        <div className="modal-overlay" onClick={() => setShowLeaveModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>申请请假</h3>
              <button className="modal-close" onClick={() => setShowLeaveModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateLeave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>开始日期</label>
                    <input
                      type="date"
                      value={leaveForm.startDate}
                      onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                      min={detail.order.startDate}
                      max={detail.order.endDate}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>结束日期</label>
                    <input
                      type="date"
                      value={leaveForm.endDate}
                      onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      min={leaveForm.startDate || detail.order.startDate}
                      max={detail.order.endDate}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>请假原因</label>
                  <textarea
                    rows={3}
                    value={leaveForm.reason}
                    onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowLeaveModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">提交申请</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReplacementModal && selectedLeave && (
        <div className="modal-overlay" onClick={() => setShowReplacementModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>安排替班</h3>
              <button className="modal-close" onClick={() => setShowReplacementModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateReplacement}>
              <div className="modal-body">
                <div className="info-grid" style={{ marginBottom: '20px' }}>
                  <div className="info-item">
                    <div className="label">请假日期</div>
                    <div className="value">{selectedLeave.startDate} 至 {selectedLeave.endDate}</div>
                  </div>
                  <div className="info-item">
                    <div className="label">请假天数</div>
                    <div className="value">{selectedLeave.days} 天</div>
                  </div>
                </div>
                <div className="form-group">
                  <label>选择替班月嫂</label>
                  <select
                    value={replacementForm.replacementNannyId}
                    onChange={e => setReplacementForm({ ...replacementForm, replacementNannyId: e.target.value })}
                    required
                  >
                    <option value="">请选择月嫂</option>
                    {availableNannies.map(n => (
                      <option key={n.id} value={n.id}>
                        {n.name} - {n.level} (¥{n.dailyRate}/天)
                      </option>
                    ))}
                  </select>
                  {availableNannies.length === 0 && (
                    <small style={{ color: '#e74c3c', fontSize: '12px' }}>该时段暂无可用月嫂</small>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowReplacementModal(false)}>取消</button>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={availableNannies.length === 0}
                >
                  确认安排
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEvaluationModal && (
        <div className="modal-overlay" onClick={() => setShowEvaluationModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>客户评价</h3>
              <button className="modal-close" onClick={() => setShowEvaluationModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateEvaluation}>
              <div className="modal-body">
                <div className="form-group">
                  <label>评分</label>
                  <div className="star-rating">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className={`star ${i < evaluationForm.rating ? 'active' : ''}`}
                        onClick={() => setEvaluationForm({ ...evaluationForm, rating: i + 1 })}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>评价内容</label>
                  <textarea
                    rows={3}
                    value={evaluationForm.comment}
                    onChange={e => setEvaluationForm({ ...evaluationForm, comment: e.target.value })}
                    required
                  />
                </div>
                {evaluationForm.rating <= 3 && (
                  <>
                    <div className="form-group">
                      <label>扣款金额(元)</label>
                      <input
                        type="number"
                        value={evaluationForm.deductionAmount}
                        onChange={e => setEvaluationForm({ ...evaluationForm, deductionAmount: parseFloat(e.target.value) || 0 })}
                        min={0}
                      />
                    </div>
                    <div className="form-group">
                      <label>扣款原因</label>
                      <textarea
                        rows={2}
                        value={evaluationForm.deductionReason}
                        onChange={e => setEvaluationForm({ ...evaluationForm, deductionReason: e.target.value })}
                        placeholder="请填写差评扣款的具体原因"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowEvaluationModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">提交评价</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
