import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Card, Typography, Statistic, Row, Col, Divider } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;

const Discards = () => {
  const [data, setData] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  useEffect(() => {
    fetchDiscards();
    fetchStats();
  }, []);

  const fetchDiscards = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const response = await api.get('/discards', {
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
      console.error('获取废弃记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/discards/stats');
      setStats(response.data);
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  };

  const columns = [
    {
      title: '废弃时间',
      dataIndex: 'discardedAt',
      key: 'discardedAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
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
      title: '废弃原因',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason) => {
        const reasonMap = {
          EXPIRED: '过期',
          CONTAMINATED: '污染',
          DAMAGE: '损坏',
          QUANTITY_INSUFFICIENT: '量不足',
          QUALITY_ISSUE: '质量问题',
          ADMIN_DECISION: '行政决定',
        };
        return <Tag>{reasonMap[reason] || reason}</Tag>;
      },
    },
    {
      title: '剩余数量',
      dataIndex: 'remainingQuantity',
      key: 'remainingQuantity',
      render: (qty, record) => `${qty} ${record.batch?.unit || ''}`,
    },
    {
      title: '废弃人',
      dataIndex: ['discardedBy', 'name'],
      key: 'discardedBy',
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
    },
  ];

  return (
    <div>
      <Title level={4}>废弃记录</Title>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月废弃数"
              value={stats.currentMonthCount || 0}
              prefix={<DeleteOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="累计废弃数"
              value={stats.totalCount || 0}
              prefix={<DeleteOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="过期废弃率"
              value={stats.expiredRate || 0}
              suffix="%"
              precision={1}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="涉及试剂种类"
              value={stats.reagentTypeCount || 0}
            />
          </Card>
        </Col>
      </Row>

      <Divider />

      <Card title="废弃记录列表">
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => fetchDiscards(page, pageSize),
          }}
        />
      </Card>
    </div>
  );
};

export default Discards;
