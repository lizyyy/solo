import { useState, useEffect } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';

export function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [smsList, setSmsList] = useState([]);
  const [inventory, setInventory] = useState([]);
  const { showToast } = useToast();

  const loadData = async () => {
    try {
      const [statsData, invData, smsData, invtryData] = await Promise.all([
        api.getStatistics(),
        api.getInvoices(),
        api.getSms(),
        api.getInventory()
      ]);
      setStats(statsData);
      setInvoices(invData);
      setSmsList(smsData);
      setInventory(invtryData);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleReset = async () => {
    try {
      await api.resetSeed();
      showToast('数据已重置', 'success');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="container">
      <div className="stats-grid">
        <div className="stat-card pending">
          <h3>待处理任务</h3>
          <div className="value">{stats?.tasks?.pending || 0}</div>
        </div>
        <div className="stat-card success">
          <h3>已完成任务</h3>
          <div className="value">{stats?.tasks?.completed || 0}</div>
        </div>
        <div className="stat-card failed">
          <h3>死信队列</h3>
          <div className="value">{stats?.deadLetters?.active || 0}</div>
        </div>
        <div className="stat-card manual">
          <h3>需人工处理</h3>
          <div className="value">{stats?.deadLetters?.needManual || 0}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>补偿报告概览</h2>
          <button className="btn btn-secondary btn-sm" onClick={handleReset}>重置示例数据</button>
        </div>
        <div className="card-body">
          <div className="report-summary">
            <h3>死信补偿统计</h3>
            <div className="report-metrics">
              <div className="report-metric">
                <div className="num">{stats?.deadLetters?.total || 0}</div>
                <div className="label">总计死信</div>
              </div>
              <div className="report-metric">
                <div className="num">{stats?.deadLetters?.active || 0}</div>
                <div className="label">待处理</div>
              </div>
              <div className="report-metric">
                <div className="num">{stats?.deadLetters?.resolved || 0}</div>
                <div className="label">已成功</div>
              </div>
              <div className="report-metric">
                <div className="num">{stats?.deadLetters?.closed || 0}</div>
                <div className="label">已关闭</div>
              </div>
            </div>
          </div>

          {stats?.errorCategories?.length > 0 && (
            <div>
              <div className="section-title">失败原因分类</div>
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                {stats.errorCategories.map((cat, i) => (
                  <div key={i} className="stat-card">
                    <h3>{getCategoryName(cat.error_category)}</h3>
                    <div className="value">{cat.count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats?.taskTypes?.length > 0 && (
            <div>
              <div className="section-title">任务类型分布</div>
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                {stats.taskTypes.map((type, i) => (
                  <div key={i} className="stat-card">
                    <h3>{getTaskTypeName(type.task_type)}</h3>
                    <div className="value">{type.count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>业务数据快照</h2>
        </div>
        <div className="card-body">
          <div className="tabs">
            <div className="tab active">库存状态</div>
          </div>
          {inventory.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>商品ID</th>
                    <th>商品名称</th>
                    <th>当前库存</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map(item => (
                    <tr key={item.id}>
                      <td>{item.product_id}</td>
                      <td>{item.product_name}</td>
                      <td>
                        <span className={`badge ${item.stock > 50 ? 'badge-resolved' : item.stock > 10 ? 'badge-active' : 'badge-dead-letter'}`}>
                          {item.stock} 件
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="icon">📦</div>
              <div>暂无库存数据</div>
            </div>
          )}

          {smsList.length > 0 && (
            <div>
              <div className="section-title">短信发送记录</div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>业务号</th>
                      <th>手机号</th>
                      <th>发送次数</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {smsList.map(item => (
                      <tr key={item.id}>
                        <td>{item.business_no}</td>
                        <td>{item.phone}</td>
                        <td>{item.sent_count} 次</td>
                        <td>
                          <span className={`badge badge-${item.status === 'sent' ? 'resolved' : 'pending'}`}>
                            {item.status === 'sent' ? '已发送' : '待发送'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {invoices.length > 0 && (
            <div>
              <div className="section-title">发票记录</div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>业务号</th>
                      <th>发票号</th>
                      <th>金额</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(item => (
                      <tr key={item.id}>
                        <td>{item.business_no}</td>
                        <td>{item.invoice_no || '-'}</td>
                        <td>¥{item.amount?.toFixed(2)}</td>
                        <td>
                          <span className={`badge badge-${item.status === 'issued' ? 'resolved' : 'pending'}`}>
                            {item.status === 'issued' ? '已开票' : '待开票'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getCategoryName(cat) {
  const names = {
    network: '网络错误',
    timeout: '超时',
    business: '业务错误',
    data: '数据错误',
    system: '系统错误',
    unknown: '未知错误'
  };
  return names[cat] || cat;
}

function getTaskTypeName(type) {
  const names = {
    invoice: '发票',
    sms: '短信',
    inventory: '库存'
  };
  return names[type] || type;
}
