import React, { useState, useEffect } from 'react';
import { Table, Button, Space, message, Tag, Typography, Input, Select } from 'antd';
import { ReloadOutlined, EyeOutlined, StopOutlined } from '@ant-design/icons';
import moment from 'moment';

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;

function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/logs?limit=200');
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      message.error('获取访问日志失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '访问时间',
      dataIndex: 'access_time',
      key: 'access_time',
      width: 180,
      render: (date) => date ? moment(date).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    {
      title: '学员',
      dataIndex: 'student_name',
      key: 'student_name',
      width: 120
    },
    {
      title: '账号标识',
      dataIndex: 'account_identifier',
      key: 'account_identifier',
      width: 150
    },
    {
      title: '访问场次',
      dataIndex: 'session_title',
      key: 'session_title',
      width: 200
    },
    {
      title: '访问类型',
      dataIndex: 'access_type',
      key: 'access_type',
      width: 100,
      render: (type) => {
        const typeMap = {
          'play': '观看',
          'denied': '拒绝',
          'download': '下载'
        };
        return typeMap[type] || type;
      }
    },
    {
      title: '是否允许',
      dataIndex: 'was_allowed',
      key: 'was_allowed',
      width: 100,
      render: (allowed) => (
        <Tag color={allowed ? 'green' : 'red'} icon={allowed ? <EyeOutlined /> : <StopOutlined />}>
          {allowed ? '允许' : '拒绝'}
        </Tag>
      )
    },
    {
      title: '拒绝原因',
      dataIndex: 'deny_reason',
      key: 'deny_reason',
      ellipsis: true,
      render: (reason) => reason || '-'
    }
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>访问日志</Title>
        <Text type="secondary">记录所有回放访问行为，用于审计和追溯</Text>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Search
            placeholder="搜索学员/场次"
            style={{ width: 250 }}
            enterButton
          />
          <Select
            placeholder="按结果筛选"
            style={{ width: 150 }}
            allowClear
          >
            <Option value={1}>允许访问</Option>
            <Option value={0}>拒绝访问</Option>
          </Select>
        </Space>
        <Button icon={<ReloadOutlined />} onClick={fetchLogs}>
          刷新
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1300 }}
      />
    </div>
  );
}

export default Logs;
