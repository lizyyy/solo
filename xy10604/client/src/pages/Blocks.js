import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Card, Input, Typography, Alert } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Search } = Input;

const blockReasonMap = {
  EXPIRED: '过期',
  NEAR_EXPIRY: '近效期',
  INVALID_BATCH: '无效批号',
  OPEN_DATE_INVALID: '开封日期无效',
  MANUAL_BLOCK: '人工封锁',
};

const Blocks = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const navigate = useNavigate();

  useEffect(() => {
    fetchBlocks();
  }, []);

  const fetchBlocks = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const response = await api.get('/blocks', {
        params: {
          page,
          limit: pageSize,
        },
      });
      setData(response.data.records);
      setPagination({
        current: page,
        pageSize,
        total: response.data.pagination.total,
      });
    } catch (error) {
      console.error('获取拦截记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '拦截原因',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason) => (
        <Tag color="red">{blockReasonMap[reason] || reason}</Tag>
      ),
    },
    {
      title: '试剂',
      dataIndex: ['batch', 'reagent', 'name'],
      key: 'reagent',
    },
    {
      title: '批号',
      dataIndex: ['batch', 'batchNumber'],
      key: 'batchNumber',
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
    },
    {
      title: '拦截时间',
      dataIndex: 'blockedAt',
      key: 'blockedAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '状态',
      dataIndex: 'isResolved',
      key: 'isResolved',
      render: (resolved) => (
        <Tag color={resolved ? 'green' : 'red'}>
          {resolved ? '已解决' : '未解决'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          {record.experimentId && (
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/experiments/${record.experimentId}`)}
            >
              查看实验
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const unresolvedCount = data.filter((r) => !r.isResolved).length;

  return (
    <div>
      <Title level={4}>拦截记录</Title>

      {unresolvedCount > 0 && (
        <Alert
          message={`有 ${unresolvedCount} 条待处理的拦截记录需要人工复核`}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => fetchBlocks(page, pageSize),
          }}
        />
      </Card>
    </div>
  );
};

export default Blocks;
