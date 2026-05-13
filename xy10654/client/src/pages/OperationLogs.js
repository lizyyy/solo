import React, { useEffect, useState } from 'react';
import { Table, Tag, Card, Form, Select, DatePicker, Button, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

function OperationLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async (filters = {}) => {
    setLoading(true);
    try {
      const params = {};
      if (filters.operator) params.operator = filters.operator;
      if (filters.startDate) params.startDate = filters.startDate.format('YYYY-MM-DD');
      if (filters.endDate) params.endDate = filters.endDate.format('YYYY-MM-DD');
      
      const res = await axios.get('/api/operation-logs', { params });
      if (res.data.success) {
        setLogs(res.data.data);
      }
    } catch (error) {
      console.error('获取日志失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (values) => {
    fetchLogs(values);
  };

  const getModuleTag = (module) => {
    const colorMap = {
      consumable_batches: 'blue',
      department_usages: 'green',
      recall_notices: 'orange',
      return_acceptances: 'purple'
    };
    return <Tag color={colorMap[module] || 'default'}>{module}</Tag>;
  };

  const getOperationTag = (operation) => {
    const colorMap = {
      create: 'blue',
      update: 'green',
      review: 'orange',
      blocked: 'red',
      delete: 'red'
    };
    return <Tag color={colorMap[operation] || 'default'}>{operation}</Tag>;
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '模块', dataIndex: 'module', key: 'module', width: 150, render: getModuleTag },
    { title: '操作', dataIndex: 'operation', key: 'operation', width: 100, render: getOperationTag },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 100 },
    { title: '记录ID', dataIndex: 'record_id', key: 'record_id', width: 100 },
    { title: '变更原因', dataIndex: 'change_reason', key: 'change_reason', ellipsis: true },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 180 }
  ];

  const operators = [...new Set(logs.map(l => l.operator))];

  return (
    <div>
      <h2>操作日志</h2>
      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Form.Item name="operator" label="操作人">
            <Select style={{ width: 150 }} allowClear placeholder="选择操作人">
              {operators.map(op => (
                <Select.Option key={op} value={op}>{op}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="startDate" label="开始日期">
            <DatePicker />
          </Form.Item>
          <Form.Item name="endDate" label="结束日期">
            <DatePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} htmlType="submit">
                查询
              </Button>
              <Button onClick={() => { form.resetFields(); fetchLogs(); }}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
}

export default OperationLogs;
