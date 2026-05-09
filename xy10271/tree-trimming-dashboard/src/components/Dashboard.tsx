import React from 'react';
import { useApp } from '../store/AppContext';
import { formatDate } from '../utils';

const Dashboard: React.FC = () => {
  const { state, dispatch } = useApp();

  const stats = {
    totalTrees: state.trees.length,
    pendingComplaints: state.complaints.filter(c => !c.resolved).length,
    pendingWorkOrders: state.workOrders.filter(wo => wo.status === 'pending').length,
    completedPublic: state.workOrders.filter(wo => wo.isPublic).length,
    processingWorkOrders: state.workOrders.filter(wo => wo.status === 'processing').length,
    completedWorkOrders: state.workOrders.filter(wo => wo.status === 'completed').length
  };

  const highPriorityOrders = state.workOrders
    .filter(wo => wo.status !== 'completed')
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);

  const recentComplaints = [...state.complaints]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const handleReset = () => {
    if (confirm('确定要重置所有数据吗？这将恢复到初始样例数据。')) {
      dispatch({ type: 'RESET_DATA' });
    }
  };

  const getPriorityClass = (priority: number) => {
    if (priority >= 80) return 'priority-urgent';
    if (priority >= 60) return 'priority-high';
    if (priority >= 40) return 'priority-medium';
    return 'priority-low';
  };

  const getPriorityText = (priority: number) => {
    if (priority >= 80) return '紧急';
    if (priority >= 60) return '高';
    if (priority >= 40) return '中';
    return '低';
  };

  return (
    <div>
      <div className="page-header">
        <h2>数据概览</h2>
        <p>查看小区树木修剪工作的整体进展和关键指标</p>
        <div className="header-actions">
          <button className="btn btn-danger btn-sm" onClick={handleReset}>
            🔄 重置样例数据
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-label">树木总数</div>
          <div className="stat-value">{stats.totalTrees}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">待处理投诉</div>
          <div className="stat-value">{stats.pendingComplaints}</div>
        </div>
        <div className="stat-card info">
          <div className="stat-label">待处理工单</div>
          <div className="stat-value">{stats.pendingWorkOrders}</div>
        </div>
        <div className="stat-card primary">
          <div className="stat-label">已公示结果</div>
          <div className="stat-value">{stats.completedPublic}</div>
        </div>
      </div>

      <div className="tree-info-panel">
        <div className="info-panel">
          <h4>📊 工单状态分布</h4>
          <ul className="info-list">
            <li>
              <span className="info-label">待处理</span>
              <span className="badge badge-gray">{stats.pendingWorkOrders}</span>
            </li>
            <li>
              <span className="info-label">处理中</span>
              <span className="badge badge-blue">{stats.processingWorkOrders}</span>
            </li>
            <li>
              <span className="info-label">已完成</span>
              <span className="badge badge-green">{stats.completedWorkOrders}</span>
            </li>
          </ul>
        </div>
        <div className="info-panel">
          <h4>🌳 树木健康状况</h4>
          <ul className="info-list">
            <li>
              <span className="info-label">健康</span>
              <span className="badge badge-green">
                {state.trees.filter(t => t.status === 'healthy').length}
              </span>
            </li>
            <li>
              <span className="info-label">需修剪</span>
              <span className="badge badge-yellow">
                {state.trees.filter(t => t.status === 'needs_trimming').length}
              </span>
            </li>
            <li>
              <span className="info-label">病虫害</span>
              <span className="badge badge-red">
                {state.trees.filter(t => t.status === 'diseased').length}
              </span>
            </li>
            <li>
              <span className="info-label">已修剪</span>
              <span className="badge badge-blue">
                {state.trees.filter(t => t.status === 'trimmed').length}
              </span>
            </li>
          </ul>
        </div>
        <div className="info-panel">
          <h4>📋 投诉类型统计</h4>
          <ul className="info-list">
            <li>
              <span className="info-label">楼栋遮光</span>
              <span className="complaint-tag complaint-tag-shading">
                {state.complaints.filter(c => c.type === 'shading').length} 件
              </span>
            </li>
            <li>
              <span className="info-label">病虫害</span>
              <span className="complaint-tag complaint-tag-disease">
                {state.complaints.filter(c => c.type === 'disease').length} 件
              </span>
            </li>
            <li>
              <span className="info-label">居民投诉</span>
              <span className="complaint-tag complaint-tag-resident">
                {state.complaints.filter(c => c.type === 'resident').length} 件
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h3>🔴 高优先级工单（Top 5）</h3>
          </div>
          <div className="card-body">
            {highPriorityOrders.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>优先级</th>
                      <th>树木位置</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {highPriorityOrders.map(wo => {
                      const tree = state.trees.find(t => t.id === wo.treeId);
                      return (
                        <tr key={wo.id}>
                          <td>
                            <span className={`priority-badge ${getPriorityClass(wo.priority)}`}>
                              {getPriorityText(wo.priority)} ({wo.priority})
                            </span>
                          </td>
                          <td>{tree?.location || '-'}</td>
                          <td>
                            <span className={`badge ${
                              wo.status === 'pending' ? 'badge-gray' :
                              wo.status === 'processing' ? 'badge-blue' : 'badge-green'
                            }`}>
                              {wo.status === 'pending' ? '待处理' :
                               wo.status === 'processing' ? '处理中' : '已完成'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <div className="empty-state-text">暂无待处理工单</div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>📝 最新投诉记录</h3>
          </div>
          <div className="card-body">
            {recentComplaints.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>类型</th>
                      <th>投诉人</th>
                      <th>日期</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentComplaints.map(c => (
                      <tr key={c.id}>
                        <td>
                          <span className={`complaint-tag complaint-tag-${c.type}`}>
                            {c.type === 'shading' ? '遮光' :
                             c.type === 'disease' ? '病虫害' : '居民'}
                          </span>
                        </td>
                        <td>{c.complainant}</td>
                        <td>{formatDate(c.createdAt)}</td>
                        <td>
                          <span className={`badge ${c.resolved ? 'badge-green' : 'badge-yellow'}`}>
                            {c.resolved ? '已解决' : '待处理'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-text">暂无投诉记录</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
