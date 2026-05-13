import React from 'react';
import { Card, Statistic, Row, Col, Progress, Space } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

interface StatCardProps {
  title: string;
  value: number | string;
  prefix?: React.ReactNode;
  suffix?: string;
  valueStyle?: React.CSSProperties;
  trend?: number;
  progress?: number;
  progressColor?: string;
  extra?: React.ReactNode;
  children?: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  prefix,
  suffix,
  valueStyle,
  trend,
  progress,
  progressColor,
  extra,
  children
}) => {
  return (
    <Card>
      <Statistic
        title={title}
        value={value}
        prefix={prefix}
        suffix={suffix}
        valueStyle={valueStyle}
      />
      {trend !== undefined && (
        <Space style={{ marginTop: 8 }}>
          {trend >= 0 ? <ArrowUpOutlined style={{ color: '#cf1322' }} /> : <ArrowDownOutlined style={{ color: '#3f8600' }} />}
          <span style={{ color: trend >= 0 ? '#cf1322' : '#3f8600' }}>
            {Math.abs(trend)}%
          </span>
        </Space>
      )}
      {progress !== undefined && (
        <Progress
          percent={progress}
          strokeColor={progressColor || '#1890ff'}
          showInfo={false}
          style={{ marginTop: 8 }}
        />
      )}
      {extra}
      {children}
    </Card>
  );
};

export default StatCard;
