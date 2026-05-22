import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Select, Space, Tag, Spin, message, Popconfirm } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, RollbackOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { Batch, BatchStatus, BatchStatusLabel, Role, rolePermissions } from '../../shared/types.js';

const { Search } = Input;
const { Option } = Select;

const BatchList: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const canCreate = user ? rolePermissions[user.role as Role]?.includes('batch:create') : false;
  const canWithdraw = user ? rolePermissions[user.role as Role]?.includes('batch:withdraw') : false;

  useEffect(() => {
    loadBatches();
  }, [page, pageSize, statusFilter, keyword]);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(statusFilter && { status: statusFilter }),
        ...(keyword && { keyword })
      });
      const result = await apiClient.get(`/batches?${params}`);
      setBatches(result.batches);
      setTotal(result.total);
    } catch (error) {
      message.error('加载批次列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (batchId: string) => {
    try {
      await apiClient.post(`/batches/${batchId}/withdraw`, { reason: '用户撤回' });
      message.success('撤回成功');
      loadBatches();
    } catch (error) {
      console.error('撤回失败:', error);
    }
  };

  const getStatusColor = (status: BatchStatus) => {
    const colorMap: Record<BatchStatus, string> = {
      [BatchStatus.PENDING_SUBMIT]: 'default',
      [BatchStatus.PROCESSING]: 'blue',
      [BatchStatus.PENDING_REVIEW]: 'orange',
      [BatchStatus.REVIEW_APPROVED]: 'green',
      [BatchStatus.REVIEW_REJECTED]: 'red',
      [BatchStatus.FROZEN]: 'cyan',
      [BatchStatus.SETTLED]: 'purple',
      [BatchStatus.ARCHIVED]: 'default',
      [BatchStatus.WITHDRAWN]: 'default'
    };
    return colorMap[status];
  };

  const columns = [
    {
      title: '批次号',
      dataIndex: 'batchNo',
      key: 'batchNo',
      width: 150
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: BatchStatus) => (
        <Tag color={getStatusColor(status)}>
          {BatchStatusLabel[status]}
        </Tag>
      )
    },
    {
      title: '创建人',
      dataIndex: 'createdByName',
      key: 'createdByName',
      width: 100
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (time: string) => new Date(time).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: Batch) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/batches/${record.id}`)}
          >
            查看
          </Button>
          {canWithdraw && (
            record.status === BatchStatus.PENDING_SUBMIT || 
            record.status === BatchStatus.PROCESSING
          ) && (
            <Popconfirm
              title="确定要撤回此批次吗？"
              onConfirm={() => handleWithdraw(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<RollbackOutlined />}
              >
                撤回
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>批次列表</h2>
        <Space>
          <Search
            placeholder="搜索批次号/标题"
            allowClear
            style={{ width: 250 }}
            onSearch={(value) => {
              setKeyword(value);
              setPage(1);
            }}
          />
          <Select
            placeholder="筛选状态"
            allowClear
            style={{ width: 150 }}
            onChange={(value) => {
              setStatusFilter(value || '');
              setPage(1);
            }}
          >
            {Object.entries(BatchStatusLabel).map(([status, label]) => (
              <Option key={status} value={status}>{label}</Option>
            ))}
          </Select>
          {canCreate && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/batches/create')}
              style={{ background: '#1e3a5f', borderColor: '#1e3a5f' }}
            >
              创建批次
            </Button>
          )}
        </Space>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>
      ) : (
        <Table
          columns={columns}
          dataSource={batches}
          rowKey="id"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            }
          }}
        />
      )}
    </div>
  );
};

export default BatchList;
