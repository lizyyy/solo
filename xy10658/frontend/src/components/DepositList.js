import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Modal, Form, Input, InputNumber, message, Space, Select } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import api from '../services/api';

function DepositList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/deposits');
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
      await api.post('/deposits', {
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

  const getTransactionTypeText = (type) => {
    const types = {
      'deposit_increase': '押金增加',
      'deposit_decrease': '押金减少',
      'maintenance_deduction': '维修扣款',
      'refund': '押金退款'
    };
    return types[type] || type;
  };

  const columns = [
    { title: '房间号', dataIndex: 'room_number', key: 'room_number' },
    { title: '租户姓名', dataIndex: 'tenant_name', key: 'tenant_name' },
    {
      title: '交易类型',
      dataIndex: 'transaction_type',
      key: 'transaction_type',
      render: (type) => {
        let color = 'blue';
        if (type.includes('deduction') || type.includes('decrease') || type === 'refund') {
          color = 'red';
        } else if (type.includes('increase')) {
          color = 'green';
        }
        return <Tag color={color}>{getTransactionTypeText(type)}</Tag>;
      }
    },
    { title: '金额', dataIndex: 'amount', key: 'amount' },
    { title: '余额', dataIndex: 'balance', key: 'balance' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '创建人', dataIndex: 'created_by', key: 'created_by' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          新建押金记录
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
        title="新建押金记录"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="contract_id" label="合同ID" rules={[{ required: true }]}>
            <Input placeholder="请输入合同ID" />
          </Form.Item>
          <Form.Item name="transaction_type" label="交易类型" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="deposit_increase">押金增加</Select.Option>
              <Select.Option value="deposit_decrease">押金减少</Select.Option>
              <Select.Option value="maintenance_deduction">维修扣款</Select.Option>
              <Select.Option value="refund">押金退款</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="amount" label="金额" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
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

export default DepositList;
