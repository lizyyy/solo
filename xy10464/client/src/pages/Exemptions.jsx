import React, { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Popconfirm,
  message,
  Spin,
  Card,
  Select,
  Modal
} from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { exemptionsAPI, workOrdersAPI } from '../services/api';

const Exemptions = () => {
  const [loading, setLoading] = useState(false);
  const [exemptions, setExemptions] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [filters, setFilters] = useState({
    work_order_id: undefined,
    status: undefined
  });

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [exemptionsRes, workOrdersRes] = await Promise.all([
        exemptionsAPI.getAll(filters),
        workOrdersAPI.getAll()
      ]);

      setExemptions(exemptionsRes.data.map(e => ({ ...e, key: e.id })));
      setWorkOrders(workOrdersRes.data);
    } catch (error) {
      message.error('加载数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const handleApprove = async (id) => {
    try {
      await exemptionsAPI.approve(id);
      message.success('审批通过');
      loadData();
    } catch (error) {
      message.error(error.response?.data?.error || '审批失败');
    }
  };

  const handleReject = async (id) => {
    Modal.confirm({
      title: '拒绝免责申请',
      content: '确定要拒绝此免责申请吗？',
      okText: '确认拒绝',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await exemptionsAPI.reject(id, { reject_reason: '未提供详细原因' });
          message.success('已拒绝');
          loadData();
        } catch (error) {
          message.error(error.response?.data?.error || '操作失败');
        }
      }
    });
  };

  const columns = [
    {
      title: '工单编号',
      dataIndex: 'work_order_number',
      key: 'work_order_number'
    },
    {
      title: '类型',
      dataIndex: 'exemption_type',
      key: 'exemption_type',
      render: (type) => type === 'response' ? '响应超时' : '修复超时'
    },
    {
      title: '申请金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => `¥${amount.toFixed(2)}`
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colorMap = {
          pending: 'orange',
          approved: 'green',
          rejected: 'red'
        };
        const textMap = {
          pending: '待审批',
          approved: '已批准',
          rejected: '已拒绝'
        };
        return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
      },
      filters: [
        { text: '待审批', value: 'pending' },
        { text: '已批准', value: 'approved' },
        { text: '已拒绝', value: 'rejected' }
      ],
      filterMultiple: false,
      onFilter: (value, record) => record.status === value
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at)
    },
    {
      title: '审批时间',
      dataIndex: 'approved_at',
      key: 'approved_at',
      render: (time) => time || '-'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        if (record.status !== 'pending') return null;
        return (
          <Space>
            <Popconfirm
              title="确认批准此免责申请？"
              onConfirm={() => handleApprove(record.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" size="small" icon={<CheckOutlined />}>
                批准
              </Button>
            </Popconfirm>
            <Button 
              type="link" 
              size="small" 
              danger 
              icon={<CloseOutlined />}
              onClick={() => handleReject(record.id)}
            >
              拒绝
            </Button>
          </Space>
        );
      }
    }
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Select
            placeholder="选择工单"
            style={{ width: 200 }}
            allowClear
            value={filters.work_order_id}
            onChange={(value) => setFilters(prev => ({ ...prev, work_order_id: value }))}
          >
            {workOrders.map(wo => (
              <Select.Option key={wo.id} value={wo.id}>
                {wo.work_order_number}
              </Select.Option>
            ))}
          </Select>

          <Select
            placeholder="选择状态"
            style={{ width: 150 }}
            allowClear
            value={filters.status}
            onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
          >
            <Select.Option value="pending">待审批</Select.Option>
            <Select.Option value="approved">已批准</Select.Option>
            <Select.Option value="rejected">已拒绝</Select.Option>
          </Select>

          <Button
            onClick={() => setFilters({ work_order_id: undefined, status: undefined })}
          >
            重置
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={exemptions}
        loading={loading}
        rowKey="id"
      />
    </div>
  );
};

export default Exemptions;
