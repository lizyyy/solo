import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Space, Tabs, message } from 'antd';
import {
  CarOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { dashboardAPI } from '../services/api';

const Dashboard = () => {
  const [overview, setOverview] = useState({});
  const [abnormalData, setAbnormalData] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [overviewRes, abnormalRes] = await Promise.all([
        dashboardAPI.overview(),
        dashboardAPI.abnormal(),
      ]);
      if (overviewRes.success) setOverview(overviewRes.data);
      if (abnormalRes.success) setAbnormalData(abnormalRes.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const expiringColumns = [
    {
      title: '车牌号',
      dataIndex: 'plate_number',
      key: 'plate_number',
    },
    {
      title: '车主姓名',
      dataIndex: 'owner_name',
      key: 'owner_name',
    },
    {
      title: '有效期至',
      dataIndex: 'valid_to',
      key: 'valid_to',
      render: (text) => <Tag color="orange">{text}</Tag>,
    },
  ];

  const expiredColumns = [
    {
      title: '车牌号',
      dataIndex: 'plate_number',
      key: 'plate_number',
    },
    {
      title: '车主姓名',
      dataIndex: 'owner_name',
      key: 'owner_name',
    },
    {
      title: '有效期至',
      dataIndex: 'valid_to',
      key: 'valid_to',
      render: (text) => <Tag color="red">{text}</Tag>,
    },
  ];

  const arrearsColumns = [
    {
      title: '车牌号',
      dataIndex: 'plate_number',
      key: 'plate_number',
    },
    {
      title: '账期',
      dataIndex: 'bill_month',
      key: 'bill_month',
    },
    {
      title: '欠费金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (text) => `¥${text}`,
    },
  ];

  const tabItems = [
    {
      key: '1',
      label: '即将到期',
      children: (
        <Table
          columns={expiringColumns}
          dataSource={overview.expiring_list || []}
          rowKey="id"
          pagination={false}
          loading={loading}
        />
      ),
    },
    {
      key: '2',
      label: '已过期',
      children: (
        <Table
          columns={expiredColumns}
          dataSource={overview.expired_list || []}
          rowKey="id"
          pagination={false}
          loading={loading}
        />
      ),
    },
    {
      key: '3',
      label: '长期欠费',
      children: (
        <Table
          columns={arrearsColumns}
          dataSource={abnormalData.arrears_unpaid || []}
          rowKey="id"
          pagination={false}
          loading={loading}
        />
      ),
    },
    {
      key: '4',
      label: '权限不一致',
      children: (
        <Table
          columns={expiredColumns}
          dataSource={abnormalData.permission_inconsistency || []}
          rowKey="id"
          pagination={false}
          loading={loading}
        />
      ),
    },
    {
      key: '5',
      label: '支付异常',
      children: (
        <Table
          columns={[
            { title: '车牌号', dataIndex: 'plate_number', key: 'plate_number' },
            { title: '交易号', dataIndex: 'transaction_no', key: 'transaction_no' },
            { title: '金额', dataIndex: 'amount', key: 'amount', render: (text) => `¥${text}` },
            { title: '状态', dataIndex: 'status', key: 'status', render: (text) => <Tag color="red">{text}</Tag> },
          ]}
          dataSource={abnormalData.payment_exception || []}
          rowKey="id"
          pagination={false}
          loading={loading}
        />
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="绑定车辆数"
              value={overview.total_bindings || 0}
              prefix={<CarOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理欠费"
              value={overview.total_arrears || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月续费"
              value={overview.monthly_renewals || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃黑名单"
              value={overview.active_blacklist || 0}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic
              title="即将到期(7天内)"
              value={overview.expiring_soon || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="已过期"
              value={overview.expired || 0}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="异常监控看板">
        <Tabs defaultActiveKey="1" items={tabItems} />
      </Card>
    </Space>
  );
};

export default Dashboard;
