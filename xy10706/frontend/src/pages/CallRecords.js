import React, { useState, useEffect } from 'react';
import { Table, Select, Space, message, Spin, Tag, Button, Modal, Input } from 'antd';
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { quotaApi } from '../services/api';

const { Option } = Select;

const CallRecords = () => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({ customerId: null, status: null });
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    fetchCustomers();
    fetchRecords();
  }, [filters, pagination.current]);

  const fetchCustomers = async () => {
    try {
      const res = await quotaApi.getCustomers();
      setCustomers(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters,
      };
      const res = await quotaApi.getCallRecords(params);
      setRecords(res.data.records || []);
      setPagination(prev => ({
        ...prev,
        total: res.data.total || 0,
      }));
    } catch (error) {
      message.error('获取数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (record) => {
    try {
      const res = await quotaApi.getCallRecord(record.id);
      setSelectedRecord(res.data);
      setDetailModalVisible(true);
    } catch (error) {
      message.error('获取详情失败');
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      success: { text: '成功', class: 'status-success' },
      pending_review: { text: '待复核', class: 'status-pending' },
      blocked: { text: '已拦截', class: 'status-blocked' },
      retryable: { text: '可重试', class: 'status-retryable' },
      failed: { text: '失败', class: '' },
    };
    const config = statusMap[status] || { text: status, class: '' };
    return <span className={config.class}>{config.text}</span>;
  };

  const columns = [
    {
      title: '请求ID',
      dataIndex: 'requestId',
      key: 'requestId',
      width: 180,
      fixed: 'left',
    },
    {
      title: '客户',
      dataIndex: ['Customer', 'name'],
      key: 'customer',
      width: 120,
    },
    {
      title: '接口',
      key: 'endpoint',
      width: 200,
      render: (_, record) => `${record.ApiEndpoint?.method} ${record.ApiEndpoint?.path}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: getStatusTag,
    },
    {
      title: '成本',
      dataIndex: 'cost',
      key: 'cost',
      width: 80,
    },
    {
      title: '重试次数',
      dataIndex: 'retryCount',
      key: 'retryCount',
      width: 100,
    },
    {
      title: '突增检测',
      dataIndex: 'burstDetected',
      key: 'burstDetected',
      width: 100,
      render: (val) => val ? <Tag color="orange">是</Tag> : '否',
    },
    {
      title: '超额',
      dataIndex: 'overQuota',
      key: 'overQuota',
      width: 80,
      render: (val) => val ? <Tag color="red">是</Tag> : '否',
    },
    {
      title: '已复核',
      dataIndex: 'reviewed',
      key: 'reviewed',
      width: 80,
      render: (val) => val ? <Tag color="green">是</Tag> : '否',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <Space style={{ marginBottom: 16 }}>
        <Select
          style={{ width: 200 }}
          placeholder="选择客户"
          allowClear
          onChange={(value) => setFilters(prev => ({ ...prev, customerId: value }))}
        >
          {customers.map(c => (
            <Option key={c.id} value={c.id}>{c.name}</Option>
          ))}
        </Select>
        <Select
          style={{ width: 150 }}
          placeholder="选择状态"
          allowClear
          onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
        >
          <Option value="success">成功</Option>
          <Option value="pending_review">待复核</Option>
          <Option value="blocked">已拦截</Option>
          <Option value="retryable">可重试</Option>
        </Select>
        <Button
          type="primary"
          icon={<SearchOutlined />}
          onClick={fetchRecords}
        >
          搜索
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        scroll={{ x: 1400 }}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => setPagination(prev => ({
            ...prev,
            current: page,
            pageSize,
          })),
        }}
      />

      <Modal
        title="调用记录详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedRecord && (
          <div>
            <p><strong>请求ID:</strong> {selectedRecord.requestId}</p>
            <p><strong>客户:</strong> {selectedRecord.Customer?.name}</p>
            <p><strong>接口:</strong> {selectedRecord.ApiEndpoint?.method} {selectedRecord.ApiEndpoint?.path}</p>
            <p><strong>状态:</strong> {getStatusTag(selectedRecord.status)}</p>
            <p><strong>成本:</strong> {selectedRecord.cost}</p>
            <p><strong>重试次数:</strong> {selectedRecord.retryCount}</p>
            <p><strong>突增检测:</strong> {selectedRecord.burstDetected ? '是' : '否'}</p>
            <p><strong>超额:</strong> {selectedRecord.overQuota ? '是' : '否'}</p>
            <p><strong>已复核:</strong> {selectedRecord.reviewed ? '是' : '否'}</p>
            <p><strong>已修正:</strong> {selectedRecord.corrected ? '是' : '否'}</p>
            {selectedRecord.correctionReason && (
              <p><strong>修正原因:</strong> {selectedRecord.correctionReason}</p>
            )}
            {selectedRecord.errorMessage && (
              <p><strong>错误信息:</strong> {selectedRecord.errorMessage}</p>
            )}
            <p><strong>创建时间:</strong> {new Date(selectedRecord.createdAt).toLocaleString()}</p>
            {selectedRecord.ReviewRecords && selectedRecord.ReviewRecords.length > 0 && (
              <div>
                <h4>复核历史:</h4>
                {selectedRecord.ReviewRecords.map((r, i) => (
                  <div key={i} style={{ padding: '8px', background: '#f5f5f5', margin: '4px 0', borderRadius: '4px' }}>
                    <p>操作人: {r.reviewer}</p>
                    <p>操作: {r.action}</p>
                    <p>原因: {r.reason}</p>
                    <p>时间: {new Date(r.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </Spin>
  );
};

export default CallRecords;
