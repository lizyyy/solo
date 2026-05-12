import React, { useState, useEffect } from 'react';
import { Table, message, Tag } from 'antd';
import axios from 'axios';

function Trainings() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/trainings');
      setData(res.data);
    } catch (err) {
      message.error('加载失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const columns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '项目', dataIndex: 'project', key: 'project' },
    { title: '培训日期', dataIndex: 'training_date', key: 'training_date' },
    { title: '培训内容', dataIndex: 'training_content', key: 'training_content' },
    { title: '培训师', dataIndex: 'trainer', key: 'trainer' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (val) => val === 'completed' ? <Tag color="green">已完成</Tag> : <Tag color="orange">进行中</Tag>
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

export default Trainings;
