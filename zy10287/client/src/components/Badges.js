import React, { useState, useEffect } from 'react';
import { Table, message, Tag, Button } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';

function Badges() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/badges');
      setData(res.data);
    } catch (err) {
      message.error('加载失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReturn = async (id) => {
    try {
      await axios.put(`/api/badges/${id}/return`, {
        returned_date: dayjs().format('YYYY-MM-DD')
      });
      message.success('工牌已回收');
      loadData();
    } catch (err) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '项目', dataIndex: 'project', key: 'project' },
    { title: '工牌号', dataIndex: 'badge_number', key: 'badge_number' },
    { title: '发放日期', dataIndex: 'issue_date', key: 'issue_date' },
    { title: '回收日期', dataIndex: 'returned_date', key: 'returned_date' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (val) => val === 'issued' ? <Tag color="blue">已发放</Tag> : <Tag color="green">已回收</Tag>
    },
    {
      title: '操作',
      render: (_, record) => record.status === 'issued' ? (
        <Button type="link" onClick={() => handleReturn(record.id)}>回收</Button>
      ) : null
    }
  ];

  return (
    <Table
      dataSource={data}
      columns={columns}
      rowKey="id"
      loading={loading}
      pagination={{ pageSize: 10 }}
    />
  );
}

export default Badges;
