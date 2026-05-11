import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const Reports = () => {
  const [efficiencyData, setEfficiencyData] = useState([]);
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState('');
  const [scoreDistribution, setScoreDistribution] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [efficiency, coursesData] = await Promise.all([
          api.getAssistantEfficiency(),
          api.getCourses()
        ]);
        setEfficiencyData(efficiency);
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
    if (selectedAssignment) {
      api.getScoreDistribution(selectedAssignment).then(setScoreDistribution);
    } else {
      setScoreDistribution(null);
    }
  }, [selectedAssignment]);

  const handleCourseChange = async (courseId) => {
    setSelectedAssignment('');
    if (courseId) {
      const data = await api.getAssignments(courseId);
      setAssignments(data);
    } else {
      setAssignments([]);
    }
  };

  const COLORS = ['#667eea', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const workloadLevel = (current, max) => {
    const ratio = current / max;
    if (ratio >= 0.8) return 'high';
    if (ratio >= 0.5) return 'medium';
    return 'low';
  };

  const chartData = efficiencyData.map(ta => ({
    name: ta.name,
    已批改: ta.graded,
    已退回: ta.returned,
    待处理: ta.pending,
    超时: ta.overdue
  }));

  if (loading) {
    return <div className="empty-state"><div className="icon">⏳</div><p>加载中...</p></div>;
  }

  return (
    <div>
      <h1 className="page-title">📈 报表</h1>

      <div className="card">
        <div className="card-header">
          <h2>👨‍💼 助教效率报表</h2>
        </div>
        <div className="card-body">
          <div style={{ height: '350px', marginBottom: '2rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="已批改" fill="#10b981" />
                <Bar dataKey="已退回" fill="#ef4444" />
                <Bar dataKey="待处理" fill="#667eea" />
                <Bar dataKey="超时" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>助教</th>
                  <th>负载</th>
                  <th>已批改</th>
                  <th>已退回</th>
                  <th>待处理</th>
                  <th>超时</th>
                  <th>平均分</th>
                </tr>
              </thead>
              <tbody>
                {efficiencyData.map(ta => (
                  <tr key={ta.id}>
                    <td>{ta.name}</td>
                    <td>
                      <div className={`workload-indicator ${workloadLevel(ta.workload, ta.maxWorkload)}`}>
                        <span className="current">{ta.workload}</span>
                        <span>/ {ta.maxWorkload}</span>
                      </div>
                    </td>
                    <td>{ta.graded}</td>
                    <td>{ta.returned}</td>
                    <td>{ta.pending}</td>
                    <td>
                      {ta.overdue > 0 ? (
                        <span className="status-badge status-overdue">{ta.overdue}</span>
                      ) : ta.overdue}
                    </td>
                    <td>{ta.avgScore || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>📊 分数分布</h2>
        </div>
        <div className="card-body">
          <div className="filters" style={{ marginBottom: '1rem' }}>
            <div className="filter-group">
              <label>课程</label>
              <select onChange={(e) => handleCourseChange(e.target.value)}>
                <option value="">请选择课程</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>作业</label>
              <select 
                value={selectedAssignment}
                onChange={(e) => setSelectedAssignment(e.target.value)}
                disabled={assignments.length === 0}
              >
                <option value="">请选择作业</option>
                {assignments.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          {scoreDistribution ? (
            scoreDistribution.totalSubmissions > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                  <h4 style={{ marginBottom: '1rem' }}>分数段分布</h4>
                  <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={scoreDistribution.distribution} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#667eea">
                          {scoreDistribution.distribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <h4 style={{ marginBottom: '1rem' }}>占比</h4>
                  <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={scoreDistribution.distribution.filter(d => d.count > 0)}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {scoreDistribution.distribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div className="stats-grid" style={{ marginBottom: 0 }}>
                    <div className="stat-card graded">
                      <h3>已批改份数</h3>
                      <div className="value">{scoreDistribution.totalSubmissions}</div>
                    </div>
                    <div className="stat-card">
                      <h3>平均分</h3>
                      <div className="value">{scoreDistribution.average}</div>
                    </div>
                    <div className="stat-card">
                      <h3>满分</h3>
                      <div className="value">{scoreDistribution.assignment?.totalScore}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="icon">📊</div>
                <p>该作业暂无已批改的提交</p>
              </div>
            )
          ) : (
            <div className="empty-state">
              <div className="icon">👆</div>
              <p>请选择课程和作业查看分数分布</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
