import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Modal, Form, Input, message, Space, Select } from 'antd';
import { CheckOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';
import api from '../services/api';

function PendingList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/pending');
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

  const handleProcess = async (id, status) => {
    try {
      await api.put(`/pending/${id}/process`, {
        status,
        processed_by: '当前用户'
      });
      message.success(status === 'processed' ? '已处理' : '已取消');
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      await api.post('/pending', {
        ...values,
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
    {
      title: '请求类型',
      dataIndex: 'request_type',
      key: 'request_type',
      render: (type) => {
        const text = { renewal: '续租', checkout: '退租', deposit_adjust: '押金调整' };
        return <Tag color="blue">{text[type] || type}</Tag>;
      }
    },
    {
      title: '请求数据',
      dataIndex: 'request_data',
      key: 'request_data',
      render: (data) => {
        try {
          const obj = JSON.parse(data);
          return <span style={{ fontSize: 12, color: '#666' }}>{obj.note || JSON.stringify(obj)}</span>;
        } catch {
          return data;
        }
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        let color = 'orange';
        let text = '待处理';
        if (status === 'processed') {
          color = 'green';
          text = '已处理';
        } else if (status === 'cancelled') {
          color = 'red';
          text = '已取消';
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
            onClick={() => handleProcess(record.id, 'processed')}
          >
            处理
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseOutlined />}
            onClick={() => handleProcess(record.id, 'cancelled')}
          >
            取消
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          新建待确认合同
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
        title="新建待确认合同"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="contract_id" label="合同ID" rules={[{ required: true }]}>
            <Input placeholder="请输入合同ID" />
          </Form.Item>
          <Form.Item name="request_type" label="请求类型" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="renewal">续租</Select.Option>
              <Select.Option value="checkout">退租</Select.Option>
              <Select.Option value="deposit_adjust">押金调整</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="request_data" label="请求数据">
            <Input.TextArea rows={3} placeholder='{"note": "备注信息"}' />
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

export default PendingList;
