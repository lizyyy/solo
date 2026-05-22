import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, message } from 'antd';
import {
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  LockOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { apiClient } from '../utils/api';
import { ReportSummary, BatchStatus, BatchStatusLabel } from '../../shared/types.js';

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReportSummary | null>(null);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      const result = await apiClient.get<ReportSummary>('/reports/summary');
      setSummary(result);
    } catch (error) {
      message.error('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>仪表盘</h2>
      
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总批次数"
              value={summary?.totalBatches || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1e3a5f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待复核"
              value={summary?.statusCounts?.[BatchStatus.PENDING_REVIEW] || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已冻结"
              value={summary?.statusCounts?.[BatchStatus.FROZEN] || 0}
              prefix={<LockOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已结算"
              value={summary?.statusCounts?.[BatchStatus.SETTLED] || 0}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="各状态批次统计">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {Object.entries(BatchStatusLabel).map(([status, label]) => (
                <div key={status} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: '#f5f5f5',
                  borderRadius: 4
                }}>
                  <span>{label}</span>
                  <span style={{ fontWeight: 'bold' }}>
                    {summary?.statusCounts?.[status as BatchStatus] || 0}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="冻结前状态分布">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {Object.entries(BatchStatusLabel).map(([status, label]) => {
                const count = summary?.frozenBeforeStatus?.[status as BatchStatus] || 0;
                if (count === 0) return null;
                return (
                  <div key={status} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: '#e6f7ff',
                    borderRadius: 4
                  }}>
                    <span>{label}</span>
                    <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="改判理由TOP">
            {summary?.reviewReasons && summary.reviewReasons.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {summary.reviewReasons.map((item, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: index === 0 ? '#fff7e6' : '#fafafa',
                    borderRadius: 4
                  }}>
                    <span style={{ 
                      maxWidth: '70%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.reason}
                    </span>
                    <span style={{ fontWeight: 'bold' }}>{item.count} 次</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                暂无改判记录
              </div>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="系统提示">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ 
                padding: 12, 
                background: summary?.permissionDeniedCount ? '#fff1f0' : '#f6ffed',
                borderRadius: 4,
                borderLeft: `4px solid ${summary?.permissionDeniedCount ? '#ff4d4f' : '#52c41a'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {summary?.permissionDeniedCount ? (
                    <WarningOutlined style={{ color: '#ff4d4f' }} />
                  ) : (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  )}
                  <span style={{ fontWeight: 'bold' }}>
                    权限拦截记录：{summary?.permissionDeniedCount || 0} 次
                  </span>
                </div>
              </div>
              <div style={{ padding: 12, background: '#e6f7ff', borderRadius: 4 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>平均处理时长</div>
                <div style={{ fontSize: 24, color: '#1890ff', fontWeight: 'bold' }}>
                  {summary?.avgProcessingTime?.toFixed(1) || 0} 小时
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
