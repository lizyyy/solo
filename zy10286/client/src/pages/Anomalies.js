import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Space, message, Tag, Typography, 
  Select, Card, Row, Col, Statistic
} from 'antd';
import { 
  ReloadOutlined, WarningOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, SafetyOutlined
} from '@ant-design/icons';
import moment from 'moment';

const { Title, Text } = Typography;
const { Option } = Select;

function Anomalies({ onResolve }) {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, high: 0, medium: 0, resolved: 0 });

  useEffect(() => {
    fetchAnomalies();
  }, []);

  const fetchAnomalies = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/anomalies');
      const data = await response.json();
      setAnomalies(data);
      
      setStats({
        total: data.length,
        high: data.filter(a => a.severity === 'high' && a.status === 'open').length,
        medium: data.filter(a => a.severity === 'medium' && a.status === 'open').length,
        resolved: data.filter(a => a.status === 'resolved').length
      });
    } catch (error) {
      message.error('获取异常列表失败');
    } finally {
      setLoading(false);
    }
  };

  const runDetection = async () => {
    try {
      const response = await fetch('/api/anomalies/detect', { method: 'POST' });
      const result = await response.json();
      message.success(`检测完成，发现 ${result.detected} 个异常`);
      fetchAnomalies();
      if (onResolve) onResolve();
    } catch (error) {
      message.error('检测失败');
    }
  };

  const handleResolve = async (id) => {
    try {
      const response = await fetch(`/api/anomalies/${id}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolver: '教务管理员', notes: '人工审核确认' })
      });
      if (response.ok) {
        message.success('异常已处理');
        fetchAnomalies();
        if (onResolve) onResolve();
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high':
        return <ExclamationCircleOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />;
      case 'medium':
        return <WarningOutlined style={{ fontSize: 20, color: '#faad14' }} />;
      default:
        return <SafetyOutlined style={{ fontSize: 20, color: '#52c41a' }} />;
    }
  };

  const anomalyTypeMap = {
    'permission_after_refund': '退费后仍有权限',
    'expired_permission_active': '权限过期仍标记有效',
    'duplicate_permissions': '重复权限',
    'multiple_accounts': '多账号绑定',
    'access_after_refund': '退费后仍尝试访问'
  };

  const columns = [
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity) => {
        const color = severity === 'high' ? 'red' : severity === 'medium' ? 'orange' : 'green';
        return (
          <Tag color={color} icon={getSeverityIcon(severity)}>
            {severity === 'high' ? '高危' : severity === 'medium' ? '中等' : '低危'}
          </Tag>
        );
      }
    },
    {
      title: '异常类型',
      dataIndex: 'anomaly_type',
      key: 'anomaly_type',
      width: 180,
      render: (type) => anomalyTypeMap[type] || type
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '学员',
      dataIndex: 'student_name',
      key: 'student_name',
      width: 120
    },
    {
      title: '相关场次',
      dataIndex: 'session_title',
      key: 'session_title',
      width: 180
    },
    {
      title: '检测时间',
      dataIndex: 'detected_at',
      key: 'detected_at',
      width: 160,
      render: (date) => date ? moment(date).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={status === 'resolved' ? 'green' : 'red'}>
          {status === 'resolved' ? '已处理' : '待处理'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          {record.status === 'open' && (
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => handleResolve(record.id)}
            >
              标记已处理
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>权限异常检测</Title>
        <Text type="secondary">自动检测并处理权限异常，防止数据不一致</Text>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="待处理异常"
              value={stats.high + stats.medium}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="高危异常"
              value={stats.high}
              valueStyle={{ color: '#cf1322' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="中等异常"
              value={stats.medium}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="已处理"
              value={stats.resolved}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Select
          placeholder="按异常类型筛选"
          style={{ width: 200 }}
          allowClear
        >
          {Object.entries(anomalyTypeMap).map(([key, value]) => (
            <Option key={key} value={key}>{value}</Option>
          ))}
        </Select>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchAnomalies}>
            刷新
          </Button>
          <Button type="primary" icon={<SafetyOutlined />} onClick={runDetection}>
            运行异常检测
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={anomalies}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1300 }}
      />

      <Card title="异常类型说明" style={{ marginTop: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <div className="anomaly-card high">
              <Text strong>高危异常</Text>
              <ul>
                <li>退费后仍有权限：学员已退费但仍有活跃回放权限</li>
                <li>退费后仍尝试访问：已退费学员尝试观看回放</li>
              </ul>
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div className="anomaly-card medium">
              <Text strong>中等异常</Text>
              <ul>
                <li>权限过期仍标记有效：权限已过期但状态仍为活跃</li>
                <li>重复权限：同一场次有多个相同权限记录</li>
              </ul>
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div className="anomaly-card low">
              <Text strong>低危异常（需人工确认）</Text>
              <ul>
                <li>多账号绑定：同一学员绑定多个账号，可能是账号共享</li>
              </ul>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
}

export default Anomalies;
