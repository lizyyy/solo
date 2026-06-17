import { useState, useEffect } from 'react';
import { locationsApi, plansApi, conflictsApi } from '../api';
import type { LocationDetail, PlanVersion } from '../api';

interface Props {
  locationId: number;
  onClose: () => void;
}

export default function LocationDetail({ locationId, onClose }: Props) {
  const [detail, setDetail] = useState<LocationDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'feedbacks' | 'plans' | 'timeline'>('overview');
  const [loading, setLoading] = useState(true);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlan, setNewPlan] = useState({
    title: '',
    description: '',
    pruningType: '疏枝修剪',
    estimatedDate: '',
    contractor: '',
    cost: ''
  });
  const [resolvingConflict, setResolvingConflict] = useState<number | null>(null);
  const [resolution, setResolution] = useState('');
  const [resolutionType, setResolutionType] = useState<'use_feedback' | 'use_existing' | 'manual'>('use_feedback');

  useEffect(() => {
    loadDetail();
  }, [locationId]);

  async function loadDetail() {
    try {
      const response = await locationsApi.getById(locationId);
      setDetail(response.data);
    } catch (error) {
      console.error('加载点位详情失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePlan() {
    if (!detail) return;
    
    try {
      await plansApi.create({
        locationId,
        title: newPlan.title || `${detail.location.name}树木修剪方案`,
        description: newPlan.description,
        pruningType: newPlan.pruningType,
        estimatedDate: newPlan.estimatedDate || undefined,
        contractor: newPlan.contractor || undefined,
        cost: newPlan.cost ? parseFloat(newPlan.cost) : undefined,
        createdBy: '何工'
      });
      
      setShowNewPlan(false);
      setNewPlan({ title: '', description: '', pruningType: '疏枝修剪', estimatedDate: '', contractor: '', cost: '' });
      loadDetail();
    } catch (error) {
      console.error('创建方案失败:', error);
    }
  }

  async function handleResolveConflict(conflictId: number) {
    try {
      await conflictsApi.resolve(conflictId, resolutionType, '何工', resolution);
      setResolvingConflict(null);
      setResolution('');
      setResolutionType('use_feedback');
      loadDetail();
    } catch (error) {
      console.error('解决冲突失败:', error);
    }
  }

  async function handleGenerateReport(planId: number) {
    try {
      await plansApi.generateReport(planId, '何工');
      loadDetail();
    } catch (error) {
      console.error('生成报告失败:', error);
    }
  }

  if (loading) {
    return (
      <div className="detail-panel-body">
        <div>加载中...</div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="detail-panel-body">
        <div>加载失败</div>
      </div>
    );
  }

  return (
    <>
      <div className="detail-panel-header">
        <h3>{detail.location.name}</h3>
        <button className="close-btn" onClick={onClose}>&times;</button>
      </div>
      
      <div className="detail-panel-body">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            概览
          </button>
          <button 
            className={`tab ${activeTab === 'feedbacks' ? 'active' : ''}`}
            onClick={() => setActiveTab('feedbacks')}
          >
            反馈 ({detail.feedbacks.length})
          </button>
          <button 
            className={`tab ${activeTab === 'plans' ? 'active' : ''}`}
            onClick={() => setActiveTab('plans')}
          >
            方案 ({detail.plans.length})
          </button>
          <button 
            className={`tab ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            时间线
          </button>
        </div>

        {activeTab === 'overview' && (
          <div>
            <div className="section-title">点位信息</div>
            <div className="info-row">
              <div className="info-label">点位名称</div>
              <div className="info-value">{detail.location.name}</div>
            </div>
            <div className="info-row">
              <div className="info-label">地址</div>
              <div className="info-value">{detail.location.address || '-'}</div>
            </div>
            <div className="info-row">
              <div className="info-label">街道</div>
              <div className="info-value">{detail.location.street || '-'}</div>
            </div>
            <div className="info-row">
              <div className="info-label">区域</div>
              <div className="info-value">{detail.location.district || '-'}</div>
            </div>
            <div className="info-row">
              <div className="info-label">坐标</div>
              <div className="info-value">{detail.location.lat.toFixed(6)}, {detail.location.lng.toFixed(6)}</div>
            </div>

            <div className="section-title">别名 ({detail.aliases.length})</div>
            <div className="aliases-list">
              {detail.aliases.map((alias, i) => (
                <span key={i} className="alias-tag">{alias}</span>
              ))}
            </div>

            {detail.conflicts.length > 0 && (
              <>
                <div className="section-title">⚠️ 数据冲突 ({detail.conflicts.length})</div>
                {detail.conflicts.map(conflict => {
                  const isResolved = !!conflict.resolvedAt;
                  return (
                  <div key={conflict.id} className={`conflict-card ${isResolved ? 'resolved' : ''}`}>
                    <div className="conflict-header">
                      <span className="conflict-type">
                        {conflict.conflictType === 'pruning_suggestion' ? '修剪建议冲突' :
                         conflict.conflictType === 'status' ? '状态冲突' :
                         conflict.conflictType === 'location_name' ? '点位名称冲突' :
                         conflict.conflictType === 'content_discrepancy' ? '内容描述冲突' :
                         conflict.conflictType === 'priority' ? '优先级冲突' : '其他冲突'}
                      </span>
                      {!isResolved && (
                        <button 
                          className="btn btn-sm btn-success"
                          onClick={() => {
                            setResolvingConflict(resolvingConflict === conflict.id ? null : conflict.id);
                            setResolution('');
                            setResolutionType('use_feedback');
                          }}
                        >
                          {resolvingConflict === conflict.id ? '取消' : '人工裁决'}
                        </button>
                      )}
                      {isResolved && (
                        <span className="badge badge-resolved">已解决 · {conflict.resolvedBy}</span>
                      )}
                    </div>
                    <div className="conflict-sources">
                      <div className="conflict-source">
                        <div className="conflict-source-label">🆕 新反馈内容</div>
                        <div>{conflict.feedbackValue || '无'}</div>
                      </div>
                      <div className="conflict-source">
                        <div className="conflict-source-label">📋 已有记录</div>
                        <div>{conflict.existingValue || '无'}</div>
                      </div>
                    </div>
                    <div className="conflict-description"><strong>问题：</strong>{conflict.description}</div>
                    <div className="conflict-suggestion">💡 <strong>建议：</strong>{conflict.suggestedAction}</div>

                    {isResolved && conflict.resolution && (
                      <div style={{ marginTop: '12px', padding: '12px', background: '#f0fdf4', borderRadius: '6px', fontSize: '13px' }}>
                        <strong>✅ 裁决：</strong>{conflict.resolution}
                      </div>
                    )}
                    
                    {resolvingConflict === conflict.id && (
                      <div style={{ marginTop: '12px', padding: '16px', background: '#f8fafc', borderRadius: '6px' }}>
                        <div className="form-group">
                          <label className="form-label">📌 裁决方式</label>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', background: resolutionType === 'use_feedback' ? '#eff6ff' : 'white', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}>
                              <input type="radio" name="resType" value="use_feedback" checked={resolutionType === 'use_feedback'} onChange={(e) => setResolutionType(e.target.value as any)} />
                              采用新反馈
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', background: resolutionType === 'use_existing' ? '#eff6ff' : 'white', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}>
                              <input type="radio" name="resType" value="use_existing" checked={resolutionType === 'use_existing'} onChange={(e) => setResolutionType(e.target.value as any)} />
                              保留原有记录
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', background: resolutionType === 'manual' ? '#eff6ff' : 'white', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}>
                              <input type="radio" name="resType" value="manual" checked={resolutionType === 'manual'} onChange={(e) => setResolutionType(e.target.value as any)} />
                              手动处理
                            </label>
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">📝 处理说明（可选）</label>
                          <textarea className="form-textarea" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="请输入处理说明..." />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-primary" onClick={() => handleResolveConflict(conflict.id)}>确认裁决</button>
                          <button className="btn btn-secondary" onClick={() => setResolvingConflict(null)}>取消</button>
                        </div>
                      </div>
                    )}
                  </div>
                )})}
              </>
            )}
          </div>
        )}

        {activeTab === 'feedbacks' && (
          <div>
            {detail.feedbacks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📝</div>
                <div className="empty-state-text">暂无居民反馈</div>
              </div>
            ) : (
              detail.feedbacks.map(feedback => (
                <div key={feedback.id} style={{
                  padding: '16px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className={`badge badge-${feedback.priority}`}>
                      {feedback.priority === 'urgent' ? '紧急' :
                       feedback.priority === 'high' ? '高' :
                       feedback.priority === 'medium' ? '中' : '低'}
                    </span>
                    <span className={`badge badge-${feedback.status}`}>
                      {feedback.status === 'pending' ? '待处理' :
                       feedback.status === 'processing' ? '处理中' :
                       feedback.status === 'resolved' ? '已解决' : '已关闭'}
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                    {feedback.content}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {feedback.feedbackDate} · {feedback.source} · {feedback.reporter || '匿名'}
                  </div>
                  {feedback.rawContent !== feedback.content && (
                    <div style={{ 
                      marginTop: '8px', 
                      padding: '8px', 
                      background: '#fff3cd', 
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      <strong>原始备注：</strong>{feedback.rawContent}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'plans' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <button 
                className="btn btn-primary"
                onClick={() => setShowNewPlan(!showNewPlan)}
              >
                + 新建修剪方案
              </button>
            </div>

            {showNewPlan && (
              <div className="card" style={{ marginBottom: '16px' }}>
                <div className="card-body">
                  <div className="form-group">
                    <label className="form-label">方案标题</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newPlan.title}
                      onChange={(e) => setNewPlan({ ...newPlan, title: e.target.value })}
                      placeholder="请输入方案标题"
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">修剪类型</label>
                      <select 
                        className="form-select"
                        value={newPlan.pruningType}
                        onChange={(e) => setNewPlan({ ...newPlan, pruningType: e.target.value })}
                      >
                        <option value="疏枝修剪">疏枝修剪</option>
                        <option value="整形修剪">整形修剪</option>
                        <option value="回缩修剪">回缩修剪</option>
                        <option value="枯枝清理">枯枝清理</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">计划日期</label>
                      <input
                        type="date"
                        className="form-input"
                        value={newPlan.estimatedDate}
                        onChange={(e) => setNewPlan({ ...newPlan, estimatedDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">方案说明</label>
                    <textarea
                      className="form-textarea"
                      value={newPlan.description}
                      onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                      placeholder="请输入修剪方案说明"
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">施工单位</label>
                      <input
                        type="text"
                        className="form-input"
                        value={newPlan.contractor}
                        onChange={(e) => setNewPlan({ ...newPlan, contractor: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">预计费用（元）</label>
                      <input
                        type="number"
                        className="form-input"
                        value={newPlan.cost}
                        onChange={(e) => setNewPlan({ ...newPlan, cost: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary" onClick={handleCreatePlan}>
                      创建方案
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setShowNewPlan(false)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            )}

            {detail.plans.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-text">暂无修剪方案</div>
              </div>
            ) : (
              detail.plans.map(plan => (
                <div key={plan.id} style={{
                  padding: '16px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '500' }}>{plan.title}</span>
                    <span className={`badge badge-${plan.status}`}>
                      {plan.status === 'draft' ? '草稿' :
                       plan.status === 'approved' ? '已批准' :
                       plan.status === 'in_progress' ? '进行中' :
                       plan.status === 'completed' ? '已完成' : '已取消'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    版本 {plan.version} · {plan.pruningType} · {plan.createdBy}
                  </div>
                  {plan.description && (
                    <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                      {plan.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleGenerateReport(plan.id)}
                    >
                      生成报告
                    </button>
                  </div>
                </div>
              ))
            )}

            {detail.reports.length > 0 && (
              <>
                <div className="section-title">关联报告 ({detail.reports.length})</div>
                {detail.reports.map((report: any) => (
                  <div key={report.id} style={{
                    padding: '12px',
                    background: '#f0fdf4',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '8px'
                  }}>
                    <div style={{ fontWeight: '500', fontSize: '14px' }}>{report.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {report.reportNo} · {report.generatedBy} · {report.generatedAt}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div>
            {detail.timeline.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">⏱️</div>
                <div className="empty-state-text">暂无时间记录</div>
              </div>
            ) : (
              <div className="timeline">
                {detail.timeline.map((item, index) => (
                  <div key={`${item.type}-${item.id}`} className={`timeline-item ${item.type}`}>
                    <div className="timeline-date">
                      {item.date || item.createdAt}
                      <span style={{ marginLeft: '8px', fontSize: '11px' }}>
                        {item.type === 'feedback' ? '反馈' :
                         item.type === 'plan' ? `方案 v${item.version}` :
                         item.type === 'report' ? '报告' : ''}
                      </span>
                    </div>
                    <div className="timeline-content">
                      <div>{item.content}</div>
                      {item.priority && (
                        <span className={`badge badge-${item.priority}`} style={{ marginTop: '4px' }}>
                          {item.priority === 'urgent' ? '紧急' :
                           item.priority === 'high' ? '高' :
                           item.priority === 'medium' ? '中' : '低'}
                        </span>
                      )}
                      {item.status && (
                        <span className={`badge badge-${item.status}`} style={{ marginTop: '4px', marginLeft: '4px' }}>
                          {item.status === 'pending' ? '待处理' :
                           item.status === 'processing' ? '处理中' :
                           item.status === 'resolved' ? '已解决' :
                           item.status === 'draft' ? '草稿' :
                           item.status === 'approved' ? '已批准' :
                           item.status === 'completed' ? '已完成' : item.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
