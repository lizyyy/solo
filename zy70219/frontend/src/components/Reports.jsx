import React, { useState, useEffect } from 'react';

function Reports({ onViewReservation }) {
  const [dashboardStats, setDashboardStats] = useState({});
  const [utilization, setUtilization] = useState([]);
  const [equipmentSchedule, setEquipmentSchedule] = useState([]);
  const [timeline, setTimeline] = useState({ reservations: [], cleanings: [], fireInspections: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, utilRes, equipRes, timelineRes] = await Promise.all([
        fetch('/api/reports/dashboard'),
        fetch('/api/reports/kitchen-utilization'),
        fetch('/api/reports/equipment-schedule'),
        fetch('/api/reports/timeline')
      ]);
      
      setDashboardStats(await statsRes.json());
      setUtilization(await utilRes.json());
      setEquipmentSchedule(await equipRes.json());
      setTimeline(await timelineRes.json());
    } catch (err) {
      setError('获取报表数据失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusLabel = (status) => {
    const labels = {
      draft: '草稿',
      submitted: '待审批',
      approved: '已批准',
      rejected: '已驳回',
      pending: '待确认',
      confirmed: '已确认'
    };
    return labels[status] || status;
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      {error && <div className="error-message">{error}</div>}
      
      <div className="dashboard-grid">
        <div className="stat-card primary">
          <div className="label">总预约数</div>
          <div className="value">{dashboardStats.totalReservations || 0}</div>
        </div>
        <div className="stat-card warning">
          <div className="label">待审批</div>
          <div className="value">{dashboardStats.submittedReservations || 0}</div>
        </div>
        <div className="stat-card success">
          <div className="label">已批准</div>
          <div className="value">{dashboardStats.approvedReservations || 0}</div>
        </div>
        <div className="stat-card danger">
          <div className="label">已驳回</div>
          <div className="value">{dashboardStats.rejectedReservations || 0}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>本周厨房利用率</h2>
          <button 
            className="button button-secondary button-sm"
            onClick={fetchData}
          >
            刷新
          </button>
        </div>
        <div className="card-body">
          {utilization.length === 0 ? (
            <p style={{ color: '#64748b' }}>暂无厨房数据</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>厨房</th>
                  <th>容量</th>
                  <th>本周预约数</th>
                  <th>已批准</th>
                  <th>已驳回</th>
                </tr>
              </thead>
              <tbody>
                {utilization.map(k => (
                  <tr key={k.id}>
                    <td>{k.name}</td>
                    <td>{k.capacity} 个团队</td>
                    <td>{k.reservations_count || 0}</td>
                    <td>
                      <span className="badge badge-approved">{k.approved_count || 0}</span>
                    </td>
                    <td>
                      <span className="badge badge-rejected">{k.rejected_count || 0}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>设备档期占用</h2>
        </div>
        <div className="card-body">
          {equipmentSchedule.length === 0 ? (
            <p style={{ color: '#64748b' }}>暂无设备数据</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>设备</th>
                  <th>类型</th>
                  <th>所在厨房</th>
                  <th>使用团队</th>
                  <th>时间</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {equipmentSchedule.filter(e => e.reservation_id).map(e => (
                  <tr key={`${e.id}-${e.reservation_id || 'empty'}`}>
                    <td>{e.name}</td>
                    <td>{e.type || '-'}</td>
                    <td>{e.kitchen_name}</td>
                    <td>{e.team_name || '-'}</td>
                    <td>
                      {e.start_time ? `${formatTime(e.start_time)} - ${formatTime(e.end_time)}` : '-'}
                    </td>
                    <td>
                      <span className={`badge badge-${e.booking_status === 'confirmed' ? 'approved' : 'draft'}`}>
                        {getStatusLabel(e.booking_status)}
                      </span>
                    </td>
                    <td>
                      {e.reservation_id && (
                        <button
                          className="button button-secondary button-sm"
                          onClick={() => onViewReservation(e.reservation_id)}
                        >
                          查看预约
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>档期时间线概览</h2>
        </div>
        <div className="card-body">
          <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', background: '#667eea', borderRadius: '2px' }}></div>
                <span style={{ fontSize: '0.85rem' }}>餐饮团队预约</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '2px' }}></div>
                <span style={{ fontSize: '0.85rem' }}>清洁窗口</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '2px' }}></div>
                <span style={{ fontSize: '0.85rem' }}>消防检查</span>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: '#f5f3ff', borderRadius: '8px', borderLeft: '4px solid #667eea' }}>
              <h4 style={{ marginBottom: '1rem', color: '#4338ca' }}>餐饮团队预约 ({timeline.reservations.length})</h4>
              {timeline.reservations.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>暂无</p>
              ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {timeline.reservations.map(r => (
                    <div 
                      key={r.id} 
                      style={{ 
                        padding: '0.75rem', 
                        background: 'white', 
                        borderRadius: '6px', 
                        marginBottom: '0.5rem',
                        cursor: 'pointer'
                      }}
                      onClick={() => onViewReservation(r.id)}
                    >
                      <div style={{ fontWeight: 500 }}>{r.team_name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {r.kitchen_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {formatTime(r.start_time)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
              <h4 style={{ marginBottom: '1rem', color: '#065f46' }}>清洁窗口 ({timeline.cleanings.length})</h4>
              {timeline.cleanings.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>暂无</p>
              ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {timeline.cleanings.map(c => (
                    <div key={c.id} style={{ padding: '0.75rem', background: 'white', borderRadius: '6px', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 500 }}>🧹 {c.kitchen_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {formatTime(c.start_time)} - {formatTime(c.end_time)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
              <h4 style={{ marginBottom: '1rem', color: '#991b1b' }}>消防检查 ({timeline.fireInspections.length})</h4>
              {timeline.fireInspections.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>暂无</p>
              ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {timeline.fireInspections.map(f => (
                    <div key={f.id} style={{ padding: '0.75rem', background: 'white', borderRadius: '6px', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 500 }}>🔥 {f.kitchen_name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {f.inspector || '检查员未指定'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {formatTime(f.scheduled_time)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>完整业务流程</h2>
        </div>
        <div className="card-body">
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '1rem',
            background: '#f8fafc',
            borderRadius: '8px'
          }}>
            <div style={{ textAlign: 'center', flex: 1, minWidth: '120px' }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                background: '#667eea', 
                borderRadius: '50%', 
                color: 'white', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto 0.5rem',
                fontWeight: 600
              }}>1</div>
              <div style={{ fontWeight: 500 }}>创建厨房档案</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>添加厨房和设备</div>
            </div>
            <div style={{ color: '#cbd5e1', fontSize: '1.5rem' }}>→</div>
            <div style={{ textAlign: 'center', flex: 1, minWidth: '120px' }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                background: '#667eea', 
                borderRadius: '50%', 
                color: 'white', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto 0.5rem',
                fontWeight: 600
              }}>2</div>
              <div style={{ fontWeight: 500 }}>团队创建预约</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>选择设备和时间</div>
            </div>
            <div style={{ color: '#cbd5e1', fontSize: '1.5rem' }}>→</div>
            <div style={{ textAlign: 'center', flex: 1, minWidth: '120px' }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                background: '#667eea', 
                borderRadius: '50%', 
                color: 'white', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto 0.5rem',
                fontWeight: 600
              }}>3</div>
              <div style={{ fontWeight: 500 }}>提交审批</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>系统检测冲突</div>
            </div>
            <div style={{ color: '#cbd5e1', fontSize: '1.5rem' }}>→</div>
            <div style={{ textAlign: 'center', flex: 1, minWidth: '120px' }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                background: '#667eea', 
                borderRadius: '50%', 
                color: 'white', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto 0.5rem',
                fontWeight: 600
              }}>4</div>
              <div style={{ fontWeight: 500 }}>管理员审批</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>批准/驳回</div>
            </div>
            <div style={{ color: '#cbd5e1', fontSize: '1.5rem' }}>→</div>
            <div style={{ textAlign: 'center', flex: 1, minWidth: '120px' }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                background: '#10b981', 
                borderRadius: '50%', 
                color: 'white', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto 0.5rem',
                fontWeight: 600
              }}>✓</div>
              <div style={{ fontWeight: 500 }}>设备锁定</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>档期确认</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reports;
