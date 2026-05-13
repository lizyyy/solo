import React, { useState, useEffect } from 'react';
import { Table, Button, message } from 'antd';
import axios from 'axios';

const WorkHours = () => {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState([]);

  useEffect(() => {
    loadData();
    loadSummary();
  }, []);

  const loadData = async () => {
    try {
      const res = await axios.get('/api/work-hours');
      setData(res.data);
    } catch (err) {
      message.error('加载失败');
    }
  };

  const loadSummary = async () => {
    try {
      const res = await axios.get('/api/work-hours/summary');
      setSummary(res.data);
    } catch (err) {
      message.error('加载汇总失败');
    }
  };

  const columns = [
    { title: '陪护人员', dataIndex: 'caregiver_name', key: 'caregiver_name' },
    { title: '日期', dataIndex: 'date', key: 'date' },
    { title: '工时', dataIndex: 'hours', key: 'hours' },
    { title: '类型', dataIndex: 'hour_type', key: 'hour_type' },
    { title: '备注', dataIndex: 'remarks', key: 'remarks' },
  ];

  const summaryColumns = [
    { title: '陪护人员', dataIndex: 'name', key: 'name' },
    { title: '工时类型', dataIndex: 'hour_type', key: 'hour_type' },
    { title: '总工时', dataIndex: 'total_hours', key: 'total_hours' },
    { title: '记录数', dataIndex: 'record_count', key: 'record_count' },
  ];

  return (
    <div>
      <h3>工时汇总</h3>
      <Table columns={summaryColumns} dataSource={summary} rowKey="id" pagination={false} />
      
      <h3 style={{ marginTop: 24 }}>工时明细</h3>
      <Table columns={columns} dataSource={data} rowKey="id" style={{ marginTop: 16 }} />
    </div>
  );
};

export default WorkHours;
