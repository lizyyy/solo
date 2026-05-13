import React, { useState, useEffect } from 'react';
import { Table, Button, message } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';

function HandoverPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/handover');
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
      title: '楼层',
      dataIndex: 'floor',
      key: 'floor',
    },
    {
      title: '交接类型',
      dataIndex: 'handover_type',
      key: 'handover_type',
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
    },
    {
      title: '经办人',
      dataIndex: 'handler',
      key: 'handler',
    },
    {
      title: '接收人',
      dataIndex: 'receiver',
      key: 'receiver',
    },
    {
      title: '交接时间',
      dataIndex: 'handover_time',
      key: 'handover_time',
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
      <h2 className="page-title">楼层交接记录</h2>
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

export default HandoverPage;