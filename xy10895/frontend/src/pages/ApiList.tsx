import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Input,
  Select,
  Space,
  Tag,
  Button,
  Card,
  Row,
  Col,
  Statistic,
  message,
} from 'antd';
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';
import apiService, { ApiEntry } from '../services/api';

const { Option } = Select;

const statusColors: Record<string, string> = {
  draft: 'default',
  reviewing: 'orange',
  active: 'green',
  deprecated: 'red',
  archived: 'default',
};

const methodColors: Record<string, string> = {
  GET: 'green',
  POST: 'blue',
  PUT: 'orange',
  DELETE: 'red',
  PATCH: 'purple',
};

const ApiList: React.FC = () => {
  const navigate = useNavigate();
  const [apis, setApis] = useState<ApiEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    method: '',
    permission_level: '',
  });
  const [stats, setStats] = useState({ total: 0, active: 0, deprecated: 0, draft: 0 });

  const fetchApis = async () => {
    setLoading(true);
    try {
      const response = await apiService.getApiList({
        ...filters,
        page: pagination.page,
        limit: pagination.limit,
      });
      if (response.data.success) {
        setApis(response.data.data.items);
        setPagination(prev => ({
          ...prev,
          total: response.data.data.pagination.total,
        }));
      }
    } catch (error) {
      message.error('获取 API 列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiService.getApiList({ limit: 1000 });
      if (response.data.success) {
        const items = response.data.data.items;
        setStats({
          total: items.length,
          active: items.filter((a: ApiEntry) => a.status === 'active').length,
          deprecated: items.filter((a: ApiEntry) => a.status === 'deprecated').length,
          draft: items.filter((a: ApiEntry) => a.status === 'draft').length,
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats');
    }
  };

  useEffect(() => {
    fetchApis();
    fetchStats();
  }, [filters, pagination.page, pagination.limit]);

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ApiEntry) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.description}</div>
        </div>
      ),
    },
    {
      title: '端点',
      dataIndex: 'endpoint',
      key: 'endpoint',
      render: (text: string, record: ApiEntry) => (
        <Space>
          <Tag color={methodColors[record.method]}>{record.method}</Tag>
          <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>{text}</code>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColors[status]}>{status}</Tag>
      ),
      filters: [
        { text: '草稿', value: 'draft' },
        { text: '审核中', value: 'reviewing' },
        { text: '活跃', value: 'active' },
        { text: '废弃', value: 'deprecated' },
        { text: '归档', value: 'archived' },
      ],
      onFilter: (value: string | number | boolean, record: ApiEntry) => record.status === value,
    },
    {
      title: '负责人',
      dataIndex: 'owner_name',
      key: 'owner_name',
      render: (text: string) => text || '-',
    },
    {
      title: '权限等级',
      dataIndex: 'permission_level',
      key: 'permission_level',
      render: (level: string) => <Tag>{level}</Tag>,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: ApiEntry) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/apis/${record.id}`)}
        >
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="API 总数" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="活跃 API" value={stats.active} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="草稿 API" value={stats.draft} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="废弃 API" value={stats.deprecated} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>

      <Card title="筛选条件" style={{ marginBottom: 24 }}>
        <Space wrap size="large">
          <Input
            placeholder="搜索名称、描述、端点..."
            prefix={<SearchOutlined />}
            style={{ width: 300 }}
            allowClear
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
          <Select
            placeholder="按状态筛选"
            style={{ width: 150 }}
            allowClear
            onChange={(value) => setFilters(prev => ({ ...prev, status: value || '' }))}
          >
            <Option value="draft">草稿</Option>
            <Option value="reviewing">审核中</Option>
            <Option value="active">活跃</Option>
            <Option value="deprecated">废弃</Option>
            <Option value="archived">归档</Option>
          </Select>
          <Select
            placeholder="按方法筛选"
            style={{ width: 150 }}
            allowClear
            onChange={(value) => setFilters(prev => ({ ...prev, method: value || '' }))}
          >
            <Option value="GET">GET</Option>
            <Option value="POST">POST</Option>
            <Option value="PUT">PUT</Option>
            <Option value="DELETE">DELETE</Option>
            <Option value="PATCH">PATCH</Option>
          </Select>
          <Select
            placeholder="按权限筛选"
            style={{ width: 150 }}
            allowClear
            onChange={(value) => setFilters(prev => ({ ...prev, permission_level: value || '' }))}
          >
            <Option value="public">public</Option>
            <Option value="internal">internal</Option>
            <Option value="confidential">confidential</Option>
            <Option value="restricted">restricted</Option>
          </Select>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={apis}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.page,
          pageSize: pagination.limit,
          total: pagination.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => setPagination({ page, limit: pageSize, total: pagination.total }),
        }}
      />
    </div>
  );
};

export default ApiList;
