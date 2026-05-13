import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Input, Select, DatePicker, message, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { Option } = Select;
const { RangePicker } = DatePicker;

function Refunds() {
  const [refunds, setRefunds] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    storeId: '',
    memberId: '',
    returnStatus: '',
    handler: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    loadRefunds();
    loadStores();
  }, [filters]);

  const loadRefunds = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.storeId) params.storeId = filters.storeId;
      if (filters.memberId) params.memberId = filters.memberId;
      if (filters.returnStatus) params.returnStatus = filters.returnStatus;
      if (filters.handler) params.handler = filters.handler;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const res = await axios.get('/api/refunds', { params });
      setRefunds(res.data);
    } catch (err) {
      message.error('加载退款记录失败');
    }
    setLoading(false);
  };

  const loadStores = async () => {
    try {
      const res = await axios.get('/api/stores');
      setStores(res.data);
    } catch (err) {
      message.error('加载门店列表失败');
    }
  };

  const exportData = () => {
    const params = new URLSearchParams();
    if (filters.storeId) params.append('storeId', filters.storeId);
    if (filters.memberId) params.append('memberId', filters.memberId);
    if (filters.returnStatus) params.append('returnStatus', filters.returnStatus);
    if (filters.handler) params.append('handler', filters.handler);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    window.open(`/api/export/refunds?${params.toString()}`, '_blank');
  };

  const columns = [
    { title: '退款单号', dataIndex: 'refund_no', key: 'refund_no' },
    { title: '券号', dataIndex: 'coupon_no', key: 'coupon_no' },
    { title: '会员', key: 'member',
      render: (_, record) => (
        <span>{record.member_name} ({record.member_no})</span>
      )
    },
    { title: '门店', dataIndex: 'store_name', key: 'store_name' },
    { title: '退款金额', dataIndex: 'refund_amount', key: 'refund_amount' },
    { title: '退款员', dataIndex: 'operator', key: 'operator' },
    { title: '是否返券', dataIndex: 'is_coupon_returned', key: 'is_coupon_returned',
      render: (val) => val ? (
        <Tag color="green">是</Tag>
      ) : (
        <Tag color="orange">否</Tag>
      )
    },
    { title: '返券状态', dataIndex: 'return_status', key: 'return_status',
      render: (status) => {
        const statusMap = {
          'pending': { color: 'default', text: '待处理' },
          'exception': { color: 'red', text: '异常' },
          'handling': { color: 'orange', text: '处理中' },
          'handled': { color: 'blue', text: '已处理' },
          'success': { color: 'green', text: '成功' }
        };
        const s = statusMap[status] || { color: 'default', text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
      }
    },
    { title: '异常类型', dataIndex: 'exception_type', key: 'exception_type',
      render: (type) => type || '-'
    },
    { title: '处理人', dataIndex: 'handler', key: 'handler',
      render: (handler) => handler || '-'
    },
    { title: '处理时间', dataIndex: 'handle_time', key: 'handle_time',
      render: (time) => time ? moment(time).format('YYYY-MM-DD HH:mm') : '-'
    },
    { title: '处理结果', dataIndex: 'handle_result', key: 'handle_result',
      render: (result) => result || '-'
    },
    { title: '退款时间', dataIndex: 'refund_time', key: 'refund_time',
      render: (time) => moment(time).format('YYYY-MM-DD HH:mm')
    }
  ];

  return (
    <div>
      <h2>退款记录</h2>
      
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="选择门店"
            style={{ width: 150 }}
            allowClear
            value={filters.storeId}
            onChange={(value) => setFilters({ ...filters, storeId: value })}
          >
            {stores.map(store => (
              <Option key={store.id} value={store.id}>{store.name}</Option>
            ))}
          </Select>
          
          <Input
            placeholder="会员ID"
            style={{ width: 150 }}
            value={filters.memberId}
            onChange={(e) => setFilters({ ...filters, memberId: e.target.value })}
            prefix={<SearchOutlined />}
          />
          
          <Select
            placeholder="返券状态"
            style={{ width: 120 }}
            allowClear
            value={filters.returnStatus}
            onChange={(value) => setFilters({ ...filters, returnStatus: value })}
          >
            <Option value="pending">待处理</Option>
            <Option value="exception">异常</Option>
            <Option value="handling">处理中</Option>
            <Option value="handled">已处理</Option>
            <Option value="success">成功</Option>
          </Select>
          
          <Input
            placeholder="处理人"
            style={{ width: 120 }}
            value={filters.handler}
            onChange={(e) => setFilters({ ...filters, handler: e.target.value })}
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
          
          <Button type="primary" onClick={loadRefunds}>
            搜索
          </Button>
          
          <Button onClick={exportData}>
            导出
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={refunds}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1600 }}
        />
      </Card>
    </div>
  );
}

export default Refunds;
