import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Input, 
  Select, 
  Space, 
  Tag, 
  Modal, 
  Form, 
  InputNumber,
  message,
  Popconfirm,
  Progress,
  Card
} from 'antd';
import { PlusOutlined, SearchOutlined, DownloadOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { customerApi, reportApi } from '../utils/api';

const { Option } = Select;

function Customers() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [filters, setFilters] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await customerApi.getAll(filters);
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (error) {
      message.error('获取客户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'high': return 'red';
      case 'medium': return 'orange';
      default: return 'green';
    }
  };

  const getProgressColor = (ratio) => {
    if (ratio >= 90) return 'progress-high';
    if (ratio >= 70) return 'progress-medium';
    return 'progress-low';
  };

  const columns = [
    {
      title: '客户编码',
      dataIndex: 'code',
      key: 'code',
      width: 120
    },
    {
      title: '客户名称',
      dataIndex: 'name',
      key: 'name',
      width: 180
    },
    {
      title: '行业',
      dataIndex: 'industry',
      key: 'industry',
      width: 100
    },
    {
      title: '联系人',
      dataIndex: 'contact_person',
      key: 'contact_person',
      width: 100
    },
    {
      title: '联系电话',
      dataIndex: 'contact_phone',
      key: 'contact_phone',
      width: 130
    },
    {
      title: '总额度',
      dataIndex: 'total_credit_limit',
      key: 'total_credit_limit',
      width: 120,
      render: (val) => `¥${val.toLocaleString()}`
    },
    {
      title: '可用额度',
      dataIndex: 'available_credit',
      key: 'available_credit',
      width: 120,
      render: (val) => <span style={{ color: val < 0 ? '#ff4d4f' : '#52c41a' }}>¥{val.toLocaleString()}</span>
    },
    {
      title: '使用率',
      dataIndex: 'usage_ratio',
      key: 'usage_ratio',
      width: 150,
      render: (ratio) => (
        <div className={getProgressColor(ratio)}>
          <Progress percent={Number(ratio.toFixed(1))} size="small" />
        </div>
      )
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      key: 'risk_level',
      width: 100,
      render: (level) => (
        <Tag color={getRiskColor(level)}>
          {level === 'high' ? '高风险' : level === 'medium' ? '中风险' : '低风险'}
        </Tag>
      )
    },
    {
      title: '信用状态',
      dataIndex: 'credit_status',
      key: 'credit_status',
      width: 100,
      render: (status) => (
        <Tag color={status === 'normal' ? 'green' : 'red'}>
          {status === 'normal' ? '正常' : '超限'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/customers/${record.id}`)}>
            详情
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除该客户吗？"
            description="删除后无法恢复"
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

  const handleEdit = (record) => {
    setEditingCustomer(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      const res = await customerApi.delete(id);
      if (res.data.success) {
        message.success('删除成功');
        fetchData();
      } else {
        message.error(res.data.message);
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingCustomer) {
        const res = await customerApi.update(editingCustomer.id, values);
        if (res.data.success) {
          message.success('更新成功');
          setModalVisible(false);
          setEditingCustomer(null);
          form.resetFields();
          fetchData();
        } else {
          message.error(res.data.message);
        }
      } else {
        const res = await customerApi.create(values);
        if (res.data.success) {
          message.success('创建成功');
          setModalVisible(false);
          form.resetFields();
          fetchData();
        } else {
          message.error(res.data.message);
        }
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleExport = () => {
    window.location.href = reportApi.exportCustomers();
  };

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            <Input
              placeholder="搜索客户名称或编码"
              prefix={<SearchOutlined />}
              style={{ width: 250 }}
              allowClear
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            />
            <Select
              placeholder="选择风险等级"
              style={{ width: 150 }}
              allowClear
              onChange={(value) => setFilters({ ...filters, risk_level: value })}
            >
              <Option value="low">低风险</Option>
              <Option value="medium">中风险</Option>
              <Option value="high">高风险</Option>
            </Select>
            <Select
              placeholder="选择信用状态"
              style={{ width: 150 }}
              allowClear
              onChange={(value) => setFilters({ ...filters, credit_status: value })}
            >
              <Option value="normal">正常</Option>
              <Option value="overdrawn">超限</Option>
            </Select>
          </Space>
          <Space style={{ float: 'right' }}>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              setEditingCustomer(null);
              form.resetFields();
              setModalVisible(true);
            }}>
              新增客户
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1500 }}
        />
      </Card>

      <Modal
        title={editingCustomer ? '编辑客户' : '新增客户'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingCustomer(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item name="code" label="客户编码" rules={[{ required: true, message: '请输入客户编码' }]}>
            <Input placeholder="请输入客户编码" />
          </Form.Item>
          <Form.Item name="name" label="客户名称" rules={[{ required: true, message: '请输入客户名称' }]}>
            <Input placeholder="请输入客户名称" />
          </Form.Item>
          <Form.Item name="industry" label="行业">
            <Input placeholder="请输入行业" />
          </Form.Item>
          <Form.Item name="contact_person" label="联系人">
            <Input placeholder="请输入联系人" />
          </Form.Item>
          <Form.Item name="contact_phone" label="联系电话">
            <Input placeholder="请输入联系电话" />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input.TextArea placeholder="请输入地址" rows={2} />
          </Form.Item>
          <Form.Item name="total_credit_limit" label="初始授信额度" rules={[{ required: true, message: '请输入初始授信额度' }]}>
            <InputNumber 
              style={{ width: '100%' }} 
              placeholder="请输入初始授信额度"
              min={0}
              formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value.replace(/\¥\s?|(,*)/g, '')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Customers;
