import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { useQuestions, useReview } from '../../context/AppContext';
import { subjectColors } from '../../data/mockData';
import { getEbbinghausIntervals, formatInterval, isReviewDue } from '../../utils/reviewAlgorithm';
import './ReviewPlan.css';

export const ReviewPlan: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { questions } = useQuestions();
  const { reviewRecords, reviewSettings, updateReviewSettings, getDueQuestions, getReviewRecordByQuestionId } = useReview();

  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const shouldShowSettings = searchParams.get('showSettings') === 'true';
    if (shouldShowSettings) {
      setShowSettings(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [customIntervals, setCustomIntervals] = useState<number[]>(
    reviewSettings.customIntervals || []
  );

  const stats = useMemo(() => {
    const total = questions.length;
    const reviewed = reviewRecords.length;
    const due = getDueQuestions().length;
    const mastered = reviewRecords.filter(r => 
      r.familiarity === '认识' && r.reviewCount >= 3 && !isReviewDue(r.nextReviewDate)
    ).length;

    return { total, reviewed, due, mastered };
  }, [questions, reviewRecords, getDueQuestions]);

  const handleStatClick = (filter: 'all' | 'reviewed' | 'due' | 'mastered') => {
    navigate(`/?filter=${filter}`);
  };

  const dueQuestions = useMemo(() => {
    const due = getDueQuestions();
    return due.slice(0, 10).map(q => {
      const record = getReviewRecordByQuestionId(q.id);
      const daysOverdue = record ? Math.max(0, differenceInDays(new Date(), new Date(record.nextReviewDate))) : 0;
      return {
        ...q,
        record,
        daysOverdue,
        urgent: daysOverdue > 3
      };
    });
  }, [getDueQuestions, getReviewRecordByQuestionId]);

  const currentIntervals = useMemo(() => {
    return reviewSettings.algorithm === 'ebbinghaus'
      ? getEbbinghausIntervals()
      : customIntervals;
  }, [reviewSettings.algorithm, customIntervals]);

  const handleAlgorithmChange = (algorithm: 'ebbinghaus' | 'custom') => {
    updateReviewSettings({ algorithm });
  };

  const handleIntervalChange = (index: number, value: string) => {
    const newIntervals = [...customIntervals];
    newIntervals[index] = Math.max(1, parseInt(value) || 1);
    setCustomIntervals(newIntervals);
  };

  const handleAddInterval = () => {
    setCustomIntervals([...customIntervals, 1]);
  };

  const handleSaveCustomIntervals = () => {
    updateReviewSettings({ customIntervals });
  };

  const handleReviewQuestion = (questionId: string) => {
    navigate(`/question/${questionId}`);
  };

  const renderQuestionContent = (content: string) => {
    return content.length > 80 ? content.substring(0, 80) + '...' : content;
  };

  const progress = stats.total > 0 ? Math.round((stats.reviewed / stats.total) * 100) : 0;

  return (
    <div className="review-plan">
      <div className="page-header">
        <h1 className="page-title">复习计划</h1>
        <p className="page-subtitle">基于艾宾浩斯记忆曲线的智能复习系统</p>
      </div>

      <div className="stats-cards">
        <div className="stat-card clickable" onClick={() => handleStatClick('all')}>
          <div className="stat-icon total">📚</div>
          <div className="stat-info">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">总题目数</span>
          </div>
        </div>
        <div className="stat-card clickable" onClick={() => handleStatClick('reviewed')}>
          <div className="stat-icon reviewed">✅</div>
          <div className="stat-info">
            <span className="stat-value">{stats.reviewed}</span>
            <span className="stat-label">已复习</span>
          </div>
        </div>
        <div className="stat-card clickable" onClick={() => handleStatClick('due')}>
          <div className="stat-icon due">⏰</div>
          <div className="stat-info">
            <span className="stat-value">{stats.due}</span>
            <span className="stat-label">待复习</span>
          </div>
        </div>
        <div className="stat-card clickable" onClick={() => handleStatClick('mastered')}>
          <div className="stat-icon mastered">🏆</div>
          <div className="stat-info">
            <span className="stat-value">{stats.mastered}</span>
            <span className="stat-label">已掌握</span>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="progress-section">
          <div className="settings-header">
            <span className="settings-title">复习进度</span>
          </div>
          <div className="progress-container">
            <div className="progress-label">
              <span>总体进度</span>
              <span>{progress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2 className="section-title">待复习题目</h2>
          {dueQuestions.length > 0 && (
            <span className="section-action" onClick={() => navigate('/')}>
              <span>📚</span>
              <span>查看全部</span>
            </span>
          )}
        </div>

        {dueQuestions.length === 0 ? (
          <div className="empty-review">
            <div className="empty-review-icon">🎉</div>
            <div className="empty-review-text">太棒了！所有题目都已掌握，没有待复习的内容</div>
          </div>
        ) : (
          <div className="due-list">
            {dueQuestions.map((question) => (
              <div
                key={question.id}
                className={`due-item ${question.urgent ? 'urgent' : ''}`}
                onClick={() => handleReviewQuestion(question.id)}
              >
                <div className="due-info">
                  <div className="due-content">
                    {renderQuestionContent(question.content)}
                  </div>
                  <div className="due-meta">
                    <span
                      className="due-subject"
                      style={{ background: subjectColors[question.subject] }}
                    >
                      {question.subject}
                    </span>
                    {question.daysOverdue > 0 && (
                      <span className="due-time">
                        已逾期 {question.daysOverdue} 天
                      </span>
                    )}
                  </div>
                </div>
                <button className="due-action">开始复习</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-header">
          <h2 className="section-title">复习算法</h2>
          <span className="section-action" onClick={() => setShowSettings(!showSettings)}>
            <span>⚙️</span>
            <span>{showSettings ? '收起设置' : '设置'}</span>
          </span>
        </div>

        <div className="algorithm-card">
          <div className="algorithm-header">
            <div className="algorithm-info">
              <div className="algorithm-icon">🧠</div>
              <div className="algorithm-details">
                <span className="algorithm-name">
                  {reviewSettings.algorithm === 'ebbinghaus' 
                    ? '艾宾浩斯记忆曲线' 
                    : '自定义复习间隔'}
                </span>
                <span className="algorithm-desc">
                  {reviewSettings.algorithm === 'ebbinghaus'
                    ? '基于科学研究的遗忘曲线，自动安排复习计划'
                    : '根据自己的学习节奏自定义复习间隔'}
                </span>
              </div>
            </div>
            <span className="algorithm-type">
              {reviewSettings.algorithm === 'ebbinghaus' ? '推荐' : '自定义'}
            </span>
          </div>

          <div className="intervals-display">
            {currentIntervals.map((interval, index) => (
              <div key={index} className="interval-item">
                <span className="interval-number">{formatInterval(interval)}</span>
                <span className="interval-label">第{index + 1}次</span>
              </div>
            ))}
          </div>

          {reviewSettings.algorithm === 'ebbinghaus' && (
            <div className="algorithm-description">
              <p>
                <strong>艾宾浩斯记忆曲线</strong>是由德国心理学家赫尔曼·艾宾浩斯研究发现的，
                描述了人类大脑对新事物遗忘的规律。这个算法根据记忆的遗忘规律，
                在关键节点安排复习，帮助你将知识从短期记忆转化为长期记忆。
              </p>
            </div>
          )}
        </div>

        {showSettings && (
          <div className="settings-section">
            <div className="settings-header">
              <span className="settings-title">复习算法选择</span>
            </div>
            <div className="settings-toggle">
              <button
                className={`toggle-btn ${reviewSettings.algorithm === 'ebbinghaus' ? 'active' : ''}`}
                onClick={() => handleAlgorithmChange('ebbinghaus')}
              >
                艾宾浩斯记忆曲线
              </button>
              <button
                className={`toggle-btn ${reviewSettings.algorithm === 'custom' ? 'active' : ''}`}
                onClick={() => handleAlgorithmChange('custom')}
              >
                自定义间隔
              </button>
            </div>

            {reviewSettings.algorithm === 'custom' && (
              <div className="custom-intervals">
                <span className="custom-intervals-label">设置复习间隔（天）</span>
                <div className="intervals-inputs">
                  {customIntervals.map((interval, index) => (
                    <div key={index} className="interval-input-group">
                      <span className="interval-input-label">第{index + 1}次</span>
                      <input
                        type="number"
                        className="interval-input"
                        value={interval}
                        onChange={(e) => handleIntervalChange(index, e.target.value)}
                        min="1"
                      />
                    </div>
                  ))}
                </div>
                <div className="settings-toggle">
                  <button className="add-interval-btn" onClick={handleAddInterval}>
                    + 添加间隔
                  </button>
                  <button className="btn btn-primary" onClick={handleSaveCustomIntervals}>
                    保存设置
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
