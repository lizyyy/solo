import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Select, Input, Space, message, Spin, Tag } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EditOutlined } from '@ant-design/icons';
import { quotaApi } from '../services/api';

const { Option } = Select;
const { TextArea } = Input;

const Reviews = () => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  useEffect(() => {
    fetchRecords();
  }, [pagination.current]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        status: 'pending_review',
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

  const handleReview = (record) => {
    setSelectedRecord(record);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await quotaApi.reviewCall({
        callRecordId: selectedRecord.id,
        ...values,
        reviewer: 'admin',
      });
      message.success('复核成功');
      setIsModalVisible(false);
      fetchRecords();
    } catch (error) {
      message.error('复核失败');
      console.error(error);
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      pending_review: { text: '待复核', class: 'status-pending' },
    };
    const config = statusMap[status] || { text: status, class: '' };
    return <span className={config.class}>{config.text}</span>;
  };

  const getReasonTag = (record) => {
    if (record.burstDetected) {
      return <Tag color="orange">突增检测</Tag>;
    }
    if (record.overQuota) {
      return <Tag color="red">超额</Tag>;
    }
    return <Tag>其他</Tag>;
  };

  const columns = [
    {
      title: '请求ID',
      dataIndex: 'requestId',
      key: 'requestId',
      width: 180,
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
      title: '触发原因',
      key: 'reason',
      width: 120,
      render: (_, record) => getReasonTag(record),
    },
    {
      title: '成本',
      dataIndex: 'cost',
      key: 'cost',
      width: 80,
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
      width: 120,
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          onClick={() => handleReview(record)}
        >
          复核
        </Button>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <div style={{ marginBottom: 16 }}>
        <h3>待复核调用记录</h3>
        <p>对触发突增检测或超额的调用记录进行复核处理，可选择通过、拒绝或修正。</p>
      </div>

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条待复核`,
          onChange: (page, pageSize) => setPagination(prev => ({
            ...prev,
            current: page,
            pageSize,
          })),
        }}
      />

      <Modal
        title="复核调用记录"
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        width={600}
      >
        {selectedRecord && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            <p><strong>请求ID:</strong> {selectedRecord.requestId}</p>
            <p><strong>客户:</strong> {selectedRecord.Customer?.name}</p>
            <p><strong>接口:</strong> {selectedRecord.ApiEndpoint?.method} {selectedRecord.ApiEndpoint?.path}</p>
            <p><strong>成本:</strong> {selectedRecord.cost}</p>
            <p><strong>触发原因:</strong> {selectedRecord.burstDetected ? '突增检测' : selectedRecord.overQuota ? '超额' : '其他'}</p>
          </div>
        )}
        <Form form={form} layout="vertical">
          <Form.Item
            name="action"
            label="复核操作"
            rules={[{ required: true, message: '请选择复核操作' }]}
          >
            <Select>
              <Option value="approve">
                <Space>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  通过（计入配额）
                </Space>
              </Option>
              <Option value="reject">
                <Space>
                  <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                  拒绝（不计入配额）
                </Space>
              </Option>
              <Option value="correct">
                <Space>
                  <EditOutlined style={{ color: '#1890ff' }} />
                  修正（特殊情况处理，计入配额并记录修正原因）
                </Space>
              </Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="reason"
            label="复核原因"
            rules={[{ required: true, message: '请输入复核原因' }]}
          >
            <TextArea rows={4} placeholder="请详细说明复核原因，此原因将作为审计记录保存..." />
          </Form.Item>
        </Form>
      </Modal>
    </Spin>
  );
};

export default Reviews;
