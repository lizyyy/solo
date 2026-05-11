import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useParams, useNavigate } from 'react-router-dom';

const SubmissionDetail = ({ currentAssistant }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await api.getSubmissionDetail(id);
        setSubmission(data);
        if (data.gradingRecords.length > 0) {
          const latest = data.gradingRecords[data.gradingRecords.length - 1];
          setScore(latest.score);
          setFeedback(latest.feedback);
        }
      } catch (error) {
        console.error('获取数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleAction = async (status) => {
    try {
      if (!score || score === '') {
        throw new Error('请输入分数');
      }
      
      const scoreNum = parseFloat(score);
      if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > submission.assignment.totalScore) {
        throw new Error(`分数必须在0到${submission.assignment.totalScore}之间`);
      }

      await api.submitGrading({
        submissionId: id,
        assistantId: currentAssistant.id,
        score: scoreNum,
        feedback: feedback || '',
        status
      });

      setMessage({ 
        type: 'success', 
        text: status === 'published' ? '成绩已发布' : 
              status === 'returned' ? '已退回重交' : 
              status === 'regraded' ? '复批完成' : '批改完成'
      });

      const data = await api.getSubmissionDetail(id);
      setSubmission(data);
    } catch (error) {
      setMessage({ type: 'danger', text: error.message });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleResubmit = async () => {
    const newContent = prompt('请输入修改后的作业内容：', submission.content);
    if (newContent === null) return;
    
    try {
      await api.resubmit(id, newContent);
      setMessage({ type: 'success', text: '重交成功' });
      const data = await api.getSubmissionDetail(id);
      setSubmission(data);
    } catch (error) {
      setMessage({ type: 'danger', text: error.message });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const statusLabels = {
    submitted: '已提交',
    assigned: '已分配',
    graded: '已批改',
    returned: '已退回',
    resubmitted: '已重交',
    regraded: '已复批'
  };

  const typeLabels = {
    programming: '编程作业',
    essay: '作文',
    quiz: '测验'
  };

  const canGrade = submission && (
    submission.status === 'assigned' ||
    submission.status === 'resubmitted' ||
    submission.status === 'regraded'
  ) && submission.assignedAssistantId === currentAssistant.id;

  const canRegrade = submission && 
    submission.status === 'resubmitted' && 
    submission.assignedAssistantId === currentAssistant.id;

  const canResubmit = submission && submission.status === 'returned';

  const latestRecord = submission?.gradingRecords?.length > 0 
    ? submission.gradingRecords[submission.gradingRecords.length - 1]
    : null;

  if (loading) {
    return <div className="empty-state"><div className="icon">⏳</div><p>加载中...</p></div>;
  }

  if (!submission) {
    return <div className="empty-state"><div className="icon">❌</div><p>提交不存在</p></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          📝 {submission.assignment?.name}
        </h1>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          ← 返回
        </button>
      </div>

      {message && (
        <div className={`alert-box ${message.type}`}>
          <div className="alert-icon">{message.type === 'success' ? '✅' : '❌'}</div>
          <div className="alert-content">
            <div className="title">{message.type === 'success' ? '成功' : '错误'}</div>
            <p>{message.text}</p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>基本信息</h2>
          <span className={`status-badge status-${submission.status}`}>
            {statusLabels[submission.status]}
          </span>
        </div>
        <div className="card-body">
          <div className="detail-grid">
            <div className="detail-item">
              <label>学生</label>
              <div className="value">{submission.student?.name}</div>
            </div>
            <div className="detail-item">
              <label>学号</label>
              <div className="value">{submission.student?.studentId}</div>
            </div>
            <div className="detail-item">
              <label>课程</label>
              <div className="value">{submission.course?.name}</div>
            </div>
            <div className="detail-item">
              <label>作业类型</label>
              <div className="value">
                <span className={`type-badge type-${submission.assignment?.type}`}>
                  {typeLabels[submission.assignment?.type]}
                </span>
              </div>
            </div>
            <div className="detail-item">
              <label>分配给</label>
              <div className="value">{submission.assistant?.name || '-'}</div>
            </div>
            <div className="detail-item">
              <label>提交时间</label>
              <div className="value">{new Date(submission.submittedAt).toLocaleString('zh-CN')}</div>
            </div>
            <div className="detail-item">
              <label>重交次数</label>
              <div className="value">{submission.retryCount || 0}</div>
            </div>
            <div className="detail-item">
              <label>最终分数</label>
              <div className="value" style={{ fontWeight: '700', color: '#667eea' }}>
                {submission.finalScore !== undefined 
                  ? `${submission.finalScore}/${submission.assignment?.totalScore}`
                  : '-'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>作业内容</h2>
          <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            满分: {submission.assignment?.totalScore}
          </span>
        </div>
        <div className="card-body">
          {submission.assignment?.description && (
            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f0f4ff', borderRadius: '8px' }}>
              <strong>📋 作业要求：</strong>
              <p style={{ marginTop: '0.5rem', color: '#374151' }}>{submission.assignment.description}</p>
            </div>
          )}
          <div className={`content-box ${submission.assignment?.type === 'essay' ? 'essay-content' : ''}`}>
            {submission.content}
          </div>
        </div>
      </div>

      {(canGrade || (latestRecord && latestRecord.status === 'published')) && (
        <div className="card">
          <div className="card-header">
            <h2>{canGrade ? '✏️ 批改' : '📄 批改结果'}</h2>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>分数</label>
              <div className="score-input">
                <input 
                  type="number" 
                  min="0" 
                  max={submission.assignment?.totalScore}
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  disabled={!canGrade}
                  placeholder="输入分数"
                />
                <span className="total">/ {submission.assignment?.totalScore}</span>
              </div>
            </div>
            <div className="form-group">
              <label>评语/反馈</label>
              <textarea 
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                disabled={!canGrade}
                placeholder={canRegrade 
                  ? '请输入复批评语...' 
                  : '请输入批改评语...'}
              />
            </div>
            
            {canGrade && (
              <div className="action-buttons">
                {canRegrade && (
                  <>
                    <button 
                      className="btn btn-success"
                      onClick={() => handleAction('regraded')}
                    >
                      🔄 复批调分
                    </button>
                    <button 
                      className="btn btn-primary"
                      onClick={() => handleAction('published')}
                    >
                      📤 发布成绩
                    </button>
                  </>
                )}
                {!canRegrade && (
                  <>
                    <button 
                      className="btn btn-success"
                      onClick={() => handleAction('published')}
                    >
                      📤 发布成绩
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={() => handleAction('returned')}
                    >
                      🔙 退回重交
                    </button>
                  </>
                )}
              </div>
            )}

            {!canGrade && latestRecord && latestRecord.status === 'published' && (
              <div className="alert-box success">
                <div className="alert-icon">✅</div>
                <div className="alert-content">
                  <div className="title">成绩已发布</div>
                  <p>该作业成绩已发布，不可再次修改。</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {canResubmit && (
        <div className="alert-box">
          <div className="alert-icon">📝</div>
          <div className="alert-content">
            <div className="title">作业被退回</div>
            <p style={{ marginBottom: '0.75rem' }}>
              <strong>退回原因：</strong>{submission.returnReason}
            </p>
            <button className="btn btn-warning btn-sm" onClick={handleResubmit}>
              🔄 模拟学生重交
            </button>
          </div>
        </div>
      )}

      {submission.gradeHistory?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>📜 批改历史（老师可见）</h2>
          </div>
          <div className="card-body">
            <div className="history-timeline">
              {submission.gradeHistory.map((history, index) => {
                const scoreDiff = history.newScore - history.previousScore;
                const scoreClass = scoreDiff > 0 ? 'score-up' : scoreDiff < 0 ? 'score-down' : 'score-same';
                
                return (
                  <div key={index} className="history-item">
                    <div className="meta">
                      {new Date(history.changedAt).toLocaleString('zh-CN')} · {history.changedByName}
                    </div>
                    <div className="score-change">
                      <span>{history.reason}</span>
                      <span className={scoreClass}>
                        {history.previousScore} → {history.newScore}
                        {scoreDiff > 0 ? ` (+${scoreDiff})` : scoreDiff < 0 ? ` (${scoreDiff})` : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmissionDetail;
