import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  AlertTriangle, 
  Lock, 
  Wrench, 
  PackageCheck,
  Plus,
  Check,
  X,
  Unlock
} from 'lucide-react';
import api, { getStatusBadgeClass, getSeverityBadgeClass } from '../utils/api';

const BatchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [confirmStep, setConfirmStep] = useState(0);
  const [selectedQuarantine, setSelectedQuarantine] = useState(null);

  const [defectForm, setDefectForm] = useState({
    defect_type: '',
    severity: '轻微',
    quantity: '',
    description: '',
    detected_by: ''
  });

  const [quarantineForm, setQuarantineForm] = useState({
    quantity: '',
    reason: '',
    quarantined_by: ''
  });

  const [reworkForm, setReworkForm] = useState({
    defect_id: '',
    quantity: '',
    rework_method: '',
    reworked_by: ''
  });

  const [decisionForm, setDecisionForm] = useState({
    decision: '',
    quantity: '',
    reason: '',
    approval_basis: '',
    approved_by: ''
  });

  const [recheckForm, setRecheckForm] = useState({
    rework_id: '',
    recheck_result: '',
    rechecked_by: ''
  });

  const [releaseConfirmCode, setReleaseConfirmCode] = useState('');

  useEffect(() => {
    loadBatch();
  }, [id]);

  const loadBatch = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/batches/${id}`);
      setBatch(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || '加载批次详情失败');
    } finally {
      setLoading(false);
    }
  };

  const submitDefect = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/defects', {
        batch_id: id,
        ...defectForm,
        quantity: Number(defectForm.quantity)
      });
      setModalType(null);
      setDefectForm({
        defect_type: '',
        severity: '轻微',
        quantity: '',
        description: '',
        detected_by: ''
      });
      loadBatch();
    } catch (err) {
      alert(`${err.response?.data?.error || '登记失败'}\n${err.response?.data?.details || ''}`);
    }
  };

  const submitQuarantine = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/defects/quarantine', {
        batch_id: id,
        ...quarantineForm,
        quantity: Number(quarantineForm.quantity)
      });
      setModalType(null);
      setQuarantineForm({
        quantity: '',
        reason: '',
        quarantined_by: ''
      });
      loadBatch();
    } catch (err) {
      alert(`${err.response?.data?.error || '隔离失败'}\n${err.response?.data?.details || ''}`);
    }
  };

  const submitRework = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/rework', {
        batch_id: id,
        ...reworkForm,
        defect_id: reworkForm.defect_id ? Number(reworkForm.defect_id) : null,
        quantity: Number(reworkForm.quantity)
      });
      setModalType(null);
      setReworkForm({
        defect_id: '',
        quantity: '',
        rework_method: '',
        reworked_by: ''
      });
      loadBatch();
    } catch (err) {
      alert(`${err.response?.data?.error || '返工创建失败'}\n${err.response?.data?.details || ''}`);
    }
  };

  const submitDecision = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/rework/decision', {
        batch_id: id,
        ...decisionForm,
        quantity: Number(decisionForm.quantity)
      });
      setModalType(null);
      setDecisionForm({
        decision: '',
        quantity: '',
        reason: '',
        approval_basis: '',
        approved_by: ''
      });
      loadBatch();
    } catch (err) {
      alert(`${err.response?.data?.error || '复判失败'}\n${err.response?.data?.details || ''}`);
    }
  };

  const submitRecheck = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/api/rework/${recheckForm.rework_id}/recheck`, {
        recheck_result: recheckForm.recheck_result,
        rechecked_by: recheckForm.rechecked_by
      });
      setModalType(null);
      setRecheckForm({
        rework_id: '',
        recheck_result: '',
        rechecked_by: ''
      });
      loadBatch();
    } catch (err) {
      alert(`${err.response?.data?.error || '复检失败'}\n${err.response?.data?.details || ''}`);
    }
  };

  const startReleaseQuarantine = (quarantineId) => {
    setSelectedQuarantine(quarantineId);
    setConfirmStep(1);
    setModalType('release-quarantine');
  };

  const confirmRelease = async () => {
    if (confirmStep === 1) {
      setConfirmStep(2);
      return;
    }
    if (confirmStep === 2 && !releaseConfirmCode) {
      alert('请输入确认码释放');
      return;
    }
    try {
      await api.post('/api/defects/release-quarantine', {
        quarantine_id: selectedQuarantine,
        released_by: '当前用户',
        confirm_code: releaseConfirmCode
      });
      setModalType(null);
      setConfirmStep(0);
      setReleaseConfirmCode('');
      loadBatch();
    } catch (err) {
      alert(`${err.response?.data?.error || '释放失败'}\n${err.response?.data?.details || ''}`);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem' }}>正在加载批次详情...</p>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div>
        <div className="alert alert-danger">{error}</div>
        <Link to="/batches" className="btn btn-secondary">
          <ArrowLeft size={16} /> 返回批次列表
        </Link>
      </div>
    );
  }

  const totalDefectQty = batch.defects.reduce((sum, d) => sum + d.quantity, 0);
  const totalQuarantined = batch.quarantine
    .filter(q => q.status === '隔离中')
    .reduce((sum, q) => sum + q.quantity, 0);

  const tabs = [
    { key: 'overview', label: '概览' },
    { key: 'defects', label: `缺陷 (${batch.defects.length})` },
    { key: 'quarantine', label: `隔离 (${totalQuarantined})` },
    { key: 'rework', label: `返工 (${batch.rework_records.length})` },
    { key: 'decisions', label: `复判 (${batch.reinspection_decisions.length})` }
  ];

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/batches')}>
            <ArrowLeft size={14} /> 返回
          </button>
          <div>
            <h2>{batch.batch_no}</h2>
            <p style={{ color: '#6b7280' }}>{batch.product_name} {batch.model && `· ${batch.model}`}</p>
          </div>
        </div>
        <span className={`status-badge ${getStatusBadgeClass(batch.status)}`}>
          {batch.status}
        </span>
      </div>

      <div className="batch-detail-header">
        <div className="batch-info">
          <label>批次数量</label>
          <span className="stat-value">{batch.quantity.toLocaleString()}</span>
        </div>
        <div className="batch-info">
          <label>缺陷数量</label>
          <span className="stat-value" style={{ color: totalDefectQty > 0 ? '#dc2626' : '#16a34a' }}>
            {totalDefectQty}
          </span>
        </div>
        <div className="batch-info">
          <label>隔离数量</label>
          <span className="stat-value" style={{ color: totalQuarantined > 0 ? '#dc2626' : '#16a34a' }}>
            {totalQuarantined}
          </span>
        </div>
        <div className="batch-info">
          <label>生产线 / 质检员</label>
          <span className="stat-value" style={{ fontSize: '1rem' }}>
            {batch.production_line || '-'} / {batch.inspector || '-'}
          </span>
        </div>
      </div>

      <div className="tabs">
        {tabs.map(tab => (
          <button 
            key={tab.key} 
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div>
          <div className="card">
            <h3 className="card-title">基本信息</h3>
            <div className="form-row">
              <div className="batch-info">
                <label>生产日期</label>
                <span>{batch.production_date || '-'}</span>
              </div>
              <div className="batch-info">
                <label>创建时间</label>
                <span>{batch.created_at}</span>
              </div>
              <div className="batch-info">
                <label>更新时间</label>
                <span>{batch.updated_at}</span>
              </div>
              <div className="batch-info">
                <label>当前状态</label>
                <span className={`status-badge ${getStatusBadgeClass(batch.status)}`}>
                  {batch.status}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">快速操作</h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => setModalType('defect')}>
                <AlertTriangle size={14} /> 登记缺陷
              </button>
              <button className="btn btn-warning" onClick={() => setModalType('quarantine')} style={{ background: '#f59e0b', color: 'white' }}>
                <Lock size={14} /> 隔离库存
              </button>
              <button className="btn btn-primary" onClick={() => setModalType('rework')}>
                <Wrench size={14} /> 创建返工
              </button>
              <button className="btn btn-success" onClick={() => setModalType('decision')}>
                <PackageCheck size={14} /> 复判决定
              </button>
            </div>
          </div>

          {batch.defects.length > 0 && (
            <div className="card">
              <h3 className="card-title">近期缺陷</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>缺陷类型</th>
                      <th>严重程度</th>
                      <th>数量</th>
                      <th>检测人</th>
                      <th>检测时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.defects.slice(0, 5).map(d => (
                      <tr key={d.id}>
                        <td>{d.defect_type}</td>
                        <td>
                          <span className={`status-badge ${getSeverityBadgeClass(d.severity)}`}>
                            {d.severity}
                          </span>
                        </td>
                        <td>{d.quantity}</td>
                        <td>{d.detected_by}</td>
                        <td>{d.detected_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'defects' && (
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ marginBottom: 0 }}>缺陷记录</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setModalType('defect')}>
                <Plus size={14} /> 添加
              </button>
            </div>
            {batch.defects.length > 0 ? (
              <div className="table-container" style={{ marginTop: '1rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>缺陷类型</th>
                      <th>严重程度</th>
                      <th>数量</th>
                      <th>描述</th>
                      <th>检测人</th>
                      <th>检测时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.defects.map(d => (
                      <tr key={d.id}>
                        <td>{d.defect_type}</td>
                        <td>
                          <span className={`status-badge ${getSeverityBadgeClass(d.severity)}`}>
                            {d.severity}
                          </span>
                        </td>
                        <td>{d.quantity}</td>
                        <td>{d.description || '-'}</td>
                        <td>{d.detected_by}</td>
                        <td>{d.detected_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">暂无缺陷记录</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'quarantine' && (
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ marginBottom: 0 }}>隔离库存</h3>
              <button className="btn btn-warning btn-sm" onClick={() => setModalType('quarantine')} style={{ background: '#f59e0b', color: 'white' }}>
                <Lock size={14} /> 新增隔离
              </button>
            </div>
            {batch.quarantine.length > 0 ? (
              <div className="table-container" style={{ marginTop: '1rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>数量</th>
                      <th>原因</th>
                      <th>隔离人</th>
                      <th>隔离时间</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.quarantine.map(q => (
                      <tr key={q.id}>
                        <td>{q.quantity}</td>
                        <td>{q.reason || '-'}</td>
                        <td>{q.quarantined_by}</td>
                        <td>{q.created_at}</td>
                        <td>
                          <span className={`status-badge ${q.status === '隔离中' ? 'status-danger' : 'status-success'}`}>
                            {q.status}
                          </span>
                        </td>
                        <td>
                          {q.status === '隔离中' && (
                            <button 
                              className="btn btn-secondary btn-sm"
                              onClick={() => startReleaseQuarantine(q.id)}
                            >
                              <Unlock size={12} /> 释放
                            </button>
                          )}
                          {q.status === '已释放' && (
                            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                              {q.released_by} @ {q.released_at}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">暂无隔离记录</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'rework' && (
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ marginBottom: 0 }}>返工记录</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setModalType('rework')}>
                <Plus size={14} /> 新建返工
              </button>
            </div>
            {batch.rework_records.length > 0 ? (
              <div className="table-container" style={{ marginTop: '1rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>返工方法</th>
                      <th>数量</th>
                      <th>返工人</th>
                      <th>开始时间</th>
                      <th>复检结果</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.rework_records.map(r => (
                      <tr key={r.id}>
                        <td>{r.rework_method}</td>
                        <td>{r.quantity}</td>
                        <td>{r.reworked_by}</td>
                        <td>{r.rework_start}</td>
                        <td>
                          {r.recheck_result ? (
                            <span className={`status-badge ${r.recheck_result === '合格' ? 'status-success' : 'status-danger'}`}>
                              {r.recheck_result}
                            </span>
                          ) : '-'}
                        </td>
                        <td>
                          <span className={`status-badge ${r.status === '返工中' ? 'status-active' : 'status-success'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td>
                          {r.status === '返工中' && (
                            <button 
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setRecheckForm({ rework_id: r.id, recheck_result: '', rechecked_by: '' });
                                setModalType('recheck');
                              }}
                            >
                              <Check size={12} /> 复检
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">暂无返工记录</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'decisions' && (
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ marginBottom: 0 }}>复判决定</h3>
              <button className="btn btn-success btn-sm" onClick={() => setModalType('decision')}>
                <Plus size={14} /> 新建复判
              </button>
            </div>
            {batch.reinspection_decisions.length > 0 ? (
              <div className="timeline" style={{ marginTop: '1rem' }}>
                {batch.reinspection_decisions.map(d => (
                  <div key={d.id} className="timeline-item">
                    <div className="timeline-dot"></div>
                    <div className={`timeline-content ${
                      d.decision === '入库' ? 'confirmed' :
                      d.decision === '返工' ? 'warning-border' :
                      d.decision === '让步放行' ? 'primary-border' :
                      d.decision === '报废' ? 'danger-border' : ''
                    }`}>
                      <h4>{d.decision} · {d.quantity}件</h4>
                      <p>{d.reason || '-'}</p>
                      {d.approval_basis && (
                        <p style={{ background: '#eff6ff', padding: '0.5rem', borderRadius: '0.25rem', marginTop: '0.5rem' }}>
                          <strong>批准依据:</strong> {d.approval_basis}
                        </p>
                      )}
                      <div className="timeline-meta">
                        批准人: {d.approved_by} · {d.decided_at}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">暂无复判记录</div>
            )}
          </div>
        </div>
      )}

      {modalType === 'defect' && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>登记抽检缺陷</h3>
              <button className="close-btn" onClick={() => setModalType(null)}>×</button>
            </div>
            <form onSubmit={submitDefect}>
              <div className="form-row">
                <div className="form-group">
                  <label>缺陷类型 *</label>
                  <select 
                    value={defectForm.defect_type}
                    onChange={(e) => setDefectForm(prev => ({ ...prev, defect_type: e.target.value }))}
                    required
                  >
                    <option value="">请选择</option>
                    <option value="轻微外观缺陷">轻微外观缺陷</option>
                    <option value="严重尺寸不良">严重尺寸不良</option>
                    <option value="功能缺陷">功能缺陷</option>
                    <option value="包装缺陷">包装缺陷</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>严重程度 *</label>
                  <select 
                    value={defectForm.severity}
                    onChange={(e) => setDefectForm(prev => ({ ...prev, severity: e.target.value }))}
                    required
                  >
                    <option value="轻微">轻微</option>
                    <option value="一般">一般</option>
                    <option value="严重">严重</option>
                    <option value="致命">致命</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>数量 *</label>
                  <input 
                    type="number" 
                    min="1"
                    value={defectForm.quantity}
                    onChange={(e) => setDefectForm(prev => ({ ...prev, quantity: e.target.value }))}
                    required
                  />
                  <small style={{ color: '#6b7280' }}>批次总量: {batch.quantity}, 已登记: {totalDefectQty}</small>
                </div>
                <div className="form-group">
                  <label>检测人 *</label>
                  <input 
                    type="text" 
                    value={defectForm.detected_by}
                    onChange={(e) => setDefectForm(prev => ({ ...prev, detected_by: e.target.value }))}
                    placeholder="如：质检员A"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>缺陷描述</label>
                <textarea 
                  rows="3"
                  value={defectForm.description}
                  onChange={(e) => setDefectForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="详细描述缺陷情况..."
                />
              </div>
              <div className="alert alert-warning" style={{ fontSize: '0.875rem' }}>
                <strong>注意:</strong> 系统会自动拦截同一缺陷重复登记和数量超过批次的情况。
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>取消</button>
                <button type="submit" className="btn btn-primary">登记缺陷</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalType === 'quarantine' && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>隔离库存</h3>
              <button className="close-btn" onClick={() => setModalType(null)}>×</button>
            </div>
            <form onSubmit={submitQuarantine}>
              <div className="form-row">
                <div className="form-group">
                  <label>隔离数量 *</label>
                  <input 
                    type="number" 
                    min="1"
                    max={batch.quantity - totalQuarantined}
                    value={quarantineForm.quantity}
                    onChange={(e) => setQuarantineForm(prev => ({ ...prev, quantity: e.target.value }))}
                    required
                  />
                  <small style={{ color: '#6b7280' }}>批次总量: {batch.quantity}, 已隔离: {totalQuarantined}</small>
                </div>
                <div className="form-group">
                  <label>隔离人 *</label>
                  <input 
                    type="text" 
                    value={quarantineForm.quarantined_by}
                    onChange={(e) => setQuarantineForm(prev => ({ ...prev, quarantined_by: e.target.value }))}
                    placeholder="如：张工"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>隔离原因</label>
                <textarea 
                  rows="3"
                  value={quarantineForm.reason}
                  onChange={(e) => setQuarantineForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="隔离原因说明..."
                />
              </div>
              <div className="alert alert-warning" style={{ fontSize: '0.875rem' }}>
                <strong>注意:</strong> 隔离库存释放前需要二次确认。
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>取消</button>
                <button type="submit" className="btn btn-warning" style={{ background: '#f59e0b', color: 'white' }}>确认隔离</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalType === 'release-quarantine' && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>释放隔离库存 - 二次确认</h3>
              <button className="close-btn" onClick={() => { setModalType(null); setConfirmStep(0); }}>×</button>
            </div>
            {confirmStep === 1 && (
              <div>
                <div className="confirm-box">
                  <h4>⚠️ 释放隔离库存确认</h4>
                  <p>请确认以下事项：</p>
                  <ul>
                    <li>已完成产品复检</li>
                    <li>确认产品质量合格</li>
                    <li>已记录相关处理信息</li>
                  </ul>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => { setModalType(null); setConfirmStep(0); }}>
                    取消
                  </button>
                  <button type="button" className="btn btn-primary" onClick={confirmRelease}>
                    继续确认
                  </button>
                </div>
              </div>
            )}
            {confirmStep === 2 && (
              <div>
                <div className="confirm-box">
                  <h4>🔐 最终确认</h4>
                  <p>请输入确认码完成释放：</p>
                </div>
                <div className="form-group">
                  <label>确认码 *</label>
                  <input 
                    type="text" 
                    value={releaseConfirmCode}
                    onChange={(e) => setReleaseConfirmCode(e.target.value)}
                    placeholder="输入任意字符确认"
                  />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => { setModalType(null); setConfirmStep(0); setReleaseConfirmCode(''); }}>
                    取消
                  </button>
                  <button type="button" className="btn btn-success" onClick={confirmRelease}>
                    <Unlock size={14} /> 确认释放
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {modalType === 'rework' && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>创建返工记录</h3>
              <button className="close-btn" onClick={() => setModalType(null)}>×</button>
            </div>
            <form onSubmit={submitRework}>
              <div className="form-group">
                <label>关联缺陷 (可选)</label>
                <select 
                  value={reworkForm.defect_id}
                  onChange={(e) => setReworkForm(prev => ({ ...prev, defect_id: e.target.value }))}
                >
                  <option value="">不关联特定缺陷</option>
                  {batch.defects.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.defect_type} ({d.severity}) - {d.quantity}件
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>返工数量 *</label>
                  <input 
                    type="number" 
                    min="1"
                    value={reworkForm.quantity}
                    onChange={(e) => setReworkForm(prev => ({ ...prev, quantity: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>返工人 *</label>
                  <input 
                    type="text" 
                    value={reworkForm.reworked_by}
                    onChange={(e) => setReworkForm(prev => ({ ...prev, reworked_by: e.target.value }))}
                    placeholder="如：赵师傅"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>返工方法 *</label>
                <select 
                  value={reworkForm.rework_method}
                  onChange={(e) => setReworkForm(prev => ({ ...prev, rework_method: e.target.value }))}
                  required
                >
                  <option value="">请选择</option>
                  <option value="抛光处理">抛光处理</option>
                  <option value="重新加工">重新加工</option>
                  <option value="更换零件">更换零件</option>
                  <option value="清洁处理">清洁处理</option>
                  <option value="其他">其他</option>
                </select>
              </div>
              <div className="alert alert-warning" style={{ fontSize: '0.875rem' }}>
                <strong>注意:</strong> 返工完成后必须复检才能入库。
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>取消</button>
                <button type="submit" className="btn btn-primary">创建返工</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalType === 'recheck' && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>返工复检</h3>
              <button className="close-btn" onClick={() => setModalType(null)}>×</button>
            </div>
            <form onSubmit={submitRecheck}>
              <div className="form-group">
                <label>复检结果 *</label>
                <select 
                  value={recheckForm.recheck_result}
                  onChange={(e) => setRecheckForm(prev => ({ ...prev, recheck_result: e.target.value }))}
                  required
                >
                  <option value="">请选择</option>
                  <option value="合格">合格</option>
                  <option value="不合格">不合格</option>
                  <option value="部分合格">部分合格</option>
                </select>
              </div>
              <div className="form-group">
                <label>复检人 *</label>
                <input 
                  type="text" 
                  value={recheckForm.rechecked_by}
                  onChange={(e) => setRecheckForm(prev => ({ ...prev, rechecked_by: e.target.value }))}
                  placeholder="如：王工"
                  required
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>取消</button>
                <button type="submit" className="btn btn-primary">提交复检</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalType === 'decision' && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>复判决定</h3>
              <button className="close-btn" onClick={() => setModalType(null)}>×</button>
            </div>
            <form onSubmit={submitDecision}>
              <div className="form-row">
                <div className="form-group">
                  <label>复判决定 *</label>
                  <select 
                    value={decisionForm.decision}
                    onChange={(e) => setDecisionForm(prev => ({ ...prev, decision: e.target.value }))}
                    required
                  >
                    <option value="">请选择</option>
                    <option value="入库">入库</option>
                    <option value="返工">返工</option>
                    <option value="让步放行">让步放行</option>
                    <option value="报废">报废</option>
                    <option value="退回供应商">退回供应商</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>数量 *</label>
                  <input 
                    type="number" 
                    min="1"
                    max={batch.quantity}
                    value={decisionForm.quantity}
                    onChange={(e) => setDecisionForm(prev => ({ ...prev, quantity: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>批准人 *</label>
                <input 
                  type="text" 
                  value={decisionForm.approved_by}
                  onChange={(e) => setDecisionForm(prev => ({ ...prev, approved_by: e.target.value }))}
                  placeholder="如：质量经理"
                  required
                />
              </div>
              <div className="form-group">
                <label>原因说明</label>
                <textarea 
                  rows="2"
                  value={decisionForm.reason}
                  onChange={(e) => setDecisionForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="复判原因说明..."
                />
              </div>
              {decisionForm.decision === '让步放行' && (
                <div className="form-group">
                  <label style={{ color: '#dc2626' }}>批准依据 *</label>
                  <textarea 
                    rows="2"
                    value={decisionForm.approval_basis}
                    onChange={(e) => setDecisionForm(prev => ({ ...prev, approval_basis: e.target.value }))}
                    placeholder="让步放行必须提供批准依据，如：客户确认函编号、标准豁免条款等"
                    required={decisionForm.decision === '让步放行'}
                  />
                  <small style={{ color: '#dc2626' }}>让步放行批次必须填写批准依据</small>
                </div>
              )}
              <div className="alert alert-warning" style={{ fontSize: '0.875rem' }}>
                <strong>系统规则:</strong>
                <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                  <li>存在隔离库存时无法入库或让步放行</li>
                  <li>存在未完成复检的返工时无法入库</li>
                  <li>数量不能超过批次总量</li>
                </ul>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>取消</button>
                <button type="submit" className="btn btn-success">确认复判</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchDetail;
