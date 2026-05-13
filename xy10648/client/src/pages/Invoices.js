import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, DatePicker, Tag, Space, Popconfirm, message, List, Descriptions } from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined, FileTextOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [activities, setActivities] = useState([]);
  const [visible, setVisible] = useState(false);
  const [supplementVisible, setSupplementVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [supplements, setSupplements] = useState([]);
  const [form] = Form.useForm();
  const [supplementForm] = Form.useForm();

  useEffect(() => {
    loadInvoices();
    loadActivities();
  }, []);

  const loadInvoices = async () => {
    try {
      const response = await axios.get('/api/invoices');
      setInvoices(response.data);
    } catch (error) {
      message.error('加载票据数据失败');
    }
  };

  const loadActivities = async () => {
    try {
      const response = await axios.get('/api/activities');
      setActivities(response.data);
    } catch (error) {
      message.error('加载活动数据失败');
    }
  };

  const loadSupplements = async (id) => {
    try {
      const response = await axios.get(`/api/invoices/${id}/supplements`);
      setSupplements(response.data);
      setSelectedInvoice(invoices.find(i => i.id === id));
      setSupplementVisible(true);
    } catch (error) {
      message.error('加载补资料请求失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const data = {
        ...values,
        invoice_date: values.invoice_date.format('YYYY-MM-DD')
      };
      await axios.post('/api/invoices', {
        ...data,
        created_by: '张三'
      });
      message.success('创建成功');
      setVisible(false);
      form.resetFields();
      loadInvoices();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await axios.patch(`/api/invoices/${id}/status`, {
        status,
        reviewer: '审核员A',
        review_comment: status === 'approved' ? '票据审核通过' : '票据审核拒绝'
      });
      message.success('状态更新成功');
      loadInvoices();
    } catch (error) {
      message.error('状态更新失败');
    }
  };

  const handleAddSupplement = async (values) => {
    try {
      await axios.post('/api/supplements', {
        ...values,
        review_id: selectedInvoice.id,
        requested_by: '审核员A'
      });
      message.success('补资料请求已发送');
      setSupplementVisible(false);
      supplementForm.resetFields();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'orange',
      'reviewing': 'blue',
      'approved': 'green',
      'rejected': 'red'
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'pending': '待审核',
      'reviewing': '审核中',
      'approved': '已通过',
      'rejected': '已拒绝'
    };
    return labels[status] || status;
  };

  const columns = [
    { title: '票据编号', dataIndex: 'invoice_number', key: 'invoice_number' },
    { title: '所属活动', dataIndex: 'activity_id', key: 'activity_id',
      render: (id) => {
        const activity = activities.find(a => a.id === id);
        return activity ? activity.activity_name : '-';
      }
    },
    { title: '票据金额', dataIndex: 'invoice_amount', key: 'invoice_amount',
      render: (val) => `¥${val.toLocaleString()}`
    },
    { title: '开票日期', dataIndex: 'invoice_date', key: 'invoice_date' },
    { title: '供应商', dataIndex: 'vendor_name', key: 'vendor_name' },
    { title: '审核员', dataIndex: 'reviewer', key: 'reviewer', render: v => v || '-' },
    { title: '审核意见', dataIndex: 'review_comment', key: 'review_comment', render: v => v || '-' },
    { title: '状态', dataIndex: 'status', key: 'status',
      render: (status) => <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at',
      render: (val) => moment(val).format('YYYY-MM-DD')
    },
    { title: '操作', key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<FileTextOutlined />} size="small" onClick={() => loadSupplements(record.id)}>补资料</Button>
          {record.status === 'pending' && (
            <>
              <Popconfirm title="确认审核通过?" onConfirm={() => handleStatusChange(record.id, 'approved')}>
                <Button size="small" type="primary" icon={<CheckOutlined />}>通过</Button>
              </Popconfirm>
              <Popconfirm title="确认审核拒绝?" onConfirm={() => handleStatusChange(record.id, 'rejected')}>
                <Button size="small" danger icon={<CloseOutlined />}>拒绝</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>票据审核</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          form.resetFields();
          setVisible(true);
        }}>上传票据</Button>
      </div>
      <Table columns={columns} dataSource={invoices} rowKey="id" />

      <Modal
        title="上传票据"
        visible={visible}
        onCancel={() => setVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="activity_id" label="所属活动" rules={[{ required: true }]}>
            <select style={{ width: '100%', height: 32, padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 4 }}>
              <option value="">请选择活动</option>
              {activities.filter(a => a.status === 'approved').map(a => (
                <option key={a.id} value={a.id}>{a.activity_name}</option>
              ))}
            </select>
          </Form.Item>
          <Form.Item name="invoice_number" label="票据编号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="invoice_amount" label="票据金额" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="invoice_date" label="开票日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="vendor_name" label="供应商名称">
            <Input />
          </Form.Item>
          <Form.Item name="invoice_url" label="票据图片/附件链接">
            <Input placeholder="请输入文件链接" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>提交</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="补资料管理"
        visible={supplementVisible}
        onCancel={() => setSupplementVisible(false)}
        width={700}
        footer={[
          <Button onClick={() => setSupplementVisible(false)}>关闭</Button>
        ]}
      >
        {selectedInvoice && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="票据编号">{selectedInvoice.invoice_number}</Descriptions.Item>
              <Descriptions.Item label="票据金额">¥{selectedInvoice.invoice_amount}</Descriptions.Item>
              <Descriptions.Item label="供应商">{selectedInvoice.vendor_name}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={getStatusColor(selectedInvoice.status)}>{getStatusLabel(selectedInvoice.status)}</Tag></Descriptions.Item>
            </Descriptions>
            
            <Button type="primary" onClick={() => supplementForm.setFieldsValue({ request_type: 'missing_invoice' })} style={{ marginBottom: 16 }}>
              发起补资料请求
            </Button>

            {supplementForm.getFieldsValue().request_type && (
              <Form form={supplementForm} layout="vertical" onFinish={handleAddSupplement} style={{ padding: 16, background: '#f5f5f5', borderRadius: 4, marginBottom: 16 }}>
                <Form.Item name="request_type" label="补资料类型" rules={[{ required: true }]}>
                  <select style={{ width: '100%', height: 32, padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 4 }}>
                    <option value="missing_invoice">缺少发票</option>
                    <option value="missing_receipt">缺少小票</option>
                    <option value="incomplete_info">信息不全</option>
                    <option value="other">其他问题</option>
                  </select>
                </Form.Item>
                <Form.Item name="description" label="补资料说明" rules={[{ required: true }]}>
                  <Input.TextArea rows={3} placeholder="请详细说明需要补充的资料" />
                </Form.Item>
                <Button type="primary" htmlType="submit">提交补资料请求</Button>
              </Form>
            )}

            <h4>补资料请求历史</h4>
            <List
              dataSource={supplements}
              renderItem={item => (
                <List.Item key={item.id}>
                  <List.Item.Meta
                    title={<Tag color={item.status === 'pending' ? 'orange' : 'green'}>{item.status === 'pending' ? '待补充' : '已补充'}</Tag>}
                    description={
                      <div>
                        <div><strong>类型:</strong> {item.request_type} | <strong>请求人:</strong> {item.requested_by}</div>
                        <div><strong>说明:</strong> {item.description}</div>
                        {item.response && (
                          <div style={{ marginTop: 8, padding: 8, background: '#e6f7ff', borderRadius: 4 }}>
                            <strong>回复 ({item.responded_by}):</strong> {item.response}
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Invoices;
