import React, { useState, useEffect } from 'react';
import { Table, Tag, Input, Select, Space, message } from 'antd';
import api from '../services/api';

function OperationLogs() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.module) params.append('module', filters.module);
      if (filters.operator) params.append('operator', filters.operator);
      
      const response = await api.get(`/logs?${params.toString()}`);
      setData(response.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters]);

  const getModuleText = (module) => {
    const modules = {
      'lease': '房源合同',
      'renewal': '续租报价',
      'deposit': '押金账本',
      'maintenance': '维修扣款',
      'checkout': '退租验收',
      'pending': '待确认合同'
    };
    return modules[module] || module;
  };

  const columns = [
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 120,
      render: (module) => <Tag color="blue">{getModuleText(module)}</Tag>,
      filterDropdown: () => (
        <Select
          style={{ width: 200 }}
          placeholder="选择模块"
          allowClear
          onChange={(value) => setFilters({ ...filters, module: value })}
        >
          <Select.Option value="lease">房源合同</Select.Option>
          <Select.Option value="renewal">续租报价</Select.Option>
          <Select.Option value="deposit">押金账本</Select.Option>
          <Select.Option value="maintenance">维修扣款</Select.Option>
          <Select.Option value="checkout">退租验收</Select.Option>
          <Select.Option value="pending">待确认合同</Select.Option>
        </Select>
      )
    },
    { title: '操作', dataIndex: 'operation', key: 'operation', width: 100 },
    { title: '记录ID', dataIndex: 'record_id', key: 'record_id', ellipsis: true },
    {
      title: '旧值',
      dataIndex: 'old_value',
      key: 'old_value',
      width: 200,
      render: (value) => value ? (
        <pre style={{ fontSize: 11, maxHeight: 80, overflow: 'auto', background: '#f5f5f5', padding: 8, borderRadius: 4, margin: 0 }}>
          {value}
        </pre>
      ) : '-'
    },
    {
      title: '新值',
      dataIndex: 'new_value',
      key: 'new_value',
      width: 200,
      render: (value) => value ? (
        <pre style={{ fontSize: 11, maxHeight: 80, overflow: 'auto', background: '#f0f9ff', padding: 8, borderRadius: 4, margin: 0 }}>
          {value}
        </pre>
      ) : '-'
    },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 100 },
    { title: '操作时间', dataIndex: 'created_at', key: 'created_at', width: 180 }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Input
            placeholder="搜索操作人"
            style={{ width: 200 }}
            allowClear
            onPressEnter={(e) => setFilters({ ...filters, operator: e.target.value })}
          />
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1000 }}
      />
    </div>
  );
}

export default OperationLogs;
