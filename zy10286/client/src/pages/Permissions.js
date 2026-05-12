import React, { useState, useEffect } from 'react';
import { Table, Button, Space, message, Tag, Typography, Input, Select } from 'antd';
import { ReloadOutlined, StopOutlined } from '@ant-design/icons';
import moment from 'moment';

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;

function Permissions() {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filteredPermissions, setFilteredPermissions] = useState([]);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/permissions');
      const data = await response.json();
      setPermissions(data);
      setFilteredPermissions(data);
    } catch (error) {
      message.error('获取权限列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (perm) => {
    try {
      const response = await fetch(`/api/permissions/${perm.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: '手动回收', operator: '教务管理员' })
      });
      if (response.ok) {
        message.success('权限已回收');
        fetchPermissions();
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleSearch = (value) => {
    if (!value) {
      setFilteredPermissions(permissions);
      return;
    }
    const filtered = permissions.filter(p => 
      p.student_name?.includes(value) || 
      p.session_title?.includes(value) ||
      p.class_name?.includes(value)
    );
    setFilteredPermissions(filtered);
  };

  const handleStatusFilter = (value) => {
    if (!value) {
      setFilteredPermissions(permissions);
      return;
    }
    const filtered = permissions.filter(p => p.status === value);
    setFilteredPermissions(filtered);
  };

  const columns = [
    {
      title: '学员',
      dataIndex: 'student_name',
      key: 'student_name',
      width: 120
    },
    {
      title: '场次',
      dataIndex: 'session_title',
      key: 'session_title',
      width: 200
    },
    {
      title: '所属班级',
      dataIndex: 'class_name',
      key: 'class_name',
      width: 180
    },
    {
      title: '授权来源',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (source) => {
        const sourceMap = {
          'enrollment': '报名授权',
          'transfer': '转班授权',
          'manual': '手动授权'
        };
        return sourceMap[source] || source;
      }
    },
    {
      title: '授权时间',
      dataIndex: 'granted_at',
      key: 'granted_at',
      width: 160,
      render: (date) => date ? moment(date).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: '过期时间',
      dataIndex: 'expires_at',
      key: 'expires_at',
      width: 120,
      render: (date) => {
        if (!date) return '永久';
        const isExpired = moment(date).isBefore(moment());
        return (
          <Text type={isExpired ? 'danger' : undefined}>
            {moment(date).format('YYYY-MM-DD')}
          </Text>
        );
      }
    },
    {
      title: '回收时间',
      dataIndex: 'revoked_at',
      key: 'revoked_at',
      width: 160,
      render: (date) => date ? moment(date).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const color = status === 'active' ? 'green' : status === 'revoked' ? 'red' : 'default';
        const text = status === 'active' ? '有效' : status === 'revoked' ? '已回收' : status;
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          {record.status === 'active' && (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => handleRevoke(record)}
            >
              回收
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>权限管理</Title>
        <Text type="secondary">管理学员回放权限，可手动回收</Text>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Search
            placeholder="搜索学员/场次/班级"
            style={{ width: 300 }}
            onSearch={handleSearch}
            enterButton
          />
          <Select
            placeholder="按状态筛选"
            style={{ width: 150 }}
            onChange={handleStatusFilter}
            allowClear
          >
            <Option value="active">有效</Option>
            <Option value="revoked">已回收</Option>
          </Select>
        </Space>
        <Button icon={<ReloadOutlined />} onClick={fetchPermissions}>
          刷新
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={filteredPermissions}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1300 }}
      />
    </div>
  );
}

export default Permissions;
