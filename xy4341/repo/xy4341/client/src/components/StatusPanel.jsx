import React, { useEffect } from 'react';
import { Statistic } from 'antd';
import { UserOutlined, TeamOutlined, SafetyOutlined, WarningOutlined } from '@ant-design/icons';
import useStore from '../store';

function StatusPanel() {
  const { persons, loadPersons } = useStore();
  
  useEffect(() => {
    loadPersons();
  }, []);
  
  const getStatusSummary = () => {
    const summary = { idle: 0, evacuating: 0, evacuated: 0, trapped: 0, injured: 0 };
    persons.forEach(p => {
      if (summary[p.status] !== undefined) {
        summary[p.status]++;
      }
    });
    return summary;
  };
  
  const summary = getStatusSummary();
  const total = persons.length;
  
  return (
    <div className="panel-card">
      <div className="panel-header">
        <h3 className="panel-title">人员状态</h3>
        <span style={{ fontSize: '12px', color: '#666' }}>
          总计: {total} 人
        </span>
      </div>
      <div className="panel-body">
        <div className="status-summary">
          <div className="status-item idle">
            <Statistic
              value={summary.idle}
              prefix={<UserOutlined />}
              valueStyle={{ fontSize: '20px', color: '#1890ff' }}
            />
            <div className="status-label">待疏散</div>
          </div>
          
          <div className="status-item evacuating">
            <Statistic
              value={summary.evacuating}
              prefix={<TeamOutlined />}
              valueStyle={{ fontSize: '20px', color: '#faad14' }}
            />
            <div className="status-label">疏散中</div>
          </div>
          
          <div className="status-item evacuated">
            <Statistic
              value={summary.evacuated}
              prefix={<SafetyOutlined />}
              valueStyle={{ fontSize: '20px', color: '#52c41a' }}
            />
            <div className="status-label">已疏散</div>
          </div>
          
          <div className="status-item trapped">
            <Statistic
              value={summary.trapped}
              prefix={<WarningOutlined />}
              valueStyle={{ fontSize: '20px', color: '#ff4d4f' }}
            />
            <div className="status-label">被困</div>
          </div>
        </div>
        
        {total > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: 8 }}>
              疏散进度
            </div>
            <div style={{ 
              height: 8, 
              background: '#f0f0f0', 
              borderRadius: 4,
              overflow: 'hidden',
              display: 'flex'
            }}>
              <div style={{ 
                width: `${(summary.idle / total) * 100}%`, 
                background: '#1890ff',
                height: '100%'
              }} />
              <div style={{ 
                width: `${(summary.evacuating / total) * 100}%`, 
                background: '#faad14',
                height: '100%'
              }} />
              <div style={{ 
                width: `${(summary.evacuated / total) * 100}%`, 
                background: '#52c41a',
                height: '100%'
              }} />
              <div style={{ 
                width: `${(summary.trapped / total) * 100}%`, 
                background: '#ff4d4f',
                height: '100%'
              }} />
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontSize: '11px', 
              color: '#999',
              marginTop: 4
            }}>
              <span>疏散率: {((summary.evacuated / total) * 100).toFixed(1)}%</span>
              <span>待疏散: {((summary.idle / total) * 100).toFixed(1)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StatusPanel;
