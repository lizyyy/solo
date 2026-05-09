import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Select, 
  InputNumber, 
  Input, 
  Space, 
  Tag, 
  message,
  Card,
  Popconfirm,
  Radio
} from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { adjustmentApi, customerApi } from '../utils/api';

const { Option } = Select;
const { TextArea } = Input;

function Adjustments() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [form] = Form.useForm();
  const [reviewForm] = Form.useForm();

  useEffect(() => {
    fetchData();
    fetchCustomers();
  }, [filterStatus]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = filterStatus ? { approval_status: filterStatus } : {};
      const res = await adjustmentApi.getAll(params);
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (error) {
      message.error('获取调额申请列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await customerApi.getAll();
      if (res.data.success) {
        setCustomers(res.data.data);
      }
    } catch (error) {
      message.error('获取客户列表失败');
    }
  };

  const columns = [
    { title: '调额单号', dataIndex: 'adjustment_no', key: 'adjustment_no', width: 180 },
    { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 180 },
    { 
      title: '调额类型', 
      dataIndex: 'adjustment_type', 
      key: 'adjustment_type', 
      width: 100,
      render: (t) => t === 'increase' ? <Tag color="green">调增</Tag> : <Tag color="orange">调减</Tag>
    },
    { 
      title: '金额', 
      dataIndex: 'amount', 
      key: 'amount', 
      width: 120,
      render: (val, record) => (
        <span style={{ color: record.adjustment_type === 'increase' ? '#52c41a' : '#fa8c16' }}>
          {record.adjustment_type === 'increase' ? '+' : '-'}¥{val.toLocaleString()}
        </span>
      )
    },
    { title: '原因', dataIndex: 'reason', key: 'reason', width: 200, ellipsis: true },
    { title: '申请人', dataIndex: 'requester', key: 'requester', width: 100 },
    { 
      title: '审批状态', 
      dataIndex: 'approval_status', 
      key: 'approval_status', 
      width: 100,
      render: (s) => {
        const map = { 
          pending: <Tag color="orange">待审批</Tag>, 
          approved: <Tag color="green">已通过</Tag>, 
          rejected: <Tag color="red">已驳回</Tag> 
        };
        return map[s] || s;
      }
    },
    { title: '审批人', dataIndex: 'approver', key: 'approver', width: 100, render: (v) => v || '-' },
    { title: '申请时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => {
        if (record.approval_status !== 'pending') {
          return <span style={{ color: '#999' }}>-</span>;
        }
        return (
          <Space size="small">
            <Button type="link" icon={<CheckOutlined />} onClick={() => handleReview(record, true)}>
              通过
            </Button>
            <Button type="link" danger icon={<CloseOutlined />} onClick={() => handleReview(record, false)}>
              驳回
            </Button>
          </Space>
        );
      }
    }
  ];

  const handleReview = (record, isApprove) => {
    setSelectedRecord({ ...record, isApprove });
    reviewForm.resetFields();
    setReviewModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      const res = await adjustmentApi.create({
        ...values,
        requester: '操作员'
      });
      if (res.data.success) {
        message.success(res.data.message);
        setModalVisible(false);
        form.resetFields();
        fetchData();
      } else {
        message.error(res.data.message);
      }
    } catch (error) {
      message.error('提交调额申请失败');
    }
  };

  const handleApprove = async (values) => {
    try {
      const apiMethod = selectedRecord.isApprove ? adjustmentApi.approve : adjustmentApi.reject;
      const res = await apiMethod(selectedRecord.id, {
        approver: '审批人',
        approval_remark: values.approval_remark || ''
      });
      if (res.data.success) {
        message.success(res.data.message);
        setReviewModalVisible(false);
        setSelectedRecord(null);
        fetchData();
      } else {
        message.error(res.data.message);
      }
    } catch (error) {
      message.error('审批失败');
    }
  };

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Radio.Group value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <Radio.Button value="">全部</Radio.Button>
              <Radio.Button value="pending">待审批</Radio.Button>
              <Radio.Button value="approved">已通过</Radio.Button>
              <Radio.Button value="rejected">已驳回</Radio.Button>
            </Radio.Group>
          </Space>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => setModalVisible(true)}
            style={{ float: 'right' }}
          >
            提交调额申请
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1400 }}
        />
      </Card>

      <Modal
        title="提交调额申请"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ adjustment_type: 'increase' }}
        >
          <Form.Item name="customer_id" label="选择客户" rules={[{ required: true, message: '请选择客户' }]}>
            <Select placeholder="请选择客户" showSearch optionFilterProp="children">
              {customers.map(c => (
                <Option key={c.id} value={c.id}>
                  {c.name} (当前额度: ¥{c.total_credit_limit.toLocaleString()})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="adjustment_type" label="调额类型" rules={[{ required: true, message: '请选择调额类型' }]}>
            <Radio.Group>
              <Radio value="increase">调增额度</Radio>
              <Radio value="decrease">调减额度</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item 
            name="amount" 
            label="调额金额" 
            rules={[{ required: true, message: '请输入调额金额' }]}
          >
            <InputNumber 
              style={{ width: '100%' }} 
              placeholder="请输入调额金额"
              min={0.01}
              step={0.01}
              formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value.replace(/\¥\s?|(,*)/g, '')}
            />
          </Form.Item>

          <Form.Item name="reason" label="调额原因" rules={[{ required: true, message: '请输入调额原因' }]}>
            <TextArea placeholder="请输入调额原因" rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedRecord?.isApprove ? '审批通过' : '审批驳回'}
        open={reviewModalVisible}
        onCancel={() => {
          setReviewModalVisible(false);
          setSelectedRecord(null);
        }}
        onOk={() => reviewForm.submit()}
      >
        <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <div><strong>客户:</strong> {selectedRecord?.customer_name}</div>
          <div><strong>调额类型:</strong> {selectedRecord?.adjustment_type === 'increase' ? '调增' : '调减'}</div>
          <div><strong>金额:</strong> {selectedRecord?.adjustment_type === 'increase' ? '+' : '-'}¥{selectedRecord?.amount?.toLocaleString()}</div>
          <div><strong>原因:</strong> {selectedRecord?.reason}</div>
        </div>
        <Form
          form={reviewForm}
          layout="vertical"
          onFinish={handleApprove}
        >
          <Form.Item name="approval_remark" label={selectedRecord?.isApprove ? '审批意见' : '驳回原因'}>
            <TextArea placeholder="请输入意见" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Adjustments;
