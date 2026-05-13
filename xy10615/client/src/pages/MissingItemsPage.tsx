import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Space,
  message,
  Typography,
  Tag
} from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { MissingItemCategoryTag } from '../components/StatusTag';
import { missingItemApi } from '../api';
import { MissingItem } from '../types';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const MissingItemsPage: React.FC = () => {
  const [items, setItems] = useState<MissingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MissingItem | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const response = await missingItemApi.getAll();
      if (response.data.success) {
        setItems(response.data.data || []);
      }
    } catch (error) {
      message.error('加载缺项清单失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (item: MissingItem) => {
    setEditingItem(item);
    form.setFieldsValue({
      category: item.category,
      name: item.name,
      description: item.description,
      responsiblePerson: item.responsiblePerson,
      dueDate: dayjs(item.dueDate),
      status: item.status
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const data = {
        ...values,
        dueDate: values.dueDate?.toISOString(),
        operator: '当前用户',
        operatorId: 'current-user',
        requestId: dayjs().valueOf().toString()
      };

      if (editingItem) {
        message.success('更新成功');
      } else {
        message.success('创建成功');
      }
      setIsModalOpen(false);
      loadItems();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category: any) => <MissingItemCategoryTag category={category} />
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '负责人',
      dataIndex: 'responsiblePerson',
      key: 'responsiblePerson',
      width: 120
    },
    {
      title: '截止日期',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD')
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: any) => {
        const statusConfig: Record<string, { color: string; text: string }> = {
          OPEN: { color: 'error', text: '待处理' },
          IN_PROGRESS: { color: 'processing', text: '处理中' },
          RESOLVED: { color: 'success', text: '已解决' },
          CLOSED: { color: 'default', text: '已关闭' }
        };
        const config = statusConfig[status] || statusConfig.OPEN;
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '解决时间',
      dataIndex: 'resolvedAt',
      key: 'resolvedAt',
      width: 180,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: '优先级',
      key: 'priority',
      width: 100,
      render: (_: any, record: MissingItem) => {
        const daysUntilDue = Math.ceil((new Date(record.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (record.status === 'RESOLVED' || record.status === 'CLOSED') return null;
        if (daysUntilDue <= 0) return <Tag color="error">紧急</Tag>;
        if (daysUntilDue <= 3) return <Tag color="orange">高</Tag>;
        if (daysUntilDue <= 7) return <Tag color="blue">中</Tag>;
        return <Tag color="default">低</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: MissingItem) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
          编辑
        </Button>
      )
    }
  ];

  const stats = {
    total: items.length,
    open: items.filter(i => i.status === 'OPEN').length,
    inProgress: items.filter(i => i.status === 'IN_PROGRESS').length,
    resolved: items.filter(i => i.status === 'RESOLVED').length,
    overdue: items.filter(i => {
      if (i.status === 'RESOLVED' || i.status === 'CLOSED') return false;
      return new Date(i.dueDate) < new Date();
    }).length
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>缺项清单</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新增缺项
        </Button>
      </Space>

      <Space style={{ marginBottom: 16 }}>
        <Tag color="default">总计: {stats.total}</Tag>
        <Tag color="error">待处理: {stats.open}</Tag>
        <Tag color="processing">处理中: {stats.inProgress}</Tag>
        <Tag color="success">已解决: {stats.resolved}</Tag>
        <Tag color="red">已逾期: {stats.overdue}</Tag>
      </Space>

      <Table
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1400 }}
      />

      <Modal
        title={editingItem ? '编辑缺项' : '新增缺项'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item label="类别" name="category" rules={[{ required: true }]}>
            <Select>
              <Option value="MOLD">模具</Option>
              <Option value="MATERIAL">物料</Option>
              <Option value="TOOL">工具</Option>
              <Option value="DOCUMENT">文档</Option>
              <Option value="OTHER">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item label="名称" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="描述" name="description" rules={[{ required: true }]}>
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item label="负责人" name="responsiblePerson" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="截止日期" name="dueDate" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Select>
              <Option value="OPEN">待处理</Option>
              <Option value="IN_PROGRESS">处理中</Option>
              <Option value="RESOLVED">已解决</Option>
              <Option value="CLOSED">已关闭</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MissingItemsPage;
