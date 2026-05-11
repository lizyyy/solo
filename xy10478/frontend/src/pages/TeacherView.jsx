import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Link } from 'react-router-dom';

const TeacherView = () => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [teacherData, setTeacherData] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCourses().then(data => {
      setCourses(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      api.getTeacherView(selectedCourse).then(setTeacherData);
    } else {
      setTeacherData([]);
    }
  }, [selectedCourse]);

  const statusLabels = {
    submitted: '已提交',
    assigned: '已分配',
    graded: '已批改',
    returned: '已退回',
    resubmitted: '已重交',
    regraded: '已复批'
  };

  if (loading) {
    return <div className="empty-state"><div className="icon">⏳</div><p>加载中...</p></div>;
  }

  return (
    <div>
      <h1 className="page-title">👀 老师视图</h1>

      <div className="alert-box success" style={{ marginBottom: '1.5rem' }}>
        <div className="alert-icon">ℹ️</div>
        <div className="alert-content">
          <div className="title">老师专用视图</div>
          <p>在此视图中，您可以查看所有批改结果、复批原因和分数变化历史。点击某一行可以展开查看详细的批改历史。</p>
        </div>
      </div>

      <div className="filters" style={{ marginBottom: '1.5rem' }}>
        <div className="filter-group">
          <label>选择课程</label>
          <select 
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
          >
            <option value="">请选择课程</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedCourse ? (
        <div className="card">
          <div className="card-header">
            <h2>学生成绩列表</h2>
            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              共 {teacherData.length} 份提交
            </span>
          </div>
          <div className="card-body">
            {teacherData.length === 0 ? (
              <div className="empty-state">
                <div className="icon">📭</div>
                <p>该课程暂无作业提交</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}></th>
                      <th>学生</th>
                      <th>作业</th>
                      <th>状态</th>
                      <th>分数</th>
                      <th>复批次数</th>
                      <th>最新评语</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacherData.map(item => (
                      <React.Fragment key={item.submissionId}>
                        <tr 
                          style={{ cursor: 'pointer' }}
                          onClick={() => setExpandedRow(expandedRow === item.submissionId ? null : item.submissionId)}
                        >
                          <td>
                            {item.gradeHistory?.length > 0 && (
                              <span style={{ fontSize: '1.25rem' }}>
                                {expandedRow === item.submissionId ? '▼' : '▶'}
                              </span>
                            )}
                          </td>
                          <td>{item.studentName}</td>
                          <td>{item.assignmentName}</td>
                          <td>
                            <span className={`status-badge status-${item.status}`}>
                              {statusLabels[item.status]}
                            </span>
                          </td>
                          <td style={{ fontWeight: '600', color: item.finalScore !== undefined ? '#667eea' : '#6b7280' }}>
                            {item.finalScore !== undefined 
                              ? `${item.finalScore}/${item.totalScore}`
                              : '-'}
                          </td>
                          <td>
                            {item.gradeHistory?.length > 0 ? (
                              <span className="status-badge status-regraded">
                                {item.gradeHistory.length}次
                              </span>
                            ) : '-'}
                          </td>
                          <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.latestFeedback || '-'}
                          </td>
                          <td>
                            <Link to={`/submission/${item.submissionId}`}>
                              <button className="btn btn-secondary btn-sm">详情</button>
                            </Link>
                          </td>
                        </tr>
                        {expandedRow === item.submissionId && item.gradeHistory?.length > 0 && (
                          <tr>
                            <td colSpan="8" style={{ background: '#f9fafb', padding: '1rem 3rem' }}>
                              <h4 style={{ marginBottom: '1rem', color: '#374151' }}>📜 批改历史</h4>
                              <div className="history-timeline" style={{ marginLeft: '1rem' }}>
                                {item.gradeHistory.map((h, idx) => {
                                  const diff = h.newScore - h.previousScore;
                                  const diffClass = diff > 0 ? 'score-up' : diff < 0 ? 'score-down' : 'score-same';
                                  return (
                                    <div key={idx} className="history-item">
                                      <div className="meta">
                                        {new Date(h.changedAt).toLocaleString('zh-CN')} · {h.changedBy}
                                      </div>
                                      <div className="score-change">
                                        <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>{h.reason}:</span>
                                        <span>{h.previousScore}</span>
                                        <span style={{ color: '#9ca3af' }}>→</span>
                                        <span className={diffClass}>
                                          {h.newScore}
                                          {diff > 0 ? ` (+${diff})` : diff < 0 ? ` (${diff})` : ''}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <div className="icon">👆</div>
          <p>请选择课程查看学生成绩</p>
        </div>
      )}
    </div>
  );
};

export default TeacherView;
