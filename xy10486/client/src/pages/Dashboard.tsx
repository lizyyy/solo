import { useState, useEffect } from 'react';
import { getDashboard, getAlerts } from '../api';
import * as dayjs from 'dayjs';

const Dashboard = () => {
  const [data, setData] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dashboardRes, alertsRes] = await Promise.all([
        getDashboard(),
        getAlerts()
      ]);
      setData(dashboardRes.data);
      setAlerts(alertsRes.data.filter((a: any) => !a.resolved));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  const categoryIcon = (category: string) => {
    switch (category) {
      case '叶菜': return '🥬';
      case '水果': return '🍎';
      case '肉类': return '🥩';
      default: return '📦';
    }
  };

  const getCategoryIconClass = (category: string) => {
    switch (category) {
      case '叶菜': return 'leaf';
      case '水果': return 'fruit';
      case '肉类': return 'meat';
      default: return '';
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>生鲜报货看板</h1>
        <div>{dayjs().format('YYYY年MM月DD日')}</div>
      </div>

      {alerts.length > 0 && (
        <div className="alert-banner warning">
          <span>⚠️</span>
          <span>有 {alerts.length} 条异常预警待处理</span>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">待到货品类</div>
          <div className="stat-value">{data?.pendingOrders?.length || 0}</div>
          <div className="stat-change">需要核对的订单</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">风险商品数</div>
          <div className="stat-value">{data?.riskProducts?.length || 0}</div>
          <div className="stat-change negative">损耗过高/到货不足</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">人工调整次数</div>
          <div className="stat-value">{data?.adjustments?.length || 0}</div>
          <div className="stat-change">进入复盘分析</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">品类报货建议</div>
        {data?.categoryStats?.length > 0 ? (
          <div className="row">
            {data.categoryStats.map((stat: any) => (
              <div key={stat.category} className="col-3">
                <div className="prediction-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <span className={`category-icon ${getCategoryIconClass(stat.category)}`}>
                      {categoryIcon(stat.category)}
                    </span>
                    <span className="category-name">{stat.category}</span>
                  </div>
                  <div className="row" style={{ width: '100%' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>建议报货</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>
                        {stat.total_suggested} 斤
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>实际报货</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#1f2937' }}>
                        {stat.total_adjusted} 斤
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">暂无待报货订单</div>
        )}
      </div>

      <div className="card">
        <div className="card-title">风险商品</div>
        {data?.riskProducts?.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>商品</th>
                <th>品类</th>
                <th>平均损耗率</th>
                <th>高损耗次数</th>
                <th>到货率</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {data.riskProducts.map((product: any) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.category}</td>
                  <td className={product.avg_wastage_rate > 0.15 ? 'adjusted-higher' : ''}>
                    {(product.avg_wastage_rate * 100).toFixed(1)}%
                  </td>
                  <td>{product.high_wastage_count} 次</td>
                  <td className={product.avg_delivery_rate < 0.8 ? 'adjusted-higher' : ''}>
                    {(product.avg_delivery_rate * 100).toFixed(1)}%
                  </td>
                  <td>
                    {product.avg_wastage_rate > 0.15 ? (
                      <span className="badge badge-red">损耗过高</span>
                    ) : product.avg_delivery_rate < 0.8 ? (
                      <span className="badge badge-yellow">到货不足</span>
                    ) : (
                      <span className="badge badge-green">正常</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">暂无风险商品</div>
        )}
      </div>

      <div className="card">
        <div className="card-title">调整历史</div>
        {data?.adjustments?.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>商品</th>
                <th>品类</th>
                <th>报货日期</th>
                <th>建议量</th>
                <th>调整量</th>
                <th>调整原因</th>
              </tr>
            </thead>
            <tbody>
              {data.adjustments.map((adj: any) => {
                const diff = adj.adjusted_qty - adj.suggested_qty;
                return (
                  <tr key={adj.id}>
                    <td>{adj.product_name}</td>
                    <td>{adj.category}</td>
                    <td>{adj.order_date}</td>
                    <td>{adj.suggested_qty} {adj.unit}</td>
                    <td className={diff > 0 ? 'adjusted-higher' : 'adjusted-lower'}>
                      {adj.adjusted_qty} {adj.unit}
                      <span style={{ fontSize: 12, marginLeft: 8 }}>
                        ({diff > 0 ? '+' : ''}{diff})
                      </span>
                    </td>
                    <td style={{ maxWidth: 250 }}>{adj.adjustment_reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">暂无调整记录</div>
        )}
      </div>

      {data?.pendingOrders?.length > 0 && (
        <div className="card">
          <div className="card-title">待导出报货表</div>
          <table className="table">
            <thead>
              <tr>
                <th>商品</th>
                <th>品类</th>
                <th>报货日期</th>
                <th>到货日期</th>
                <th>采购量</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {data.pendingOrders.map((order: any) => (
                <tr key={order.id}>
                  <td>{order.product_name}</td>
                  <td>{order.category}</td>
                  <td>{order.order_date}</td>
                  <td>{order.delivery_date}</td>
                  <td>{order.adjusted_qty} {order.unit}</td>
                  <td>
                    <span className="badge badge-blue">待收货</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-16" style={{ textAlign: 'right' }}>
            <button 
              className="btn btn-outline btn-sm"
              onClick={() => {
                const csvContent = [
                  ['商品', '品类', '单位', '建议量', '采购量', '到货日期'].join(','),
                  ...data.pendingOrders.map((o: any) => 
                    [o.product_name, o.category, o.unit, o.suggested_qty, o.adjusted_qty, o.delivery_date].join(',')
                  )
                ].join('\n');
                
                const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `报货表_${dayjs().format('YYYYMMDD')}.csv`;
                link.click();
              }}
            >
              📥 导出报货表
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
