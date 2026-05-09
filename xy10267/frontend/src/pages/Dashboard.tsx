import { useEffect, useState } from 'react';
import { api } from '../services/api';

interface DashboardStats {
  totals: {
    aunts: number;
    availableAunts: number;
    orders: number;
    assignments: number;
    leaves: number;
  };
  orderStats: Record<string, number>;
  assignmentStats: Record<string, number>;
  leaveStats: {
    pending: number;
    approved: number;
  };
  quality: {
    avgDistance: string;
    avgScore: string;
  };
  blockedPoints: {
    pendingDispatch: number;
    pendingLeaves: number;
    reassignedOrders: number;
    pendingAssignments: number;
  };
  suggestions: Array<{
    priority: string;
    type: string;
    message: string;
    action: string;
  }>;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    const response = await api.dashboard.getStats();
    if (response.success) {
      setStats(response.data as DashboardStats);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="card">加载中...</div>;
  }

  if (!stats) {
    return <div className="card">无法加载数据</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📊 家政阿姨技能派单台</h1>
        <button className="btn btn-primary" onClick={loadStats}>
          刷新数据
        </button>
      </div>

      {/* 总体统计 */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">阿姨总数</div>
          <div className="stat-value primary">{stats.totals.aunts}</div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
            可用: {stats.totals.availableAunts}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-title">订单总数</div>
          <div className="stat-value success">{stats.totals.orders}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">派单记录</div>
          <div className="stat-value info">{stats.totals.assignments}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">请假申请</div>
          <div className="stat-value warning">{stats.totals.leaves}</div>
        </div>
      </div>

      {/* 订单状态统计 */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📦 订单状态统计</h2>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-title">待派单</div>
            <div className="stat-value warning">{stats.orderStats.pending_dispatch}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">已派单</div>
            <div className="stat-value info">{stats.orderStats.dispatched}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">服务中</div>
            <div className="stat-value primary">{stats.orderStats.in_progress}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">已完成</div>
            <div className="stat-value success">{stats.orderStats.completed}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">需重新派单</div>
            <div className="stat-value danger">{stats.orderStats.reassigned}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">已取消</div>
            <div className="stat-value">{stats.orderStats.cancelled}</div>
          </div>
        </div>
      </div>

      {/* 当前卡点 */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">⚠️ 当前卡点</h2>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-title">待派单订单</div>
            <div className={`stat-value ${stats.blockedPoints.pendingDispatch > 0 ? 'danger' : ''}`}>
              {stats.blockedPoints.pendingDispatch}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-title">需重新派单</div>
            <div className={`stat-value ${stats.blockedPoints.reassignedOrders > 0 ? 'danger' : ''}`}>
              {stats.blockedPoints.reassignedOrders}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-title">待审批请假</div>
            <div className={`stat-value ${stats.blockedPoints.pendingLeaves > 0 ? 'warning' : ''}`}>
              {stats.blockedPoints.pendingLeaves}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-title">待确认派单</div>
            <div className={`stat-value ${stats.blockedPoints.pendingAssignments > 0 ? 'info' : ''}`}>
              {stats.blockedPoints.pendingAssignments}
            </div>
          </div>
        </div>
      </div>

      {/* 处理建议 */}
      {stats.suggestions.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">💡 处理建议</h2>
          </div>
          <div>
            {stats.suggestions.map((suggestion, index) => (
              <div key={index} className={`suggestion-card ${suggestion.priority}`}>
                <div className="suggestion-title">
                  [{suggestion.priority === 'high' ? '高优先级' : '中优先级'}] {suggestion.message}
                </div>
                <div className="suggestion-action">{suggestion.action}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 质量指标 */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📈 派单质量指标</h2>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-title">平均派单距离</div>
            <div className="stat-value">{stats.quality.avgDistance} km</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">平均匹配分数</div>
            <div className="stat-value success">{stats.quality.avgScore} 分</div>
          </div>
        </div>
      </div>

      {/* 使用说明 */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📖 快速开始指南</h2>
        </div>
        <div style={{ lineHeight: '1.8', color: '#666' }}>
          <p><strong>从空数据到最终看板的完整流程：</strong></p>
          <ol>
            <li>
              <strong>第一步：添加阿姨</strong> - 在「阿姨管理」页面添加家政阿姨，
              务必设置她们的<strong>技能标签</strong>（如保洁、做饭、育儿等）和
              <strong>禁忌</strong>（如不接触狗、不做夜班等）。
            </li>
            <li>
              <strong>第二步：添加客户</strong> - 在「客户管理」页面添加客户信息，
              记录客户的位置和禁忌。
            </li>
            <li>
              <strong>第三步：创建订单</strong> - 在「订单管理」页面创建新订单，
              选择所需技能、服务时间和订单来源。
            </li>
            <li>
              <strong>第四步：智能派单</strong> - 系统会自动根据<strong>技能匹配</strong>、
              <strong>距离计算</strong>和<strong>禁忌过滤</strong>推荐最佳阿姨。
              您可以查看候选阿姨列表，选择最合适的进行派单。
            </li>
            <li>
              <strong>第五步：处理请假</strong> - 如果有阿姨临时请假，
              系统会自动检测<strong>受影响的订单</strong>并标记为「需重新派单」，
              您需要重新为这些订单匹配阿姨。
            </li>
            <li>
              <strong>第六步：查看历史</strong> - 在「历史记录」页面可以看到所有操作的变更记录，
              包括状态变化、派单记录和请假影响。
            </li>
          </ol>
          <p style={{ marginTop: '16px' }}>
            <strong>💡 提示：</strong>系统已预置了4位阿姨和2位客户的示例数据，
            您可以直接创建订单体验派单流程。
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
