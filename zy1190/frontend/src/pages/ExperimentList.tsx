import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Space, Tag, Input, Popconfirm, message,
  Card, Typography, Select, DatePicker, Empty, Spin
} from 'antd';
import { PlusOutlined, DeleteOutlined, EyeOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { listExperiments, deleteExperiment, runExperiment } from '../services/api';
import type { ExperimentListItem } from '../types';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

const ExperimentList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [experiments, setExperiments] = useState<ExperimentListItem[]>([]);
  const [filtered, setFiltered] = useState<ExperimentListItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [testFilter, setTestFilter] = useState<string | undefined>();

  useEffect(() => {
    loadExperiments();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [experiments, searchText, statusFilter, testFilter]);

  const loadExperiments = async () => {
    setLoading(true);
    try {
      const data = await listExperiments(1000, 0);
      setExperiments(data);
    } catch (error) {
      message.error('加载实验列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...experiments];

    if (searchText) {
      result = result.filter(item => 
        item.name.toLowerCase().includes(searchText.toLowerCase()) ||
        item.description.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    if (statusFilter) {
      if (statusFilter === 'completed') {
        result = result.filter(item => item.has_result);
      } else if (statusFilter === 'pending') {
        result = result.filter(item => !item.has_result);
      }
    }

    if (testFilter) {
      result = result.filter(item => item.test_name === testFilter);
    }

    setFiltered(result);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteExperiment(id);
      message.success('删除成功');
      loadExperiments();
    } catch (error) {
      message.error('删除失败');
      console.error(error);
    }
  };

  const handleRun = async (id: string) => {
    try {
      message.info('开始运行实验...');
      const result = await runExperiment(id);
      if (result.status === 'completed') {
        message.success('实验运行完成');
        loadExperiments();
      }
    } catch (error) {
      message.error('运行失败');
      console.error(error);
    }
  };

  const uniqueTests = Array.from(new Set(experiments.map(e => e.test_name)));

  const columns: ColumnsType<ExperimentListItem> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Link to={`/experiments/${record.id}`}>
          <Text strong>{text}</Text>
        </Link>
      )
    },
    {
      title: '测试类型',
      dataIndex: 'test_name',
      key: 'test_name',
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '状态',
      dataIndex: 'has_result',
      key: 'status',
      render: (hasResult) => (
        <Tag color={hasResult ? 'green' : 'orange'}>
          {hasResult ? '已完成' : '待运行'}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => new Date(text).toLocaleString(),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <Space>
          {tags.map(tag => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            icon={<EyeOutlined />}
            onClick={() => navigate(`/experiments/${record.id}`)}
          >
            查看
          </Button>
          {!record.has_result && (
            <Button 
              type="link" 
              icon={<PlayCircleOutlined />}
              onClick={() => handleRun(record.id)}
            >
              运行
            </Button>
          )}
          <Popconfirm
            title="确定删除这个实验？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>实验列表</Title>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => navigate('/experiments/new')}
          >
            新建实验
          </Button>
        </div>

        <Space style={{ marginBottom: 16 }}>
          <Search
            placeholder="搜索实验名称或描述"
            allowClear
            style={{ width: 250 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 150 }}
            value={statusFilter}
            onChange={setStatusFilter}
          >
            <Option value="completed">已完成</Option>
            <Option value="pending">待运行</Option>
          </Select>
          <Select
            placeholder="测试类型筛选"
            allowClear
            style={{ width: 150 }}
            value={testFilter}
            onChange={setTestFilter}
          >
            {uniqueTests.map(test => (
              <Option key={test} value={test}>{test}</Option>
            ))}
          </Select>
        </Space>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : filtered.length === 0 ? (
          <Empty
            description="暂无实验"
            style={{ padding: 40 }}
          >
            <Button type="primary" onClick={() => navigate('/experiments/new')}>
              创建第一个实验
            </Button>
          </Empty>
        ) : (
          <Table
            columns={columns}
            dataSource={filtered}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default ExperimentList;
