import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Input, Select, DatePicker, message, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { Option } = Select;
const { RangePicker } = DatePicker;

function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    targetType: '',
    targetId: '',
    operator: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    loadLogs();
  }, [filters]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.targetType) params.targetType = filters.targetType;
      if (filters.targetId) params.targetId = filters.targetId;
      if (filters.operator) params.operator = filters.operator;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const res = await axios.get('/api/audit-logs', { params });
      setLogs(res.data);
    } catch (err) {
      message.error('加载审计日志失败');
    }
    setLoading(false);
  };

  const columns = [
    { title: '操作类型', dataIndex: 'operation_type', key: 'operation_type',
      render: (type) => {
        const typeMap = {
          'create': '创建',
          'update': '更新',
          'delete': '删除',
          'handle': '处理'
        };
        return typeMap[type] || type;
      }
    },
    { title: '目标类型', dataIndex: 'target_type', key: 'target_type',
      render: (type) => {
        const typeMap = {
          'member': '会员',
          'coupon': '优惠券',
          'coupon_package': '券包',
          'verification': '核销',
          'refund': '退款',
          'store': '门店'
        };
        return typeMap[type] || type;
      }
    },
    { title: '目标ID', dataIndex: 'target_id', key: 'target_id' },
    { title: '操作人', dataIndex: 'operator', key: 'operator' },
    { title: '旧值', dataIndex: 'old_value', key: 'old_value',
      render: (val) => val || '-'
    },
    { title: '新值', dataIndex: 'new_value', key: 'new_value',
      render: (val) => val || '-'
    },
    { title: '备注', dataIndex: 'remark', key: 'remark',
      render: (val) => val || '-'
    },
    { title: '操作时间', dataIndex: 'operation_time', key: 'operation_time',
      render: (time) => moment(time).format('YYYY-MM-DD HH:mm:ss')
    }
  ];

  return (
    <div>
      <h2>审计日志</h2>
      
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="目标类型"
            style={{ width: 150 }}
            allowClear
            value={filters.targetType}
            onChange={(value) => setFilters({ ...filters, targetType: value })}
          >
            <Option value="member">会员</Option>
            <Option value="coupon">优惠券</Option>
            <Option value="coupon_package">券包</Option>
            <Option value="verification">核销</Option>
            <Option value="refund">退款</Option>
            <Option value="store">门店</Option>
          </Select>
          
          <Input
            placeholder="目标ID"
            style={{ width: 120 }}
            value={filters.targetId}
            onChange={(e) => setFilters({ ...filters, targetId: e.target.value })}
            prefix={<SearchOutlined />}
          />
          
          <Input
            placeholder="操作人"
            style={{ width: 120 }}
            value={filters.operator}
            onChange={(e) => setFilters({ ...filters, operator: e.target.value })}
            prefix={<SearchOutlined />}
          />
          
          <RangePicker
            format="YYYY-MM-DD"
            onChange={(dates) => {
              if (dates) {
                setFilters({
                  ...filters,
                  startDate: dates[0].format('YYYY-MM-DD'),
                  endDate: dates[1].format('YYYY-MM-DD')
                });
              } else {
                setFilters({ ...filters, startDate: '', endDate: '' });
              }
            }}
          />
          
          <Button type="primary" onClick={loadLogs}>
            搜索
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1400 }}
        />
      </Card>
    </div>
  );
}

export default AuditLogs;
