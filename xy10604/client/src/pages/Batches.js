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
  InputNumber,
  message,
  Popconfirm,
  Typography,
} from 'antd';
import { PlusOutlined, EyeOutlined, ExperimentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;
const { Search } = Input;

const statusColors = {
  PENDING: 'default',
  ACTIVE: 'green',
  EXPIRED: 'red',
  BLOCKED: 'orange',
  DISCARDED: 'default',
};

const statusMap = {
  PENDING: '待处理',
  ACTIVE: '正常',
  EXPIRED: '已过期',
  BLOCKED: '已封锁',
  DISCARDED: '已废弃',
};

const Batches = () => {
  const [data, setData] = useState([]);
  const [reagents, setReagents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [searchText, setSearchText] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    fetchBatches();
    fetchReagents();
  }, []);

  const fetchBatches = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const response = await api.get('/batches', {
        params: {
          page,
          limit: pageSize,
          search: searchText,
        },
      });
      setData(response.data.batches);
      setPagination({
        current: page,
        pageSize,
        total: response.data.pagination.total,
      });
    } catch (error) {
      message.error('获取批号列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchReagents = async () => {
    try {
      const response = await api.get('/reagents', { params: { limit: 100 } });
      setReagents(response.data.reagents);
    } catch (error) {
      console.error('获取试剂列表失败:', error);
    }
  };

  const handleCreate = async (values) => {
    try {
      await api.post('/batches', {
        ...values,
        productionDate: values.productionDate.format('YYYY-MM-DD'),
        expiryDate: values.expiryDate.format('YYYY-MM-DD'),
      });
      message.success('创建批号成功');
      setCreateModalVisible(false);
      form.resetFields();
      fetchBatches(pagination.current, pagination.pageSize);
    } catch (error) {
      message.error(error.response?.data?.error || '创建批号失败');
    }
  };

  const handleSearch = (value) => {
    setSearchText(value);
    fetchBatches(1, pagination.pageSize);
  };

  const columns = [
    {
      title: '试剂名称',
      dataIndex: ['reagent', 'name'],
      key: 'reagent',
    },
    {
      title: '批号',
      dataIndex: 'batchNumber',
      key: 'batchNumber',
    },
    {
      title: '生产日期',
      dataIndex: 'productionDate',
      key: 'productionDate',
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '有效期',
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '库存',
      dataIndex: 'currentQty',
      key: 'currentQty',
      render: (qty, record) => `${qty} / ${record.originalQty} ${record.unit}`,
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
            onClick={() => navigate(`/batches/${record.id}`)}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={4}>试剂批号管理</Title>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Search
            placeholder="搜索试剂名称或批号"
            onSearch={handleSearch}
            style={{ width: 300 }}
            allowClear
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            新建批号
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
            onChange: (page, pageSize) => fetchBatches(page, pageSize),
          }}
        />
      </Card>

      <Modal
        title="新建试剂批号"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="reagentId"
            label="试剂类型"
            rules={[{ required: true, message: '请选择试剂类型' }]}
          >
            <Select placeholder="请选择试剂类型">
              {reagents.map((r) => (
                <Option key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="batchNumber"
            label="批号"
            rules={[{ required: true, message: '请输入批号' }]}
          >
            <Input placeholder="请输入批号" />
          </Form.Item>

          <Form.Item
            name="productionDate"
            label="生产日期"
            rules={[{ required: true, message: '请选择生产日期' }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="选择生产日期" />
          </Form.Item>

          <Form.Item
            name="expiryDate"
            label="有效期"
            rules={[{ required: true, message: '请选择有效期' }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="选择有效期" />
          </Form.Item>

          <Form.Item
            name="originalQty"
            label="初始数量"
            rules={[{ required: true, message: '请输入初始数量' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              placeholder="请输入初始数量"
            />
          </Form.Item>

          <Form.Item
            name="unit"
            label="单位"
            rules={[{ required: true, message: '请输入单位' }]}
          >
            <Input placeholder="如: mL, μL, g 等" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
              <Button onClick={() => setCreateModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Batches;
