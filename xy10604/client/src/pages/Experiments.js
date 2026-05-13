import React, { useEffect, useState } from 'react';
import {
  Table,
  Tag,
  Button,
  Input,
  Space,
  Card,
  Modal,
  Form,
  Select,
  DatePicker,
  message,
  Alert,
  Typography,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;
const { Search } = Input;

const statusColors = {
  PENDING: 'default',
  APPROVED: 'green',
  BLOCKED: 'red',
  REVIEWING: 'orange',
  COMPLETED: 'blue',
  CANCELLED: 'default',
};

const statusMap = {
  PENDING: '待审批',
  APPROVED: '已批准',
  BLOCKED: '已拦截',
  REVIEWING: '待复核',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const Experiments = () => {
  const [data, setData] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [searchText, setSearchText] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    fetchExperiments();
    fetchBatches();
  }, []);

  const fetchExperiments = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const response = await api.get('/experiments', {
        params: {
          page,
          limit: pageSize,
        },
      });
      setData(response.data.experiments);
      setPagination({
        current: page,
        pageSize,
        total: response.data.pagination.total,
      });
    } catch (error) {
      message.error('获取实验列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async () => {
    try {
      const response = await api.get('/batches', { params: { limit: 100 } });
      setBatches(response.data.batches);
    } catch (error) {
      console.error('获取批号列表失败:', error);
    }
  };

  const handleValidate = async (values) => {
    if (!values.batchId || !values.scheduledDate) return;

    try {
      const response = await api.post('/experiments/validate', {
        batchId: values.batchId,
        scheduledDate: values.scheduledDate.format('YYYY-MM-DD'),
      });
      setValidationResult(response.data);
    } catch (error) {
      console.error('校验失败:', error);
    }
  };

  const handleCreate = async (values) => {
    try {
      const response = await api.post('/experiments', {
        name: values.name,
        code: values.code,
        batchId: values.batchId,
        scheduledDate: values.scheduledDate.format('YYYY-MM-DD'),
      });
      message.success('创建实验成功');

      if (response.data.validation.blocked) {
        message.warning('实验已被规则拦截，需要人工复核');
      }

      setCreateModalVisible(false);
      form.resetFields();
      setValidationResult(null);
      fetchExperiments(pagination.current, pagination.pageSize);
    } catch (error) {
      message.error(error.response?.data?.error || '创建实验失败');
    }
  };

  const handleComplete = async (record) => {
    try {
      await api.put(`/experiments/${record.id}/status`, {
        status: 'COMPLETED',
      });
      message.success('实验已完成');
      fetchExperiments(pagination.current, pagination.pageSize);
    } catch (error) {
      message.error('更新实验状态失败');
    }
  };

  const columns = [
    {
      title: '实验编号',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: '实验名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '试剂',
      dataIndex: ['batch', 'reagent', 'name'],
      key: 'reagent',
    },
    {
      title: '批号',
      dataIndex: ['batch', 'batchNumber'],
      key: 'batchNumber',
    },
    {
      title: '预约日期',
      dataIndex: 'scheduledDate',
      key: 'scheduledDate',
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusColors[status]}>{statusMap[status]}</Tag>
      ),
    },
    {
      title: '创建人',
      dataIndex: ['createdBy', 'name'],
      key: 'createdBy',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/experiments/${record.id}`)}
          >
            详情
          </Button>
          {record.status === 'APPROVED' && (
            <Popconfirm
              title="确认标记该实验为已完成？"
              onConfirm={() => handleComplete(record)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" icon={<CheckCircleOutlined />}>
                完成
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={4}>实验预约管理</Title>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Search
            placeholder="搜索实验编号或名称"
            onSearch={(value) => setSearchText(value)}
            style={{ width: 300 }}
            allowClear
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setCreateModalVisible(true);
              setValidationResult(null);
            }}
          >
            新建实验
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => fetchExperiments(page, pageSize),
          }}
        />
      </Card>

      <Modal
        title="新建实验预约"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          setValidationResult(null);
        }}
        footer={null}
        destroyOnClose
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          onValuesChange={handleValidate}
        >
          <Form.Item
            name="name"
            label="实验名称"
            rules={[{ required: true, message: '请输入实验名称' }]}
          >
            <Input placeholder="请输入实验名称" />
          </Form.Item>

          <Form.Item
            name="code"
            label="实验编号"
            rules={[{ required: true, message: '请输入实验编号' }]}
          >
            <Input placeholder="请输入唯一的实验编号" />
          </Form.Item>

          <Form.Item
            name="batchId"
            label="试剂批号"
            rules={[{ required: true, message: '请选择试剂批号' }]}
          >
            <Select placeholder="请选择试剂批号">
              {batches
                .filter((b) => b.status !== 'EXPIRED' && b.status !== 'DISCARDED')
                .map((b) => (
                  <Option key={b.id} value={b.id}>
                    {b.reagent.name} - {b.batchNumber} ({b.status})
                  </Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="scheduledDate"
            label="实验日期"
            rules={[{ required: true, message: '请选择实验日期' }]}
          >
            <DatePicker style={{ width: '100%' }} minDate={dayjs()} />
          </Form.Item>

          {validationResult && (
            <Form.Item>
              {!validationResult.valid && (
                <Alert
                  type="error"
                  showIcon
                  message={
                    validationResult.blocked
                      ? '实验被规则拦截'
                      : '校验失败'
                  }
                  description={validationResult.blockDetails}
                />
              )}
              {validationResult.warnings?.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  message="警告信息"
                  description={validationResult.warnings.join('; ')}
                />
              )}
              {validationResult.valid && !validationResult.warnings && (
                <Alert
                  type="success"
                  showIcon
                  message="校验通过，可以创建实验"
                />
              )}
            </Form.Item>
          )}

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
              <Button
                onClick={() => {
                  setCreateModalVisible(false);
                  setValidationResult(null);
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Experiments;
