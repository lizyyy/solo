import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Button, Spin, message } from 'antd';
import {
  ClockCircleOutlined,
  ToolOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { dashboardApi } from '../api';
import dayjs from 'dayjs';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await dashboardApi.getStats();
      setStats(response.data.data);
    } catch (error) {
      console.error('加载统计数据失败:', error);
      message.error('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colorMap = {
      pending: 'orange',
      in_progress: 'blue',
      waiting_parts: 'red',
      completed: 'green'
    };
    return colorMap[status] || 'default';
  };

  const statCards = stats ? [
    {
      title: '待接单',
      value: stats.work_order_stats.pending.count,
      icon: <ClockCircleOutlined />,
      color: '#fa8c16'
    },
    {
      title: '维修中',
      value: stats.work_order_stats.in_progress.count,
      icon: <ToolOutlined />,
      color: '#1890ff'
    },
    {
      title: '等待备件',
      value: stats.work_order_stats.waiting_parts.count,
      icon: <AlertOutlined />,
      color: '#f5222d'
    },
    {
      title: '已完成',
      value: stats.work_order_stats.completed.count,
      icon: <CheckCircleOutlined />,
      color: '#52c41a'
    }
  ] : [];

  const lowStockColumns = [
    {
      title: '备件名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '型号',
      dataIndex: 'model',
      key: 'model'
    },
    {
      title: '当前库存',
      dataIndex: 'stock',
      key: 'stock',
      render: (stock) => (
        <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
          {stock}
        </span>
      )
    },
    {
      title: '安全库存',
      dataIndex: 'safe_stock',
      key: 'safe_stock'
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => {
        const diff = record.safe_stock - record.stock;
        return (
          <Tag color="red">
            缺货 {diff} 件
          </Tag>
        );
      }
    }
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
        <p style={{ marginTop: 16 }}>加载中...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 8 }}>今日看板</h1>
        <p style={{ color: '#666' }}>
          今日新增: {stats?.today_stats.created || 0} 单 | 
          今日完成: {stats?.today_stats.completed || 0} 单
        </p>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        {statCards.map((card, index) => (
          <Col xs={12} sm={6} key={index}>
            <Card hoverable>
              <Statistic
                title={card.title}
                value={card.value}
                prefix={
                  <span style={{ color: card.color }}>{card.icon}</span>
                }
                valueStyle={{ color: card.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card 
        title={
          <span>
            <AlertOutlined style={{ marginRight: 8 }} />
            库存低于安全线的备件
          </span>
        }
        extra={
          <Button type="primary" href="#/spare-parts">
            查看所有备件
          </Button>
        }
      >
        {stats?.low_stock_parts && stats.low_stock_parts.length > 0 ? (
          <Table
            columns={lowStockColumns}
            dataSource={stats.low_stock_parts}
            rowKey="id"
            pagination={false}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 24, color: '#52c41a' }}>
            <CheckCircleOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <p>所有备件库存充足</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Dashboard;
