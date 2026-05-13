import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Input, Select, DatePicker, Modal, message, Space } from 'antd';
import { SearchOutlined, BlockOutlined, UnlockOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { Option } = Select;
const { RangePicker } = DatePicker;

function Verifications() {
  const [verifications, setVerifications] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    storeId: '',
    memberId: '',
    isBlocked: '',
    startDate: '',
    endDate: ''
  });
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [blockingRecord, setBlockingRecord] = useState(null);
  const [blockReason, setBlockReason] = useState('');

  useEffect(() => {
    loadVerifications();
    loadStores();
  }, [filters]);

  const loadVerifications = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.storeId) params.storeId = filters.storeId;
      if (filters.memberId) params.memberId = filters.memberId;
      if (filters.isBlocked !== '') params.isBlocked = filters.isBlocked;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const res = await axios.get('/api/verifications', { params });
      setVerifications(res.data);
    } catch (err) {
      message.error('加载核销记录失败');
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

  const handleBlock = (record) => {
    setBlockingRecord(record);
    setBlockReason(record.block_reason || '');
    setBlockModalVisible(true);
  };

  const submitBlock = async () => {
    try {
      const isBlocked = !blockingRecord.is_blocked;
      await axios.put(`/api/verifications/${blockingRecord.id}/block`, {
        blocked: isBlocked,
        reason: blockReason,
        operator: '管理员'
      });
      message.success(isBlocked ? '拦截成功' : '解除拦截成功');
      setBlockModalVisible(false);
      loadVerifications();
    } catch (err) {
      message.error('操作失败');
    }
  };

  const exportData = () => {
    const params = new URLSearchParams();
    if (filters.storeId) params.append('storeId', filters.storeId);
    if (filters.memberId) params.append('memberId', filters.memberId);
    if (filters.isBlocked !== '') params.append('isBlocked', filters.isBlocked);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    window.open(`/api/export/verifications?${params.toString()}`, '_blank');
  };

  const columns = [
    { title: '核销单号', dataIndex: 'verification_no', key: 'verification_no' },
    { title: '券号', dataIndex: 'coupon_no', key: 'coupon_no' },
    { title: '券类型', dataIndex: 'coupon_type', key: 'coupon_type' },
    { title: '会员', key: 'member',
      render: (_, record) => (
        <span>{record.member_name} ({record.member_no})</span>
      )
    },
    { title: '门店', dataIndex: 'store_name', key: 'store_name' },
    { title: '订单金额', dataIndex: 'order_amount', key: 'order_amount' },
    { title: '优惠金额', dataIndex: 'discount_amount', key: 'discount_amount' },
    { title: '核销员', dataIndex: 'operator', key: 'operator' },
    { title: '状态', dataIndex: 'status', key: 'status',
      render: (status) => {
        const statusMap = {
          'normal': { color: 'green', text: '正常' },
          'refunded': { color: 'blue', text: '已退款' }
        };
        const s = statusMap[status] || { color: 'default', text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
      }
    },
    { title: '是否拦截', dataIndex: 'is_blocked', key: 'is_blocked',
      render: (blocked) => blocked ? (
        <Tag color="red">已拦截</Tag>
      ) : (
        <Tag color="green">正常</Tag>
      )
    },
    { title: '拦截原因', dataIndex: 'block_reason', key: 'block_reason' },
    { title: '核销时间', dataIndex: 'verification_time', key: 'verification_time',
      render: (time) => moment(time).format('YYYY-MM-DD HH:mm')
    },
    { title: '操作', key: 'action',
      render: (_, record) => (
        <Button
          type={record.is_blocked ? 'default' : 'primary'}
          size="small"
          icon={record.is_blocked ? <UnlockOutlined /> : <BlockOutlined />}
          onClick={() => handleBlock(record)}
        >
          {record.is_blocked ? '解除拦截' : '拦截'}
        </Button>
      )
    }
  ];

  return (
    <div>
      <h2>核销记录</h2>
      
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
            placeholder="是否拦截"
            style={{ width: 120 }}
            allowClear
            value={filters.isBlocked}
            onChange={(value) => setFilters({ ...filters, isBlocked: value })}
          >
            <Option value={1}>是</Option>
            <Option value={0}>否</Option>
          </Select>
          
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
          
          <Button type="primary" onClick={loadVerifications}>
            搜索
          </Button>
          
          <Button onClick={exportData}>
            导出
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={verifications}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1400 }}
        />
      </Card>

      <Modal
        title={blockingRecord?.is_blocked ? '解除拦截' : '拦截核销'}
        visible={blockModalVisible}
        onOk={submitBlock}
        onCancel={() => setBlockModalVisible(false)}
      >
        {blockingRecord && (
          <div>
            <p><strong>核销单号：</strong>{blockingRecord.verification_no}</p>
            <p><strong>会员：</strong>{blockingRecord.member_name} ({blockingRecord.member_no})</p>
            <p><strong>当前状态：</strong>{blockingRecord.is_blocked ? '已拦截' : '正常'}</p>
            
            <div style={{ marginTop: 16 }}>
              <label>{blockingRecord.is_blocked ? '解除原因：' : '拦截原因：'}</label>
              <Input.TextArea
                rows={4}
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder={`请输入${blockingRecord.is_blocked ? '解除' : '拦截'}原因`}
                style={{ marginTop: 8 }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Verifications;
