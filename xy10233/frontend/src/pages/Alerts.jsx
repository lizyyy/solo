import React, { useEffect, useState } from 'react';
import {
  Table, Button, Tag, Space, message, Select, Card, Row, Col, Statistic,
  Modal, Input
} from 'antd';
import { CheckCircleOutlined, WarningOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { alertApi } from '../services/api';
import dayjs from 'dayjs';

const { Option } = Select;

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await alertApi.getAll();
      setAlerts(res.data.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleAcknowledge = async (alertId) => {
    try {
      await alertApi.acknowledge(alertId);
      message.success('确认成功');
      fetchAlerts();
    } catch (error) {
      message.error('确认失败');
    }
  };

  const handleResolve = (alert) => {
    setSelectedAlert(alert);
    setResolutionNotes('');
    setResolveModalVisible(true);
  };

  const handleResolveSubmit = async () => {
    try {
      await alertApi.resolve(selectedAlert.id, resolutionNotes);
      message.success('解决成功');
      setResolveModalVisible(false);
      fetchAlerts();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const filteredAlerts = statusFilter === 'all' 
    ? alerts 
    : alerts.filter(a => a.status === statusFilter);

  const stats = {
    total: alerts.length,
    active: alerts.filter(a => a.status === 'active').length,
    acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
    resolved: alerts.filter(a => a.status === 'resolved').length
  };

  const getTypeIcon = (type) => {
    if (type.includes('temperature')) return '🌡️';
    if (type.includes('salinity')) return '💧';
    if (type.includes('oxygen')) return '🫧';
    return '⚠️';
  };

  const columns = [
    {
      title: '类型',
      key: 'type',
      render: (_, record) => (
        <Space>
          <span style={{ fontSize: 18 }}>{getTypeIcon(record.alert_type)}</span>
          <Tag>{record.alert_type}</Tag>
        </Space>
      )
    },
    { title: '暂养池', dataIndex: 'tank_name', key: 'tank' },
    { title: '消息', dataIndex: 'message', key: 'message', ellipsis: true },
    {
      title: '阈值',
      key: 'threshold',
      render: (_, record) => (
        <span style={{ color: '#1890ff' }}>{record.threshold_value}</span>
      )
    },
    {
      title: '实际值',
      key: 'actual',
      render: (_, record) => (
        <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{record.actual_value}</span>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          active: 'red',
          acknowledged: 'orange',
          resolved: 'green'
        };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created',
      render: (t) => dayjs(t).format('MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          {record.status === 'active' && (
            <Button size="small" onClick={() => handleAcknowledge(record.id)}>确认</Button>
          )}
          {record.status !== 'resolved' && (
            <Button size="small" type="primary" onClick={() => handleResolve(record)}>解决</Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>报警管理</h2>
        <Space>
          <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 150 }}>
            <Option value="all">全部状态</Option>
            <Option value="active">活跃</Option>
            <Option value="acknowledged">已确认</Option>
            <Option value="resolved">已解决</Option>
          </Select>
          <Button onClick={fetchAlerts}>刷新</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic 
              title="总报警" 
              value={stats.total} 
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic 
              title="活跃报警" 
              value={stats.active} 
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic 
              title="已确认" 
              value={stats.acknowledged} 
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic 
              title="已解决" 
              value={stats.resolved} 
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }} 
            />
          </Card>
        </Col>
      </Row>

      <Table
        dataSource={filteredAlerts}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="解决报警"
        open={resolveModalVisible}
        onCancel={() => setResolveModalVisible(false)}
        onOk={handleResolveSubmit}
        okText="确认解决"
        cancelText="取消"
      >
        {selectedAlert && (
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <p><strong>类型：</strong>{selectedAlert.alert_type}</p>
              <p><strong>暂养池：</strong>{selectedAlert.tank_name}</p>
              <p><strong>消息：</strong>{selectedAlert.message}</p>
              <p><strong>阈值：</strong>{selectedAlert.threshold_value}，实际值：{selectedAlert.actual_value}</p>
            </Card>
            <Input.TextArea
              rows={4}
              placeholder="请输入解决说明（可选）"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Alerts;
