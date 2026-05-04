import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import Visualization3D from '../components/Visualization3D';

const issueTypeLabels = {
  'fan_direction_abnormal': '风机方向异常',
  'concentration_exceeded': '浓度超阈值',
  'exit_blocked': '出口被烟雾遮挡',
  'sensor_offline': '传感器离线'
};

const severityLabels = {
  'critical': '严重',
  'high': '高',
  'medium': '中',
  'low': '低'
};

function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const {
    currentSession,
    identifiedIssues,
    reviewNotes,
    summary,
    geojsonData,
    fanWindowData,
    sensorData,
    currentTime,
    isPlaying,
    playSpeed,
    loadSession,
    refreshSession,
    addReviewNote,
    updateReviewNote,
    resolveIssue,
    setCurrentTime,
    setIsPlaying,
    setPlaySpeed,
    setSelectedIssue,
    selectedIssue
  } = useStore();

  const [activeTab, setActiveTab] = useState('issues');
  const [isLoading, setIsLoading] = useState(true);
  const [showIssueDetail, setShowIssueDetail] = useState(null);
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteAuthor, setNewNoteAuthor] = useState('');
  const [showResolveDialog, setShowResolveDialog] = useState(null);
  const [resolveContent, setResolveContent] = useState('');
  const [resolveAuthor, setResolveAuthor] = useState('');
  
  const animationRef = useRef();
  const lastTimeRef = useRef(Date.now());

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await loadSession(id);
      setIsLoading(false);
    };
    
    if (id) {
      load();
    }
    
    return () => {
      setIsPlaying(false);
    };
  }, [id, loadSession]);

  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        const now = Date.now();
        const delta = (now - lastTimeRef.current) / 1000;
        lastTimeRef.current = now;
        
        setCurrentTime(prev => {
          const next = prev + delta * playSpeed * 0.1;
          return next > 1 ? 0 : next;
        });
        
        animationRef.current = requestAnimationFrame(animate);
      };
      
      lastTimeRef.current = Date.now();
      animationRef.current = requestAnimationFrame(animate);
      
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [isPlaying, playSpeed, setCurrentTime]);

  const formatTime = (time) => {
    if (!sensorData || !sensorData.readings) return '00:00';
    
    const totalDuration = sensorData.duration || 60;
    const currentSeconds = Math.floor(time * totalDuration);
    const minutes = Math.floor(currentSeconds / 60);
    const seconds = currentSeconds % 60;
    
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handleExportMarkdown = () => {
    window.open(`/api/export/${id}/markdown`, '_blank');
  };

  const handleExportJson = () => {
    window.open(`/api/export/${id}/json`, '_blank');
  };

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;
    
    try {
      await addReviewNote(id, {
        content: newNoteContent,
        reviewed_by: newNoteAuthor || '匿名',
        note_type: 'general'
      });
      setNewNoteContent('');
      setNewNoteAuthor('');
      setShowAddNote(false);
    } catch (error) {
      alert('添加备注失败: ' + error.message);
    }
  };

  const handleResolveIssue = async () => {
    if (!showResolveDialog) return;
    
    try {
      await resolveIssue(id, showResolveDialog.id, resolveContent, resolveAuthor || '匿名');
      setResolveContent('');
      setResolveAuthor('');
      setShowResolveDialog(null);
      await refreshSession();
    } catch (error) {
      alert('标记解决失败: ' + error.message);
    }
  };

  const toggleResolve = (note) => {
    updateReviewNote(note.id, {
      is_resolved: !note.is_resolved
    });
  };

  const threshold = sensorData?.threshold || 100;

  if (isLoading) {
    return (
      <div className="session-detail">
        <div className="loading-container" style={{ flex: 1 }}>
          <div className="loading-spinner"></div>
          <p>加载训练数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="session-detail">
      <div className="detail-sidebar">
        <div className="sidebar-header">
          <h2>{currentSession?.name || '训练详情'}</h2>
          <p>{currentSession?.description || ''}</p>
        </div>

        <div className="sidebar-tabs">
          <div 
            className={`sidebar-tab ${activeTab === 'issues' ? 'active' : ''}`}
            onClick={() => setActiveTab('issues')}
          >
            问题 ({identifiedIssues.length})
          </div>
          <div 
            className={`sidebar-tab ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            备注 ({reviewNotes.length})
          </div>
        </div>

        <div className="sidebar-content">
          {activeTab === 'issues' && (
            <>
              {summary && (
                <div className="risk-summary">
                  <div className="risk-summary-header">
                    <div className="risk-level">
                      <div className={`risk-indicator ${summary.issues?.bySeverity?.critical > 0 ? 'critical' : 
                                            summary.issues?.bySeverity?.high > 0 ? 'high' : 
                                            summary.issues?.bySeverity?.medium > 0 ? 'medium' : 'low'}`}></div>
                      <span>风险概览</span>
                    </div>
                    <div className="risk-score">{summary.issues?.total || 0} 个问题</div>
                  </div>
                  <div className="risk-breakdown">
                    <div className="risk-breakdown-item">
                      <span>严重</span>
                      <span className="risk-breakdown-count" style={{ color: 'var(--danger)' }}>
                        {summary.issues?.bySeverity?.critical || 0}
                      </span>
                    </div>
                    <div className="risk-breakdown-item">
                      <span>高</span>
                      <span className="risk-breakdown-count" style={{ color: 'var(--warning)' }}>
                        {summary.issues?.bySeverity?.high || 0}
                      </span>
                    </div>
                    <div className="risk-breakdown-item">
                      <span>中</span>
                      <span className="risk-breakdown-count" style={{ color: 'var(--info)' }}>
                        {summary.issues?.bySeverity?.medium || 0}
                      </span>
                    </div>
                    <div className="risk-breakdown-item">
                      <span>低</span>
                      <span className="risk-breakdown-count" style={{ color: 'var(--success)' }}>
                        {summary.issues?.bySeverity?.low || 0}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {identifiedIssues.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">✅</div>
                  <h3>暂无识别到的问题</h3>
                  <p>系统分析后未发现明显问题</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {identifiedIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className={`issue-item ${selectedIssue?.id === issue.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedIssue(issue);
                        setShowIssueDetail(issue);
                      }}
                    >
                      <div className="issue-header">
                        <span className={`issue-type ${issue.issue_type}`}>
                          {issueTypeLabels[issue.issue_type] || issue.issue_type}
                        </span>
                        <span className={`severity-badge severity-${issue.severity}`}>
                          {severityLabels[issue.severity] || issue.severity}
                        </span>
                      </div>
                      <div className="issue-description">{issue.description}</div>
                      {issue.location && (
                        <div className="issue-meta">位置: {issue.location}</div>
                      )}
                      {issue.timestamp && (
                        <div className="issue-meta">时间: {issue.timestamp}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'notes' && (
            <>
              <button 
                className="btn btn-primary btn-small" 
                style={{ marginBottom: 16, width: '100%' }}
                onClick={() => setShowAddNote(true)}
              >
                + 添加备注
              </button>

              {reviewNotes.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📝</div>
                  <h3>暂无复核备注</h3>
                  <p>点击上方按钮添加备注</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {reviewNotes.map((note) => (
                    <div key={note.id} className="note-item">
                      <div className="note-header">
                        <span className="note-author">{note.reviewed_by || '匿名'}</span>
                        <span className="note-time">
                          {new Date(note.reviewed_at).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <div className="note-content">{note.content}</div>
                      {note.resolution && (
                        <div className="note-resolved">✓ {note.resolution}</div>
                      )}
                      <div className="note-actions">
                        <button
                          className={`btn btn-small ${note.is_resolved ? 'btn-secondary' : 'btn-primary'}`}
                          onClick={() => toggleResolve(note)}
                        >
                          {note.is_resolved ? '标记未解决' : '标记已解决'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="detail-main">
        <div className="detail-toolbar">
          <div className="toolbar-left">
            <button className="btn btn-secondary" onClick={() => navigate('/')}>
              ← 返回列表
            </button>
            <button className="btn btn-secondary" onClick={refreshSession}>
              🔄 刷新
            </button>
          </div>
          <div className="toolbar-right">
            <button className="btn btn-secondary" onClick={handleExportMarkdown}>
              📄 导出 Markdown
            </button>
            <button className="btn btn-secondary" onClick={handleExportJson}>
              📦 导出 JSON 审计包
            </button>
          </div>
        </div>

        <div className="visualization-container">
          <Visualization3D
            geojsonData={geojsonData}
            fanWindowData={fanWindowData}
            sensorData={sensorData}
            currentTime={currentTime}
            threshold={threshold}
          />
        </div>

        <div className="timeline-container">
          <div className="timeline-header">
            <div className="timeline-controls">
              <button
                className="play-btn"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <span className="time-display">
                {formatTime(currentTime)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>速度:</span>
              {[0.5, 1, 2, 4].map((speed) => (
                <button
                  key={speed}
                  className={`btn btn-small ${playSpeed === speed ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPlaySpeed(speed)}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
          
          <div 
            className="timeline-track"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const progress = x / rect.width;
              setCurrentTime(Math.max(0, Math.min(1, progress)));
            }}
          >
            <div 
              className="timeline-progress"
              style={{ width: `${currentTime * 100}%` }}
            />
            <div className="timeline-markers">
              {identifiedIssues
                .filter(i => i.timestamp)
                .map((issue, index) => {
                  const time = parseTimestamp(issue.timestamp);
                  const position = time * 100;
                  return (
                    <div
                      key={index}
                      className={`timeline-marker ${
                        issue.severity === 'critical' ? 'timeline-marker-critical' :
                        issue.severity === 'high' ? 'timeline-marker-high' : ''
                      }`}
                      style={{ left: `${position}%` }}
                      title={issue.description}
                    />
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {showIssueDetail && (
        <div className="modal-overlay" onClick={() => {
          setShowIssueDetail(null);
          setSelectedIssue(null);
        }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>问题详情</h3>
              <button 
                className="modal-close"
                onClick={() => {
                  setShowIssueDetail(null);
                  setSelectedIssue(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="issue-detail-content">
                <div className="issue-detail-row">
                  <label>问题类型</label>
                  <value>{issueTypeLabels[showIssueDetail.issue_type] || showIssueDetail.issue_type}</value>
                </div>
                <div className="issue-detail-row">
                  <label>严重程度</label>
                  <value>
                    <span className={`severity-badge severity-${showIssueDetail.severity}`}>
                      {severityLabels[showIssueDetail.severity] || showIssueDetail.severity}
                    </span>
                  </value>
                </div>
                <div className="issue-detail-row">
                  <label>描述</label>
                  <value>{showIssueDetail.description}</value>
                </div>
                {showIssueDetail.location && (
                  <div className="issue-detail-row">
                    <label>位置</label>
                    <value>{showIssueDetail.location}</value>
                  </div>
                )}
                {showIssueDetail.timestamp && (
                  <div className="issue-detail-row">
                    <label>时间</label>
                    <value>{showIssueDetail.timestamp}</value>
                  </div>
                )}
                {showIssueDetail.details && (
                  <div className="issue-detail-row">
                    <label>详细信息</label>
                    <div className="issue-detail-json">
                      {JSON.stringify(showIssueDetail.details, null, 2)}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowIssueDetail(null);
                  setSelectedIssue(null);
                }}
              >
                关闭
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowResolveDialog(showIssueDetail);
                }}
              >
                标记已复核
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddNote && (
        <div className="modal-overlay" onClick={() => setShowAddNote(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>添加复核备注</h3>
              <button className="modal-close" onClick={() => setShowAddNote(false)}>
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label>备注内容</label>
                <textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="输入备注内容..."
                  style={{ minHeight: 120 }}
                />
              </div>
              <div className="form-group">
                <label>复核人 (可选)</label>
                <input
                  type="text"
                  value={newNoteAuthor}
                  onChange={(e) => setNewNoteAuthor(e.target.value)}
                  placeholder="输入复核人姓名"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddNote(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleAddNote}>
                添加备注
              </button>
            </div>
          </div>
        </div>
      )}

      {showResolveDialog && (
        <div className="modal-overlay" onClick={() => {
          setShowResolveDialog(null);
          setResolveContent('');
          setResolveAuthor('');
        }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>标记问题已复核</h3>
              <button 
                className="modal-close"
                onClick={() => {
                  setShowResolveDialog(null);
                  setResolveContent('');
                  setResolveAuthor('');
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label>复核结论</label>
                <textarea
                  value={resolveContent}
                  onChange={(e) => setResolveContent(e.target.value)}
                  placeholder="输入复核结论和处理意见..."
                  style={{ minHeight: 120 }}
                />
              </div>
              <div className="form-group">
                <label>复核人 (可选)</label>
                <input
                  type="text"
                  value={resolveAuthor}
                  onChange={(e) => setResolveAuthor(e.target.value)}
                  placeholder="输入复核人姓名"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowResolveDialog(null);
                  setResolveContent('');
                  setResolveAuthor('');
                }}
              >
                取消
              </button>
              <button className="btn btn-primary" onClick={handleResolveIssue}>
                确认复核
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function parseTimestamp(timestamp) {
  if (!timestamp) return 0;
  
  if (timestamp.includes(':')) {
    const parts = timestamp.split(':');
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseInt(parts[1]) || 0;
    const totalSeconds = minutes * 60 + seconds;
    return totalSeconds / 600;
  }
  
  return 0.5;
}

export default SessionDetail;
