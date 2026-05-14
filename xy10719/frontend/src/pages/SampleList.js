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
  Upload,
  message,
  Popconfirm
} from 'antd';
import {
  PlusOutlined,
  UploadOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  DeleteOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { sampleApi } from '../services/api';

const { Search } = Input;
const { Option } = Select;

const statusColors = {
  pending: 'default',
  processing: 'processing',
  success: 'success',
  failed: 'error',
  needs_approval: 'warning',
  approved: 'success',
  rejected: 'error'
};

const statusLabels = {
  pending: '待处理',
  processing: '处理中',
  success: '成功',
  failed: '失败',
  needs_approval: '待审批',
  approved: '已审批',
  rejected: '已拒绝'
};

const fieldTypeLabels = {
  phone: '手机号',
  email: '邮箱',
  id_card: '身份证',
  name: '姓名',
  address: '地址',
  bank_card: '银行卡',
  general: '通用'
};

function SampleList() {
  const navigate = useNavigate();
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchSamples = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (searchText) params.search = searchText;
      const response = await sampleApi.getSamples(params);
      setSamples(response.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSamples();
  }, [searchText, statusFilter]);

  const handleCreate = async (values) => {
    try {
      await sampleApi.createSample(values);
      message.success('创建成功');
      setModalVisible(false);
      form.resetFields();
      fetchSamples();
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleUpload = async (file) => {
    try {
      const response = await sampleApi.uploadSamples(file);
      message.success(response.data.message);
      fetchSamples();
    } catch (error) {
      message.error('上传失败');
    }
    return false;
  };

  const handleRetry = async (id) => {
    try {
      await sampleApi.retrySample(id);
      message.success('重试成功');
      fetchSamples();
    } catch (error) {
      message.error('重试失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await sampleApi.deleteSample(id);
      message.success('删除成功');
      fetchSamples();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '字段名称',
      dataIndex: 'field_name',
      key: 'field_name',
      width: 150,
    },
    {
      title: '字段类型',
      dataIndex: 'field_type',
      key: 'field_type',
      width: 100,
      render: (type) => fieldTypeLabels[type] || type,
    },
    {
      title: '原始值',
      dataIndex: 'original_value',
      key: 'original_value',
      ellipsis: true,
    },
    {
      title: '脱敏值',
      dataIndex: 'masked_value',
      key: 'masked_value',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
    },
    {
      title: '脏数据',
      dataIndex: 'is_dirty',
      key: 'is_dirty',
      width: 80,
      render: (isDirty) => isDirty ? <Tag color="red">是</Tag> : <Tag color="green">否</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/sample/${record.id}`)}
          >
            详情
          </Button>
          {record.status === 'failed' && (
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleRetry(record.id)}
            >
              重试
            </Button>
          )}
          <Popconfirm
            title="确定要删除吗？"
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
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Search
            placeholder="搜索字段名或原始值"
            allowClear
            enterButton={<SearchOutlined />}
            onSearch={setSearchText}
            style={{ width: 300 }}
          />
          <Select
            placeholder="筛选状态"
            allowClear
            style={{ width: 150 }}
            onChange={setStatusFilter}
          >
            {Object.entries(statusLabels).map(([key, label]) => (
              <Option key={key} value={key}>{label}</Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={fetchSamples}>
            刷新
          </Button>
        </Space>
        <Space>
          <Upload
            beforeUpload={handleUpload}
            showUploadList={false}
            accept=".xlsx,.xls,.csv"
          >
            <Button icon={<UploadOutlined />}>上传文件</Button>
          </Upload>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            新增样例
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={samples}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        expandable={{
          expandedRowRender: (record) => (
            <div>
              {record.error_message && (
                <div style={{ color: '#ff4d4f', marginBottom: 8 }}>
                  <strong>错误详情：</strong>{record.error_message}
                </div>
              )}
              {record.processed_at && (
                <div>
                  <strong>处理时间：</strong>{new Date(record.processed_at).toLocaleString()}
                  {record.processed_by && ` (处理人: ${record.processed_by})`}
                </div>
              )}
            </div>
          ),
        }}
      />

      <Modal
        title="新增样例数据"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="字段名称"
            name="field_name"
            rules={[{ required: true, message: '请输入字段名称' }]}
          >
            <Input placeholder="请输入字段名称" />
          </Form.Item>
          <Form.Item
            label="字段类型"
            name="field_type"
            rules={[{ required: true, message: '请选择字段类型' }]}
          >
            <Select placeholder="请选择字段类型">
              {Object.entries(fieldTypeLabels).map(([key, label]) => (
                <Option key={key} value={key}>{label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="原始值"
            name="original_value"
            rules={[{ required: true, message: '请输入原始值' }]}
          >
            <Input.TextArea placeholder="请输入原始值" rows={3} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default SampleList;
