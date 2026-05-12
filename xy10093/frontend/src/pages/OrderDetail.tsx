import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { orderApi, anomalyApi } from '../services/api';
import { formatDate, today } from '../utils';
import { STATUS_LABELS, STATUS_COLORS, QC_RESULT_LABELS, SEVERITY_LABELS } from '../types';
import type { ReworkOrder, ReworkRecord, OrderHistory, Anomaly, SeverityLevel } from '../types';
import { Toast, showToast } from '../components/Toast';
import { ReworkRecordForm } from '../components/ReworkRecordForm';
import { QCCheckForm } from '../components/QCCheckForm';
import { Modal } from '../components/Modal';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const orderId = parseInt(id || '0', 10);
  
  const [order, setOrder] = useState<ReworkOrder | null>(null);
  const [records, setRecords] = useState<ReworkRecord[]>([]);
  const [history, setHistory] = useState<OrderHistory[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'records' | 'anomalies' | 'history'>('records');

  const [showReworkForm, setShowReworkForm] = useState(false);
  const [showQCForm, setShowQCForm] = useState<number | null>(null);
  const [showAnomalyForm, setShowAnomalyForm] = useState(false);
  const [nextReworkCount, setNextReworkCount] = useState(1);

  const [anomalyForm, setAnomalyForm] = useState<{
    anomaly_type: string;
    description: string;
    severity: SeverityLevel;
    reported_by: string;
  }>({
    anomaly_type: 'process',
    description: '',
    severity: 'medium',
    reported_by: ''
  });

  const fetchData = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const data = await orderApi.detail(orderId);
      setOrder(data.order);
      setRecords(data.rework_records);
      setHistory(data.history);
      setAnomalies(data.anomalies);
      setNextReworkCount((data.rework_records.length || 0) + 1);
    } catch (e: any) {
      showToast(e.message || '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddRework = async (formData: any) => {
    try {
      await orderApi.addRecord(orderId, formData);
      setShowReworkForm(false);
      showToast('返工记录已保存', 'success');
      fetchData();
    } catch (e: any) {
      showToast(e.message || '保存失败', 'error');
    }
  };

  const handleAddQC = async (recordId: number, formData: any) => {
    try {
      await orderApi.addQualityCheck(recordId, formData);
      setShowQCForm(null);
      showToast('质检记录已保存', 'success');
      fetchData();
    } catch (e: any) {
      showToast(e.message || '保存失败', 'error');
    }
  };

  const handleAddAnomaly = async () => {
    if (!anomalyForm.description) {
      alert('请填写异常描述');
      return;
    }
    try {
      await anomalyApi.create({ order_id: orderId, ...anomalyForm });
      setShowAnomalyForm(false);
      setAnomalyForm({ anomaly_type: 'process', description: '', severity: 'medium', reported_by: '' });
      showToast('异常已上报', 'success');
      fetchData();
    } catch (e: any) {
      showToast(e.message || '保存失败', 'error');
    }
  };

  const handleResolveAnomaly = async (anomaly: Anomaly) => {
    const resolution = prompt('请输入解决措施：');
    if (resolution === null) return;
    try {
      await anomalyApi.resolve(anomaly.id, { resolution });
      showToast('异常已解决', 'success');
      fetchData();
    } catch (e: any) {
      showToast(e.message || '操作失败', 'error');
    }
  };

  const handleCloseOrder = async () => {
    const note = prompt('请输入关闭备注：', '手动闭环工单');
    if (note === null) return;
    try {
      await orderApi.close(orderId, { close_note: note });
      showToast('工单已闭环', 'success');
      fetchData();
    } catch (e: any) {
      showToast(e.message || '关闭失败', 'error');
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: 80 }}>
        加载中...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container">
        <div className="alert alert-danger">工单不存在或已被删除</div>
        <Link to="/">← 返回列表</Link>
      </div>
    );
  }

  const isClosed = order.current_status === 'closed';

  return (
    <div className="container">
      <Toast />

      <div className="breadcrumb">
        <Link to="/">返工单列表</Link>
        <span>›</span>
        <span className="current">{order.order_no}</span>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{order.order_no}</h1>
            <p className="page-subtitle">{order.product_name}</p>
          </div>
          <div className="button-group">
            {!isClosed && (
              <>
                <button className="btn btn-primary" onClick={() => setShowReworkForm(true)}>
                  + 新增返工记录
                </button>
                <button className="btn btn-warning" onClick={() => setShowAnomalyForm(true)}>
                  ⚠️ 上报异常
                </button>
                <button className="btn btn-success" onClick={handleCloseOrder}>
                  ✓ 闭环工单
                </button>
              </>
            )}
            <button className="btn btn-secondary" onClick={() => navigate('/')}>返回</button>
          </div>
        </div>

        <div className="info-grid">
          <div className="info-item">
            <div className="info-label">返工单号</div>
            <div className="info-value">{order.order_no}</div>
          </div>
          <div className="info-item">
            <div className="info-label">产品名称</div>
            <div className="info-value">{order.product_name}</div>
          </div>
          <div className="info-item">
            <div className="info-label">批次号</div>
            <div className="info-value">{order.batch_no || '-'}</div>
          </div>
          <div className="info-item">
            <div className="info-label">批量</div>
            <div className="info-value">{order.qty || 0}</div>
          </div>
          <div className="info-item">
            <div className="info-label">不良数</div>
            <div className="info-value">{order.defect_qty || 0}</div>
          </div>
          <div className="info-item">
            <div className="info-label">返工次数</div>
            <div className="info-value">{records.length} 次</div>
          </div>
          <div className="info-item">
            <div className="info-label">状态</div>
            <div className="info-value">
              <span className={`status-badge status-${STATUS_COLORS[order.current_status]}`}>
                {STATUS_LABELS[order.current_status]}
              </span>
            </div>
          </div>
          <div className="info-item">
            <div className="info-label">创建时间</div>
            <div className="info-value">{formatDate(order.created_at, true)}</div>
          </div>
        </div>
      </div>

      {isClosed && (
        <div className="alert alert-success">
          <span>✅</span>
          <div><strong>工单已闭环</strong> - 所有质检通过，返工流程完成。数据已完整归档，可在下方历史记录中追溯。</div>
        </div>
      )}

      {records.length >= 2 && (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <div><strong>多次返工预警</strong> - 该工单已返工 {records.length} 次，建议排查系统性问题。已自动关联异常提醒。</div>
        </div>
      )}

      <div className="card">
        <div className="tabs">
          <div
            className={`tab ${activeTab === 'records' ? 'active' : ''}`}
            onClick={() => setActiveTab('records')}
          >
            返工记录与质检 ({records.length})
          </div>
          <div
            className={`tab ${activeTab === 'anomalies' ? 'active' : ''}`}
            onClick={() => setActiveTab('anomalies')}
          >
            异常处理 ({anomalies.filter(a => a.status === 'open').length} 待处理)
          </div>
          <div
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            操作历史 ({history.length})
          </div>
        </div>

        {activeTab === 'records' && (
          <div>
            {records.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <div className="empty-text">暂无返工记录</div>
                {!isClosed && (
                  <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowReworkForm(true)}>
                    + 新增第一次返工记录
                  </button>
                )}
              </div>
            ) : (
              records.map((record, idx) => {
                const latestQC = record.quality_checks[record.quality_checks.length - 1];
                const needsQC = !isClosed && (!latestQC || latestQC.check_result === 'rework_required') && idx === records.length - 1;
                
                return (
                  <div key={record.id} className="rework-card">
                    <div className="rework-header">
                      <div className="rework-number">
                        第 {record.rework_count} 次返工
                        {latestQC && (
                          <span className={`status-badge status-${latestQC.check_result === 'pass' ? 'success' : latestQC.check_result === 'rework_required' ? 'danger' : 'info'}`} style={{ marginLeft: 8 }}>
                            质检: {QC_RESULT_LABELS[latestQC.check_result] || '待检'}
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#999', fontSize: 13 }}>
                        责任人: {record.responsible_person || '-'} | 工序: {record.responsible_process || '-'}
                      </div>
                    </div>

                    <div className="evidence-list">
                      <div className="evidence-item">
                        <span className="evidence-label">不良描述</span>
                        <span className="evidence-value">{record.defect_description || '-'}</span>
                      </div>
                      <div className="evidence-item">
                        <span className="evidence-label">原因类别</span>
                        <span className="evidence-value">{record.cause_category || '-'}</span>
                      </div>
                      <div className="evidence-item">
                        <span className="evidence-label">根本原因</span>
                        <span className="evidence-value">{record.root_cause || '-'}</span>
                      </div>
                      <div className="evidence-item">
                        <span className="evidence-label">纠正措施</span>
                        <span className="evidence-value">{record.correction_action || '-'}</span>
                      </div>
                      <div className="evidence-item">
                        <span className="evidence-label">纠正日期</span>
                        <span className="evidence-value">{formatDate(record.correction_date)}</span>
                      </div>
                    </div>

                    {record.quality_checks.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>📋 质检记录</div>
                        {record.quality_checks.map((qc, qi) => (
                          <div key={qc.id} className="evidence-list" style={{ marginBottom: qi < record.quality_checks.length - 1 ? 8 : 0 }}>
                            <div className="evidence-item">
                              <span className="evidence-label">检验员</span>
                              <span className="evidence-value">{qc.inspector || '-'}</span>
                            </div>
                            <div className="evidence-item">
                              <span className="evidence-label">检验日期</span>
                              <span className="evidence-value">{formatDate(qc.check_date)}</span>
                            </div>
                            <div className="evidence-item">
                              <span className="evidence-label">结果</span>
                              <span className="evidence-value">
                                <span className={`status-badge status-${qc.check_result === 'pass' ? 'success' : qc.check_result === 'rework_required' ? 'danger' : 'info'}`}>
                                  {QC_RESULT_LABELS[qc.check_result] || '待检'}
                                </span>
                              </span>
                            </div>
                            {qc.defect_items && (
                              <div className="evidence-item">
                                <span className="evidence-label">不良明细</span>
                                <span className="evidence-value">{qc.defect_items}</span>
                              </div>
                            )}
                            {qc.final_conclusion && (
                              <div className="evidence-item">
                                <span className="evidence-label">最终结论</span>
                                <span className="evidence-value">{qc.final_conclusion}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {needsQC && (
                      <div className="button-group" style={{ marginTop: 16 }}>
                        <button className="btn btn-primary" onClick={() => setShowQCForm(record.id)}>
                          📝 提交质量检验
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'anomalies' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 500 }}>
                {anomalies.length === 0 ? '暂无异常记录' : `共 ${anomalies.length} 条异常`}
              </div>
              {!isClosed && (
                <button className="btn btn-warning btn-sm" onClick={() => setShowAnomalyForm(true)}>
                  + 上报异常
                </button>
              )}
            </div>
            {anomalies.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <div className="empty-text">无异常记录</div>
              </div>
            ) : (
              anomalies.map(a => (
                <div key={a.id} className="rework-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 8 }}>
                        <span className={`status-badge ${a.status === 'open' ? 'status-danger' : 'status-success'}`}>
                          {a.status === 'open' ? '待处理' : '已解决'}
                        </span>
                        <span className={`status-badge status-${a.severity === 'high' ? 'danger' : a.severity === 'medium' ? 'warning' : 'info'}`} style={{ marginLeft: 6 }}>
                          严重度: {SEVERITY_LABELS[a.severity]}
                        </span>
                      </div>
                      <div style={{ fontWeight: 500, marginBottom: 4 }}>{a.anomaly_type === 'process' ? '流程异常' : a.anomaly_type === 'quality' ? '质量异常' : '其他异常'}</div>
                      <div style={{ color: '#666' }}>{a.description}</div>
                      <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
                        上报人: {a.reported_by || '-'} | 上报时间: {formatDate(a.reported_date, true)}
                      </div>
                      {a.resolution && (
                        <div style={{ marginTop: 8, padding: 8, background: '#f6ffed', borderRadius: 4 }}>
                          <strong>解决措施:</strong> {a.resolution}
                          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>解决时间: {formatDate(a.resolved_date!, true)}</div>
                        </div>
                      )}
                    </div>
                    {a.status === 'open' && !isClosed && (
                      <button className="btn btn-success btn-sm" onClick={() => handleResolveAnomaly(a)}>
                        标记解决
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            {history.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📜</div>
                <div className="empty-text">暂无操作历史</div>
              </div>
            ) : (
              <div className="timeline">
                {history.map(h => (
                  <div key={h.id} className="timeline-item">
                    <div className="timeline-action">
                      {h.action === 'create' && '📝 创建工单'}
                      {h.action === 'update' && '✏️ 更新信息'}
                      {h.action === 'add_record' && '🔧 新增返工记录'}
                      {h.action === 'qc_check' && '🔍 质量检验'}
                      {h.action === 'close' && '✅ 工单闭环'}
                      {!['create', 'update', 'add_record', 'qc_check', 'close'].includes(h.action) && `📌 ${h.action}`}
                    </div>
                    <div className="timeline-details">{h.details}</div>
                    <div className="timeline-meta">操作人: {h.operator} | {formatDate(h.created_at, true)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showReworkForm && (
        <ReworkRecordForm
          reworkCount={nextReworkCount}
          onSubmit={handleAddRework}
          onClose={() => setShowReworkForm(false)}
        />
      )}

      {showQCForm !== null && (
        <QCCheckForm
          recordId={showQCForm}
          onSubmit={(data) => handleAddQC(showQCForm, data)}
          onClose={() => setShowQCForm(null)}
        />
      )}

      {showAnomalyForm && (
        <Modal
          title="上报异常"
          onClose={() => setShowAnomalyForm(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowAnomalyForm(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleAddAnomaly}>提交</button>
            </>
          }
        >
          <div className="form-grid">
            <div className="form-group">
              <label>异常类型</label>
              <select
                className="form-control"
                value={anomalyForm.anomaly_type}
                onChange={e => setAnomalyForm({ ...anomalyForm, anomaly_type: e.target.value })}
              >
                <option value="process">流程异常</option>
                <option value="quality">质量异常</option>
                <option value="material">物料异常</option>
                <option value="equipment">设备异常</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div className="form-group">
              <label>严重度</label>
              <select
                className="form-control"
                value={anomalyForm.severity}
                onChange={e => setAnomalyForm({ ...anomalyForm, severity: e.target.value as any })}
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>异常描述 *</label>
              <textarea
                className="form-control"
                value={anomalyForm.description}
                onChange={e => setAnomalyForm({ ...anomalyForm, description: e.target.value })}
                placeholder="详细描述异常情况"
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>上报人</label>
              <input
                className="form-control"
                value={anomalyForm.reported_by}
                onChange={e => setAnomalyForm({ ...anomalyForm, reported_by: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
