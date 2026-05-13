import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Select, Space, Modal, Form, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { isolationAPI } from '../services/api';
import { FailureIsolation } from '../types';

const { Option } = Select;

const Isolation: React.FC = () => {
  const [records, setRecords] = useState<FailureIsolation[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FailureIsolation | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await isolationAPI.getAll();
      setRecords(res.data.data);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (record: FailureIsolation) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  const handleSave = async (values: any) => {
    try {
      if (editingRecord) {
        await isolationAPI.update(editingRecord.id, values);
        message.success('更新成功');
      } else {
        await isolationAPI.create(values);
        message.success('创建成功');
      }
      setIsModalOpen(false);
      loadRecords();
    } catch (error) {
      message.error('保存失败');
    }
  };

  const columns = [
    { title: '隔离编号', dataIndex: 'isolation_no', key: 'isolation_no' },
    { title: '来源类型', dataIndex: 'source_type', key: 'source_type' },
    { title: '原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
    { title: '处理人', dataIndex: 'handler', key: 'handler' },
    { title: '隔离时间', dataIndex: 'isolation_time', key: 'isolation_time' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          isolated: 'orange',
          resolved: 'green',
        };
        const textMap: Record<string, string> = {
          isolated: '隔离中',
          resolved: '已处理',
        };
        return <Tag color={colorMap[status] || 'default'}>{textMap[status] || status}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: FailureIsolation) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
          编辑
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 120 }}
          >
            <Option value="isolated">隔离中</Option>
            <Option value="resolved">已处理</Option>
          </Select>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加隔离记录
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingRecord ? '编辑隔离记录' : '添加隔离记录'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="isolation_no" label="隔离编号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="source_type" label="来源类型" rules={[{ required: true }]}>
            <Select>
              <Option value="cleaning">清洗记录</Option>
              <Option value="sterilization">灭菌批次</Option>
              <Option value="package">器械包</Option>
            </Select>
          </Form.Item>
          <Form.Item name="source_id" label="来源ID" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="reason" label="原因" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="handler" label="处理人" rules={[{ required: true }]}>
            <Select>
              <Option value="张三">张三</Option>
              <Option value="李四">李四</Option>
              <Option value="王五">王五</Option>
              <Option value="赵六">赵六</Option>
              <Option value="钱七">钱七</Option>
            </Select>
          </Form.Item>
          <Form.Item name="isolation_time" label="隔离时间" rules={[{ required: true }]}>
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Option value="isolated">隔离中</Option>
              <Option value="resolved">已处理</Option>
            </Select>
          </Form.Item>
          <Form.Item name="corrective_action" label="纠正措施">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => setIsModalOpen(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Isolation;
