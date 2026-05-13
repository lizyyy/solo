import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Modal, Form, Input, InputNumber, DatePicker, message, Space } from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import moment from 'moment';
import api from '../services/api';

function LeaseList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/leases');
      setData(response.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (values) => {
    try {
      const formattedValues = {
        ...values,
        start_date: values.start_date.format('YYYY-MM-DD'),
        end_date: values.end_date.format('YYYY-MM-DD'),
        created_by: '当前用户'
      };

      if (editingItem) {
        await api.put(`/leases/${editingItem.id}`, formattedValues);
        message.success('更新成功');
      } else {
        await api.post('/leases', formattedValues);
        message.success('创建成功');
      }

      setModalVisible(false);
      setEditingItem(null);
      form.resetFields();
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    form.setFieldsValue({
      ...record,
      start_date: moment(record.start_date),
      end_date: moment(record.end_date)
    });
    setModalVisible(true);
  };

  const columns = [
    { title: '房间号', dataIndex: 'room_number', key: 'room_number' },
    { title: '租户姓名', dataIndex: 'tenant_name', key: 'tenant_name' },
    { title: '租户电话', dataIndex: 'tenant_phone', key: 'tenant_phone' },
    { title: '开始日期', dataIndex: 'start_date', key: 'start_date' },
    { title: '结束日期', dataIndex: 'end_date', key: 'end_date' },
    { title: '月租金', dataIndex: 'monthly_rent', key: 'monthly_rent' },
    { title: '押金金额', dataIndex: 'deposit_amount', key: 'deposit_amount' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '生效中' : '已结束'}
        </Tag>
      )
    },
    { title: '创建人', dataIndex: 'created_by', key: 'created_by' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
          编辑
        </Button>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setEditingItem(null);
          form.resetFields();
          setModalVisible(true);
        }}>
          新建合同
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />
      <Modal
        title={editingItem ? '编辑合同' : '新建合同'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingItem(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="room_number" label="房间号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="tenant_name" label="租户姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="tenant_phone" label="租户电话">
            <Input />
          </Form.Item>
          <Form.Item name="start_date" label="开始日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="end_date" label="结束日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="monthly_rent" label="月租金" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="deposit_amount" label="押金金额" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]} initialValue="active">
            <select style={{ width: '100%', height: 32, padding: '0 11px', border: '1px solid #d9d9d9', borderRadius: 6 }}>
              <option value="active">生效中</option>
              <option value="ended">已结束</option>
            </select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default LeaseList;
