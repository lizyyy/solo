import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Space, message, Card, Row, Col, Statistic, Timeline } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const ReviewPanel = () => {
  const [activities, setActivities] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [activitiesRes, invoicesRes, logsRes] = await Promise.all([
        axios.get('/api/activities'),
        axios.get('/api/invoices'),
        axios.get('/api/logs', { params: { limit: 50 } })
      ]);
      setActivities(activitiesRes.data);
      setInvoices(invoicesRes.data);
      setLogs(logsRes.data);
    } catch (error) {
      message.error('加载数据失败');
    }
  };

  const pendingActivities = activities.filter(a => a.status === 'pending' || a.status === 'reviewing');
  const pendingInvoices = invoices.filter(i => i.status === 'pending');

  const activityColumns = [
    { title: '活动名称', dataIndex: 'activity_name', key: 'activity_name' },
    { title: '预计人数', dataIndex: 'expected_participants', key: 'participants' },
    { title: '预计金额', dataIndex: 'estimated_amount', key: 'amount',
      render: (val) => `¥${val.toLocaleString()}`
    },
    { title: '申请人', dataIndex: 'applicant', key: 'applicant' },
    { title: '状态', dataIndex: 'status', key: 'status',
      render: (status) => {
        const colors = { pending: 'orange', reviewing: 'blue', approved: 'green', rejected: 'red' };
        const labels = { pending: '待提交', reviewing: '审核中', approved: '已通过', rejected: '已拒绝' };
        return <Tag color={colors[status]}>{labels[status]}</Tag>;
      }
    },
    { title: '申请时间', dataIndex: 'created_at', key: 'created_at',
      render: (val) => moment(val).format('YYYY-MM-DD HH:mm')
    },
    { title: '操作', key: 'actions',
      render: () => (
        <Space>
          <Button icon={<EyeOutlined />} size="small">查看详情</Button>
        </Space>
      )
    }
  ];

  const invoiceColumns = [
    { title: '票据编号', dataIndex: 'invoice_number', key: 'invoice_number' },
    { title: '金额', dataIndex: 'invoice_amount', key: 'amount',
      render: (val) => <span style={{ fontWeight: 'bold', color: '#1890ff' }}>¥{val.toLocaleString()}</span>
    },
    { title: '供应商', dataIndex: 'vendor_name', key: 'vendor' },
    { title: '状态', dataIndex: 'status', key: 'status',
      render: (status) => {
        const colors = { pending: 'orange', approved: 'green', rejected: 'red' };
        const labels = { pending: '待审核', approved: '已通过', rejected: '已拒绝' };
        return <Tag color={colors[status]}>{labels[status]}</Tag>;
      }
    },
    { title: '提交时间', dataIndex: 'created_at', key: 'created_at',
      render: (val) => moment(val).format('YYYY-MM-DD HH:mm')
    },
    { title: '操作', key: 'actions',
      render: () => (
        <Space>
          <Button icon={<EyeOutlined />} size="small">查看票据</Button>
          <Button type="primary" size="small">审核</Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <h2>复核面板</h2>
      
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="待审核活动"
              value={pendingActivities.length}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待审核票据"
              value={pendingInvoices.length}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已通过活动"
              value={activities.filter(a => a.status === 'approved').length}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已拒绝"
              value={activities.filter(a => a.status === 'rejected').length + invoices.filter(i => i.status === 'rejected').length}
              valueStyle={{ color: '#f5222d' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="待审核活动列表" style={{ marginBottom: 24 }}>
        <Table
          columns={activityColumns}
          dataSource={pendingActivities}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>

      <Card title="待审核票据列表" style={{ marginBottom: 24 }}>
        <Table
          columns={invoiceColumns}
          dataSource={pendingInvoices}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>

      <Card title="最近操作日志">
        <Timeline>
          {logs.slice(0, 10).map(log => (
            <Timeline.Item key={log.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  <Tag color={log.operation_type === 'create' ? 'blue' : log.operation_type === 'approve' ? 'green' : 'orange'}>
                    {log.operation_type}
                  </Tag>
                  <strong>{log.operator}</strong> {log.details}
                  <span style={{ color: '#999', marginLeft: 8 }}>({log.target_type})</span>
                </span>
                <span style={{ color: '#999' }}>{moment(log.created_at).format('YYYY-MM-DD HH:mm:ss')}</span>
              </div>
            </Timeline.Item>
          ))}
        </Timeline>
      </Card>
    </div>
  );
};

export default ReviewPanel;
