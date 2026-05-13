import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Progress, Table, Tag, Spin, Alert } from 'antd';
import { 
  FileTextOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ClockCircleOutlined,
  UserOutlined,
  ExclamationOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

function Statistics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      const response = await axios.get('/api/reports/statistics');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      setError('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colorMap = {
      pending: 'orange',
      reviewing: 'blue',
      takedown: 'red',
      rejected: 'gray',
      appealed: 'purple',
      reinstated: 'green',
      approved: 'green',
    };
    return colorMap[status] || 'default';
  };

  const getStatusText = (status) => {
    const textMap = {
      pending: '待处理',
      reviewing: '审核中',
      takedown: '已下架',
      rejected: '已驳回',
      appealed: '已申诉',
      reinstated: '已恢复',
      approved: '已通过',
    };
    return textMap[status] || status;
  };

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  if (error) {
    return <Alert message="错误" description={error} type="error" />;
  }

  const complaintByStatusData = stats.complaintsByStatus.map(item => ({
    ...item,
    name: getStatusText(item.status),
  }));

  const appealByStatusData = stats.appealsByStatus.map(item => ({
    ...item,
    name: getStatusText(item.status),
  }));

  const handlerColumns = [
    {
      title: '处理人',
      dataIndex: 'handler',
      key: 'handler',
      render: (text) => <span><UserOutlined style={{ marginRight: 8 }} />{text}</span>,
    },
    {
      title: '处理数量',
      dataIndex: 'count',
      key: 'count',
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>统计概览</h2>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="总投诉数"
              value={stats.totalComplaints}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="已下架"
              value={stats.complaintsByStatus.find(s => s.status === 'takedown')?.count || 0}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="待处理"
              value={stats.complaintsByStatus.find(s => s.status === 'pending')?.count || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="申诉中"
              value={stats.complaintsByStatus.find(s => s.status === 'appealed')?.count || 0}
              prefix={<ExclamationOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="投诉状态分布" className="stat-card">
            {complaintByStatusData.map((item, index) => (
              <div key={item.status} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Tag color={getStatusColor(item.status)}>{item.name}</Tag>
                  <span>{item.count} 件</span>
                </div>
                <Progress 
                  percent={Math.round((item.count / stats.totalComplaints) * 100)} 
                  strokeColor={item.status === 'takedown' ? '#f5222d' : '#1890ff'}
                  showInfo={false}
                />
              </div>
            ))}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="处理人工作量统计" className="stat-card">
            <Table
              columns={handlerColumns}
              dataSource={stats.complaintsByHandler}
              pagination={false}
              size="small"
              rowKey="handler"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card title="申诉状态分布" className="stat-card">
            <Statistic
              title="总申诉数"
              value={stats.totalAppeals}
              prefix={<ExclamationOutlined />}
              style={{ marginBottom: 16 }}
            />
            {appealByStatusData.map((item, index) => (
              <div key={item.status} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Tag color={getStatusColor(item.status)}>{item.name}</Tag>
                  <span>{item.count} 件</span>
                </div>
                <Progress 
                  percent={stats.totalAppeals > 0 ? Math.round((item.count / stats.totalAppeals) * 100) : 0}
                  strokeColor="#722ed1"
                  showInfo={false}
                />
              </div>
            ))}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="下架率" className="stat-card">
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Progress
                type="circle"
                percent={parseInt(stats.takedownRate) || 0}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#f5222d',
                }}
                width={150}
              />
              <div style={{ marginTop: 16, fontSize: 16 }}>
                下架率: <span style={{ color: '#f5222d', fontWeight: 'bold' }}>{stats.takedownRate}</span>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Statistics;
