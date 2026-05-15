import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Modal,
  Form,
  message,
  Popconfirm,
  Upload,
  Row,
  Col,
  Statistic,
  Card,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  UploadOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { bffEndpointApi, callHistoryApi } from '../services/api';
import dayjs from 'dayjs';

const { Option } = Select;

const statusColors = {
  draft: 'default',
  active: 'success',
  degraded: 'warning',
  disabled: 'error',
  error: 'error',
};

const statusLabels = {
  draft: '草稿',
  active: '启用',
  degraded: '降级',
  disabled: '禁用',
  error: '错误',
};

const EndpointList = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    name: '',
    status: '',
    page_module_id: '',
  });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form] = Form.useForm();
  const [statistics, setStatistics] = useState({
    total: 0,
    active: 0,
    error: 0,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        skip: (pagination.current - 1) * pagination.pageSize,
        limit: pagination.pageSize,
      };
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });
      const res = await bffEndpointApi.getAll(params);
      setData(res.data);

      const allRes = await bffEndpointApi.getAll({ limit: 1000 });
      setStatistics({
        total: allRes.data.length,
        active: allRes.data.filter(item => item.status === 'active').length,
        error: allRes.data.filter(item => item.status === 'error').length,
      });
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchData();
  }, [filters]);

  const handleSearch = (value) => {
    setFilters(prev => ({ ...prev, name: value }));
  };

  const handleStatusChange = (value) => {
    setFilters(prev => ({ ...prev, status: value }));
  };

  const handleAdd = () => {
    setEditItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditItem(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await bffEndpointApi.delete(id);
      message.success('删除成功');
      fetchData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editItem) {
        await bffEndpointApi.update(editItem.id, values);
        message.success('更新成功');
      } else {
        await bffEndpointApi.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleStatusTransition = async (record, newStatus) => {
    try {
      await bffEndpointApi.transitionStatus(record.id, { new_status: newStatus });
      message.success('状态更新成功');
      fetchData();
    } catch (error) {
      message.error('状态更新失败');
    }
  };

  const handleBatchImport = async (file) => {
    try {
      const res = await bffEndpointApi.batchImport(file);
      message.success(`导入成功: ${res.data.success_count} 条, 失败: ${res.data.failed_count} 条`);
      fetchData();
    } catch (error) {
      message.error('导入失败');
    }
    return false;
  };

  const handleExport = async () => {
    try {
      const res = await callHistoryApi.export({ format: 'xlsx' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'call_history.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      width: 200,
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      width: 100,
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (text) => (
        <Tag color={statusColors[text]}>{statusLabels[text]}</Tag>
      ),
    },
    {
      title: '缓存',
      dataIndex: 'cache_enabled',
      key: 'cache_enabled',
      width: 80,
      render: (text) => text ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/endpoints/${record.id}`)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {record.status === 'draft' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStatusTransition(record, 'active')}
            >
              启用
            </Button>
          )}
          {record.status === 'active' && (
            <Button
              type="link"
              size="small"
              danger
              onClick={() => handleStatusTransition(record, 'disabled')}
            >
              禁用
            </Button>
          )}
          <Popconfirm
            title="确认删除?"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
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
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title="总端点" value={statistics.total} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="已启用" value={statistics.active} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="异常" value={statistics.error} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>

      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建端点
          </Button>
          <Upload
            showUploadList={false}
            beforeUpload={handleBatchImport}
            accept=".json,.csv"
          >
            <Button icon={<UploadOutlined />}>批量导入</Button>
          </Upload>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出报告
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>
            刷新
          </Button>
        </Space>
        <Space style={{ float: 'right' }}>
          <Input.Search
            placeholder="搜索名称"
            allowClear
            enterButton={<SearchOutlined />}
            onSearch={handleSearch}
            style={{ width: 200 }}
          />
          <Select
            placeholder="筛选状态"
            allowClear
            style={{ width: 120 }}
            onChange={handleStatusChange}
          >
            <Option value="draft">草稿</Option>
            <Option value="active">启用</Option>
            <Option value="degraded">降级</Option>
            <Option value="disabled">禁用</Option>
          </Select>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        onChange={(page) => setPagination(page)}
      />

      <Modal
        title={editItem ? '编辑端点' : '新建端点'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="请输入端点名称" />
          </Form.Item>
          <Form.Item
            name="path"
            label="路径"
            rules={[{ required: true, message: '请输入路径' }]}
          >
            <Input placeholder="例如: /api/user/profile" />
          </Form.Item>
          <Form.Item name="method" label="方法" initialValue="GET">
            <Select>
              <Option value="GET">GET</Option>
              <Option value="POST">POST</Option>
              <Option value="PUT">PUT</Option>
              <Option value="DELETE">DELETE</Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="draft">
            <Select>
              <Option value="draft">草稿</Option>
              <Option value="active">启用</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>
          <Form.Item name="cache_enabled" label="启用缓存" valuePropName="checked" initialValue={true}>
            <Select>
              <Option value={true}>是</Option>
              <Option value={false}>否</Option>
            </Select>
          </Form.Item>
          <Form.Item name="cache_ttl" label="缓存 TTL (秒)" initialValue={300}>
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EndpointList;
