import React, { useState, useEffect } from 'react';
import { Table, Tag, Space, Button, Input, Select, Card, message, Modal, Form, DatePicker } from 'antd';
import { PlusOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../api';

const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

const statusMap = {
  pending: { text: '待处理', color: 'default' },
  accepted: { text: '已接单', color: 'blue' },
  in_progress: { text: '进行中', color: 'processing' },
  completed: { text: '已完成', color: 'success' },
  cancelled: { text: '已取消', color: 'red' },
  refunded: { text: '已退款', color: 'orange' }
};

function OrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = {};
      if (status) params.status = status;
      const res = await api.getOrders(params);
      setOrders(res.data);
    } catch (e) {
      message.error('加载订单失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [refreshKey]);

  const filteredOrders = orders.filter(o => {
    if (!keyword) return true;
    const k = keyword.toLowerCase();
    return (
      o.order_no?.toLowerCase().includes(k) ||
      o.patient_name?.toLowerCase().includes(k) ||
      o.escort_name?.toLowerCase().includes(k) ||
      o.department?.toLowerCase().includes(k)
    );
  });

  const columns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 180,
      render: text => <code>{text}</code>
    },
    {
      title: '患者',
      dataIndex: 'patient_name',
      key: 'patient_name',
      width: 100
    },
    {
      title: '陪诊员',
      dataIndex: 'escort_name',
      key: 'escort_name',
      width: 100
    },
    {
      title: '科室',
      dataIndex: 'department',
      key: 'department',
      width: 120
    },
    {
      title: '医院',
      dataIndex: 'hospital',
      key: 'hospital',
      width: 150
    },
    {
      title: '服务时间',
      key: 'time',
      width: 200,
      render: (_, record) => (
        <span>
          {record.start_time ? dayjs(record.start_time).format('MM-DD HH:mm') : '-'}
        </span>
      )
    },
    {
      title: '金额',
      key: 'amount',
      width: 100,
      render: (_, record) => (
        <span style={{ color: record.total_amount ? '#f5222d' : '#999' }}>
          ¥{record.total_amount || 0}
        </span>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: status => {
        const s = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/orders/${record.id}`)}
          >
            详情
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card title="订单列表" style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16, display: 'flex' }}>
          <Search
            placeholder="搜索订单号/患者/陪诊员"
            style={{ width: 300 }}
            onSearch={setKeyword}
            onChange={e => setKeyword(e.target.value)}
            allowClear
          />
          <Select
            placeholder="筛选状态"
            style={{ width: 150 }}
            allowClear
            value={status}
            onChange={setStatus}
          >
            {Object.entries(statusMap).map(([key, val]) => (
              <Option key={key} value={key}>{val.text}</Option>
            ))}
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/orders/new')}>
            新建订单
          </Button>
          <Button onClick={() => setRefreshKey(k => k + 1)}>刷新</Button>
        </Space>

        <Table
          columns={columns}
          dataSource={filteredOrders}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
}

export default OrdersPage;
