import React, { useState, useEffect } from 'react';
import axios from 'axios';

const App = () => {
  const [activeTab, setActiveTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [exchanges, setExchanges] = useState([]);
  const [recoveries, setRecoveries] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [timelineStats, setTimelineStats] = useState({});
  const [filters, setFilters] = useState({ department: '', status: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'employees':
          const empRes = await axios.get('/api/employees', { params: filters });
          setEmployees(empRes.data);
          break;
        case 'exchanges':
          const excRes = await axios.get('/api/exchanges');
          setExchanges(excRes.data);
          break;
        case 'recoveries':
          const recRes = await axios.get('/api/recoveries');
          setRecoveries(recRes.data);
          break;
        case 'inventory':
          const invRes = await axios.get('/api/inventory');
          setInventory(invRes.data);
          break;
        case 'timeline':
          const timeRes = await axios.get('/api/timeline');
          setTimeline(timeRes.data);
          const statsRes = await axios.get('/api/timeline/stats');
          setTimelineStats(statsRes.data);
          break;
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    }
    setLoading(false);
  };

  const runDemo = async (path) => {
    setLoading(true);
    try {
      const response = await axios.post(`/api/demo/${path}`, {}, {
        headers: { 'x-idempotency-key': path === 'duplicate' ? 'demo-key-123' : undefined }
      });
      setMessage(response.data.message);
      loadData();
    } catch (error) {
      setMessage(error.response?.data?.message || '操作失败');
    }
    setLoading(false);
    setTimeout(() => setMessage(''), 5000);
  };

  const exportData = (type) => {
    window.open(`/api/export/${type}`, '_blank');
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await axios.post(`/api/import/${type}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage(`导入成功: ${response.data.success} 条`);
      loadData();
    } catch (error) {
      setMessage('导入失败');
    }
  };

  const approveExchange = async (requestId) => {
    try {
      await axios.put(`/api/exchanges/${requestId}/approve`);
      setMessage('审批通过');
      loadData();
    } catch (error) {
      setMessage('审批失败');
    }
  };

  const confirmRecovery = async (recoveryId) => {
    try {
      await axios.put(`/api/recoveries/${recoveryId}/confirm`);
      setMessage('回收确认');
      loadData();
    } catch (error) {
      setMessage('确认失败');
    }
  };

  const reviewRecovery = async (recoveryId, approve) => {
    try {
      await axios.put(`/api/recoveries/${recoveryId}/review`, {
        reviewed_by: '管理员',
        review_notes: '人工复核',
        approve
      });
      setMessage(approve ? '复核通过' : '复核拒绝');
      loadData();
    } catch (error) {
      setMessage('复核失败');
    }
  };

  const tabs = [
    { id: 'employees', name: '员工管理' },
    { id: 'exchanges', name: '换码申请' },
    { id: 'recoveries', name: '离职回收' },
    { id: 'inventory', name: '库存管理' },
    { id: 'timeline', name: '操作时间线' },
    { id: 'demo', name: '演示路径' }
  ];

  const statusColors = {
    success: '#52c41a',
    failed: '#ff4d4f',
    blocked: '#faad14',
    manual: '#722ed1'
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>工装尺码换码回收管理系统</h1>
        {message && <div style={styles.message}>{message}</div>}
      </header>

      <nav style={styles.nav}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            style={activeTab === tab.id ? { ...styles.tab, ...styles.tabActive } : styles.tab}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.name}
          </button>
        ))}
      </nav>

      <main style={styles.main}>
        {activeTab === 'employees' && (
          <div>
            <div style={styles.toolbar}>
              <select
                style={styles.select}
                value={filters.department}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              >
                <option value="">全部部门</option>
                <option value="技术部">技术部</option>
                <option value="销售部">销售部</option>
                <option value="行政部">行政部</option>
              </select>
              <select
                style={styles.select}
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">全部状态</option>
                <option value="active">在职</option>
                <option value="inactive">离职</option>
              </select>
              <button style={styles.button} onClick={() => loadData()}>筛选</button>
              <label style={styles.button}>
                批量导入
                <input type="file" accept=".csv" style={{ display: 'none' }}
                  onChange={(e) => handleFileUpload(e, 'employees')} />
              </label>
              <button style={styles.button} onClick={() => exportData('employees')}>导出CSV</button>
            </div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>工号</th>
                  <th style={styles.th}>姓名</th>
                  <th style={styles.th}>部门</th>
                  <th style={styles.th}>尺码</th>
                  <th style={styles.th}>状态</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id}>
                    <td style={styles.td}>{emp.employee_id}</td>
                    <td style={styles.td}>{emp.name}</td>
                    <td style={styles.td}>{emp.department}</td>
                    <td style={styles.td}>{emp.size}</td>
                    <td style={styles.td}>{emp.status === 'active' ? '在职' : '离职'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'exchanges' && (
          <div>
            <div style={styles.toolbar}>
              <button style={styles.button} onClick={() => exportData('exchanges')}>导出换码记录</button>
            </div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>申请ID</th>
                  <th style={styles.th}>员工</th>
                  <th style={styles.th}>原尺码</th>
                  <th style={styles.th}>新尺码</th>
                  <th style={styles.th}>状态</th>
                  <th style={styles.th}>失败原因</th>
                  <th style={styles.th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {exchanges.map(exc => (
                  <tr key={exc.id}>
                    <td style={styles.td}>{exc.request_id}</td>
                    <td style={styles.td}>{exc.employee_name}</td>
                    <td style={styles.td}>{exc.old_size}</td>
                    <td style={styles.td}>{exc.new_size}</td>
                    <td style={styles.td}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px',
                        color: exc.status === 'approved' ? '#52c41a' : exc.status === 'failed' ? '#ff4d4f' : '#faad14'
                      }}>{exc.status}</span>
                    </td>
                    <td style={styles.td}>{exc.failure_reason || '-'}</td>
                    <td style={styles.td}>
                      {exc.status === 'pending' && (
                        <button style={{ ...styles.smallButton, background: '#52c41a' }}
                          onClick={() => approveExchange(exc.request_id)}>审批</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'recoveries' && (
          <div>
            <div style={styles.toolbar}>
              <button style={styles.button} onClick={() => exportData('recoveries')}>导出回收记录</button>
            </div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>回收ID</th>
                  <th style={styles.th}>员工</th>
                  <th style={styles.th}>尺码</th>
                  <th style={styles.th}>状态</th>
                  <th style={styles.th}>异常</th>
                  <th style={styles.th}>异常原因</th>
                  <th style={styles.th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {recoveries.map(rec => (
                  <tr key={rec.id}>
                    <td style={styles.td}>{rec.recovery_id}</td>
                    <td style={styles.td}>{rec.employee_name}</td>
                    <td style={styles.td}>{rec.size}</td>
                    <td style={styles.td}>{rec.status}</td>
                    <td style={styles.td}>{rec.is_exception ? '是' : '否'}</td>
                    <td style={styles.td}>{rec.exception_reason || '-'}</td>
                    <td style={styles.td}>
                      {rec.is_exception ? (
                        <>
                          <button style={{ ...styles.smallButton, background: '#52c41a', marginRight: '4px' }}
                            onClick={() => reviewRecovery(rec.recovery_id, true)}>通过</button>
                          <button style={{ ...styles.smallButton, background: '#ff4d4f' }}
                            onClick={() => reviewRecovery(rec.recovery_id, false)}>拒绝</button>
                        </>
                      ) : rec.status === 'pending' ? (
                        <button style={{ ...styles.smallButton, background: '#1890ff' }}
                          onClick={() => confirmRecovery(rec.recovery_id)}>确认</button>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div>
            <div style={styles.toolbar}>
              <label style={styles.button}>
                导入库存
                <input type="file" accept=".csv" style={{ display: 'none' }}
                  onChange={(e) => handleFileUpload(e, 'inventory')} />
              </label>
              <button style={styles.button} onClick={() => exportData('inventory')}>导出库存</button>
            </div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>尺码</th>
                  <th style={styles.th}>数量</th>
                  <th style={styles.th}>更新时间</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map(inv => (
                  <tr key={inv.id}>
                    <td style={styles.td}>{inv.size}</td>
                    <td style={styles.td}>{inv.quantity}</td>
                    <td style={styles.td}>{new Date(inv.updated_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div>
            <div style={styles.statsBar}>
              <div style={{ ...styles.statItem, borderLeftColor: statusColors.success }}>
                <strong>{timelineStats.success || 0}</strong> 成功
              </div>
              <div style={{ ...styles.statItem, borderLeftColor: statusColors.failed }}>
                <strong>{timelineStats.failed || 0}</strong> 失败
              </div>
              <div style={{ ...styles.statItem, borderLeftColor: statusColors.blocked }}>
                <strong>{timelineStats.blocked || 0}</strong> 拦截
              </div>
              <div style={{ ...styles.statItem, borderLeftColor: statusColors.manual }}>
                <strong>{timelineStats.manual || 0}</strong> 人工处理
              </div>
              <button style={styles.button} onClick={() => exportData('timeline')}>导出时间线</button>
            </div>
            <div style={styles.timeline}>
              {timeline.map((item, index) => (
                <div key={item.id} style={styles.timelineItem}>
                  <div style={{ ...styles.timelineDot, background: statusColors[item.status] || '#999' }} />
                  <div style={styles.timelineContent}>
                    <div style={styles.timelineType}>{item.event_type}</div>
                    <div style={styles.timelineDesc}>{item.description}</div>
                    <div style={styles.timelineTime}>{new Date(item.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'demo' && (
          <div>
            <h2 style={styles.sectionTitle}>四条演示路径</h2>
            <div style={styles.demoGrid}>
              <div style={{ ...styles.demoCard, borderTop: `4px solid ${statusColors.success}` }}>
                <h3>路径1: 成功流程</h3>
                <p>提交换码申请 → 库存充足 → 自动审批通过</p>
                <button style={{ ...styles.demoButton, background: statusColors.success }}
                  onClick={() => runDemo('success')} disabled={loading}>
                  运行演示
                </button>
              </div>
              
              <div style={{ ...styles.demoCard, borderTop: `4px solid ${statusColors.blocked}` }}>
                <h3>路径2: 拦截流程</h3>
                <p>提交换码申请 → 库存不足 → 申请被拦截失败</p>
                <button style={{ ...styles.demoButton, background: statusColors.blocked }}
                  onClick={() => runDemo('blocked')} disabled={loading}>
                  运行演示
                </button>
              </div>
              
              <div style={{ ...styles.demoCard, borderTop: `4px solid ${statusColors.manual}` }}>
                <h3>路径3: 人工修正</h3>
                <p>离职回收 → 员工在职 → 标记异常 → 需人工复核</p>
                <button style={{ ...styles.demoButton, background: statusColors.manual }}
                  onClick={() => runDemo('manual')} disabled={loading}>
                  运行演示
                </button>
              </div>
              
              <div style={{ ...styles.demoCard, borderTop: `4px solid ${statusColors.failed}` }}>
                <h3>路径4: 重复提交</h3>
                <p>重复提交 → 检测幂等键 → 返回缓存结果</p>
                <button style={{ ...styles.demoButton, background: statusColors.failed }}
                  onClick={() => runDemo('duplicate')} disabled={loading}>
                  运行演示
                </button>
              </div>
            </div>
            
            <div style={styles.infoBox}>
              <h4>💡 提示</h4>
              <p>运行演示后，请切换到"操作时间线"标签页查看完整的操作记录。重启服务后数据依然保留。</p>
              <p>幂等性验证：连续点击"重复提交"两次，第二次将返回缓存结果。</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const styles = {
  container: { minHeight: '100vh', background: '#f5f5f5' },
  header: { background: '#1890ff', color: 'white', padding: '20px 40px' },
  title: { margin: 0, fontSize: '24px' },
  message: { marginTop: '10px', padding: '10px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px' },
  nav: { background: 'white', padding: '0 40px', display: 'flex', borderBottom: '1px solid #e8e8e8' },
  tab: { padding: '15px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px' },
  tabActive: { borderBottom: '2px solid #1890ff', color: '#1890ff', fontWeight: 'bold' },
  main: { padding: '20px 40px' },
  toolbar: { marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' },
  select: { padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '4px' },
  button: { padding: '8px 16px', background: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  smallButton: { padding: '4px 8px', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  table: { width: '100%', background: 'white', borderCollapse: 'collapse', borderRadius: '4px', overflow: 'hidden' },
  th: { padding: '12px', background: '#fafafa', borderBottom: '1px solid #e8e8e8', textAlign: 'left' },
  td: { padding: '12px', borderBottom: '1px solid #e8e8e8' },
  statsBar: { display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'center' },
  statItem: { padding: '15px 20px', background: 'white', borderRadius: '4px', borderLeft: '4px solid' },
  timeline: { background: 'white', padding: '20px', borderRadius: '4px' },
  timelineItem: { display: 'flex', gap: '15px', padding: '15px 0', borderBottom: '1px solid #f0f0f0' },
  timelineDot: { width: '12px', height: '12px', borderRadius: '50%', marginTop: '5px', flexShrink: 0 },
  timelineContent: { flex: 1 },
  timelineType: { fontWeight: 'bold', fontSize: '14px' },
  timelineDesc: { color: '#666', margin: '5px 0' },
  timelineTime: { fontSize: '12px', color: '#999' },
  sectionTitle: { marginBottom: '20px', color: '#333' },
  demoGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '20px' },
  demoCard: { background: 'white', padding: '20px', borderRadius: '4px' },
  demoButton: { marginTop: '15px', padding: '10px 20px', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '100%' },
  infoBox: { background: '#e6f7ff', border: '1px solid #91d5ff', padding: '15px', borderRadius: '4px' }
};

export default App;