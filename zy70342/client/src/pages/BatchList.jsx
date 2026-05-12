import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Typography,
  message,
  DatePicker,
} from 'antd';
import { PlusOutlined, EyeOutlined, SyncOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { batchApi } from '../services/api';
import {
  BATCH_STATUS_TEXT,
  BATCH_TYPE_TEXT,
} from '../utils/constants';

const { Title } = Typography;
const { RangePicker } = DatePicker;

function BatchList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [filters, setFilters] = useState({
    batchType: undefined,
    status: undefined,
  });

  const loadBatches = async () => {
    setLoading(true);
    try {
      const result = await batchApi.list({
        ...filters,
        page,
        pageSize,
      });
      setData(result.data);
      setTotal(result.total);
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, [page, pageSize, filters]);

  const handleCreate = async (values) => {
    try {
      const batch = await batchApi.create(values);
      message.success('批次创建成功');
      setCreateModalVisible(false);
      form.resetFields();
      navigate(`/batches/${batch.id}`);
    } catch (error) {
      message.error(error.message);
    }
  };

  const columns = [
    {
      title: '批次名称',
      dataIndex: 'batchName',
      key: 'batchName',
      render: (text, record) => (
        <a onClick={() => navigate(`/batches/${record.id}`)}>
          {text}
        </a>
      ),
    },
    {
      title: '批次类型',
      dataIndex: 'batchType',
      key: 'batchType',
      width: 120,
      render: (type) => (
        <Tag color={type === 'customer' ? 'blue' : 'green'}>
          {BATCH_TYPE_TEXT[type]}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const colorMap = {
          uploaded: 'blue',
          mapping_configured: 'gold',
          precheck_passed: 'green',
          precheck_failed: 'red',
          trial_imported: 'purple',
          confirmed: 'success',
          rolled_back: 'orange',
        };
        return (
          <Tag color={colorMap[status]}>
            {BATCH_STATUS_TEXT[status]}
          </Tag>
        );
      },
    },
    {
      title: '数据量',
      key: 'stats',
      width: 200,
      render: (_, record) => (
        <Space size="middle">
          <span>总计: {record.totalRows}</span>
          <span style={{ color: '#52c41a' }}>有效: {record.validRows}</span>
          <span style={{ color: '#ff4d4f' }}>错误: {record.errorRows}</span>
        </Space>
      ),
    },
    {
      title: '上传人',
      dataIndex: 'uploadedBy',
      key: 'uploadedBy',
      width: 100,
    },
    {
      title: '确认人',
      dataIndex: 'confirmedBy',
      key: 'confirmedBy',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
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
      <Card style={{ marginBottom: 24 }}>
        <Space size="large">
          <Select
            placeholder="筛选批次类型"
            style={{ width: 150 }}
            allowClear
            onChange={(value) => setFilters({ ...filters, batchType: value })}
          >
            <Select.Option value="customer">客户导入</Select.Option>
            <Select.Option value="product">商品导入</Select.Option>
          </Select>
          <Select
            placeholder="筛选状态"
            style={{ width: 150 }}
            allowClear
            onChange={(value) => setFilters({ ...filters, status: value })}
          >
            <Select.Option value="uploaded">已上传</Select.Option>
            <Select.Option value="mapping_configured">映射已配置</Select.Option>
            <Select.Option value="precheck_passed">预检通过</Select.Option>
            <Select.Option value="precheck_failed">预检失败</Select.Option>
            <Select.Option value="trial_imported">已试导入</Select.Option>
            <Select.Option value="confirmed">已确认</Select.Option>
            <Select.Option value="rolled_back">已回滚</Select.Option>
          </Select>
          <Button icon={<SyncOutlined />} onClick={loadBatches}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            新建导入批次
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>

      <Modal
        title="新建导入批次"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        maskClosable={false}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            label="批次名称"
            name="batchName"
            rules={[{ required: true, message: '请输入批次名称' }]}
          >
            <Input placeholder="例如：2024年Q1新客户导入" />
          </Form.Item>
          <Form.Item
            label="导入类型"
            name="batchType"
            rules={[{ required: true, message: '请选择导入类型' }]}
          >
            <Select placeholder="请选择导入类型">
              <Select.Option value="customer">客户导入</Select.Option>
              <Select.Option value="product">商品导入</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BatchList;
