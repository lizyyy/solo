import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { CheckRecord } from '../types';
import { checkApi } from '../services/api';
import { formatDate, getStatusText, getStatusClass, getScoreClass } from '../utils/format';
import StepIndicator from '../components/StepIndicator';
import SelfCheckPanel from '../components/SelfCheckPanel';

const CheckDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<CheckRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [comment, setComment] = useState('');
  const [resolvingConflictId, setResolvingConflictId] = useState<string | null>(null);

  const [ticketForm, setTicketForm] = useState({
    ticketNo: '',
    title: '',
    content: '',
    modelVersion: 'v2.1.0',
    conclusion: '字幕与图像一致',
    operator: '小乔',
  });

  const [reviewContent, setReviewContent] = useState('');
  const [reviewOperator, setReviewOperator] = useState('产品经理');

  useEffect(() => {
    if (id) {
      loadRecord();
    }
  }, [id]);

  const loadRecord = async () => {
    try {
      if (!id) return;
      const data = await checkApi.getById(id);
      setRecord(data);
    } catch (error) {
      console.error('Failed to load record:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!id) return;
      const updated = await checkApi.linkTicket(id, {
        ticket: {
          ticketNo: ticketForm.ticketNo,
          title: ticketForm.title,
          content: ticketForm.content,
          sampleId: record?.sampleId || '',
          modelVersion: ticketForm.modelVersion,
          conclusion: ticketForm.conclusion,
        },
        operator: ticketForm.operator,
      });
      setRecord(updated);
      setShowTicketModal(false);
    } catch (error) {
      console.error('Failed to link ticket:', error);
    }
  };

  const handleResolveConflict = async (resolution: 'confirm' | 'reject') => {
    if (!id || !resolvingConflictId) return;
    checkApi.resolveConflict(id, {
      conflictId: resolvingConflictId,
      resolution,
      comment,
      operator: '小乔',
    }).then(updated => {
      setRecord(updated);
      setResolvingConflictId(null);
      setComment('');
    }).catch(error => {
      console.error('Failed to resolve conflict:', error);
    });
  };

  const handleUpdateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!id) return;
      const updated = await checkApi.updateReview(id, {
        content: reviewContent,
        operator: reviewOperator,
      });
      setRecord(updated);
      setShowReviewModal(false);
    } catch (error) {
      console.error('Failed to update review:', error);
    }
  };

  const handleRequestRecheck = async () => {
    try {
      if (!id) return;
      const updated = await checkApi.requestRecheck(id, '运营复核人');
      setRecord(updated);
    } catch (error) {
      console.error('Failed to request recheck:', error);
    }
  };

  const handleCompleteRecheck = async () => {
    try {
      if (!id) return;
      const updated = await checkApi.completeRecheck(id, '运营复核人');
      setRecord(updated);
    } catch (error) {
      console.error('Failed to complete recheck:', error);
    }
  };

  if (loading || !record) {
    return (
      <div className="container">
        <div className="header">
          <h1>加载中...</h1>
        </div>
      </div>
    );
  }

  const steps = ['导入知识库引用', '补看线上工单', '产品复盘更新'];
  const scorePercent = `${record.calculationResult.consistencyScore * 100}%`;

  return (
    <div className="container">
      <div className="header">
        <div className="flex justify-between items-center">
          <div>
            <h1>{record.sampleName}</h1>
            <p>样本编号：{record.sampleId}</p>
          </div>
          <button className="btn btn-default" onClick={() => navigate('/')}>
            返回列表
          </button>
        </div>
      </div>

      <StepIndicator currentStep={record.currentStep} steps={steps} />

      <div className="grid grid-3">
        <div className="card">
          <h2>基本信息</h2>
          <div style={{ marginBottom: 16 }}>
            <img 
              src={record.imageUrl} 
              alt={record.sampleName}
              style={{ width: '100%', borderRadius: 8, marginBottom: 12 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>字幕内容</div>
            <div>{record.caption}</div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>状态</div>
            <span className={`status-badge ${getStatusClass(record.status)}`}>
              {getStatusText(record.status)}
            </span>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>更新时间</div>
            <div className="text-muted">{formatDate(record.updatedAt)}</div>
          </div>
        </div>

        <div className="card">
          <h2>一致性评分</h2>
          <div 
            className={`score-circle ${getScoreClass(record.calculationResult.consistencyScore)}`}
            style={{ '--score': scorePercent } as React.CSSProperties}
          >
            <div className="score-inner">
              <div className="score-value">
                {(record.calculationResult.consistencyScore * 100).toFixed(0)}
              </div>
              <div className="score-label">分</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            {record.calculationResult.isConsistent ? (
              <span className="text-success" style={{ fontWeight: 500 }}>字幕与图像一致</span>
            ) : (
              <span className="text-danger" style={{ fontWeight: 500 }}>字幕与图像不一致</span>
            )}
          </div>
          <div style={{ fontSize: 13, color: '#666' }}>
            <div className="flex justify-between mb-2">
              <span>文本相似度</span>
              <span>{(record.calculationResult.details.textSimilarity * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between mb-2">
              <span>图文匹配度</span>
              <span>{(record.calculationResult.details.imageTextMatch * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span>实体匹配度</span>
              <span>{(record.calculationResult.details.entityMatch * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>模型参数与取舍理由</h2>
          <div className="model-info">
            <h4>模型版本：{record.modelVersionInfo.version}</h4>
            <div className="model-params">
              {Object.entries(record.modelVersionInfo.params).map(([key, value]) => (
                <span key={key} className="param-tag">
                  {key}: {String(value)}
                </span>
              ))}
            </div>
            <div className="tradeoff-note">
              <strong>取舍理由：</strong>{record.modelVersionInfo.tradeOffReason}
            </div>
            <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
              参数更新时间：{formatDate(record.modelVersionInfo.timestamp)}
            </div>
          </div>
        </div>
      </div>

      {record.conflicts.length > 0 && (
        <div className="card">
          <h2>冲突证据（请知识库编辑确认或驳回）</h2>
          {record.conflicts.map(conflict => (
            <div key={conflict.id} className="conflict-card">
              <div className="conflict-title">{conflict.description}</div>
              <div className="conflict-detail">
                <div className="conflict-side">
                  <h4>知识库引用</h4>
                  <p>{conflict.knowledgeValue}</p>
                </div>
                <div className="conflict-side">
                  <h4>线上工单</h4>
                  <p>{conflict.ticketValue}</p>
                </div>
              </div>
              {resolvingConflictId === conflict.id ? (
                <div>
                  <div className="form-group">
                    <label>处理意见</label>
                    <textarea
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="请输入处理意见..."
                      rows={3}
                    />
                  </div>
                  <div className="conflict-actions">
                    <button 
                      className="btn btn-success btn-sm"
                      onClick={() => handleResolveConflict('confirm')}
                    >
                      确认冲突
                    </button>
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={() => handleResolveConflict('reject')}
                    >
                      驳回冲突
                    </button>
                    <button 
                      className="btn btn-default btn-sm"
                      onClick={() => {
                        setResolvingConflictId(null);
                        setComment('');
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="conflict-actions">
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => setResolvingConflictId(conflict.id)}
                  >
                    处理此冲突
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 style={{ marginBottom: 0 }}>知识库引用</h2>
          </div>
          {record.knowledgeReference ? (
            <div>
              <div style={{ marginBottom: 12 }}>
                <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>标题</div>
                <div>{record.knowledgeReference.title}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>链接</div>
                <a href={record.knowledgeReference.link} target="_blank" rel="noopener noreferrer">
                  {record.knowledgeReference.link}
                </a>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>模型版本</div>
                <div>{record.knowledgeReference.modelVersion}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>结论</div>
                <div>{record.knowledgeReference.conclusion}</div>
              </div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                导入时间：{formatDate(record.knowledgeReference.importedAt)}
              </div>
            </div>
          ) : (
            <div className="text-muted">暂无知识库引用</div>
          )}
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 style={{ marginBottom: 0 }}>线上反馈工单</h2>
            {!record.feedbackTicket && record.currentStep >= 1 && (
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => setShowTicketModal(true)}
              >
                关联工单
              </button>
            )}
          </div>
          {record.feedbackTicket ? (
            <div>
              <div style={{ marginBottom: 12 }}>
                <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>工单编号</div>
                <div>{record.feedbackTicket.ticketNo}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>标题</div>
                <div>{record.feedbackTicket.title}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>内容</div>
                <div>{record.feedbackTicket.content}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>模型版本</div>
                <div>{record.feedbackTicket.modelVersion}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>结论</div>
                <div>{record.feedbackTicket.conclusion}</div>
              </div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                反馈时间：{formatDate(record.feedbackTicket.feedbackTime)}
              </div>
            </div>
          ) : (
            <div className="text-muted">暂未关联工单</div>
          )}
        </div>
      </div>

      <SelfCheckPanel results={record.selfCheckResults} />

      {record.productReviewUpdate && (
        <div className="card">
          <h2>产品复盘更新</h2>
          <div style={{ marginBottom: 12 }}>
            <div className="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>更新内容</div>
            <div>{record.productReviewUpdate.content}</div>
          </div>
          <div className="text-muted" style={{ fontSize: 12 }}>
            更新人：{record.productReviewUpdate.updatedBy} | 更新时间：{formatDate(record.productReviewUpdate.updatedAt)}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 style={{ marginBottom: 0 }}>操作记录</h2>
          {record.currentStep >= 2 && !record.productReviewUpdate && (
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setShowReviewModal(true)}
            >
              更新产品复盘
            </button>
          )}
        </div>
        <div className="timeline">
          {[...record.reviewHistory].reverse().map((item, index) => (
            <div key={index} className="timeline-item">
              <div className="timeline-time">{formatDate(item.timestamp)}</div>
              <div className="timeline-content">{item.action}</div>
              {item.comment && (
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  意见：{item.comment}
                </div>
              )}
              <div className="timeline-operator">操作人：{item.operator}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>复核操作</h2>
        <div className="flex gap-2">
          {record.status === 'pending_review' && (
            <>
              <button className="btn btn-warning" onClick={handleRequestRecheck}>
                请求重检
              </button>
              <button className="btn btn-success" onClick={handleCompleteRecheck}>
                完成复核
              </button>
            </>
          )}
          {record.status === 'pending_recheck' && (
            <button className="btn btn-success" onClick={handleCompleteRecheck}>
              完成重检
            </button>
          )}
          {record.status !== 'pending_review' && record.status !== 'pending_recheck' && (
            <div className="text-muted">当前状态无需复核操作</div>
          )}
        </div>
      </div>

      {showTicketModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="card" style={{ width: 500 }}>
            <h2>关联线上工单</h2>
            <form onSubmit={handleLinkTicket}>
              <div className="form-group">
                <label>工单编号</label>
                <input
                  type="text"
                  value={ticketForm.ticketNo}
                  onChange={e => setTicketForm({ ...ticketForm, ticketNo: e.target.value })}
                  placeholder="如：FB-2024-00124"
                  required
                />
              </div>
              <div className="form-group">
                <label>工单标题</label>
                <input
                  type="text"
                  value={ticketForm.title}
                  onChange={e => setTicketForm({ ...ticketForm, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>工单内容</label>
                <textarea
                  value={ticketForm.content}
                  onChange={e => setTicketForm({ ...ticketForm, content: e.target.value })}
                  rows={3}
                  required
                />
              </div>
              <div className="form-group">
                <label>模型版本</label>
                <select
                  value={ticketForm.modelVersion}
                  onChange={e => setTicketForm({ ...ticketForm, modelVersion: e.target.value })}
                >
                  <option value="v2.0.0">v2.0.0</option>
                  <option value="v2.1.0">v2.1.0</option>
                </select>
              </div>
              <div className="form-group">
                <label>结论</label>
                <select
                  value={ticketForm.conclusion}
                  onChange={e => setTicketForm({ ...ticketForm, conclusion: e.target.value })}
                >
                  <option value="字幕与图像一致">字幕与图像一致</option>
                  <option value="字幕与图像不一致">字幕与图像不一致</option>
                </select>
              </div>
              <div className="form-group">
                <label>操作人</label>
                <input
                  type="text"
                  value={ticketForm.operator}
                  onChange={e => setTicketForm({ ...ticketForm, operator: e.target.value })}
                />
              </div>
              <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="btn btn-default"
                  onClick={() => setShowTicketModal(false)}
                >
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  关联
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReviewModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="card" style={{ width: 500 }}>
            <h2>更新产品复盘</h2>
            <form onSubmit={handleUpdateReview}>
              <div className="form-group">
                <label>复盘内容</label>
                <textarea
                  value={reviewContent}
                  onChange={e => setReviewContent(e.target.value)}
                  placeholder="请输入产品复盘内容..."
                  rows={4}
                  required
                />
              </div>
              <div className="form-group">
                <label>操作人</label>
                <input
                  type="text"
                  value={reviewOperator}
                  onChange={e => setReviewOperator(e.target.value)}
                />
              </div>
              <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="btn btn-default"
                  onClick={() => setShowReviewModal(false)}
                >
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  更新
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckDetail;
