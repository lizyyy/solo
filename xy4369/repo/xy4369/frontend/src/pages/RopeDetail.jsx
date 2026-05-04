import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Edit2, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { ropeApi, reviewApi } from '../services/api';
import RiskBadge from '../components/RiskBadge';
import Modal from '../components/Modal';
import { 
  formatDate, 
  formatNumber, 
  getTimelineItemClass,
  getEffectiveRiskLevel,
  RISK_LEVELS,
  RISK_LABELS
} from '../utils/helpers';

const RopeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assessing, setAssessing] = useState(false);
  const [rope, setRope] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [riskLevels, setRiskLevels] = useState({ risk_levels: [], decision_types: [] });
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    new_risk_level: '',
    decision_type: '',
    reviewer_name: '',
    review_notes: '',
    is_scrapped: false
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ropeResponse, timelineResponse, riskLevelsResponse] = await Promise.all([
        ropeApi.getById(id),
        ropeApi.getTimeline(id),
        reviewApi.getRiskLevels()
      ]);
      
      setRope(ropeResponse.data.data);
      setTimeline(timelineResponse.data.data);
      setRiskLevels(riskLevelsResponse.data.data);
    } catch (error) {
      toast.error('加载数据失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleAssess = async () => {
    setAssessing(true);
    try {
      await ropeApi.assess(id);
      toast.success('风险评估完成');
      await fetchData();
    } catch (error) {
      toast.error('评估失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setAssessing(false);
    }
  };

  const handleOpenReview = (assessment) => {
    setSelectedAssessment(assessment);
    setReviewForm({
      new_risk_level: assessment.effective_risk_level || assessment.overall_risk_level,
      decision_type: 'confirm',
      reviewer_name: '',
      review_notes: '',
      is_scrapped: false
    });
    setShowReviewModal(true);
  };

  const handleSubmitReview = async () => {
    if (!reviewForm.new_risk_level || !reviewForm.decision_type) {
      toast.error('请选择风险等级和复核类型');
      return;
    }

    try {
      await reviewApi.createDecision({
        assessment_id: selectedAssessment.id,
        new_risk_level: reviewForm.new_risk_level,
        decision_type: reviewForm.decision_type,
        reviewer_name: reviewForm.reviewer_name,
        review_notes: reviewForm.review_notes,
        is_scrapped: reviewForm.is_scrapped
      });
      
      toast.success('复核记录已保存');
      setShowReviewModal(false);
      await fetchData();
    } catch (error) {
      toast.error('保存失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const renderRiskFactors = (assessment) => {
    if (!assessment.risk_factors || assessment.risk_factors.length === 0) {
      return null;
    }

    return (
      <div className="risk-factors">
        {assessment.risk_factors.map((factor, index) => (
          <RiskBadge key={index} level={factor.level}>
            {factor.label}: {factor.value}{factor.unit}
          </RiskBadge>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div>
        <div className="header">
          <h2>绳索详情</h2>
        </div>
        <div className="page-content">
          <div className="empty-state">
            <div className="spinner" style={{ margin: '0 auto', width: '2rem', height: '2rem' }} />
            <p className="mt-4">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!rope) {
    return (
      <div>
        <div className="header">
          <h2>绳索详情</h2>
        </div>
        <div className="page-content">
          <div className="empty-state">
            <AlertTriangle size={48} />
            <p className="mt-4">绳索不存在</p>
            <button
              className="btn btn-primary mt-4"
              onClick={() => navigate('/ropes')}
            >
              返回列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  const latestAssessment = timeline[0];

  return (
    <div>
      <div className="header">
        <div className="flex items-center gap-4">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => navigate('/ropes')}
          >
            <ArrowLeft size={16} />
            返回
          </button>
          <h2>绳索详情: {rope.rope_number}</h2>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-outline"
            onClick={fetchData}
          >
            <RefreshCw size={16} />
            刷新
          </button>
          <button
            className="btn btn-primary"
            onClick={handleAssess}
            disabled={assessing}
          >
            {assessing ? <RefreshCw size={16} className="spinner" /> : <RefreshCw size={16} />}
            风险评估
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="rope-detail-header">
            <div>
              <h3 className="text-xl font-semibold mb-2">{rope.rope_number}</h3>
              <p className="text-secondary">
                {rope.brand || '-'} / {rope.model || '-'}
              </p>
            </div>
            {latestAssessment && (
              <div className="text-right">
                <RiskBadge 
                  level={getEffectiveRiskLevel({ latest_assessment: latestAssessment })} 
                />
                <p className="text-sm text-secondary mt-1">
                  评估日期: {formatDate(latestAssessment.assessment_date)}
                </p>
                {latestAssessment.review_decision && (
                  <p className="text-sm text-secondary">
                    已复核 · 复核人: {latestAssessment.review_decision.reviewer_name || '-'}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="rope-info-grid">
            <div className="rope-info-item">
              <div className="label">品牌</div>
              <div className="value">{rope.brand || '-'}</div>
            </div>
            <div className="rope-info-item">
              <div className="label">型号</div>
              <div className="value">{rope.model || '-'}</div>
            </div>
            <div className="rope-info-item">
              <div className="label">购买日期</div>
              <div className="value">{formatDate(rope.purchase_date)}</div>
            </div>
            <div className="rope-info-item">
              <div className="label">长度</div>
              <div className="value">{rope.length_m ? `${rope.length_m}m` : '-'}</div>
            </div>
            <div className="rope-info-item">
              <div className="label">直径</div>
              <div className="value">{rope.diameter_mm ? `${rope.diameter_mm}mm` : '-'}</div>
            </div>
            <div className="rope-info-item">
              <div className="label">状态</div>
              <div className="value">
                <span className={`badge ${rope.status === 'scrapped' ? 'badge-danger' : 'badge-success'}`}>
                  {rope.status === 'scrapped' ? '已报废' : '使用中'}
                </span>
              </div>
            </div>
          </div>

          {latestAssessment && (
            <div className="mt-4">
              <div className="review-section">
                <h4>最新评估详情</h4>
                <div className="rope-info-grid">
                  <div className="rope-info-item">
                    <div className="label">累计冲坠能量</div>
                    <div className="value">{formatNumber(latestAssessment.total_energy_kj)} kJ</div>
                  </div>
                  <div className="rope-info-item">
                    <div className="label">使用天数</div>
                    <div className="value">{latestAssessment.service_days || 0} 天</div>
                  </div>
                  <div className="rope-info-item">
                    <div className="label">当前磨损等级</div>
                    <div className="value">{latestAssessment.current_wear_level || 0} 级</div>
                  </div>
                  <div className="rope-info-item">
                    <div className="label">最大日使用次数</div>
                    <div className="value">{latestAssessment.max_daily_uses || 0} 次</div>
                  </div>
                </div>
                
                {renderRiskFactors(latestAssessment)}

                <div className="mt-4 flex gap-2">
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleOpenReview(latestAssessment)}
                  >
                    <Edit2 size={16} />
                    人工复核
                  </button>
                </div>

                {latestAssessment.review_decision && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h5 className="font-medium mb-2">复核记录</h5>
                    <div className="text-sm">
                      <p>
                        原风险等级: <RiskBadge level={latestAssessment.review_decision.original_risk_level} />
                        {' → '}
                        新风险等级: <RiskBadge level={latestAssessment.review_decision.new_risk_level} />
                      </p>
                      <p className="mt-1">
                        复核类型: {riskLevels.decision_types?.find(t => t.value === latestAssessment.review_decision.decision_type)?.label || latestAssessment.review_decision.decision_type}
                      </p>
                      {latestAssessment.review_decision.reviewer_name && (
                        <p className="mt-1">复核人: {latestAssessment.review_decision.reviewer_name}</p>
                      )}
                      {latestAssessment.review_decision.review_notes && (
                        <p className="mt-1">备注: {latestAssessment.review_decision.review_notes}</p>
                      )}
                      <p className="mt-1 text-secondary">
                        复核日期: {formatDate(latestAssessment.review_decision.review_date)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>风险时间线</h3>
          </div>
          
          {timeline.length === 0 ? (
            <div className="empty-state">
              <CheckCircle size={48} />
              <p className="mt-4">暂无风险评估记录</p>
              <button
                className="btn btn-primary mt-4"
                onClick={handleAssess}
                disabled={assessing}
              >
                开始评估
              </button>
            </div>
          ) : (
            <div className="timeline">
              {timeline.map((item, index) => (
                <div 
                  key={item.id || index} 
                  className={`timeline-item ${getTimelineItemClass(item.effective_risk_level || item.overall_risk_level)}`}
                >
                  <div className="timeline-date">
                    {formatDate(item.assessment_date)}
                  </div>
                  <div className="timeline-content">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4>风险评估</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm">
                            系统评估: <RiskBadge level={item.overall_risk_level} />
                          </span>
                          {item.review_decision && (
                            <>
                              <span className="text-secondary">→</span>
                              <span className="text-sm">
                                复核后: <RiskBadge level={item.effective_risk_level} />
                              </span>
                              <span className="badge badge-info">已复核</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleOpenReview(item)}
                      >
                        <Edit2 size={14} />
                        复核
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                      <div>
                        <span className="text-secondary">累计能量:</span>
                        <span className="ml-1 font-medium">{formatNumber(item.total_energy_kj)} kJ</span>
                      </div>
                      <div>
                        <span className="text-secondary">使用天数:</span>
                        <span className="ml-1 font-medium">{item.service_days || 0} 天</span>
                      </div>
                      <div>
                        <span className="text-secondary">磨损等级:</span>
                        <span className="ml-1 font-medium">{item.current_wear_level || 0}</span>
                      </div>
                    </div>
                    
                    {renderRiskFactors(item)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title="人工复核"
        footer={
          <div className="flex gap-2">
            <button
              className="btn btn-outline"
              onClick={() => setShowReviewModal(false)}
            >
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmitReview}
            >
              保存
            </button>
          </div>
        }
      >
        <div className="form-group">
          <label>原风险等级</label>
          <div className="p-3 bg-gray-50 rounded">
            <RiskBadge level={selectedAssessment?.overall_risk_level} />
          </div>
        </div>

        <div className="form-group">
          <label>新风险等级 *</label>
          <select
            value={reviewForm.new_risk_level}
            onChange={(e) => setReviewForm(f => ({ ...f, new_risk_level: e.target.value }))}
          >
            <option value="">请选择</option>
            {riskLevels.risk_levels?.map(level => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>复核类型 *</label>
          <select
            value={reviewForm.decision_type}
            onChange={(e) => {
              const value = e.target.value;
              setReviewForm(f => ({ 
                ...f, 
                decision_type: value,
                is_scrapped: value === 'scrap'
              }));
            }}
          >
            <option value="">请选择</option>
            {riskLevels.decision_types?.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>复核人</label>
          <input
            type="text"
            value={reviewForm.reviewer_name}
            onChange={(e) => setReviewForm(f => ({ ...f, reviewer_name: e.target.value }))}
            placeholder="请输入复核人姓名"
          />
        </div>

        <div className="form-group">
          <label>复核备注</label>
          <textarea
            value={reviewForm.review_notes}
            onChange={(e) => setReviewForm(f => ({ ...f, review_notes: e.target.value }))}
            placeholder="请输入复核备注（可选）"
          />
        </div>

        {reviewForm.is_scrapped && (
          <div className="alert alert-danger">
            <Trash2 size={16} className="inline mr-2" />
            选择"判定报废"后，该绳索将被标记为已报废状态，无法继续使用。
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RopeDetail;
