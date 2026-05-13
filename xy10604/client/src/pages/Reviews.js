import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Card, Typography, Select } from 'antd';
import { EyeOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;

const Reviews = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [decisionFilter, setDecisionFilter] = useState(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    fetchReviews();
  }, [decisionFilter]);

  const fetchReviews = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const response = await api.get('/reviews', {
        params: {
          page,
          limit: pageSize,
          decision: decisionFilter,
        },
      });
      setData(response.data.records);
      setPagination({
        current: page,
        pageSize,
        total: response.data.pagination.total,
      });
    } catch (error) {
      console.error('获取复核记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportDetails = async (record) => {
    try {
      const response = await api.get(`/exports/review/${record.id}`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `review_${record.id}.json`);
      document.body.appendChild(link);
      link.click();
    } catch (error) {
      console.error('导出失败:', error);
    }
  };

  const columns = [
    {
      title: '复核时间',
      dataIndex: 'reviewedAt',
      key: 'reviewedAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '复核人',
      dataIndex: ['reviewer', 'name'],
      key: 'reviewer',
    },
    {
      title: '复核角色',
      dataIndex: ['reviewer', 'role'],
      key: 'role',
      render: (role) => <Tag>{role}</Tag>,
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
      title: '决策',
      dataIndex: 'decision',
      key: 'decision',
      render: (decision) => (
        <Tag color={decision === 'APPROVE' ? 'green' : 'red'}>
          {decision === 'APPROVE' ? '通过' : '拒绝'}
        </Tag>
      ),
      filters: [
        { text: '通过', value: 'APPROVE' },
        { text: '拒绝', value: 'REJECT' },
      ],
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<DownloadOutlined />}
            onClick={() => handleExportDetails(record)}
          >
            导出详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={4}>复核记录</Title>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="全部决策"
            allowClear
            style={{ width: 150 }}
            value={decisionFilter}
            onChange={(value) => setDecisionFilter(value)}
          >
            <Select.Option value="APPROVE">通过</Select.Option>
            <Select.Option value="REJECT">拒绝</Select.Option>
          </Select>
        </Space>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => fetchReviews(page, pageSize),
          }}
        />
      </Card>
    </div>
  );
};

export default Reviews;
