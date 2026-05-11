import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Tag,
  message,
  Spin,
  Card,
  Descriptions,
  Statistic,
  Row,
  Col
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { workOrdersAPI, contractsAPI } from '../services/api';

const WorkOrders = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [workOrders, setWorkOrders] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    contract_id: undefined,
    status: undefined,
    is_settled: undefined
  });
  const [form] = Form.useForm();

  const statusMap = {
    created: { color: 'blue', text: '已创建' },
    responded: { color: 'cyan', text: '已响应' },
    paused: { color: 'orange', text: '已暂停' },
    in_progress: { color: 'purple', text: '处理中' },
    repaired: { color: 'green', text: '已修复' },
    closed: { color: 'default', text: '已关闭' }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [workOrdersRes, contractsRes] = await Promise.all([
        workOrdersAPI.getAll(filters),
        contractsAPI.getAll()
      ]);

      setWorkOrders(workOrdersRes.data.map(wo => ({ ...wo, key: wo.id })));
      setContracts(contractsRes.data);
    } catch (error) {
      message.error('加载数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const handleAdd = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const data = {
        ...values,
        event_time: values.event_time?.format('YYYY-MM-DD HH:mm:ss')
      };

      await workOrdersAPI.create(data);
      message.success('创建成功');
      setModalVisible(false);
      loadData();
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.response?.data?.error || '创建失败');
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const columns = [
    {
      title: '工单编号',
      dataIndex: 'work_order_number',
      key: 'work_order_number',
      render: (text, record) => (
        <a onClick={() => navigate(`/workorders/${record.id}`)}>{text}</a>
      )
    },
    {
      title: '合同',
      dataIndex: 'contract_name',
      key: 'contract_name'
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
      key: 'customer_name'
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusMap[status]?.color}>{statusMap[status]?.text}</Tag>
      ),
      filters: Object.entries(statusMap).map(([key, value]) => ({
        text: value.text,
        value: key
      })),
      filterMultiple: false,
      onFilter: (value, record) => record.status === value
    },
    {
      title: '是否结算',
      dataIndex: 'is_settled',
      key: 'is_settled',
      render: (settled) => (
        <Tag color={settled ? 'default' : 'green'}>
          {settled ? '已结算' : '未结算'}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at)
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/workorders/${record.id}`)}
          >
            详情
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="选择合同"
            style={{ width: 200 }}
            allowClear
            value={filters.contract_id}
            onChange={(value) => handleFilterChange('contract_id', value)}
          >
            {contracts.map(c => (
              <Select.Option key={c.id} value={c.id}>
                {c.name}
              </Select.Option>
            ))}
          </Select>

          <Select
            placeholder="选择状态"
            style={{ width: 150 }}
            allowClear
            value={filters.status}
            onChange={(value) => handleFilterChange('status', value)}
          >
            {Object.entries(statusMap).map(([key, value]) => (
              <Select.Option key={key} value={key}>
                {value.text}
              </Select.Option>
            ))}
          </Select>

          <Select
            placeholder="是否结算"
            style={{ width: 150 }}
            allowClear
            value={filters.is_settled}
            onChange={(value) => handleFilterChange('is_settled', value)}
          >
            <Select.Option value="true">已结算</Select.Option>
            <Select.Option value="false">未结算</Select.Option>
          </Select>

          <Button
            icon={<ReloadOutlined />}
            onClick={() => setFilters({ contract_id: undefined, status: undefined, is_settled: undefined })}
          >
            重置
          </Button>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            style={{ marginLeft: 'auto' }}
          >
            新建工单
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={workOrders}
        loading={loading}
        rowKey="id"
      />

      <Modal
        title="新建工单"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="contract_id"
            label="合同"
            rules={[{ required: true, message: '请选择合同' }]}
          >
            <Select placeholder="请选择合同">
              {contracts.map(c => (
                <Select.Option key={c.id} value={c.id}>
                  {c.name} - {c.contract_number}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="work_order_number"
            label="工单编号"
            rules={[{ required: true, message: '请输入工单编号' }]}
          >
            <Input placeholder="请输入工单编号，如：WO-2026-0001" />
          </Form.Item>

          <Form.Item
            name="description"
            label="工单描述"
            rules={[{ required: true, message: '请输入工单描述' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="请详细描述故障情况和维修需求"
            />
          </Form.Item>

          <Form.Item
            name="event_time"
            label="创建时间"
            extra="留空则使用当前时间"
          >
            <DatePicker
              showTime
              style={{ width: '100%' }}
              placeholder="选择创建时间"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkOrders;
