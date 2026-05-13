import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import api from '../api';
import moment from 'moment';
const SplitOrdersList = ({ onRefresh }) => {
  const [splitOrders, setSplitOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    loadSplitOrders();
  }, []);
  const loadSplitOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get('/split-orders');
      if (response.data.success) {
        setSplitOrders(response.data.data);
      }
    } catch (error) {
      message.error('加载拆单记录失败');
    }
    setLoading(false);
  };
  const getSplitTypeText = (type) => {
    const typeMap = {
      'warehouse_split': '仓库分仓',
      'logistics_split': '物流分拆',
      'other': '其他',
    };
    return typeMap[type] || type;
  };
  const columns = [
    { title: '拆单号', dataIndex: 'split_order_no', key: 'split_order_no', width: 180 },
    { title: '父订单ID', dataIndex: 'parent_order_id', key: 'parent_order_id', width: 200, ellipsis: true },
    { title: '拆单类型', dataIndex: 'split_type', key: 'split_type', width: 120, render: getSplitTypeText },
    { title: '拆单金额', dataIndex: 'total_amount', key: 'total_amount', width: 120, render: (val) => `¥${val}` },
    { title: '操作人', dataIndex: 'created_by', key: 'created_by', width: 120 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (val) => <Tag color="success">已完成</Tag> },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss') },
  ];
  return (
    <div>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button icon={<ReloadOutlined />} onClick={loadSplitOrders}>刷新</Button>
      </div>
      <Table
        columns={columns}
        dataSource={splitOrders}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};
export default SplitOrdersList;
