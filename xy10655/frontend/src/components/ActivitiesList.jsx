import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import api from '../api';
import moment from 'moment';
const ActivitiesList = ({ onRefresh }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    loadActivities();
  }, []);
  const loadActivities = async () => {
    setLoading(true);
    try {
      const response = await api.get('/activities');
      if (response.data.success) {
        setActivities(response.data.data);
      }
    } catch (error) {
      message.error('加载活动列表失败');
    }
    setLoading(false);
  };
  const getStatusTag = (status) => {
    return status === 'active' ? <Tag color="success">进行中</Tag> : <Tag color="default">已停止</Tag>;
  };
  const columns = [
    { title: '活动名称', dataIndex: 'name', key: 'name', width: 250 },
    { title: '门槛金额', dataIndex: 'threshold_amount', key: 'threshold_amount', width: 120, render: (val) => `¥${val}` },
    { title: '赠品ID', dataIndex: 'gift_product_id', key: 'gift_product_id', width: 150 },
    { title: '赠品数量', dataIndex: 'gift_quantity', key: 'gift_quantity', width: 100 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: getStatusTag },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss') },
  ];
  return (
    <div>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button icon={<ReloadOutlined />} onClick={loadActivities}>刷新</Button>
      </div>
      <Table
        columns={columns}
        dataSource={activities}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};
export default ActivitiesList;
