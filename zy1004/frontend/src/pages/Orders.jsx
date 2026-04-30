import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tag, Button, Space, Input, Select, DatePicker, Card, Empty, Popconfirm, message } from 'antd';
import { SearchOutlined, EyeOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { repairOrderAPI, technicianAPI } from '../services/api';
import { STATUS_COLOR, getNextStatuses } from '../utils/status';

const { RangePicker } = DatePicker;

function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: undefined,
    technician_id: undefined,
    customer_name: undefined,
    start_date: undefined,
    end_date: undefined,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordersRes, techsRes] = await Promise.all([
        repairOrderAPI.getAll(),
        technicianAPI.getAll({ active_only: true }),
      ]);
      setOrders(ordersRes.data);
      setTechnicians(techsRes.data);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.technician_id) params.technician_id = filters.technician_id;
      if (filters.customer_name) params.customer_name = filters.customer_name;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const res = await repairOrderAPI.getAll(params);
      setOrders(res.data);
    } catch (error) {
      message.error('搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFilters({
      status: undefined,
      technician_id: undefined,
      customer_name: undefined,
      start_date: undefined,
      end_date: undefined,
    });
    loadData();
  };

  const handleStatusChange = async (record, newStatus) => {
    try {
      await repairOrderAPI.updateStatus(record.id, {
        status: newStatus,
        reason: '手动更新状态',
      });
      message.success('状态更新成功');
      loadData();
    } catch (error) {
      message.error(error.message || '状态更新失败');
    }
  };

  const columns = [
    {
      title: '订单编号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 140,
      render: (text, record) => (
        <a onClick={() => navigate(`/orders/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '客户信息',
      key: 'customer',
      width: 180,
      render: (_, record) => (
        <div>
          <div>{record.customer_name}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{record.customer_phone}</div>
        </div>
      ),
    },
    {
      title: '设备类型',
      dataIndex: 'device_type',
      key: 'device_type',
      width: 100,
    },
    {
      title: '故障描述',
      dataIndex: 'fault_description',
      key: 'fault_description',
      ellipsis: true,
      width: 180,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status, record) => {
        const nextStatuses = getNextStatuses(status);
        return (
          <Space>
            <Tag color={STATUS_COLOR[status] || 'default'}>{status}</Tag>
            {nextStatuses.length > 0 && (
              <Select
                placeholder="更改状态"
                style={{ width: 100 }}
                size="small"
                onSelect={(value) => handleStatusChange(record, value)}
              >
                {nextStatuses.map((s) => (
                  <Select.Option key={s} value={s}>
                    {s}
                  </Select.Option>
                ))}
              </Select>
            )}
          </Space>
        );
      },
    },
    {
      title: '预约时间',
      dataIndex: 'appointment_time',
      key: 'appointment_time',
      width: 160,
      render: (time) => (time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '费用',
      key: 'cost',
      width: 120,
      render: (_, record) => {
        const finalCost = record.final_cost || record.estimated_cost || 0;
        const isPaid = record.is_paid;
        return (
          <div>
            <div>¥{finalCost.toFixed(2)}</div>
            <Tag color={isPaid ? 'success' : 'orange'}>{isPaid ? '已收款' : '未收款'}</Tag>
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/orders/${record.id}`)}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            <Input
              placeholder="搜索客户姓名"
              style={{ width: 200 }}
              prefix={<SearchOutlined />}
              value={filters.customer_name}
              onChange={(e) => setFilters({ ...filters, customer_name: e.target.value })}
              onPressEnter={handleSearch}
            />
            <Select
              placeholder="选择状态"
              style={{ width: 150 }}
              allowClear
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
            >
              {['待确认', '已预约', '维修中', '待取件', '已完成', '已取消'].map((s) => (
                <Select.Option key={s} value={s}>
                  {s}
                </Select.Option>
              ))}
            </Select>
            <Select
              placeholder="选择技师"
              style={{ width: 150 }}
              allowClear
              value={filters.technician_id}
              onChange={(value) => setFilters({ ...filters, technician_id: value })}
            >
              {technicians.map((t) => (
                <Select.Option key={t.id} value={t.id}>
                  {t.name}
                </Select.Option>
              ))}
            </Select>
            <RangePicker
              onChange={(dates) => {
                if (dates) {
                  setFilters({
                    ...filters,
                    start_date: dates[0]?.format('YYYY-MM-DD'),
                    end_date: dates[1]?.format('YYYY-MM-DD'),
                  });
                } else {
                  setFilters({ ...filters, start_date: undefined, end_date: undefined });
                }
              }}
            />
            <Button type="primary" onClick={handleSearch}>
              搜索
            </Button>
            <Button onClick={handleReset}>重置</Button>
          </Space>
        </div>

        {orders.length === 0 ? (
          <Empty description="暂无维修单">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/orders/new')}>
              新建维修单
            </Button>
          </Empty>
        ) : (
          <Table
            columns={columns}
            dataSource={orders}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 20,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
          />
        )}
      </Card>
    </div>
  );
}

export default Orders;
