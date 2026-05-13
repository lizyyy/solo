import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Progress, message, Modal } from 'antd';
import { ReloadOutlined, HistoryOutlined } from '@ant-design/icons';
import api from '../api';
import moment from 'moment';
const InventoryList = ({ onRefresh }) => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyRecords, setHistoryRecords] = useState([]);
  useEffect(() => {
    loadInventory();
  }, []);
  const loadInventory = async () => {
    setLoading(true);
    try {
      const response = await api.get('/inventory');
      if (response.data.success) {
        setInventory(response.data.data);
      }
    } catch (error) {
      message.error('加载库存列表失败');
    }
    setLoading(false);
  };
  const showHistory = async (item) => {
    try {
      const response = await api.get(`/history?business_type=inventory&business_id=${item.id}`);
      if (response.data.success) {
        setHistoryRecords(response.data.data);
        Modal.info({
          title: '库存变更历史',
          width: 700,
          content: (
            <Table
              dataSource={response.data.data}
              rowKey="id"
              columns={[
                { title: '变更前', dataIndex: 'before_value', key: 'before_value', render: (val) => val ? JSON.parse(val).available_quantity : '-' },
                { title: '变更后', dataIndex: 'after_value', key: 'after_value', render: (val) => val ? JSON.parse(val).available_quantity : '-' },
                { title: '操作人', dataIndex: 'operator', key: 'operator' },
                { title: '备注', dataIndex: 'remark', key: 'remark' },
                { title: '操作时间', dataIndex: 'created_at', key: 'created_at', render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss') },
              ]}
            />
          ),
        });
      }
    } catch (error) {
      message.error('加载历史记录失败');
    }
  };
  const getStockStatus = (available, total) => {
    const rate = available / total;
    if (rate > 0.5) return 'success';
    if (rate > 0.2) return 'normal';
    return 'exception';
  };
  const columns = [
    { title: '商品ID', dataIndex: 'product_id', key: 'product_id', width: 150 },
    { title: '商品名称', dataIndex: 'product_name', key: 'product_name', width: 200 },
    { title: '总库存', dataIndex: 'total_quantity', key: 'total_quantity', width: 100 },
    { title: '已使用', dataIndex: 'used_quantity', key: 'used_quantity', width: 100 },
    {
      title: '可用库存',
      dataIndex: 'available_quantity',
      key: 'available_quantity',
      width: 250,
      render: (val, record) => (
        <div>
          <Progress
            percent={Math.round((val / record.total_quantity) * 100)}
            status={getStockStatus(val, record.total_quantity)}
            format={() => `${val}件`}
          />
        </div>
      ),
    },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 180, render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss') },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="link" icon={<HistoryOutlined />} onClick={() => showHistory(record)}>历史</Button>
      ),
    },
  ];
  return (
    <div>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button icon={<ReloadOutlined />} onClick={loadInventory}>刷新</Button>
      </div>
      <Table
        columns={columns}
        dataSource={inventory}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};
export default InventoryList;
