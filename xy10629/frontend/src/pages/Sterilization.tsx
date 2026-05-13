import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Select, Space, Modal, Form, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined, SearchOutlined } from '@ant-design/icons';
import { sterilizationAPI } from '../services/api';
import { SterilizationBatch } from '../types';

const { Option } = Select;

const Sterilization: React.FC = () => {
  const [records, setRecords] = useState<SterilizationBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SterilizationBatch | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await sterilizationAPI.getAll();
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

  const handleEdit = (record: SterilizationBatch) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  const handleSave = async (values: any) => {
    try {
      if (editingRecord) {
        await sterilizationAPI.update(editingRecord.id, values);
        message.success('更新成功');
      } else {
        await sterilizationAPI.create(values);
        message.success('创建成功');
      }
      setIsModalOpen(false);
      loadRecords();
    } catch (error) {
      message.error('保存失败');
    }
  };

  const columns = [
    { title: '批次编号', dataIndex: 'batch_no', key: 'batch_no' },
    { title: '灭菌员', dataIndex: 'sterilizer', key: 'sterilizer' },
    { title: '灭菌方式', dataIndex: 'sterilization_method', key: 'sterilization_method' },
    { title: '开始时间', dataIndex: 'start_time', key: 'start_time' },
    { title: '结束时间', dataIndex: 'end_time', key: 'end_time' },
    { title: '温度(℃)', dataIndex: 'temperature', key: 'temperature' },
    { title: '压力(kPa)', dataIndex: 'pressure', key: 'pressure' },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      render: (result: string) => {
        const colorMap: Record<string, string> = {
          passed: 'green',
          failed: 'red',
          pending: 'orange',
        };
        const textMap: Record<string, string> = {
          passed: '通过',
          failed: '失败',
          pending: '待处理',
        };
        return <Tag color={colorMap[result] || 'default'}>{textMap[result] || result}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: SterilizationBatch) => (
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
          <Input
            placeholder="搜索"
            value={''}
            onChange={() => {}}
            style={{ width: 200 }}
          />
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加灭菌批次
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
        title={editingRecord ? '编辑灭菌批次' : '添加灭菌批次'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="batch_no" label="批次编号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sterilizer" label="灭菌员" rules={[{ required: true }]}>
            <Select>
              <Option value="张三">张三</Option>
              <Option value="李四">李四</Option>
              <Option value="王五">王五</Option>
              <Option value="赵六">赵六</Option>
              <Option value="钱七">钱七</Option>
            </Select>
          </Form.Item>
          <Form.Item name="sterilization_method" label="灭菌方式" rules={[{ required: true }]}>
            <Select>
              <Option value="高压蒸汽灭菌">高压蒸汽灭菌</Option>
              <Option value="环氧乙烷灭菌">环氧乙烷灭菌</Option>
              <Option value="过氧化氢等离子体灭菌">过氧化氢等离子体灭菌</Option>
            </Select>
          </Form.Item>
          <Form.Item name="start_time" label="开始时间" rules={[{ required: true }]}>
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item name="end_time" label="结束时间">
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item name="temperature" label="温度(℃)">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="pressure" label="压力(kPa)">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="duration" label="持续时间(分钟)">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="result" label="结果">
            <Select>
              <Option value="pending">待处理</Option>
              <Option value="passed">通过</Option>
              <Option value="failed">失败</Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} />
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

export default Sterilization;
