import React, { useState, useEffect } from 'react';
import { Table, Tag, Select, Space, Card } from 'antd';
import dayjs from 'dayjs';
import api from '../utils/api';

const { Option } = Select;

const InventoryLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders/inventory/logs');
      if (res.data.success) {
        setLogs(res.data.data);
      }
    } catch (error) {
      console.error('加载日志失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = filterType ? logs.filter(log => log.change_type === filterType) : logs;

  const getTypeColor = (type) => {
    if (type.includes('lock') || type.includes('confirm')) return 'orange';
    if (type.includes('release') || type.includes('refund') || type.includes('return')) return 'green';
    return 'blue';
  };

  const columns = [
    { title: '变动类型', dataIndex: 'change_type', key: 'change_type', width: 150, render: val => <Tag color={getTypeColor(val)}>{val}</Tag> },
    { title: '商品名称', dataIndex: 'product_name', key: 'product_name', width: 150 },
    { title: '变动数量', dataIndex: 'change_quantity', key: 'change_quantity', width: 100, render: val => <span style={{ color: val > 0 ? 'green' : 'red' }}>{val > 0 ? '+' : ''}{val}</span> },
    { title: '变动前库存', dataIndex: 'before_stock', key: 'before_stock', width: 120 },
    { title: '变动后库存', dataIndex: 'after_stock', key: 'after_stock', width: 120 },
    { title: '操作人', dataIndex: 'operator_name', key: 'operator_name', width: 120 },
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 250, ellipsis: true },
    { title: '幂等键', dataIndex: 'idempotent_key', key: 'idempotent_key', width: 280, ellipsis: true, render: val => <code style={{ fontSize: 12, color: '#666' }}>{val}</code> },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 160, render: val => dayjs(val).format('YYYY-MM-DD HH:mm:ss') },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Select
            placeholder="变动类型筛选"
            style={{ width: 200 }}
            allowClear
            onChange={setFilterType}
          >
            <Option value="lock">锁定库存</Option>
            <Option value="confirm">确认扣减</Option>
            <Option value="release">释放库存</Option>
            <Option value="compensation_lock">补单锁定</Option>
            <Option value="compensation_confirm">补单确认</Option>
            <Option value="refund_return">退款退回</Option>
          </Select>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={filteredLogs}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 50 }}
        scroll={{ x: 1500 }}
      />
    </div>
  );
};

export default InventoryLogs;
