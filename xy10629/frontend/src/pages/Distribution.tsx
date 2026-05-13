import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Select, Space, Modal, Form, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { distributionAPI, packagesAPI } from '../services/api';
import { DepartmentDistribution, InstrumentPackage } from '../types';

const { Option } = Select;

const Distribution: React.FC = () => {
  const [records, setRecords] = useState<DepartmentDistribution[]>([]);
  const [packages, setPackages] = useState<InstrumentPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DepartmentDistribution | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadRecords();
    loadPackages();
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await distributionAPI.getAll();
      setRecords(res.data.data);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadPackages = async () => {
    try {
      const res = await packagesAPI.getAll();
      setPackages(res.data.data);
    } catch (error) {
      console.error('加载器械包失败');
    }
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (record: DepartmentDistribution) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  const handleSave = async (values: any) => {
    try {
      if (editingRecord) {
        await distributionAPI.update(editingRecord.id, values);
        message.success('更新成功');
      } else {
        await distributionAPI.create(values);
        message.success('创建成功');
      }
      setIsModalOpen(false);
      loadRecords();
    } catch (error) {
      message.error('保存失败');
    }
  };

  const columns = [
    { title: '发放编号', dataIndex: 'distribution_no', key: 'distribution_no' },
    { title: '器械包', dataIndex: 'package_name', key: 'package_name' },
    { title: '科室', dataIndex: 'department', key: 'department' },
    { title: '发放人', dataIndex: 'distributor', key: 'distributor' },
    { title: '发放时间', dataIndex: 'distribution_time', key: 'distribution_time' },
    { title: '接收人', dataIndex: 'receiver', key: 'receiver' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color="green">{status === 'distributed' ? '已发放' : status}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: DepartmentDistribution) => (
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
            placeholder="科室筛选"
            allowClear
            style={{ width: 120 }}
          >
            <Option value="外科">外科</Option>
            <Option value="内科">内科</Option>
            <Option value="妇产科">妇产科</Option>
            <Option value="骨科">骨科</Option>
            <Option value="眼科">眼科</Option>
          </Select>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加发放记录
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
        title={editingRecord ? '编辑发放记录' : '添加发放记录'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="distribution_no" label="发放编号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="package_id" label="器械包" rules={[{ required: true }]}>
            <Select>
              {packages.map((pkg) => (
                <Option key={pkg.id} value={pkg.id}>
                  {pkg.package_no} - {pkg.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="department" label="科室" rules={[{ required: true }]}>
            <Select>
              <Option value="外科">外科</Option>
              <Option value="内科">内科</Option>
              <Option value="妇产科">妇产科</Option>
              <Option value="骨科">骨科</Option>
              <Option value="眼科">眼科</Option>
            </Select>
          </Form.Item>
          <Form.Item name="distributor" label="发放人" rules={[{ required: true }]}>
            <Select>
              <Option value="张三">张三</Option>
              <Option value="李四">李四</Option>
              <Option value="王五">王五</Option>
              <Option value="赵六">赵六</Option>
              <Option value="钱七">钱七</Option>
            </Select>
          </Form.Item>
          <Form.Item name="distribution_time" label="发放时间" rules={[{ required: true }]}>
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item name="receiver" label="接收人">
            <Input />
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

export default Distribution;
