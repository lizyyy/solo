import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Table, 
  Button, 
  Input, 
  Space, 
  Tag, 
  Modal, 
  Form, 
  Select, 
  message, 
  Typography,
  Popconfirm
} from 'antd';
import { 
  PlusOutlined, 
  SearchOutlined, 
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

const Projects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [projectModalVisible, setProjectModalVisible] = useState(false);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [projectForm] = Form.useForm();
  const [customerForm] = Form.useForm();
  const [searchText, setSearchText] = useState('');

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/projects', { params: { keyword: searchText } }),
      api.get('/customers')
    ])
      .then(([projectsRes, customersRes]) => {
        setProjects(projectsRes.data);
        setCustomers(customersRes.data);
      })
      .catch(error => {
        message.error('加载数据失败');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [searchText]);

  const handleCreateCustomer = (values) => {
    api.post('/customers', values)
      .then(() => {
        message.success('客户创建成功');
        setCustomerModalVisible(false);
        customerForm.resetFields();
        loadData();
      })
      .catch(error => {
        message.error(error.response?.data?.error || '创建失败');
      });
  };

  const handleCreateProject = (values) => {
    const apiCall = editingProject
      ? api.put(`/projects/${editingProject.id}`, values)
      : api.post('/projects', values);
    
    apiCall
      .then(() => {
        message.success(editingProject ? '项目更新成功' : '项目创建成功');
        setProjectModalVisible(false);
        setEditingProject(null);
        projectForm.resetFields();
        loadData();
      })
      .catch(error => {
        message.error(error.response?.data?.error || '操作失败');
      });
  };

  const handleDeleteProject = (id) => {
    api.delete(`/projects/${id}`)
      .then(() => {
        message.success('项目删除成功');
        loadData();
      })
      .catch(error => {
        message.error(error.response?.data?.error || '删除失败');
      });
  };

  const getStatusTag = (project) => {
    const hasConfirmed = project.confirmed_count > 0;
    if (hasConfirmed) {
      return <Tag color="green" icon={<CheckCircleOutlined />}>有有效版本</Tag>;
    }
    return <Tag color="orange">无有效版本</Tag>;
  };

  const columns = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <a onClick={() => navigate(`/projects/${record.id}`)}>
            {text}
          </a>
          {record.confirmed_count > 0 && (
            <Tag color="green" icon={<CheckCircleOutlined />} style={{ fontWeight: 'bold' }}>
              有效
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
      key: 'customer_name'
    },
    {
      title: '版本数',
      dataIndex: 'version_count',
      key: 'version_count',
      width: 100,
      render: (count, record) => (
        <span>
          {count} 个
          {record.confirmed_count > 0 && (
            <span style={{ color: '#52c41a', marginLeft: 8 }}>
              ({record.confirmed_count} 已确认)
            </span>
          )}
        </span>
      )
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_, record) => getStatusTag(record)
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            icon={<EyeOutlined />}
            onClick={() => navigate(`/projects/${record.id}`)}
          >
            查看
          </Button>
          <Button 
            type="link" 
            icon={<EditOutlined />}
            onClick={() => {
              setEditingProject(record);
              projectForm.setFieldsValue(record);
              setProjectModalVisible(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个项目吗？"
            onConfirm={() => handleDeleteProject(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" icon={<DeleteOutlined />} danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>项目管理</Title>
        <Space>
          <Button onClick={() => setCustomerModalVisible(true)}>
            <PlusOutlined /> 新建客户
          </Button>
          <Button type="primary" onClick={() => {
            setEditingProject(null);
            projectForm.resetFields();
            setProjectModalVisible(true);
          }}>
            <PlusOutlined /> 新建项目
          </Button>
        </Space>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索项目名称或客户名称"
          allowClear
          enterButton={<SearchOutlined />}
          onSearch={setSearchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 400 }}
        />
      </div>

      <Table
        columns={columns}
        dataSource={projects}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="新建客户"
        open={customerModalVisible}
        onCancel={() => setCustomerModalVisible(false)}
        onOk={() => customerForm.submit()}
      >
        <Form form={customerForm} layout="vertical" onFinish={handleCreateCustomer}>
          <Form.Item
            name="name"
            label="客户名称"
            rules={[{ required: true, message: '请输入客户名称' }]}
          >
            <Input placeholder="请输入客户名称" />
          </Form.Item>
          <Form.Item name="contact_person" label="联系人">
            <Input placeholder="请输入联系人" />
          </Form.Item>
          <Form.Item name="contact_phone" label="联系电话">
            <Input placeholder="请输入联系电话" />
          </Form.Item>
          <Form.Item name="contact_email" label="联系邮箱">
            <Input placeholder="请输入联系邮箱" />
          </Form.Item>
          <Form.Item name="industry" label="行业">
            <Input placeholder="请输入行业" />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input.TextArea placeholder="请输入地址" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingProject ? '编辑项目' : '新建项目'}
        open={projectModalVisible}
        onCancel={() => {
          setProjectModalVisible(false);
          setEditingProject(null);
        }}
        onOk={() => projectForm.submit()}
      >
        <Form form={projectForm} layout="vertical" onFinish={handleCreateProject}>
          <Form.Item
            name="customer_id"
            label="客户"
            rules={[{ required: true, message: '请选择客户' }]}
          >
            <Select placeholder="请选择客户" showSearch optionFilterProp="children">
              {customers.map(customer => (
                <Option key={customer.id} value={customer.id}>
                  {customer.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="请输入项目名称" />
          </Form.Item>
          <Form.Item name="description" label="项目描述">
            <Input.TextArea placeholder="请输入项目描述" rows={4} />
          </Form.Item>
          {editingProject && (
            <Form.Item name="status" label="状态" initialValue="active">
              <Select>
                <Option value="active">进行中</Option>
                <Option value="completed">已完成</Option>
                <Option value="suspended">已暂停</Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default Projects;
