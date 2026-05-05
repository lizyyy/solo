import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Tag,
  Upload,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { interfacesAPI } from '../services/api';

const { TextArea } = Input;
const { Option } = Select;

function Interfaces() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [pagination.current, pagination.pageSize]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await interfacesAPI.getList({
        page: pagination.current,
        pageSize: pagination.pageSize,
      });
      setData(res.data.data);
      setPagination(prev => ({ ...prev, total: res.data.total }));
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await interfacesAPI.delete(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingItem) {
        await interfacesAPI.update(editingItem.id, values);
        message.success('更新成功');
      } else {
        await interfacesAPI.create(values);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      loadData();
    } catch (error) {
      if (error.errorFields) {
        return;
      }
      message.error('保存失败');
    }
  };

  const handleBatchImport = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        if (!Array.isArray(jsonData)) {
          throw new Error('数据格式必须是数组');
        }
        
        const res = await interfacesAPI.batchImport(jsonData);
        message.success(res.data.message);
        loadData();
      } catch (error) {
        message.error('导入失败: ' + (error.message || error.response?.data?.error));
      }
    };
    reader.readAsText(file);
    return false;
  };

  const methodColors = {
    GET: 'green',
    POST: 'blue',
    PUT: 'orange',
    DELETE: 'red',
    PATCH: 'purple',
  };

  const columns = [
    {
      title: '接口名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (val) => <Tag color={methodColors[val] || 'default'}>{val}</Tag>,
      filters: [
        { text: 'GET', value: 'GET' },
        { text: 'POST', value: 'POST' },
        { text: 'PUT', value: 'PUT' },
        { text: 'DELETE', value: 'DELETE' },
      ],
      onFilter: (value, record) => record.method === value,
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      ellipsis: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags) => (
        <Space size={[0, 4]} wrap>
          {tags?.split(',').map((tag, idx) => (
            <Tag key={idx} size="small">{tag.trim()}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个接口吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 16, fontWeight: 500 }}>接口清单管理</span>
        <Space>
          <Upload
            accept=".json"
            beforeUpload={handleBatchImport}
            showUploadList={false}
          >
            <Button icon={<UploadOutlined />}>
              批量导入 (JSON)
            </Button>
          </Upload>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加接口
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize })),
        }}
      />

      <Modal
        title={editingItem ? '编辑接口' : '添加接口'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="接口名称"
            rules={[{ required: true, message: '请输入接口名称' }]}
          >
            <Input placeholder="例如：用户登录接口" />
          </Form.Item>
          <Form.Item
            name="method"
            label="HTTP方法"
            rules={[{ required: true, message: '请选择HTTP方法' }]}
          >
            <Select placeholder="请选择">
              <Option value="GET">GET</Option>
              <Option value="POST">POST</Option>
              <Option value="PUT">PUT</Option>
              <Option value="DELETE">DELETE</Option>
              <Option value="PATCH">PATCH</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="path"
            label="接口路径"
            rules={[{ required: true, message: '请输入接口路径' }]}
          >
            <Input placeholder="例如：/api/users/login" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="接口功能描述" />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Input placeholder="多个标签用逗号分隔，例如：用户,认证,登录" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Interfaces;
