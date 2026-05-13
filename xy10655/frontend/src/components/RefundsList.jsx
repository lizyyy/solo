import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import api from '../api';
import moment from 'moment';
const RefundsList = ({ onRefresh }) => {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    loadRefunds();
  }, []);
  const loadRefunds = async () => {
    setLoading(true);
    try {
      const response = await api.get('/refunds');
      if (response.data.success) {
        setRefunds(response.data.data);
      }
    } catch (error) {
      message.error('加载退款记录失败');
    }
    setLoading(false);
  };
  const getRefundTypeText = (type) => {
    const typeMap = {
      'full': '全额退款',
      'partial': '部分退款',
    };
    return typeMap[type] || type;
  };
  const columns = [
    { title: '退款号', dataIndex: 'refund_no', key: 'refund_no', width: 180 },
    { title: '订单ID', dataIndex: 'order_id', key: 'order_id', width: 200, ellipsis: true },
    { title: '退款类型', dataIndex: 'refund_type', key: 'refund_type', width: 120, render: getRefundTypeText },
    { title: '退款金额', dataIndex: 'refund_amount', key: 'refund_amount', width: 120, render: (val) => `¥${val}` },
    { title: '退款原因', dataIndex: 'reason', key: 'reason', width: 200, ellipsis: true },
    { title: '影响赠品', dataIndex: 'affect_gift', key: 'affect_gift', width: 100, render: (val) => val ? <Tag color="warning">是</Tag> : <Tag color="success">否</Tag> },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 120 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (val) => <Tag color="success">已批准</Tag> },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss') },
  ];
  return (
    <div>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button icon={<ReloadOutlined />} onClick={loadRefunds}>刷新</Button>
      </div>
      <Table
        columns={columns}
        dataSource={refunds}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};
export default RefundsList;
