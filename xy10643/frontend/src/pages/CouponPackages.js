import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Input, Select, message, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { Option } = Select;

function CouponPackages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ memberId: '', status: '' });

  useEffect(() => {
    loadPackages();
  }, [filters]);

  const loadPackages = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.memberId) params.memberId = filters.memberId;
      if (filters.status) params.status = filters.status;
      const res = await axios.get('/api/coupon-packages', { params });
      setPackages(res.data);
    } catch (err) {
      message.error('加载券包列表失败');
    }
    setLoading(false);
  };

  const columns = [
    { title: '券包编号', dataIndex: 'package_no', key: 'package_no' },
    { title: '券包名称', dataIndex: 'name', key: 'name' },
    { title: '所属会员', key: 'member',
      render: (_, record) => (
        <span>{record.member_name} ({record.member_no})</span>
      )
    },
    { title: '总券数', dataIndex: 'total_count', key: 'total_count' },
    { title: '已用券数', dataIndex: 'used_count', key: 'used_count' },
    { title: '剩余券数', dataIndex: 'remaining_count', key: 'remaining_count' },
    { title: '修改前数据', key: 'before',
      render: (_, record) => (
        record.total_count_before ? (
          <div>
            <div>总券数: {record.total_count_before}</div>
            <div>已用: {record.used_count_before}</div>
            <div>剩余: {record.remaining_count_before}</div>
          </div>
        ) : '-'
      )
    },
    { title: '状态', dataIndex: 'status', key: 'status',
      render: (status) => {
        const statusMap = {
          'active': { color: 'green', text: '有效' },
          'inactive': { color: 'red', text: '失效' },
          'expired': { color: 'orange', text: '过期' }
        };
        const s = statusMap[status] || { color: 'default', text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
      }
    },
    { title: '有效期', key: 'validity',
      render: (_, record) => (
        <span>
          {moment(record.valid_start_date).format('YYYY-MM-DD')} ~ {moment(record.valid_end_date).format('YYYY-MM-DD')}
        </span>
      )
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at',
      render: (time) => moment(time).format('YYYY-MM-DD HH:mm')
    }
  ];

  return (
    <div>
      <h2>活动券包</h2>
      
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索会员ID"
            style={{ width: 200 }}
            value={filters.memberId}
            onChange={(e) => setFilters({ ...filters, memberId: e.target.value })}
            prefix={<SearchOutlined />}
          />
          
          <Select
            placeholder="选择状态"
            style={{ width: 150 }}
            allowClear
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
          >
            <Option value="active">有效</Option>
            <Option value="inactive">失效</Option>
            <Option value="expired">过期</Option>
          </Select>
          
          <Button type="primary" onClick={loadPackages}>
            搜索
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={packages}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}

export default CouponPackages;
