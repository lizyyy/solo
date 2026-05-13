import React, { useState, useEffect } from 'react';
import { Table, Button, message, Tabs } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';

function FactoryPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/factory');
      setData(response.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const columns = [
    {
      title: '标签编号',
      dataIndex: 'tag_code',
      key: 'tag_code',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: '布草类型',
      dataIndex: 'linen_type',
      key: 'linen_type',
    },
    {
      title: '交易类型',
      dataIndex: 'transaction_type',
      key: 'transaction_type',
      render: (type) => type === 'send' ? '送厂' : '送回',
    },
    {
      title: '洗涤厂',
      dataIndex: 'factory_name',
      key: 'factory_name',
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
    },
    {
      title: '送件人',
      dataIndex: 'sender',
      key: 'sender',
    },
    {
      title: '接收人',
      dataIndex: 'receiver',
      key: 'receiver',
    },
    {
      title: '车牌号',
      dataIndex: 'vehicle_number',
      key: 'vehicle_number',
    },
    {
      title: '交易时间',
      dataIndex: 'transaction_time',
      key: 'transaction_time',
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
    },
  ];

  return (
    <div>
      <h2 className="page-title">洗涤厂收发记录</h2>
      <div className="card-content">
        <Table 
          columns={columns} 
          dataSource={data} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </div>
    </div>
  );
}

export default FactoryPage;