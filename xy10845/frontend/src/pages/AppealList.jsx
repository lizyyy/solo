import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  message
} from 'antd';
import {
  SearchOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;

const statusMap = {
  pending: { text: '待处理', color: 'orange' },
  reviewing: { text: '审核中', color: 'blue' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
  escalated: { text: '已升级', color: 'purple' }
};

function AppealList() {
  const navigate = useNavigate();
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: undefined,
    submitterName: ''
  });
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    reviewing: 0,
    approved: 0,
    rejected: 0
  });

  const fetchAppeals = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/appeals', { params: filters });
      if (response.data.success) {
        setAppeals(response.data.data);
        const data = response.data.data;
        setStats({
          total: data.length,
          pending: data.filter(a => a.status === 'pending').length,
          reviewing: data.filter(a => a.status === 'reviewing').length,
          approved: data.filter(a => a.status === 'approved').length,
          rejected: data.filter(a => a.status === 'rejected').length
        });
      }
    } catch (error) {
      message.error('获取申诉列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppeals();
  }, [filters]);

  const columns = [
    {
      title: '申诉ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (text) => text?.slice(0, 8)
    },
    {
      title: '内容类型',
      dataIndex: 'content_type',
      key: 'content_type',
      width: 100
    },
    {
      title: '内容摘要',
      dataIndex: 'content_text',
      key: 'content_text',
      ellipsis: true,
      width: 200
    },
    {
      title: '申诉人',
      dataIndex: 'submitter_name',
      key: 'submitter_name',
      width: 100
    },
    {
      title: '申诉理由',
      dataIndex: 'appeal_reason',
      key: 'appeal_reason',
      ellipsis: true,
      width: 200
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const cfg = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      }
    },
    {
      title: '审核员',
      dataIndex: 'assignee_name',
      key: 'assignee_name',
      width: 100,
      render: (text) => text || '-'
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/appeal/${record.id}`)}
        >
          详情
        </Button>
      )
    }
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="总申诉数"
              value={stats.total}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="待处理"
              value={stats.pending}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="审核中"
              value={stats.reviewing}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="已通过"
              value={stats.approved}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="已驳回"
              value={stats.rejected}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="筛选条件" style={{ marginBottom: 16 }}>
        <Space size="large">
          <Select
            placeholder="选择状态"
            style={{ width: 150 }}
            allowClear
            onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
          >
            <Option value="pending">待处理</Option>
            <Option value="reviewing">审核中</Option>
            <Option value="approved">已通过</Option>
            <Option value="rejected">已驳回</Option>
            <Option value="escalated">已升级</Option>
          </Select>
          <Input.Search
            placeholder="搜索申诉人"
            style={{ width: 200 }}
            allowClear
            enterButton={<SearchOutlined />}
            onSearch={(value) => setFilters(prev => ({ ...prev, submitterName: value }))}
          />
          <Button onClick={() => setFilters({ status: undefined, submitterName: '' })}>
            重置
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={appeals}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
}

export default AppealList;
