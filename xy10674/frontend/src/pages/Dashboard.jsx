import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Button } from 'antd';
import { ArrowUpOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { storeCollectionAPI } from '../services/api';
import dayjs from 'dayjs';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    verified: 0,
    pending: 0,
    rejected: 0
  });
  const [recentRecords, setRecentRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await storeCollectionAPI.list({ page: 1, pageSize: 10 });
      const data = response.data;
      setRecentRecords(data.data || []);

      // 统计数据
      const allRecords = data.data || [];
      setStats({
        total: data.total || 0,
        verified: allRecords.filter(r => r.collection_status === 'verified').length,
        pending: allRecords.filter(r => r.collection_status === 'pending' || r.collection_status === 'pending_review').length,
        rejected: allRecords.filter(r => r.collection_status === 'rejected').length
      });
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      pending: { color: 'gold', text: '待处理' },
      pending_review: { color: 'orange', text: '待审核' },
      verified: { color: 'green', text: '已通过' },
      rejected: { color: 'red', text: '已拒绝' }
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: '回收单号',
      dataIndex: 'collection_no',
      key: 'collection_no',
      width: 150
    },
    {
      title: '门店',
      dataIndex: ['Store', 'store_name'],
      key: 'store_name',
      width: 150
    },
    {
      title: '回收数量',
      dataIndex: 'collection_quantity',
      key: 'collection_quantity',
      width: 100
    },
    {
      title: '破损数量',
      dataIndex: 'damaged_quantity',
      key: 'damaged_quantity',
      width: 100
    },
    {
      title: '状态',
      dataIndex: 'collection_status',
      key: 'collection_status',
      render: (status) => getStatusTag(status),
      width: 100
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
      width: 160
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="link" onClick={() => navigate(`/collections/${record.id}`)}>
          查看详情
        </Button>
      ),
      width: 100
    }
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>数据概览</h2>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总记录数"
              value={stats.total}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ArrowUpOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已通过"
              value={stats.verified}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待审核"
              value={stats.pending}
              valueStyle={{ color: '#faad14' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已拒绝"
              value={stats.rejected}
              valueStyle={{ color: '#f5222d' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="最近记录" extra={<Button type="primary" onClick={() => navigate('/collections')}>查看全部</Button>}>
        <Table
          columns={columns}
          dataSource={recentRecords}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default Dashboard;
