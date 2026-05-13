import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Select, Space, Modal, Form, message, Popover, Tag } from 'antd';
import { PlusOutlined, EditOutlined, SearchOutlined, HistoryOutlined } from '@ant-design/icons';
import { packagesAPI } from '../services/api';
import { InstrumentPackage, ModificationHistory } from '../types';

const { Option } = Select;

const Packages: React.FC = () => {
  const [packages, setPackages] = useState<InstrumentPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<InstrumentPackage | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [historyData, setHistoryData] = useState<ModificationHistory[]>([]);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadPackages();
  }, [searchText, statusFilter]);

  const loadPackages = async () => {
    setLoading(true);
    try {
      const res = await packagesAPI.getAll({ keyword: searchText || undefined, status: statusFilter });
      setPackages(res.data.data);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingPackage(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (record: InstrumentPackage) => {
    setEditingPackage(record);
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  const handleShowHistory = async (id: number) => {
    try {
      const res = await packagesAPI.getHistory(id);
      setHistoryData(res.data.data);
      setHistoryVisible(true);
    } catch (error) {
      message.error('加载历史记录失败');
    }
  };

  const handleSave = async (values: any) => {
    try {
      if (editingPackage) {
        await packagesAPI.update(editingPackage.id, { ...values, modified_by: '管理员' });
        message.success('更新成功');
      } else {
        await packagesAPI.create(values);
        message.success('创建成功');
      }
      setIsModalOpen(false);
      loadPackages();
    } catch (error) {
      message.error('保存失败');
    }
  };

  const columns = [
    { title: '器械包编号', dataIndex: 'package_no', key: 'package_no' },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '启用' : '停用'}
        </Tag>
      ),
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: InstrumentPackage) => (
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

  const historyContent = (
    <div style={{ maxWidth: 400, maxHeight: 300, overflow: 'auto' }}>
      {historyData.length === 0 ? (
        <div>暂无修改记录</div>
      ) : (
        historyData.map((item, index) => (
          <div key={index} className="modification-item">
            <div className="modification-label">
              {item.field_name} - {item.modified_by} - {item.modified_at}
            </div>
            <div className="modification-values">
              <span className="old-value">{item.old_value || '空'}</span>
              <span>→</span>
              <span className="new-value">{item.new_value || '空'}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Input
            placeholder="搜索名称或编号"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
          />
          <Select
            placeholder="状态筛选"
            value={statusFilter}
            onChange={setStatusFilter}
            allowClear
            style={{ width: 120 }}
          >
            <Option value="active">启用</Option>
            <Option value="inactive">停用</Option>
          </Select>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加器械包
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={packages}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingPackage ? '编辑器械包' : '添加器械包'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="package_no" label="器械包编号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select>
              <Option value="手术器械包">手术器械包</Option>
              <Option value="换药包">换药包</Option>
              <Option value="缝合包">缝合包</Option>
              <Option value="骨科器械包">骨科器械包</Option>
              <Option value="眼科器械包">眼科器械包</Option>
            </Select>
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

      <Popover
        title="修改历史"
        content={historyContent}
        open={historyVisible}
        onOpenChange={setHistoryVisible}
        trigger="click"
      >
        <div style={{ display: 'none' }} />
      </Popover>
    </div>
  );
};

export default Packages;
