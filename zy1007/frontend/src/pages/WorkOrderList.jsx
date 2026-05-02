import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tag, Button, Space, Input, Select, message, Spin, Card } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { workOrderApi } from '../api';
import dayjs from 'dayjs';

const { Search } = Input;

const statusMap = {
  pending: { label: '待接单', color: 'orange' },
  in_progress: { label: '维修中', color: 'blue' },
  waiting_parts: { label: '等待备件', color: 'red' },
  completed: { label: '已完成', color: 'green' },
  cancelled: { label: '已取消', color: 'default' }
};

const WorkOrderList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadWorkOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [workOrders, statusFilter, searchText]);

  const loadWorkOrders = async () => {
    try {
      setLoading(true);
      const response = await workOrderApi.getAll();
      setWorkOrders(response.data.data || []);
    } catch (error) {
      console.error('加载工单列表失败:', error);
      message.error('加载工单列表失败');
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...workOrders];

    if (statusFilter) {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(order => 
        order.order_no.toLowerCase().includes(search) ||
        order.customer_name.toLowerCase().includes(search) ||
        (order.customer_phone && order.customer_phone.includes(search)) ||
        (order.device_model && order.device_model.toLowerCase().includes(search))
      );
    }

    setFilteredOrders(filtered);
  };

  const columns = [
    {
      title: '工单号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 180,
      render: (text) => <span style={{ fontWeight: 'bold' }}>{text}</span>
    },
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 120
    },
    {
      title: '联系电话',
      dataIndex: 'customer_phone',
      key: 'customer_phone',
      width: 120
    },
    {
      title: '设备类型',
      dataIndex: 'device_type',
      key: 'device_type',
      width: 100
    },
    {
      title: '设备型号',
      dataIndex: 'device_model',
      key: 'device_model',
      width: 150
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const info = statusMap[status] || { label: status, color: 'default' };
        return (
          <Tag color={info.color}>{info.label}</Tag>
        );
      }
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
      width: 120,
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="link" 
            icon={<EyeOutlined />}
            onClick={() => navigate(`/work-orders/${record.id}`)}
          >
            查看
          </Button>
        </Space>
      )
    }
  ];

  const statusOptions = [
    { value: null, label: '全部状态' },
    { value: 'pending', label: '待接单' },
    { value: 'in_progress', label: '维修中' },
    { value: 'waiting_parts', label: '等待备件' },
    { value: 'completed', label: '已完成' },
    { value: 'cancelled', label: '已取消' }
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
        <p style={{ marginTop: 16 }}>加载中...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>工单列表</h1>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => navigate('/work-orders/create')}
        >
          创建工单
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space size="middle" style={{ width: '100%' }}>
          <Search
            placeholder="搜索工单号、客户姓名、电话、设备型号"
            allowClear
            enterButton={<SearchOutlined />}
            style={{ width: 400 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Select
            style={{ width: 150 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
          />
          <Button onClick={loadWorkOrders}>刷新</Button>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredOrders}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            defaultPageSize: 10
          }}
        />
      </Card>
    </div>
  );
};

export default WorkOrderList;
