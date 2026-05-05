import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Table, 
  Tag, 
  Button, 
  Space,
  Empty,
  message
} from 'antd';
import { 
  DashboardOutlined, 
  AlertOutlined, 
  RiseOutlined, 
  FileTextOutlined,
  PlusOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { incidentApi } from '../services/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    open: 0,
    resolved: 0
  });

  useEffect(() => {
    loadIncidents();
  }, []);

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const response = await incidentApi.getAll();
      if (response.success) {
        const data = response.data || [];
        setIncidents(data);
        
        // 计算统计数据
        const total = data.length;
        const critical = data.filter(i => i.severity === 'CRITICAL').length;
        const open = data.filter(i => i.status === 'OPEN' || i.status === 'PENDING').length;
        const resolved = data.filter(i => i.status === 'RESOLVED' || i.status === 'CLOSED').length;
        
        setStats({ total, critical, open, resolved });
      }
    } catch (error) {
      console.error('加载事故列表失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'red';
      case 'HIGH':
        return 'orange';
      case 'MEDIUM':
        return 'gold';
      case 'LOW':
        return 'blue';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'OPEN':
      case 'PENDING':
        return 'red';
      case 'RESOLVED':
      case 'CLOSED':
        return 'green';
      case 'ANALYZING':
        return 'blue';
      default:
        return 'default';
    }
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text, record) => (
        <Button 
          type="link" 
          onClick={() => navigate(`/incidents/${record.id}`)}
        >
          {text}
        </Button>
      )
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 120,
      render: (severity) => (
        <Tag color={getSeverityColor(severity)}>
          {severity || '未知'}
        </Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {status || '未知'}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button 
          type="primary" 
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/incidents/${record.id}`)}
        >
          查看
        </Button>
      )
    }
  ];

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总事故数"
              value={stats.total}
              prefix={<DashboardOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="严重事故"
              value={stats.critical}
              prefix={<AlertOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理"
              value={stats.open}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已解决"
              value={stats.resolved}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      <Card 
        title="最近事故" 
        style={{ marginTop: 16 }}
        extra={
          <Space>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => navigate('/upload')}
            >
              上传新文件
            </Button>
            <Button onClick={() => navigate('/incidents')}>
              查看全部
            </Button>
          </Space>
        }
      >
        {incidents.length > 0 ? (
          <Table
            columns={columns}
            dataSource={incidents}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 5 }}
          />
        ) : (
          <Empty
            description="暂无事故数据"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => navigate('/upload')}
            >
              上传性能数据文件
            </Button>
          </Empty>
        )}
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="快速操作">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                block 
                type="primary" 
                icon={<PlusOutlined />}
                size="large"
                onClick={() => navigate('/upload')}
              >
                上传性能数据文件
              </Button>
              <Button 
                block 
                icon={<EyeOutlined />}
                size="large"
                onClick={() => navigate('/incidents')}
              >
                查看所有事故
              </Button>
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="支持的文件类型">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Tag color="blue">incident.json</Tag>
                <span> 事故描述文件</span>
              </div>
              <div>
                <Tag color="orange">gc.log</Tag>
                <span> GC 日志文件</span>
              </div>
              <div>
                <Tag color="green">thread-dump</Tag>
                <span> 线程转储文件</span>
              </div>
              <div>
                <Tag color="purple">slow-request</Tag>
                <span> 慢请求日志</span>
              </div>
              <div>
                <Tag color="cyan">io-block</Tag>
                <span> I/O 阻塞日志</span>
              </div>
              <div>
                <Tag color="magenta">network-rtt</Tag>
                <span> 网络延迟日志</span>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
