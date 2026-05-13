import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Input, Select, Button, Space, Card, Row, Col, Statistic, Tag } from 'antd';
import { SearchOutlined, EyeOutlined, ExclamationCircleOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;

const statusMap = {
  pending: { text: '待处理', color: 'default' },
  scanning: { text: '扫码中', color: 'blue' },
  sorting: { text: '分拣中', color: 'cyan' },
  weighting: { text: '称重中', color: 'purple' },
  exception: { text: '异常', color: 'red' },
  reviewing: { text: '复核中', color: 'orange' },
  rethrowing: { text: '重新投线', color: 'geekblue' },
  completed: { text: '已完成', color: 'green' }
};

function PackageList() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({ status: '', waybill_no: '' });
  const [stats, setStats] = useState({ total: 0, exception: 0, reviewing: 0, reviewed: 0 });

  useEffect(() => {
    fetchPackages();
    fetchStats();
  }, [pagination.current, pagination.pageSize]);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/packages', {
        params: {
          ...filters,
          page: pagination.current,
          limit: pagination.pageSize
        }
      });
      setPackages(response.data.data);
      setPagination(prev => ({ ...prev, total: response.data.total }));
    } catch (error) {
      console.error('获取包裹列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/reviews/stats/summary');
      setStats(response.data);
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchPackages();
  };

  const handleReset = () => {
    setFilters({ status: '', waybill_no: '' });
    setPagination(prev => ({ ...prev, current: 1 }));
    setTimeout(fetchPackages, 100);
  };

  const columns = [
    {
      title: '运单号',
      dataIndex: 'waybill_no',
      key: 'waybill_no',
      width: 180,
      render: (text) => <a onClick={() => navigate(`/package/${text}`)}>{text}</a>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const info = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      }
    },
    {
      title: '重量(kg)',
      dataIndex: 'weight',
      key: 'weight',
      width: 100,
      render: (weight) => weight || '-'
    },
    {
      title: '目的地',
      dataIndex: 'destination',
      key: 'destination',
      width: 120
    },
    {
      title: '收件人',
      dataIndex: 'receiver',
      key: 'receiver',
      width: 120
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/package/${record.id}`)}
        >
          详情
        </Button>
      )
    }
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总包裹数"
              value={stats.total}
              prefix={<CheckCircleOutlined style={{ color: '#3f8600' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="异常包裹"
              value={stats.exception}
              valueStyle={{ color: '#cf1322' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待复核"
              value={stats.reviewing}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已复核"
              value={stats.reviewed}
              valueStyle={{ color: '#1890ff' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索运单号"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            value={filters.waybill_no}
            onChange={(e) => setFilters(prev => ({ ...prev, waybill_no: e.target.value }))}
            onPressEnter={handleSearch}
          />
          <Select
            placeholder="选择状态"
            style={{ width: 150 }}
            value={filters.status || undefined}
            onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            allowClear
          >
            {Object.entries(statusMap).map(([key, value]) => (
              <Option key={key} value={key}>{value.text}</Option>
            ))}
          </Select>
          <Button type="primary" onClick={handleSearch}>搜索</Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>

        <Table
          columns={columns}
          dataSource={packages}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`
          }}
          onChange={(pagination) => setPagination(pagination)}
        />
      </Card>
    </div>
  );
}

export default PackageList;
