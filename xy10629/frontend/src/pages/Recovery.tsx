import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Select, Space, Modal, Form, message, Drawer, Tag } from 'antd';
import { PlusOutlined, EditOutlined, SearchOutlined, HistoryOutlined } from '@ant-design/icons';
import { recoveryAPI, packagesAPI } from '../services/api';
import { RecoveryRecord, InstrumentPackage, ModificationHistory } from '../types';
import dayjs from 'dayjs';

const { Option } = Select;

const Recovery: React.FC = () => {
  const [records, setRecords] = useState<RecoveryRecord[]>([]);
  const [packages, setPackages] = useState<InstrumentPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecoveryRecord | null>(null);
  const [searchText, setSearchText] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string | undefined>();
  const [historyData, setHistoryData] = useState<ModificationHistory[]>([]);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadRecords();
    loadPackages();
  }, [searchText, departmentFilter]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await recoveryAPI.getAll({ keyword: searchText || undefined, department: departmentFilter });
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
    form.setFieldsValue({ recovery_time: dayjs().format('YYYY-MM-DD HH:mm:ss') });
    setIsModalOpen(true);
  };

  const handleEdit = (record: RecoveryRecord) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  const handleShowHistory = async (id: number) => {
    try {
      const res = await recoveryAPI.getHistory(id);
      setHistoryData(res.data.data);
      setHistoryVisible(true);
    } catch (error) {
      message.error('加载历史记录失败');
    }
  };

  const handleSave = async (values: any) => {
    try {
      if (editingRecord) {
        await recoveryAPI.update(editingRecord.id, { ...values, modified_by: '管理员' });
        message.success('更新成功');
      } else {
        await recoveryAPI.create(values);
        message.success('创建成功');
      }
      setIsModalOpen(false);
      loadRecords();
    } catch (error) {
      message.error('保存失败');
    }
  };

  const columns = [
    { title: '回收编号', dataIndex: 'recovery_no', key: 'recovery_no' },
    { title: '器械包编号', dataIndex: 'package_no', key: 'package_no' },
    { title: '器械包名称', dataIndex: 'package_name', key: 'package_name' },
    { title: '科室', dataIndex: 'department', key: 'department' },
    { title: '回收时间', dataIndex: 'recovery_time', key: 'recovery_time' },
    { title: '接收人', dataIndex: 'receiver', key: 'receiver' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'completed' ? 'green' : 'orange'}>
          {status === 'completed' ? '已完成' : '待处理'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: RecoveryRecord) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" icon={<HistoryOutlined />} onClick={() => handleShowHistory(record.id)}>
            修改历史
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Input
            placeholder="搜索编号或名称"
            value={''}
            onChange={() => {}}
            style={{ width: 200 }}
          />
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
          添加回收记录
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
        title={editingRecord ? '编辑回收记录' : '添加回收记录'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="recovery_no" label="回收编号" rules={[{ required: true }]}>
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
          <Form.Item name="recovery_time" label="回收时间" rules={[{ required: true }]}>
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item name="receiver" label="接收人" rules={[{ required: true }]}>
            <Select>
              <Option value="张三">张三</Option>
              <Option value="李四">李四</Option>
              <Option value="王五">王五</Option>
              <Option value="赵六">赵六</Option>
              <Option value="钱七">钱七</Option>
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

      <Drawer
        title="修改历史"
        open={historyVisible}
        onClose={() => setHistoryVisible(false)}
        width={400}
      >
        {historyData.length === 0 ? (
          <div>暂无修改记录</div>
        ) : (
          historyData.map((item, index) => (
            <div key={index} className="modification-item" style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ color: '#666', fontSize: 13, marginBottom: 8 }}>
                {item.field_name} - {item.modified_by} - {item.modified_at}
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ color: '#ff4d4f', textDecoration: 'line-through' }}>
                  {item.old_value || '空'}
                </span>
                <span>→</span>
                <span style={{ color: '#52c41a', fontWeight: 500 }}>
                  {item.new_value || '空'}
                </span>
              </div>
            </div>
          ))
        )}
      </Drawer>
    </div>
  );
};

export default Recovery;
