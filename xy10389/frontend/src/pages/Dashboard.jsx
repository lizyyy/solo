import React from 'react';

function Dashboard({ summary, onNavigate }) {
  const statCards = [
    { label: '总笼位数', value: summary?.totalCages || 0, color: '' },
    { label: '已占用', value: summary?.occupiedCages || 0, color: '' },
    { label: '可使用', value: summary?.availableCages || 0, color: '' },
    { label: '在院病例', value: summary?.activeHospitalizations || 0, color: '' },
    { label: '传染病病例', value: summary?.infectiousCases || 0, color: 'warning' },
    { label: '待处理护理', value: summary?.pendingTasks || 0, color: 'warning' },
    { label: '待审批转笼', value: summary?.pendingTransfers || 0, color: 'warning' },
    { label: '未解决异常', value: summary?.unresolvedAlerts || 0, color: 'warning' }
  ];

  return (
    <div>
      <div className="stats-grid">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className={`stat-card ${stat.color}`}
            style={{ cursor: 'pointer' }}
            onClick={() => {
              if (index === 1 || index === 2) onNavigate('cages');
              if (index === 3 || index === 4) onNavigate('hospitalizations');
              if (index === 5) onNavigate('care-tasks');
              if (index === 6) onNavigate('transfers');
              if (index === 7) onNavigate('alerts');
            }}
          >
            <div className="label">{stat.label}</div>
            <div className="value">{stat.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="table-container">
          <div className="table-header">
            <h3>📋 快速操作指南</h3>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ color: '#333', marginBottom: '8px', fontSize: '14px' }}>隔离规则</h4>
              <ul style={{ paddingLeft: '20px', fontSize: '13px', color: '#666' }}>
                <li>猫和狗不能同住一笼</li>
                <li>传染病病例必须使用隔离笼位</li>
                <li>隔离笼位不能放置非传染病病例</li>
              </ul>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ color: '#333', marginBottom: '8px', fontSize: '14px' }}>出院规则</h4>
              <ul style={{ paddingLeft: '20px', fontSize: '13px', color: '#666' }}>
                <li>所有护理任务必须完成</li>
                <li>待处理任务会阻止出院</li>
              </ul>
            </div>
            <div>
              <h4 style={{ color: '#333', marginBottom: '8px', fontSize: '14px' }}>状态说明</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px' }}>
                <span className="status-badge status-pending">待处理</span>
                <span className="status-badge status-approved">已确认</span>
                <span className="status-badge status-rejected">已驳回</span>
                <span className="status-badge status-closed">已关闭</span>
              </div>
            </div>
          </div>
        </div>

        <div className="table-container">
          <div className="table-header">
            <h3>🎯 样例数据测试场景</h3>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ color: '#333', marginBottom: '8px', fontSize: '14px' }}>普通住院</h4>
              <p style={{ fontSize: '13px', color: '#666' }}>
                ADM-2026-001 豆豆（金毛）- 胃肠炎
              </p>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ color: '#333', marginBottom: '8px', fontSize: '14px' }}>传染病隔离</h4>
              <p style={{ fontSize: '13px', color: '#666' }}>
                ADM-2026-002 咪咪（英短）- 猫瘟热（隔离笼 ISO-001）
              </p>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ color: '#333', marginBottom: '8px', fontSize: '14px' }}>转笼成功记录</h4>
              <p style={{ fontSize: '13px', color: '#666' }}>
                豆豆 从 A-001 转至 A-002（已批准）
              </p>
            </div>
            <div>
              <h4 style={{ color: '#333', marginBottom: '8px', fontSize: '14px' }}>出院拦截测试</h4>
              <p style={{ fontSize: '13px', color: '#666' }}>
                ADM-2026-003 旺财 - 有3个待处理护理任务
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
