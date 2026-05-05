import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Tag, 
  Button, 
  Space, 
  Input, 
  Select, 
  DatePicker,
  Popconfirm,
  message,
  Row,
  Col,
  Statistic
} from 'antd';
import { 
  SearchOutlined, 
  ReloadOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  PlusOutlined,
  DashboardOutlined,
  AlertOutlined,
  RiseOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { incidentApi } from '../services/api';

const { RangePicker } = DatePicker;
const { Option } = Select;

const IncidentList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    open: 0,
    resolved: 0
  });
  const [filters, setFilters] = useState({
    keyword: '',
    status: null,
    severity: null,
    dateRange: null
  });

  useEffect(() => {
    loadIncidents();
  }, []);

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.keyword) {
        params.keyword = filters.keyword;
      }
      if (filters.status) {
        params.status = filters.status;
      }
      if (filters.severity) {
        params.severity = filters.severity;
      }

      const response = await incidentApi.getAll(params);
      if (response.success) {
        let data = response.data || [];
        
        // 时间范围过滤（前端处理）
        if (filters.dateRange && filters.dateRange.length === 2) {
          const start = filters.dateRange[0].startOf('day').valueOf();
          const end = filters.dateRange[1].endOf('day').valueOf();
          data = data.filter(item => {
            const createdAt = dayjs(item.createdAt).valueOf();
            return createdAt >= start && createdAt <= end;
          });
        }
        
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

  const handleDelete = async (id) => {
    try {
      const response = await incidentApi.delete(id);
      if (response.success) {
        message.success('删除成功');
        loadIncidents();
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      console.error('删除事故失败:', error);
      message.error('删除失败');
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
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
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
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || '-'
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
      ),
      filters: [
        { text: 'CRITICAL', value: 'CRITICAL' },
        { text: 'HIGH', value: 'HIGH' },
        { text: 'MEDIUM', value: 'MEDIUM' },
        { text: 'LOW', value: 'LOW' },
      ],
      onFilter: (value, record) => record.severity === value
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
      ),
      filters: [
        { text: 'OPEN', value: 'OPEN' },
        { text: 'PENDING', value: 'PENDING' },
        { text: 'ANALYZING', value: 'ANALYZING' },
        { text: 'RESOLVED', value: 'RESOLVED' },
        { text: 'CLOSED', value: 'CLOSED' },
      ],
      onFilter: (value, record) => record.status === value
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
      render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button 
            type="primary" 
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/incidents/${record.id}`)}
          >
            查看
          </Button>
          <Popconfirm
            title="确定要删除这个事故吗？"
            description="删除后无法恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const handleSearch = () => {
    loadIncidents();
  };

  const handleReset = () => {
    setFilters({
      keyword: '',
      status: null,
      severity: null,
      dateRange: null
    });
    loadIncidents();
  };

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总事故数"
              value={stats.total}
              prefix={<DashboardOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="严重事故"
              value={stats.critical}
              prefix={<AlertOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="待处理"
              value={stats.open}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
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
        title="事故列表"
        extra={
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => navigate('/upload')}
          >
            上传新文件
          </Button>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            <Input
              placeholder="搜索标题或描述"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              style={{ width: 200 }}
              prefix={<SearchOutlined />}
              onPressEnter={handleSearch}
            />
            <Select
              placeholder="状态"
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
              style={{ width: 120 }}
              allowClear
            >
              <Option value="OPEN">OPEN</Option>
              <Option value="PENDING">PENDING</Option>
              <Option value="ANALYZING">ANALYZING</Option>
              <Option value="RESOLVED">RESOLVED</Option>
              <Option value="CLOSED">CLOSED</Option>
            </Select>
            <Select
              placeholder="严重程度"
              value={filters.severity}
              onChange={(value) => setFilters({ ...filters, severity: value })}
              style={{ width: 120 }}
              allowClear
            >
              <Option value="CRITICAL">CRITICAL</Option>
              <Option value="HIGH">HIGH</Option>
              <Option value="MEDIUM">MEDIUM</Option>
              <Option value="LOW">LOW</Option>
            </Select>
            <RangePicker
              value={filters.dateRange}
              onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
            />
            <Button 
              type="primary" 
              icon={<SearchOutlined />}
              onClick={handleSearch}
            >
              搜索
            </Button>
            <Button 
              icon={<ReloadOutlined />}
              onClick={handleReset}
            >
              重置
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={incidents}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showTotal: (total) => `共 ${total} 条记录`,
            showSizeChanger: true,
            showQuickJumper: true
          }}
        />
      </Card>
    </div>
  );
};

export default IncidentList;
