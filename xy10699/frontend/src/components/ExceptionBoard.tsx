import React from 'react';
import { Card, List, Tag, Typography } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;

interface Exception {
  serviceName: string;
  requestId: string;
  environment: string;
  impactLevel: string;
  errorMessage: string;
  occurredAt: Date;
}

interface ExceptionBoardProps {
  exceptions: Exception[];
}

const ExceptionBoard: React.FC<ExceptionBoardProps> = ({ exceptions }) => {
  const getEnvironmentColor = (env: string) => {
    const colors: Record<string, string> = {
      prod: 'red',
      staging: 'orange',
      test: 'blue',
      dev: 'green'
    };
    return colors[env] || 'default';
  };

  const getImpactColor = (level: string) => {
    const colors: Record<string, string> = {
      critical: 'red',
      high: 'orange',
      medium: 'blue',
      low: 'green'
    };
    return colors[level] || 'default';
  };

  return (
    <Card
      title={
        <span>
          <WarningOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
          异常看板
        </span>
      }
      style={{ height: '100%' }}
    >
      <List
        dataSource={exceptions}
        renderItem={(item) => (
          <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
            <List.Item.Meta
              avatar={<WarningOutlined style={{ fontSize: '24px', color: '#ff4d4f' }} />}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text strong>{item.serviceName}</Text>
                  <Tag color={getEnvironmentColor(item.environment)}>{item.environment}</Tag>
                  <Tag color={getImpactColor(item.impactLevel)}>{item.impactLevel}</Tag>
                </div>
              }
              description={
                <div>
                  <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 4 }}>
                    {item.errorMessage}
                  </Paragraph>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#999' }}>
                    <span>申请ID: {item.requestId}</span>
                    <span>发生时间: {dayjs(item.occurredAt).format('YYYY-MM-DD HH:mm:ss')}</span>
                  </div>
                </div>
              }
            />
          </List.Item>
        )}
        locale={{ emptyText: '暂无异常数据' }}
      />
    </Card>
  );
};

export default ExceptionBoard;
