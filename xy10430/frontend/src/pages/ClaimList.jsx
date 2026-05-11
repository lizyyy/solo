import React, { useEffect, useState } from 'react';
import { Table, Tag, Input, Select, Button, Space, Card, Badge } from 'antd';
import { useNavigate } from 'react-router-dom';
import { claimApi } from '../services/api';
import moment from 'moment';

const { Search } = Input;
const { Option } = Select;

function ClaimList() {
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
      if (filters.keyword) params.claimNo = filters.keyword;

      const res = await claimApi.list(params);
      if (res.success) {
        setData(res.data);
        setPagination({
          current: res.page,
          pageSize: res.pageSize,
          total: res.total
        });
      }
    } catch (error) {
      console.error('加载索赔失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const getStatusTag = (status) => {
    const statusMap = {
      'draft': <Tag color="default">草稿</Tag>,
      'pending_review': <Badge status="processing" text={<Tag color="orange">待审批</Tag>} />,
      'approved': <Tag color="green">已批准</Tag>,
      'rejected': <Tag color="red">已驳回</Tag>,
      'paid': <Tag color="blue">已赔付</Tag>,
      'closed': <Tag color="gray">已关闭</Tag>
    };
    return statusMap[status] || status;
  };

  const getClaimTypeTag = (type) => {
    const typeMap = {
      'overtemp': <Tag color="red">超温索赔</Tag>,
      'damaged': <Tag color="orange">货损索赔</Tag>,
      'lost': <Tag color="purple">丢失索赔</Tag>,
      'other': <Tag color="blue">其他</Tag>
    };
    return typeMap[type] || type;
  };

  const getWarningFlags = (record) => {
    const flags = [];
    if (record.isDuplicate) flags.push(<Tag key="dup" color="red">重复索赔</Tag>);
    if (record.isExemptClaim) flags.push(<Tag key="exempt" color="orange">签收免责</Tag>);
    if (record.exceedsLimit) flags.push(<Tag key="limit" color="purple">金额超限</Tag>);
    return flags;
  };

  const columns = [
    {
      title: '索赔单号',
      dataIndex: 'claimNo',
      key: 'claimNo',
      width: 200,
      render: (text, record) => (
        <a onClick={() => navigate(`/claims/${record.id}`)}>{text}</a>
      )
    },
    {
      title: '运单号',
      dataIndex: ['shipment', 'shipmentNo'],
      key: 'shipmentNo',
      width: 150
    },
    {
      title: '货物类型',
      dataIndex: ['shipment', 'cargoType', 'name'],
      key: 'cargoType',
      width: 100
    },
    {
      title: '索赔类型',
      dataIndex: 'claimType',
      key: 'claimType',
      width: 100,
      render: getClaimTypeTag
    },
    {
      title: '索赔金额',
      dataIndex: 'claimAmount',
      key: 'claimAmount',
      width: 120,
      render: (val) => `¥${val?.toLocaleString() || 0}`
    },
    {
      title: '批准金额',
      dataIndex: 'approvedAmount',
      key: 'approvedAmount',
      width: 120,
      render: (val) => val ? `¥${val.toLocaleString()}` : '-'
    },
    {
      title: '风险标记',
      key: 'flags',
      width: 200,
      render: (_, record) => (
        <Space size={[4, 4]} wrap>
          {getWarningFlags(record)}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: getStatusTag
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (val) => moment(val).format('YYYY-MM-DD HH:mm')
    }
  ];

  return (
    <Card>
      <Space style={{ marginBottom: 16 }}>
        <Search
          placeholder="搜索索赔单号"
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
          <Option value="draft">草稿</Option>
          <Option value="pending_review">待审批</Option>
          <Option value="approved">已批准</Option>
          <Option value="rejected">已驳回</Option>
          <Option value="paid">已赔付</Option>
        </Select>
        <Button onClick={() => {
          setFilters({ status: '', keyword: '' });
        }}>重置</Button>
        <Button type="primary" onClick={() => navigate('/claims/new')}>
          新建索赔
        </Button>
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
        scroll={{ x: 1300 }}
      />
    </Card>
  );
}

export default ClaimList;
