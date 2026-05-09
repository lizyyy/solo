import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Space, message } from 'antd';
import {
  ShoppingOutlined,
  WarningOutlined,
  DollarCircleOutlined,
  HistoryOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import dashboardService from '../services/dashboardService';
import dayjs from 'dayjs';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentOps, setRecentOps] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, opsRes, lowStockRes] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getRecentOperations(10),
        dashboardService.getLowStockAlerts()
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (opsRes.success) setRecentOps(opsRes.data);
      if (lowStockRes.success) setLowStockItems(lowStockRes.data);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const operationTypeMap = {
    CREATE: { color: 'green', label: '创建' },
    UPDATE: { color: 'blue', label: '更新' },
    ADJUST: { color: 'orange', label: '调整' },
    TRANSFER_IN: { color: 'cyan', label: '调入' },
    TRANSFER_OUT: { color: 'purple', label: '调出' },
    PRICE_CHANGE: { color: 'magenta', label: '改价' }
  };

  const operationColumns = [
    {
      title: '操作类型',
      dataIndex: 'operationType',
      key: 'operationType',
      width: 100,
      render: (type) => {
        const info = operationTypeMap[type] || { color: 'default', label: type };
        return <Tag color={info.color}>{info.label}</Tag>;
      }
    },
    {
      title: '商品',
      key: 'product',
      render: (_, record) => (
        <span>
          {record.Inventory?.Product?.name || '-'}
          <br />
          <span style={{ color: '#888', fontSize: '12px' }}>
            {record.Inventory?.Store?.name || '-'}
          </span>
        </span>
      )
    },
    {
      title: '变更内容',
      key: 'change',
      render: (_, record) => {
        const before = record.beforeState?.quantity ?? '-';
        const after = record.afterState?.quantity ?? '-';
        return `${before} → ${after}`;
      }
    },
    {
      title: '操作人',
      dataIndex: ['User', 'name'],
      key: 'operator',
      width: 80
    },
    {
      title: '时间',
      dataIndex: 'operationAt',
      key: 'operationAt',
      width: 160,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    }
  ];

  const lowStockColumns = [
    {
      title: '商品',
      key: 'product',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.Product?.name}</span>
          <span style={{ color: '#888', fontSize: '12px' }}>{record.Product?.sku}</span>
        </Space>
      )
    },
    {
      title: '门店',
      dataIndex: ['Store', 'name'],
      key: 'store',
      width: 120
    },
    {
      title: '当前库存',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      render: (qty, record) => (
        <Space>
          <Tag color={qty <= record.minStock ? 'red' : 'orange'}>{qty}</Tag>
          <span style={{ color: '#888' }}>/ {record.minStock}</span>
        </Space>
      )
    },
    {
      title: '单价',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (price) => `¥${Number(price).toFixed(2)}`
    }
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>仪表盘</h2>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={loadData} 
          loading={loading}
        >
          刷新
        </Button>
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="库存总数量"
              value={stats?.totalInventory || 0}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="商品种类"
              value={stats?.totalItems || 0}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="库存总价值"
              value={stats?.totalValue || 0}
              precision={2}
              prefix={<DollarCircleOutlined />}
              suffix="元"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="低库存商品"
              value={stats?.lowStockCount || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card 
            title={
              <Space>
                <HistoryOutlined />
                <span>最近操作</span>
              </Space>
            }
            extra={<Link to="/operations">查看全部</Link>}
          >
            <Table
              columns={operationColumns}
              dataSource={recentOps}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card 
            title={
              <Space>
                <WarningOutlined style={{ color: '#cf1322' }} />
                <span>低库存预警</span>
              </Space>
            }
          >
            <Table
              columns={lowStockColumns}
              dataSource={lowStockItems}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;
