import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Popconfirm,
  message,
  Spin,
  Tag
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { contractsAPI } from '../services/api';

const Contracts = () => {
  const [loading, setLoading] = useState(false);
  const [contracts, setContracts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [form] = Form.useForm();

  const loadContracts = async () => {
    try {
      setLoading(true);
      const response = await contractsAPI.getAll();
      setContracts(response.data.map(c => ({ ...c, key: c.id })));
    } catch (error) {
      message.error('加载合同列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContracts();
  }, []);

  const handleAdd = () => {
    setEditingContract(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingContract(record);
    form.setFieldsValue({
      ...record,
      start_date: record.start_date ? dayjs(record.start_date) : null,
      end_date: record.end_date ? dayjs(record.end_date) : null
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await contractsAPI.delete(id);
      message.success('删除成功');
      loadContracts();
    } catch (error) {
      message.error(error.response?.data?.error || '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const data = {
        ...values,
        start_date: values.start_date?.format('YYYY-MM-DD'),
        end_date: values.end_date?.format('YYYY-MM-DD')
      };

      if (editingContract) {
        await contractsAPI.update(editingContract.id, data);
        message.success('更新成功');
      } else {
        await contractsAPI.create(data);
        message.success('创建成功');
      }

      setModalVisible(false);
      loadContracts();
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.response?.data?.error || '保存失败');
    }
  };

  const columns = [
    {
      title: '合同名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      key: 'customer_name'
    },
    {
      title: '合同编号',
      dataIndex: 'contract_number',
      key: 'contract_number'
    },
    {
      title: '生效日期',
      dataIndex: 'start_date',
      key: 'start_date'
    },
    {
      title: '截止日期',
      dataIndex: 'end_date',
      key: 'end_date'
    },
    {
      title: '响应SLA',
      dataIndex: 'response_sla_hours',
      key: 'response_sla_hours',
      render: (hours) => <Tag color="blue">{hours}小时</Tag>
    },
    {
      title: '修复SLA',
      dataIndex: 'repair_sla_hours',
      key: 'repair_sla_hours',
      render: (hours) => <Tag color="green">{hours}小时</Tag>
    },
    {
      title: '响应罚款',
      dataIndex: 'response_fine_rate',
      key: 'response_fine_rate',
      render: (rate) => `¥${rate}/小时`
    },
    {
      title: '修复罚款',
      dataIndex: 'repair_fine_rate',
      key: 'repair_fine_rate',
      render: (rate) => `¥${rate}/小时`
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个合同吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增合同
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={contracts}
        loading={loading}
        rowKey="id"
      />

      <Modal
        title={editingContract ? '编辑合同' : '新增合同'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="合同名称"
            rules={[{ required: true, message: '请输入合同名称' }]}
          >
            <Input placeholder="请输入合同名称" />
          </Form.Item>

          <Form.Item
            name="customer_name"
            label="客户名称"
            rules={[{ required: true, message: '请输入客户名称' }]}
          >
            <Input placeholder="请输入客户名称" />
          </Form.Item>

          <Form.Item
            name="contract_number"
            label="合同编号"
            rules={[{ required: true, message: '请输入合同编号' }]}
          >
            <Input placeholder="请输入合同编号" />
          </Form.Item>

          <Space style={{ width: '100%', marginBottom: 24 }}>
            <Form.Item
              name="start_date"
              label="生效日期"
              rules={[{ required: true, message: '请选择生效日期' }]}
              style={{ marginBottom: 0, flex: 1 }}
            >
              <DatePicker style={{ width: '100%' }} placeholder="选择生效日期" />
            </Form.Item>

            <Form.Item
              name="end_date"
              label="截止日期"
              rules={[{ required: true, message: '请选择截止日期' }]}
              style={{ marginBottom: 0, flex: 1 }}
            >
              <DatePicker style={{ width: '100%' }} placeholder="选择截止日期" />
            </Form.Item>
          </Space>

          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 24, marginBottom: 16 }}>
            <h4>SLA配置</h4>
          </div>

          <Space style={{ width: '100%' }}>
            <Form.Item
              name="response_sla_hours"
              label="响应SLA（小时）"
              rules={[{ required: true, message: '请输入响应SLA' }]}
              style={{ marginBottom: 0, flex: 1 }}
            >
              <InputNumber min={1} style={{ width: '100%' }} placeholder="响应SLA小时数" />
            </Form.Item>

            <Form.Item
              name="repair_sla_hours"
              label="修复SLA（小时）"
              rules={[{ required: true, message: '请输入修复SLA' }]}
              style={{ marginBottom: 0, flex: 1 }}
            >
              <InputNumber min={1} style={{ width: '100%' }} placeholder="修复SLA小时数" />
            </Form.Item>
          </Space>

          <Space style={{ width: '100%', marginTop: 16 }}>
            <Form.Item
              name="response_fine_rate"
              label="响应超时罚款（元/小时）"
              rules={[{ required: true, message: '请输入响应罚款费率' }]}
              style={{ marginBottom: 0, flex: 1 }}
            >
              <InputNumber min={0} style={{ width: '100%' }} placeholder="元/小时" />
            </Form.Item>

            <Form.Item
              name="repair_fine_rate"
              label="修复超时罚款（元/小时）"
              rules={[{ required: true, message: '请输入修复罚款费率' }]}
              style={{ marginBottom: 0, flex: 1 }}
            >
              <InputNumber min={0} style={{ width: '100%' }} placeholder="元/小时" />
            </Form.Item>
          </Space>

          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 24, marginBottom: 16, marginTop: 24 }}>
            <h4>罚款上限（可选）</h4>
          </div>

          <Space style={{ width: '100%' }}>
            <Form.Item
              name="max_response_fine"
              label="单次响应最高罚款（元）"
              style={{ marginBottom: 0, flex: 1 }}
            >
              <InputNumber min={0} style={{ width: '100%' }} placeholder="留空表示不限制" />
            </Form.Item>

            <Form.Item
              name="max_repair_fine"
              label="单次修复最高罚款（元）"
              style={{ marginBottom: 0, flex: 1 }}
            >
              <InputNumber min={0} style={{ width: '100%' }} placeholder="留空表示不限制" />
            </Form.Item>

            <Form.Item
              name="max_total_fine"
              label="单次工单最高总罚款（元）"
              style={{ marginBottom: 0, flex: 1 }}
            >
              <InputNumber min={0} style={{ width: '100%' }} placeholder="留空表示不限制" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default Contracts;
