import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Tag, 
  Button, 
  Popconfirm, 
  message, 
  Space,
  Input,
  Select,
  Empty,
  Spin
} from 'antd';
import { 
  PlusOutlined, 
  EyeOutlined, 
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const { Search } = Input;
const { Option } = Select;

const ExperimentList = () => {
  const [loading, setLoading] = useState(true);
  const [experiments, setExperiments] = useState([]);
  const [filteredExperiments, setFilteredExperiments] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadExperiments();
  }, []);

  useEffect(() => {
    filterExperiments();
  }, [experiments, searchText, statusFilter]);

  const loadExperiments = async () => {
    try {
      setLoading(true);
      const response = await api.experiments.getAll();
      if (response.success) {
        const exps = response.data || [];
        setExperiments(exps);
        setFilteredExperiments(exps);
      }
    } catch (error) {
      message.error('加载实验列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filterExperiments = () => {
    let filtered = [...experiments];
    
    if (searchText) {
      filtered = filtered.filter(exp => 
        exp.name.toLowerCase().includes(searchText.toLowerCase()) ||
        exp.description?.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    
    if (statusFilter) {
      filtered = filtered.filter(exp => exp.status === statusFilter);
    }
    
    setFilteredExperiments(filtered);
  };

  const handleDelete = async (id) => {
    try {
      const response = await api.experiments.delete(id);
      if (response.success) {
        message.success('实验已删除');
        loadExperiments();
      }
    } catch (error) {
      message.error('删除实验失败');
      console.error(error);
    }
  };

  const handleRun = async (id) => {
    try {
      const response = await api.simulations.run(id);
      if (response.success) {
        message.success('实验运行完成');
        loadExperiments();
      }
    } catch (error) {
      message.error('运行实验失败');
      console.error(error);
    }
  };

  const handleReset = async (id) => {
    try {
      const response = await api.experiments.reset(id);
      if (response.success) {
        message.success('实验已重置');
        loadExperiments();
      }
    } catch (error) {
      message.error('重置实验失败');
      console.error(error);
    }
  };

  const getStatusTag = (status) => {
    switch (status) {
      case 'completed':
        return <Tag color="green">已完成</Tag>;
      case 'running':
        return <Tag color="blue">运行中</Tag>;
      case 'created':
        return <Tag color="orange">已创建</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    {
      title: '实验名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <a onClick={() => navigate(`/experiments/${record.id}`)}>{text}</a>
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
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag,
      filters: [
        { text: '已完成', value: 'completed' },
        { text: '运行中', value: 'running' },
        { text: '已创建', value: 'created' }
      ],
      onFilter: (value, record) => record.status === value
    },
    {
      title: '缓存策略',
      dataIndex: ['config', 'strategy'],
      key: 'strategy'
    },
    {
      title: '写入策略',
      dataIndex: ['config', 'writeStrategy'],
      key: 'writeStrategy'
    },
    {
      title: '流量步骤',
      dataIndex: 'trafficPlanCount',
      key: 'trafficPlanCount'
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text) => new Date(text).toLocaleString('zh-CN'),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="link" 
            icon={<EyeOutlined />}
            onClick={() => navigate(`/experiments/${record.id}`)}
          >
            查看
          </Button>
          <Button 
            type="link" 
            icon={<PlayCircleOutlined />}
            onClick={() => handleRun(record.id)}
            disabled={record.status === 'running'}
          >
            运行
          </Button>
          {record.status === 'completed' && (
            <Button 
              type="link" 
              icon={<ReloadOutlined />}
              onClick={() => handleReset(record.id)}
            >
              重置
            </Button>
          )}
          <Popconfirm
            title="确定要删除这个实验吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              type="link" 
              danger 
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Spin spinning={loading}>
      <Card 
        title="实验管理"
        extra={
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => navigate('/experiments/create')}
          >
            创建新实验
          </Button>
        }
      >
        <Space style={{ marginBottom: 16 }}>
          <Search
            placeholder="搜索实验名称或描述"
            allowClear
            style={{ width: 300 }}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Select
            placeholder="筛选状态"
            allowClear
            style={{ width: 150 }}
            onChange={setStatusFilter}
          >
            <Option value="created">已创建</Option>
            <Option value="running">运行中</Option>
            <Option value="completed">已完成</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={loadExperiments}>
            刷新
          </Button>
        </Space>

        {filteredExperiments.length > 0 ? (
          <Table 
            columns={columns} 
            dataSource={filteredExperiments} 
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        ) : (
          <Empty 
            description="暂无实验"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>
    </Spin>
  );
};

export default ExperimentList;
