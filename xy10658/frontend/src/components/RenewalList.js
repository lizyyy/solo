import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Modal, Form, InputNumber, DatePicker, message, Space } from 'antd';
import { CheckOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';
import moment from 'moment';
import api from '../services/api';

function RenewalList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/renewals');
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

  const handleReview = async (id, status) => {
    try {
      await api.put(`/renewals/${id}/review`, {
        status,
        reviewed_by: '当前用户'
      });
      message.success(status === 'approved' ? '已批准' : '已拒绝');
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      await api.post('/renewals', {
        ...values,
        new_end_date: values.new_end_date.format('YYYY-MM-DD'),
        created_by: '当前用户'
      });
      message.success('创建成功');
      setModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '房间号', dataIndex: 'room_number', key: 'room_number' },
    { title: '租户姓名', dataIndex: 'tenant_name', key: 'tenant_name' },
    { title: '原结束日期', dataIndex: 'original_end_date', key: 'original_end_date' },
    { title: '新结束日期', dataIndex: 'new_end_date', key: 'new_end_date' },
    { title: '新月租', dataIndex: 'new_monthly_rent', key: 'new_monthly_rent' },
    { title: '押金调整', dataIndex: 'deposit_adjustment', key: 'deposit_adjustment' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        let color = 'orange';
        let text = '待审核';
        if (status === 'approved') {
          color = 'green';
          text = '已批准';
        } else if (status === 'rejected') {
          color = 'red';
          text = '已拒绝';
        }
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => record.status === 'pending' && (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleReview(record.id, 'approved')}
          >
            通过
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseOutlined />}
            onClick={() => handleReview(record.id, 'rejected')}
          >
            拒绝
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          新建续租报价
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
        title="新建续租报价"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="contract_id" label="合同ID" rules={[{ required: true }]}>
            <input style={{ width: '100%', height: 32, padding: '0 11px', border: '1px solid #d9d9d9', borderRadius: 6 }} placeholder="请输入合同ID" />
          </Form.Item>
          <Form.Item name="new_end_date" label="新结束日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="new_monthly_rent" label="新月租" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="deposit_adjustment" label="押金调整" initialValue={0}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">提交</Button>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default RenewalList;
