import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Link } from 'react-router-dom';

const GradingQueue = ({ currentAssistant }) => {
  const [submissions, setSubmissions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [filters, setFilters] = useState({
    courseId: '',
    assignmentId: '',
    status: '',
    view: 'all'
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [submissionsData, coursesData] = await Promise.all([
          api.getSubmissions(),
          api.getCourses()
        ]);
        setSubmissions(submissionsData);
        setCourses(coursesData);
      } catch (error) {
        console.error('获取数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (filters.courseId) {
      api.getAssignments(filters.courseId).then(setAssignments);
    } else {
      setAssignments([]);
    }
  }, [filters.courseId]);

  useEffect(() => {
    const fetchSubmissions = async () => {
      const params = {};
      if (filters.courseId) params.courseId = filters.courseId;
      if (filters.assignmentId) params.assignmentId = filters.assignmentId;
      if (filters.status) params.status = filters.status;
      if (filters.view === 'mine') params.assistantId = currentAssistant.id;

      const data = await api.getSubmissions(params);
      setSubmissions(data);
    };
    fetchSubmissions();
  }, [filters, currentAssistant.id]);

  const handleAutoAssign = async () => {
    try {
      const result = await api.autoAssignAll();
      setMessage({ type: 'success', text: `成功分配 ${result.results.filter(r => r.success).length} 份作业` });
      
      const data = await api.getSubmissions();
      setSubmissions(data);
    } catch (error) {
      setMessage({ type: 'danger', text: error.message });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAssign = async (submissionId) => {
    try {
      await api.assignSubmission(submissionId);
      setMessage({ type: 'success', text: '分配成功' });
      
      const data = await api.getSubmissions();
      setSubmissions(data);
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
    programming: '编程',
    essay: '作文',
    quiz: '测验'
  };

  const unassignedCount = submissions.filter(s => s.status === 'submitted').length;

  if (loading) {
    return <div className="empty-state"><div className="icon">⏳</div><p>加载中...</p></div>;
  }

  return (
    <div>
      <h1 className="page-title">📋 批改队列</h1>

      {message && (
        <div className={`alert-box ${message.type}`}>
          <div className="alert-icon">{message.type === 'success' ? '✅' : '❌'}</div>
          <div className="alert-content">
            <div className="title">{message.type === 'success' ? '成功' : '错误'}</div>
            <p>{message.text}</p>
          </div>
        </div>
      )}

      <div className="filters">
        <div className="filter-group">
          <label>查看</label>
          <select 
            value={filters.view}
            onChange={(e) => setFilters({ ...filters, view: e.target.value })}
          >
            <option value="all">全部作业</option>
            <option value="mine">我的作业</option>
          </select>
        </div>
        <div className="filter-group">
          <label>课程</label>
          <select 
            value={filters.courseId}
            onChange={(e) => setFilters({ ...filters, courseId: e.target.value, assignmentId: '' })}
          >
            <option value="">全部课程</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>作业</label>
          <select 
            value={filters.assignmentId}
            onChange={(e) => setFilters({ ...filters, assignmentId: e.target.value })}
          >
            <option value="">全部作业</option>
            {assignments.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>状态</label>
          <select 
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">全部状态</option>
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div style={{ alignSelf: 'flex-end', marginLeft: 'auto' }}>
          {unassignedCount > 0 && (
            <button className="btn btn-primary" onClick={handleAutoAssign}>
              🔄 自动分配 ({unassignedCount})
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>作业列表</h2>
          <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            共 {submissions.length} 份
          </span>
        </div>
        <div className="card-body">
          {submissions.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📭</div>
              <p>暂无作业</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>作业</th>
                    <th>类型</th>
                    <th>课程</th>
                    <th>学生</th>
                    <th>提交时间</th>
                    <th>分配给</th>
                    <th>状态</th>
                    <th>分数</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(submission => (
                    <tr key={submission.id}>
                      <td>{submission.assignment?.name}</td>
                      <td>
                        <span className={`type-badge type-${submission.assignment?.type}`}>
                          {typeLabels[submission.assignment?.type]}
                        </span>
                      </td>
                      <td>{submission.course?.name}</td>
                      <td>{submission.student?.name}</td>
                      <td>{new Date(submission.submittedAt).toLocaleString('zh-CN')}</td>
                      <td>{submission.assistant?.name || '-'}</td>
                      <td>
                        <span className={`status-badge status-${submission.status}`}>
                          {statusLabels[submission.status]}
                        </span>
                      </td>
                      <td>
                        {submission.finalScore !== undefined 
                          ? `${submission.finalScore}/${submission.assignment?.totalScore}`
                          : '-'}
                      </td>
                      <td>
                        {submission.status === 'submitted' && (
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => handleAssign(submission.id)}
                          >
                            分配
                          </button>
                        )}
                        {(submission.status === 'assigned' || 
                          submission.status === 'resubmitted' ||
                          submission.status === 'regraded') && 
                         submission.assignedAssistantId === currentAssistant.id && (
                          <Link to={`/submission/${submission.id}`}>
                            <button className="btn btn-success btn-sm">批改</button>
                          </Link>
                        )}
                        {(submission.status === 'graded' || 
                          submission.status === 'returned') && (
                          <Link to={`/submission/${submission.id}`}>
                            <button className="btn btn-secondary btn-sm">查看</button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GradingQueue;
