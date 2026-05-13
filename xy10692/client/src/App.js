import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [sessions, setSessions] = useState([]);
  const [qualifications, setQualifications] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [changeHistory, setChangeHistory] = useState([]);
  const [filters, setFilters] = useState({
    session_id: '',
    user_name: '',
    overall_qualified: ''
  });
  const [historyFilters, setHistoryFilters] = useState({
    changed_by: '',
    start_date: '',
    end_date: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [processedBy, setProcessedBy] = useState('');

  useEffect(() => {
    fetchSessions();
    fetchStatistics();
    fetchQualifications();
    fetchChangeHistory();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await axios.get('/api/sessions');
      setSessions(res.data);
    } catch (err) {
      console.error('获取场次失败:', err);
    }
  };

  const fetchStatistics = async () => {
    try {
      const res = await axios.get('/api/statistics');
      setStatistics(res.data);
    } catch (err) {
      console.error('获取统计失败:', err);
    }
  };

  const fetchQualifications = async (filterParams = filters) => {
    setLoading(true);
    try {
      const params = {};
      if (filterParams.session_id) params.session_id = filterParams.session_id;
      if (filterParams.user_name) params.user_name = filterParams.user_name;
      if (filterParams.overall_qualified !== '') params.overall_qualified = filterParams.overall_qualified;
      
      const res = await axios.get('/api/qualifications', { params });
      setQualifications(res.data);
    } catch (err) {
      showMessage('error', '获取资格数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchChangeHistory = async (hFilters = historyFilters) => {
    try {
      const params = {};
      if (hFilters.changed_by) params.changed_by = hFilters.changed_by;
      if (hFilters.start_date) params.start_date = hFilters.start_date;
      if (hFilters.end_date) params.end_date = hFilters.end_date;
      
      const res = await axios.get('/api/change-history', { params });
      setChangeHistory(res.data);
    } catch (err) {
      console.error('获取历史失败:', err);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleValidateWatch = async (sessionId, userId) => {
    if (!processedBy) {
      showMessage('error', '请输入处理人姓名');
      return;
    }
    try {
      await axios.post('/api/validate-watch-time', {
        session_id: sessionId,
        user_id: userId,
        processed_by: processedBy
      });
      showMessage('success', '观看时长校验成功');
      fetchQualifications();
      fetchStatistics();
    } catch (err) {
      showMessage('error', '校验失败');
    }
  };

  const handleProcessQuiz = async (sessionId, userId) => {
    if (!processedBy) {
      showMessage('error', '请输入处理人姓名');
      return;
    }
    try {
      await axios.post('/api/process-quiz-score', {
        session_id: sessionId,
        user_id: userId,
        processed_by: processedBy
      });
      showMessage('success', '测验成绩处理成功');
      fetchQualifications();
      fetchStatistics();
    } catch (err) {
      showMessage('error', '处理失败');
    }
  };

  const handleSaveReplay = async (sessionId, userId) => {
    if (!processedBy) {
      showMessage('error', '请输入处理人姓名');
      return;
    }
    const replayDuration = prompt('请输入回放观看时长（分钟）:');
    if (!replayDuration) return;
    
    try {
      await axios.post('/api/save-replay-study', {
        session_id: sessionId,
        user_id: userId,
        replay_duration: parseInt(replayDuration),
        approved_by: processedBy
      });
      showMessage('success', '回放补学保存成功');
      fetchQualifications();
      fetchStatistics();
    } catch (err) {
      showMessage('error', '保存失败');
    }
  };

  const handleProcessQualification = async (sessionId, userId) => {
    if (!processedBy) {
      showMessage('error', '请输入处理人姓名');
      return;
    }
    try {
      await axios.post('/api/process-qualification', {
        session_id: sessionId,
        user_id: userId,
        processed_by: processedBy
      });
      showMessage('success', '资格处理完成');
      fetchQualifications();
      fetchStatistics();
      fetchChangeHistory();
    } catch (err) {
      showMessage('error', '处理失败');
    }
  };

  const handleExportReport = () => {
    const params = new URLSearchParams();
    if (historyFilters.changed_by) params.append('processed_by', historyFilters.changed_by);
    if (historyFilters.start_date) params.append('start_date', historyFilters.start_date);
    if (historyFilters.end_date) params.append('end_date', historyFilters.end_date);
    
    window.open(`/api/export-report?${params.toString()}`);
  };

  const handleFilter = () => {
    fetchQualifications();
  };

  const handleHistoryFilter = () => {
    fetchChangeHistory();
  };

  return (
    <div className="app">
      <div className="header">
        <h1>直播培训资格处理系统</h1>
        <p style={{ marginTop: '10px', opacity: 0.9 }}>管理直播场次、观看记录、测验成绩和证书资格</p>
      </div>

      {message && (
        <div className={message.type === 'error' ? 'error' : 'success'}>
          {message.text}
        </div>
      )}

      <div className="statistics">
        <div className="stat-card">
          <h3>观看记录总数</h3>
          <div className="value">{statistics.watch_records || 0}</div>
        </div>
        <div className="stat-card">
          <h3>观看合格数</h3>
          <div className="value">{statistics.watch_qualified || 0}</div>
        </div>
        <div className="stat-card">
          <h3>测验通过率</h3>
          <div className="value">{statistics.quiz_total ? Math.round((statistics.quiz_passed / statistics.quiz_total) * 100) : 0}%</div>
        </div>
        <div className="stat-card">
          <h3>回放审批通过</h3>
          <div className="value">{statistics.replay_approved || 0}</div>
        </div>
        <div className="stat-card">
          <h3>资格证书总数</h3>
          <div className="value">{statistics.certificates_qualified || 0}</div>
        </div>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label>处理人姓名 *</label>
          <input
            type="text"
            value={processedBy}
            onChange={(e) => setProcessedBy(e.target.value)}
            placeholder="请输入您的姓名"
          />
        </div>
        <div className="filter-group">
          <label>直播场次</label>
          <select
            value={filters.session_id}
            onChange={(e) => setFilters({ ...filters, session_id: e.target.value })}
          >
            <option value="">全部场次</option>
            {sessions.map(s => (
              <option key={s.session_id} value={s.session_id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>用户名</label>
          <input
            type="text"
            value={filters.user_name}
            onChange={(e) => setFilters({ ...filters, user_name: e.target.value })}
            placeholder="搜索用户名"
          />
        </div>
        <div className="filter-group">
          <label>资格状态</label>
          <select
            value={filters.overall_qualified}
            onChange={(e) => setFilters({ ...filters, overall_qualified: e.target.value })}
          >
            <option value="">全部状态</option>
            <option value="1">已合格</option>
            <option value="0">未合格</option>
          </select>
        </div>
        <div className="filter-actions">
          <button className="btn btn-primary" onClick={handleFilter}>
            搜索
          </button>
          <button className="btn btn-info" onClick={() => { setFilters({ session_id: '', user_name: '', overall_qualified: '' }); fetchQualifications({ session_id: '', user_name: '', overall_qualified: '' }); }}>
            重置
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : (
        <div className="qualification-table">
          <div className="table-header">
            <h2>资格复核列表</h2>
            <span style={{ color: '#666', fontSize: '14px' }}>共 {qualifications.length} 条记录</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>用户</th>
                <th>场次</th>
                <th>观看</th>
                <th>互动</th>
                <th>测验</th>
                <th>回放</th>
                <th>整体状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {qualifications.map((q, index) => (
                <tr key={`${q.user_id}-${q.session_id}-${index}`}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{q.user_name}</div>
                    <div style={{ fontSize: '12px', color: '#999' }}>{q.user_id}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{q.session_title || q.session_id}</div>
                  </td>
                  <td>
                    <span className={`status-badge ${q.watch_qualified ? 'qualified' : 'not-qualified'}`}>
                      {q.watch_qualified ? '合格' : '不合格'}
                    </span>
                    {q.watch_percentage !== undefined && (
                      <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                        {q.watch_percentage.toFixed(1)}%
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge ${q.interaction_qualified ? 'qualified' : 'not-qualified'}`}>
                      {q.interaction_qualified ? '合格' : '不合格'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${q.quiz_qualified ? 'qualified' : 'not-qualified'}`}>
                      {q.quiz_qualified ? '合格' : '不合格'}
                    </span>
                    {q.quiz_score !== undefined && (
                      <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                        {q.quiz_score.toFixed(1)}分
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge ${q.replay_qualified ? 'qualified' : 'not-qualified'}`}>
                      {q.replay_qualified ? '通过' : '未通过'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${q.overall_qualified ? 'qualified' : 'not-qualified'}`}>
                      {q.overall_qualified ? '已合格' : '未合格'}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <button className="btn btn-sm btn-primary" onClick={() => handleValidateWatch(q.session_id, q.user_id)}>
                      校验观看
                    </button>
                    <button className="btn btn-sm btn-warning" onClick={() => handleProcessQuiz(q.session_id, q.user_id)}>
                      处理测验
                    </button>
                    <button className="btn btn-sm btn-info" onClick={() => handleSaveReplay(q.session_id, q.user_id)}>
                      回放补学
                    </button>
                    <button className="btn btn-sm btn-success" onClick={() => handleProcessQualification(q.session_id, q.user_id)}>
                      全部处理
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="history-section">
        <h2>变更历史 & 报告导出</h2>
        
        <div className="filters" style={{ marginBottom: '20px', padding: '16px' }}>
          <div className="filter-group">
            <label>处理人</label>
            <input
              type="text"
              value={historyFilters.changed_by}
              onChange={(e) => setHistoryFilters({ ...historyFilters, changed_by: e.target.value })}
              placeholder="筛选处理人"
            />
          </div>
          <div className="filter-group">
            <label>开始日期</label>
            <input
              type="date"
              value={historyFilters.start_date}
              onChange={(e) => setHistoryFilters({ ...historyFilters, start_date: e.target.value })}
            />
          </div>
          <div className="filter-group">
            <label>结束日期</label>
            <input
              type="date"
              value={historyFilters.end_date}
              onChange={(e) => setHistoryFilters({ ...historyFilters, end_date: e.target.value })}
            />
          </div>
          <div className="filter-actions">
            <button className="btn btn-primary" onClick={handleHistoryFilter}>
              筛选
            </button>
            <button className="btn btn-success" onClick={handleExportReport}>
              导出CSV报告
            </button>
          </div>
        </div>

        {changeHistory.length > 0 ? (
          changeHistory.slice(0, 20).map((change) => (
            <div key={change.id} className="change-item">
              <div className="change-info">
                <span className="change-type">
                  {change.record_type === 'certificate' ? '证书资格' : change.record_type === 'replay' ? '回放记录' : change.record_type} 
                  - {change.field_name}
                </span>
                <span className="change-value">
                  旧值: {change.old_value} → 新值: {change.new_value}
                </span>
              </div>
              <div className="change-meta">
                <div className="change-by">处理人: {change.changed_by}</div>
                <div className="change-time">{change.changed_at}</div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
            暂无变更记录
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
