import React, { useEffect, useState } from 'react';
import { vehicleApi } from '../api';
import { VehicleAvailability, STATUS_LABELS, STATUS_COLORS } from '../types';

const Dashboard: React.FC = () => {
  const [availability, setAvailability] = useState<VehicleAvailability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await vehicleApi.getAllAvailability();
      setAvailability(data);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>;
  }

  const availableCount = availability.filter(v => v.isAvailable).length;
  const totalTires = availability.reduce((sum, v) => sum + v.installedTires.length, 0);
  const missingTires = availability.reduce((sum, v) => sum + v.missingTireCount, 0);

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#1f2937', marginBottom: '8px' }}>
          车辆可用性看板
        </h2>
        <p style={{ color: '#6b7280' }}>实时监控车队轮胎状态和车辆可用性</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ 
          background: 'white', 
          padding: '20px', 
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>车辆总数</div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937' }}>{availability.length}</div>
        </div>
        <div style={{ 
          background: 'white', 
          padding: '20px', 
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>可用车辆</div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#10b981' }}>{availableCount}</div>
        </div>
        <div style={{ 
          background: 'white', 
          padding: '20px', 
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>已装轮胎</div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#3b82f6' }}>{totalTires}</div>
        </div>
        <div style={{ 
          background: 'white', 
          padding: '20px', 
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>缺胎数量</div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#ef4444' }}>{missingTires}</div>
        </div>
      </div>

      <div style={{ 
        background: 'white', 
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937' }}>车辆状态详情</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#6b7280' }}>车牌号</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#6b7280' }}>车型</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#6b7280' }}>状态</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#6b7280' }}>轮胎情况</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#6b7280' }}>问题</th>
              </tr>
            </thead>
            <tbody>
              {availability.map(va => (
                <tr key={va.vehicle.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontWeight: 600, color: '#1f2937' }}>{va.vehicle.plate_number}</div>
                  </td>
                  <td style={{ padding: '16px 20px', color: '#6b7280' }}>{va.vehicle.model}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      fontSize: '12px',
                      fontWeight: 500,
                      backgroundColor: va.isAvailable ? '#dcfce7' : '#fee2e2',
                      color: va.isAvailable ? '#166534' : '#991b1b',
                    }}>
                      {va.isAvailable ? '✓ 可出车' : '✗ 不可出车'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {va.installedTires.map(tire => (
                        <span
                          key={tire.id}
                          title={`${tire.serial_number} - ${STATUS_LABELS[tire.current_status]}`}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: STATUS_COLORS[tire.current_status],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          ●
                        </span>
                      ))}
                      {Array(va.missingTireCount).fill(0).map((_, i) => (
                        <span
                          key={`empty-${i}`}
                          title="缺胎"
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: '#f3f4f6',
                            border: '2px dashed #d1d5db',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#9ca3af',
                            fontSize: '12px',
                          }}
                        >
                          ?
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                      {va.installedTires.length} / {va.vehicle.tire_count} 个轮胎
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    {va.issues.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {va.issues.map((issue, i) => (
                          <span key={i} style={{ fontSize: '12px', color: '#dc2626' }}>• {issue}</span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#10b981' }}>无问题</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
