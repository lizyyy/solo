import React, { useEffect, useState } from 'react';
import { Table, Tag, Input, Select, Button, Space, Card } from 'antd';
import { useNavigate } from 'react-router-dom';
import { shipmentApi } from '../services/api';

const { Search } = Input;
const { Option } = Select;

function ShipmentList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    status: '',
    keyword: ''
  });

  const loadData = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const params = { page, pageSize };
      if (filters.status) params.status = filters.status;
      if (filters.keyword) params.shipmentNo = filters.keyword;

      const res = await shipmentApi.list(params);
      if (res.success) {
        setData(res.data);
        setPagination({
          current: res.page,
          pageSize: res.pageSize,
          total: res.total
        });
      }
    } catch (error) {
      console.error('加载运单失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const getStatusTag = (status) => {
    const statusMap = {
      'in_transit': <Tag color="blue">运输中</Tag>,
      'delivered': <Tag color="cyan">已送达</Tag>,
      'signed_off': <Tag color="green">已签收</Tag>,
      'claim_pending': <Tag color="orange">待索赔处理</Tag>
    };
    return statusMap[status] || status;
  };

  const columns = [
    {
      title: '运单号',
      dataIndex: 'shipmentNo',
      key: 'shipmentNo',
      width: 180,
      render: (text, record) => (
        <a onClick={() => navigate(`/shipments/${record.id}`)}>{text}</a>
      )
    },
    {
      title: '客户名称',
      dataIndex: 'customerName',
      key: 'customerName'
    },
    {
      title: '货物类型',
      dataIndex: ['cargoType', 'name'],
      key: 'cargoType',
      width: 100
    },
    {
      title: '起始地',
      dataIndex: 'origin',
      key: 'origin'
    },
    {
      title: '目的地',
      dataIndex: 'destination',
      key: 'destination'
    },
    {
      title: '货值',
      dataIndex: 'cargoValue',
      key: 'cargoValue',
      width: 120,
      render: (val) => `¥${val?.toLocaleString() || 0}`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: getStatusTag
    },
    {
      title: '发运时间',
      dataIndex: 'departureTime',
      key: 'departureTime',
      width: 180,
      render: (val) => new Date(val).toLocaleString()
    }
  ];

  return (
    <Card>
      <Space style={{ marginBottom: 16 }}>
        <Search
          placeholder="搜索运单号"
          onSearch={(value) => setFilters({ ...filters, keyword: value })}
          style={{ width: 200 }}
          allowClear
        />
        <Select
          placeholder="选择状态"
          style={{ width: 150 }}
          allowClear
          onChange={(value) => setFilters({ ...filters, status: value })}
        >
          <Option value="in_transit">运输中</Option>
          <Option value="delivered">已送达</Option>
          <Option value="signed_off">已签收</Option>
          <Option value="claim_pending">待索赔处理</Option>
        </Select>
        <Button onClick={() => {
          setFilters({ status: '', keyword: '' });
        }}>重置</Button>
      </Space>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
          onChange: (page, pageSize) => loadData(page, pageSize)
        }}
      />
    </Card>
  );
}

export default ShipmentList;
