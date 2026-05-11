import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Link } from 'react-router-dom';

const Dashboard = ({ currentRole }) => {
  const [stats, setStats] = useState(null);
  const [overdue, setOverdue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, overdueData] = await Promise.all([
          api.getStatistics(),
          api.getOverdue()
        ]);
        setStats(statsData);
        setOverdue(overdueData);
      } catch (error) {
        console.error('获取数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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

  if (loading) {
    return <div className="empty-state"><div className="icon">⏳</div><p>加载中...</p></div>;
  }

  return (
    <div>
      <h1 className="page-title">📊 概览</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>总提交数</h3>
          <div className="value">{stats.totalSubmissions}</div>
        </div>
        <div className="stat-card pending">
          <h3>待批改</h3>
          <div className="value">{stats.pending}</div>
        </div>
        <div className="stat-card graded">
          <h3>已批改</h3>
          <div className="value">{stats.graded}</div>
        </div>
        <div className="stat-card returned">
          <h3>已退回</h3>
          <div className="value">{stats.returned}</div>
        </div>
        <div className="stat-card">
          <h3>已重交</h3>
          <div className="value">{stats.resubmitted}</div>
        </div>
        <div className="stat-card overdue">
          <h3>超时未处理</h3>
          <div className="value">{stats.overdue}</div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card" style={{ gridColumn: 'span 2' }}>
          <h3>批改进度</h3>
          <div style={{ marginTop: '0.75rem' }}>
            <div className="progress-bar">
              <div className="fill" style={{ width: `${stats.gradingRate}%` }}></div>
            </div>
            <p style={{ marginTop: '0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
              完成率: <strong>{stats.gradingRate}%</strong>
            </p>
          </div>
        </div>
      </div>

      {overdue.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>⚠️ 超时提醒</h2>
          </div>
          <div className="card-body">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>作业</th>
                    <th>类型</th>
                    <th>学生</th>
                    <th>分配给</th>
                    <th>分配时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map(item => (
                    <tr key={item.id}>
                      <td>{item.assignment?.name}</td>
                      <td>
                        <span className={`type-badge type-${item.assignment?.type}`}>
                          {typeLabels[item.assignment?.type]}
                        </span>
                      </td>
                      <td>{item.student?.name}</td>
                      <td>{item.assistant?.name}</td>
                      <td>{new Date(item.assignedAt).toLocaleString('zh-CN')}</td>
                      <td>
                        <Link to={`/submission/${item.id}`}>
                          <button className="btn btn-warning btn-sm">查看详情</button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>💡 使用说明</h2>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div>
              <h3 style={{ marginBottom: '1rem', color: '#374151' }}>助教模式功能</h3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb' }}>
                  ✅ <strong>批改队列</strong> - 查看和筛选待批改作业
                </li>
                <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb' }}>
                  ✅ <strong>自动分配</strong> - 按负载自动分配助教
                </li>
                <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb' }}>
                  ✅ <strong>退回重交</strong> - 对不合格作业退回
                </li>
                <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb' }}>
                  ✅ <strong>复批调分</strong> - 对重交作业进行复批
                </li>
                <li style={{ padding: '0.5rem 0' }}>
                  ✅ <strong>管理</strong> - 维护课程、作业、学生、助教
                </li>
              </ul>
            </div>
            <div>
              <h3 style={{ marginBottom: '1rem', color: '#374151' }}>老师模式功能</h3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb' }}>
                  ✅ <strong>老师视图</strong> - 查看所有批改结果
                </li>
                <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb' }}>
                  ✅ <strong>复批历史</strong> - 查看分数变化和原因
                </li>
                <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb' }}>
                  ✅ <strong>报表</strong> - 助教效率和分数分布
                </li>
                <li style={{ padding: '0.5rem 0' }}>
                  ✅ <strong>统计</strong> - 总体进度概览
                </li>
              </ul>
            </div>
          </div>

          <div style={{ marginTop: '2rem', padding: '1rem', background: '#fef3c7', borderRadius: '8px' }}>
            <h4 style={{ color: '#92400e', marginBottom: '0.5rem' }}>🎯 演示样例说明</h4>
            <p style={{ color: '#78350f', fontSize: '0.875rem' }}>
              系统已预置3门课程、4份作业（含编程作业、作文、测验）、6名学生、3名助教。
              点击右上角切换到<strong>助教模式</strong>，进入<strong>批改队列</strong>开始体验完整批改流程：
              自动分配 → 批改发布 → 退回重交 → 复批调分。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
