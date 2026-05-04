import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BatchDetail as BatchDetailType } from '../types';
import { batchApi, reviewApi, exportApi } from '../api';

function BatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<BatchDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'temperature' | 'formula' | 'review'>('overview');
  const [reviewForm, setReviewForm] = useState({
    reviewer: '',
    judgement: 'pending' as 'pass' | 'rework' | 'pending',
    notes: '',
    reworkReason: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      loadBatchDetail();
    }
  }, [id]);

  const loadBatchDetail = async () => {
    try {
      const result = await batchApi.getById(id!);
      setData(result);
      if (result.reviewRecord) {
        setReviewForm({
          reviewer: result.reviewRecord.reviewer,
          judgement: result.reviewRecord.judgement,
          notes: result.reviewRecord.notes || '',
          reworkReason: result.reviewRecord.reworkReason || ''
        });
      }
    } catch (error) {
      console.error('Failed to load batch detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReview = async () => {
    if (!data || !reviewForm.reviewer.trim()) {
      alert('请填写复核人姓名');
      return;
    }

    setSaving(true);
    try {
      await reviewApi.save({
        batchId: data.batch.id,
        reviewer: reviewForm.reviewer,
        judgement: reviewForm.judgement,
        notes: reviewForm.notes || undefined,
        reworkReason: reviewForm.reworkReason || undefined
      });
      await loadBatchDetail();
      alert('复核记录已保存');
    } catch (error) {
      console.error('Failed to save review:', error);
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleExportReworkOrder = async () => {
    if (!data) return;
    await exportApi.downloadReworkOrder(data.batch.id, data.batch.batchNumber);
  };

  const handleExportAuditPackage = async () => {
    if (!data) return;
    await exportApi.downloadAuditPackage(data.batch.id, data.batch.batchNumber);
  };

  const getRiskBadgeClass = (level: string) => {
    switch (level) {
      case 'low': return 'risk-badge risk-low';
      case 'medium': return 'risk-badge risk-medium';
      case 'high': return 'risk-badge risk-high';
      case 'critical': return 'risk-badge risk-critical';
      default: return 'risk-badge';
    }
  };

  const getRiskText = (level: string) => {
    switch (level) {
      case 'low': return '低风险';
      case 'medium': return '中风险';
      case 'high': return '高风险';
      case 'critical': return '极严重';
      default: return level;
    }
  };

  const getJudgementText = (judgement: string) => {
    switch (judgement) {
      case 'pass': return '合格通过';
      case 'rework': return '需要返工';
      case 'pending': return '待复核';
      default: return judgement;
    }
  };

  const getJudgementBadgeClass = (judgement: string) => {
    switch (judgement) {
      case 'pass': return 'risk-badge risk-low';
      case 'rework': return 'risk-badge risk-high';
      case 'pending': return 'risk-badge risk-medium';
      default: return 'risk-badge';
    }
  };

  const getTemperatureChartData = () => {
    if (!data?.temperatureCurve) return [];
    
    const { targetCurve, actualCurve } = data.temperatureCurve;
    const allTimes = new Set<number>();
    targetCurve.forEach(p => allTimes.add(p.time));
    actualCurve.forEach(p => allTimes.add(p.time));
    
    const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);
    
    return sortedTimes.map(time => {
      const targetPoint = targetCurve.find(p => p.time === time);
      const actualPoint = actualCurve.find(p => p.time === time);
      return {
        time,
        目标温度: targetPoint?.temperature,
        实际温度: actualPoint?.temperature
      };
    });
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (!data) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">❌</div>
        <div className="empty-state-text">批次不存在</div>
        <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          返回仪表盘
        </Link>
      </div>
    );
  }

  const { batch, temperatureCurve, formula, reviewRecord, riskAssessment } = data;

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/" className="btn btn-sm btn-secondary" style={{ marginBottom: '0.5rem' }}>
            ← 返回
          </Link>
          <h1 className="page-title">批次详情 - {batch.batchNumber}</h1>
        </div>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={handleExportReworkOrder}>
            📄 导出返工单
          </button>
          <button className="btn btn-secondary" onClick={handleExportAuditPackage}>
            📦 导出审计包
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">DeltaE 色差</div>
          <div className="stat-value" style={{ 
            color: (batch.deltaE ?? 0) > 3 ? 'var(--danger-color)' : 
                   (batch.deltaE ?? 0) > 1 ? 'var(--warning-color)' : 
                   'var(--success-color)'
          }}>
            {batch.deltaE !== undefined ? batch.deltaE.toFixed(2) : '-'}
          </div>
          <div className="stat-icon">🎨</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">温度偏差</div>
          <div className="stat-value">
            {temperatureCurve?.temperatureDeviation !== undefined 
              ? `${temperatureCurve.temperatureDeviation.toFixed(2)}°C` 
              : '-'}
          </div>
          <div className="stat-icon">🌡️</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">漏加助剂</div>
          <div className="stat-value" style={{ 
            color: (formula?.missingChemicals.length ?? 0) > 0 ? 'var(--danger-color)' : 'var(--success-color)'
          }}>
            {formula?.missingChemicals.length ?? 0} 种
          </div>
          <div className="stat-icon">⚗️</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">风险等级</div>
          <div className="stat-value">
            <span className={getRiskBadgeClass(riskAssessment.riskLevel)}>
              {getRiskText(riskAssessment.riskLevel)}
            </span>
          </div>
          <div className="stat-icon">
            {riskAssessment.reworkPriority >= 75 ? '🔴' : 
             riskAssessment.reworkPriority >= 50 ? '🟠' : 
             riskAssessment.reworkPriority >= 25 ? '🟡' : '🟢'}
          </div>
        </div>
      </div>

      {reviewRecord && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">复核状态</h2>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">复核人</span>
                <span className="detail-value">{reviewRecord.reviewer}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">判定结果</span>
                <span className="detail-value">
                  <span className={getJudgementBadgeClass(reviewRecord.judgement)}>
                    {getJudgementText(reviewRecord.judgement)}
                  </span>
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">返工优先级</span>
                <span className="detail-value">
                  {reviewRecord.reworkPriority !== undefined ? reviewRecord.reworkPriority : '-'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">复核时间</span>
                <span className="detail-value">
                  {new Date(reviewRecord.updatedAt).toLocaleString('zh-CN')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📋 基本信息
        </button>
        <button 
          className={`tab ${activeTab === 'temperature' ? 'active' : ''}`}
          onClick={() => setActiveTab('temperature')}
        >
          🌡️ 温度曲线
        </button>
        <button 
          className={`tab ${activeTab === 'formula' ? 'active' : ''}`}
          onClick={() => setActiveTab('formula')}
        >
          ⚗️ 配方记录
        </button>
        <button 
          className={`tab ${activeTab === 'review' ? 'active' : ''}`}
          onClick={() => setActiveTab('review')}
        >
          ✍️ 复核记录
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">批次基本信息</h2>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">批次号</span>
                <span className="detail-value">{batch.batchNumber}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">面料类型</span>
                <span className="detail-value">{batch.fabricType}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">客户名称</span>
                <span className="detail-value">{batch.customerName}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">导入时间</span>
                <span className="detail-value">
                  {new Date(batch.createdAt).toLocaleString('zh-CN')}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>颜色信息</h3>
              <div className="detail-grid">
                <div className="card" style={{ margin: 0 }}>
                  <div className="card-body">
                    <h4 style={{ marginBottom: '1rem' }}>🎯 目标色</h4>
                    <div className="color-preview" style={{ marginBottom: '1rem' }}>
                      <div 
                        className="color-box" 
                        style={{ 
                          background: `lab(${batch.targetColor.L}% ${batch.targetColor.a} ${batch.targetColor.b})` 
                        }} 
                      />
                      <div className="color-labels">
                        <div>L: {batch.targetColor.L.toFixed(1)}</div>
                        <div>a: {batch.targetColor.a.toFixed(1)}</div>
                        <div>b: {batch.targetColor.b.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ margin: 0 }}>
                  <div className="card-body">
                    <h4 style={{ marginBottom: '1rem' }}>📏 测量色</h4>
                    {batch.measuredColor ? (
                      <>
                        <div className="color-preview" style={{ marginBottom: '1rem' }}>
                          <div 
                            className="color-box" 
                            style={{ 
                              background: `lab(${batch.measuredColor.L}% ${batch.measuredColor.a} ${batch.measuredColor.b})` 
                            }} 
                          />
                          <div className="color-labels">
                            <div>L: {batch.measuredColor.L.toFixed(1)}</div>
                            <div>a: {batch.measuredColor.a.toFixed(1)}</div>
                            <div>b: {batch.measuredColor.b.toFixed(1)}</div>
                          </div>
                        </div>
                        <div style={{ 
                          padding: '1rem', 
                          background: 'var(--bg-color)', 
                          borderRadius: '8px',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                            DeltaE 色差
                          </div>
                          <div style={{ 
                            fontSize: '1.5rem', 
                            fontWeight: 700,
                            color: (batch.deltaE ?? 0) > 3 ? 'var(--danger-color)' : 
                                   (batch.deltaE ?? 0) > 1 ? 'var(--warning-color)' : 
                                   'var(--success-color)'
                          }}>
                            {batch.deltaE?.toFixed(2)}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                        暂无测量数据
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'temperature' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">染缸温度曲线</h2>
            {temperatureCurve?.temperatureDeviation !== undefined && (
              <span style={{ 
                padding: '0.25rem 0.75rem', 
                borderRadius: '9999px', 
                fontSize: '0.875rem',
                background: temperatureCurve.temperatureDeviation > 5 ? '#fee2e2' : '#dcfce7',
                color: temperatureCurve.temperatureDeviation > 5 ? '#991b1b' : '#166534'
              }}>
                平均偏差: {temperatureCurve.temperatureDeviation.toFixed(2)}°C
              </span>
            )}
          </div>
          <div className="card-body">
            {temperatureCurve ? (
              <>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getTemperatureChartData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="time" 
                        label={{ value: '时间 (分钟)', position: 'insideBottom', offset: -5 }}
                        stroke="#6b7280"
                      />
                      <YAxis 
                        label={{ value: '温度 (°C)', angle: -90, position: 'insideLeft' }}
                        stroke="#6b7280"
                      />
                      <Tooltip 
                        contentStyle={{ 
                          background: 'white', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="目标温度" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6' }}
                        activeDot={{ r: 6 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="实际温度" 
                        stroke="#ef4444" 
                        strokeWidth={2}
                        dot={{ fill: '#ef4444' }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ marginTop: '2rem' }}>
                  <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>温度数据</h3>
                  <div className="detail-grid">
                    <div className="table-container">
                      <h4 style={{ marginBottom: '0.5rem' }}>目标温度曲线</h4>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>时间 (分钟)</th>
                            <th>温度 (°C)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {temperatureCurve.targetCurve.map((point, idx) => (
                            <tr key={idx}>
                              <td>{point.time}</td>
                              <td>{point.temperature}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="table-container">
                      <h4 style={{ marginBottom: '0.5rem' }}>实际温度曲线</h4>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>时间 (分钟)</th>
                            <th>温度 (°C)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {temperatureCurve.actualCurve.map((point, idx) => (
                            <tr key={idx}>
                              <td>{point.time}</td>
                              <td>{point.temperature}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">🌡️</div>
                <div className="empty-state-text">暂无温度曲线数据</div>
                <div className="empty-state-hint">请导入染缸温度曲线 JSON 文件</div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'formula' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">配方记录</h2>
            {(formula?.missingChemicals.length ?? 0) > 0 && (
              <span className="risk-badge risk-high">
                ⚠️ 漏加 {formula?.missingChemicals.length} 种助剂
              </span>
            )}
          </div>
          <div className="card-body">
            {formula ? (
              <>
                {formula.missingChemicals.length > 0 && (
                  <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
                    <strong>⚠️ 检测到漏加助剂:</strong> {formula.missingChemicals.join(', ')}
                  </div>
                )}

                <div className="detail-grid">
                  <div className="table-container">
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>🎯 目标配方</h3>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>助剂名称</th>
                          <th>用量</th>
                          <th>单位</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formula.targetFormula.length > 0 ? (
                          formula.targetFormula.map((item, idx) => (
                            <tr key={idx}>
                              <td>{item.chemicalName}</td>
                              <td>{item.dosage}</td>
                              <td>{item.unit}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                              无数据
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="table-container">
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>📋 实际添加</h3>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>助剂名称</th>
                          <th>用量</th>
                          <th>单位</th>
                          <th>实际添加</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formula.actualFormula.length > 0 ? (
                          formula.actualFormula.map((item, idx) => (
                            <tr key={idx}>
                              <td>{item.chemicalName}</td>
                              <td>{item.dosage}</td>
                              <td>{item.unit}</td>
                              <td>
                                <span className={`risk-badge ${item.added ? 'risk-low' : 'risk-high'}`}>
                                  {item.added ? '✓ 已添加' : '✗ 未添加'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                              无数据
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">⚗️</div>
                <div className="empty-state-text">暂无配方数据</div>
                <div className="empty-state-hint">请导入配方记录 JSON 文件</div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'review' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">复核记录</h2>
          </div>
          <div className="card-body">
            <div style={{ maxWidth: '600px' }}>
              <div className="form-group">
                <label className="form-label">复核人姓名 *</label>
                <input
                  type="text"
                  className="form-input"
                  value={reviewForm.reviewer}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, reviewer: e.target.value }))}
                  placeholder="请输入复核人姓名"
                />
              </div>

              <div className="form-group">
                <label className="form-label">判定结果 *</label>
                <select
                  className="form-select"
                  value={reviewForm.judgement}
                  onChange={(e) => setReviewForm(prev => ({ 
                    ...prev, 
                    judgement: e.target.value as 'pass' | 'rework' | 'pending' 
                  }))}
                >
                  <option value="pending">⏳ 待复核</option>
                  <option value="pass">✅ 合格通过</option>
                  <option value="rework">🔄 需要返工</option>
                </select>
              </div>

              {reviewForm.judgement === 'rework' && (
                <div className="form-group">
                  <label className="form-label">返工原因</label>
                  <textarea
                    className="form-textarea"
                    value={reviewForm.reworkReason}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, reworkReason: e.target.value }))}
                    placeholder="请描述返工原因..."
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">备注</label>
                <textarea
                  className="form-textarea"
                  value={reviewForm.notes}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="其他备注信息..."
                />
              </div>

              <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
                <strong>系统评估返工优先级:</strong> {riskAssessment.reworkPriority} 分
                <span className={getRiskBadgeClass(riskAssessment.riskLevel)} style={{ marginLeft: '0.5rem' }}>
                  {getRiskText(riskAssessment.riskLevel)}
                </span>
              </div>

              <div className="btn-group">
                <button 
                  className="btn btn-primary"
                  onClick={handleSaveReview}
                  disabled={saving}
                >
                  {saving ? '保存中...' : '💾 保存复核记录'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BatchDetail;
