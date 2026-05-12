import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

function Dashboard() {
  const [customers, setCustomers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    Promise.all([
      api.getHealth(),
      api.getCustomers(),
      api.getPlans()
    ]).then(([h, c, p]) => {
      setHealth(h);
      setCustomers(c);
      setPlans(p);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load data:', err);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <div className="grid grid-3 mb-4">
        <div className="stat-card">
          <div className="stat-value">{customers.length}</div>
          <div className="stat-label">客户总数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{plans.length}</div>
          <div className="stat-label">套餐总数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: health ? '#10b981' : '#ef4444' }}>
            {health?.status === 'ok' ? '正常' : '异常'}
          </div>
          <div className="stat-label">后端状态</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h2>套餐列表</h2>
          </div>
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>套餐名称</th>
                  <th>速率限制</th>
                  <th>月费</th>
                </tr>
              </thead>
              <tbody>
                {plans.map(plan => (
                  <tr key={plan.id}>
                    <td>
                      {plan.name}
                      {plan.is_trial === 1 && (
                        <span className="badge badge-info ml-2">试用</span>
                      )}
                    </td>
                    <td>{plan.rate_limit} 次/{plan.rate_window}</td>
                    <td>¥{plan.monthly_price}/月</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>客户列表</h2>
          </div>
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>客户名称</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(customer => (
                  <tr key={customer.id}>
                    <td>{customer.name}</td>
                    <td>
                      <span className={`badge ${customer.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                        {customer.status === 'active' ? '活跃' : customer.status}
                      </span>
                    </td>
                    <td>
                      <Link to={`/customers/${customer.id}`} className="btn btn-primary btn-sm">
                        详情
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-header">
          <h2>快速开始</h2>
        </div>
        <div className="card-body">
          <div className="alert alert-info">
            <strong>系统已内置示例数据：</strong>
            <ul className="mt-2" style={{ marginLeft: '1.5rem' }}>
              <li>3个示例客户：创新科技有限公司（试用）、云端数据服务（专业版+临时加量）、智能物联网（企业版）</li>
              <li>4个套餐：免费试用、入门版、专业版、企业版</li>
              <li>每个客户都有调用样例记录</li>
            </ul>
          </div>
          <p className="muted mt-4">
            点击 <Link to="/customers">客户管理</Link> 查看完整的客户订阅详情、套餐时间线和账单预估。
          </p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
