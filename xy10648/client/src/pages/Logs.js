import React, { useState, useEffect } from 'react';
import { Table, Tag, Space, Input, Select, DatePicker, Button, message, Card } from 'antd';
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { Option } = Select;

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({
    operator: '',
    target_type: '',
    startDate: null,
    endDate: null
  });

  useEffect(() => {
    loadLogs();
  }, [filters]);

  const loadLogs = async () => {
    try {
      const params = {};
      if (filters.operator) params.operator = filters.operator;
      if (filters.target_type) params.target_type = filters.target_type;
      if (filters.startDate) params.start_date = filters.startDate.format('YYYY-MM-DD');
      if (filters.endDate) params.end_date = filters.endDate.format('YYYY-MM-DD');
      
      const response = await axios.get('/api/logs', { params });
      setLogs(response.data);
    } catch (error) {
      message.error('加载日志失败');
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (filters.operator) params.append('responsible_person', filters.operator);
    if (filters.startDate) params.append('start_date', filters.startDate.format('YYYY-MM-DD'));
    if (filters.endDate) params.append('end_date', filters.endDate.format('YYYY-MM-DD'));
    
    window.open(`/api/logs/export?${params.toString()}`, '_blank');
    message.success('导出成功');
  };

  const getOperationTypeColor = (type) => {
    const colors = {
      'create': 'blue',
      'update': 'orange',
      'delete': 'red',
      'approve': 'green',
      'reject': 'red',
      'status_change': 'purple',
      'payment': 'cyan',
      'respond': 'geekblue'
    };
    return colors[type] || 'default';
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '操作类型', dataIndex: 'operation_type', key: 'operation_type', width: 100,
      render: (text) => <Tag color={getOperationTypeColor(text)}>{text}</Tag>
    },
    { title: '目标类型', dataIndex: 'target_type', key: 'target_type', width: 100,
      render: (text) => <Tag>{text}</Tag>
    },
    { title: '目标ID', dataIndex: 'target_id', key: 'target_id', ellipsis: true, width: 200 },
    { title: '责任人', dataIndex: 'operator', key: 'operator', width: 100,
      render: (text) => <strong>{text}</strong>
    },
    { title: '详情', dataIndex: 'details', key: 'details', ellipsis: true },
    { title: '旧值', dataIndex: 'old_value', key: 'old_value', ellipsis: true, width: 150,
      render: (text) => text ? <span style={{ color: '#999', fontSize: 12 }}>{text.substring(0, 50)}...</span> : '-'
    },
    { title: '新值', dataIndex: 'new_value', key: 'new_value', ellipsis: true, width: 150,
      render: (text) => text ? <span style={{ color: '#52c41a', fontSize: 12 }}>{text.substring(0, 50)}...</span> : '-'
    },
    { title: '处理时间', dataIndex: 'created_at', key: 'created_at', width: 180,
      render: (val) => moment(val).format('YYYY-MM-DD HH:mm:ss')
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>操作日志</h2>
        <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
          导出Excel
        </Button>
      </div>

      <Card title="筛选条件" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="按责任人筛选"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            value={filters.operator}
            onChange={e => setFilters({ ...filters, operator: e.target.value })}
            allowClear
          />
          <Select
            placeholder="按目标类型筛选"
            style={{ width: 150 }}
            value={filters.target_type || undefined}
            onChange={val => setFilters({ ...filters, target_type: val })}
            allowClear
          >
            <Option value="budget">预算</Option>
            <Option value="activity">活动</Option>
            <Option value="purchase">采购</Option>
            <Option value="invoice">票据</Option>
            <Option value="payment">支付</Option>
            <Option value="supplement">补资料</Option>
          </Select>
          <DatePicker
            placeholder="开始日期"
            value={filters.startDate}
            onChange={date => setFilters({ ...filters, startDate: date })}
            style={{ width: 150 }}
          />
          <DatePicker
            placeholder="结束日期"
            value={filters.endDate}
            onChange={date => setFilters({ ...filters, endDate: date })}
            style={{ width: 150 }}
          />
          <Button onClick={() => {
            setFilters({ operator: '', target_type: '', startDate: null, endDate: null });
          }}>
            重置筛选
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`
        }}
      />
    </div>
  );
};

export default Logs;
