import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Modal,
  Form,
  InputNumber,
  DatePicker,
  message,
  Typography,
  Row,
  Col,
  Statistic,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ExportOutlined,
  EyeOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { applicationApi } from '../services/api.js';

const { Title } = Typography;
const { Option } = Select;

const getStatusTag = (status) => {
  switch (status) {
    case 'completed':
      return <Tag color="green" icon={<CheckCircleOutlined />}>已完成退款</Tag>;
    case 'pending':
      return <Tag color="orange" icon={<ClockCircleOutlined />}>待处理</Tag>;
    default:
      return <Tag>{status}</Tag>;
  }
};

const ApplicationList = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0 });
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const response = await applicationApi.getAll(filters);
      setApplications(response.data);
      
      const total = response.data.length;
      const completed = response.data.filter(a => a.status === 'completed').length;
      setStats({
        total,
        completed,
        pending: total - completed
      });
    } catch (error) {
      message.error('获取申请列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [filters]);

  const handleSearch = (value) => {
    setFilters(prev => ({ ...prev, keyword: value || undefined }));
  };

  const handleStatusChange = (value) => {
    setFilters(prev => ({ ...prev, status: value || undefined }));
  };

  const handleCreate = async (values) => {
    try {
      const data = {
        ...values,
        application_date: values.application_date.format('YYYY-MM-DD'),
        operator: '当前用户'
      };
      await applicationApi.create(data);
      message.success('申请创建成功');
      setCreateModalVisible(false);
      form.resetFields();
      fetchApplications();
    } catch (error) {
      message.error(error.response?.data?.error || '创建失败');
    }
  };

  const handleExport = async () => {
    try {
      message.loading('正在生成Excel...', 0);
      const response = await applicationApi.exportExcel(filters);
      
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `装修押金退款明细_${dayjs().format('YYYY-MM-DD')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      message.destroy();
      message.success('导出成功');
    } catch (error) {
      message.destroy();
      message.error('导出失败');
    }
  };

  const columns = [
    {
      title: '申请编号',
      dataIndex: 'application_no',
      key: 'application_no',
      width: 140,
      render: (text) => <a onClick={() => navigate(`/applications/${applications.find(a => a.application_no === text)?.id}`)}>{text}</a>
    },
    {
      title: '房间号',
      dataIndex: 'room_no',
      key: 'room_no',
      width: 100
    },
    {
      title: '业主姓名',
      dataIndex: 'owner_name',
      key: 'owner_name',
      width: 100
    },
    {
      title: '联系电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 120
    },
    {
      title: '押金金额',
      dataIndex: 'deposit_amount',
      key: 'deposit_amount',
      width: 110,
      render: (value) => `¥${value?.toFixed(2) || '0.00'}`
    },
    {
      title: '申请日期',
      dataIndex: 'application_date',
      key: 'application_date',
      width: 110
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status, record) => (
        <Space direction="vertical" size="small">
          {getStatusTag(status)}
          {record.unpaid_fees > 0 && (
            <Tooltip title={`有${record.unpaid_fees}笔未结清欠费`}>
              <Tag color="red" icon={<ExclamationCircleOutlined />}>欠费</Tag>
            </Tooltip>
          )}
          {record.rectification_status?.includes('0') && (
            <Tooltip title="存在未整改问题">
              <Tag color="warning" icon={<ExclamationCircleOutlined />}>待整改</Tag>
            </Tooltip>
          )}
        </Space>
      )
    },
    {
      title: '已退款',
      dataIndex: 'refund_count',
      key: 'refund_count',
      width: 80,
      render: (count) => count > 0 ? <Tag color="green">是</Tag> : <Tag color="default">否</Tag>
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time) => time?.replace('T', ' ').substring(0, 19)
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/applications/${record.id}`)}
        >
          详情
        </Button>
      )
    }
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总申请数"
              value={stats.total}
              prefix={<SearchOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成退款"
              value={stats.completed}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理"
              value={stats.pending}
              valueStyle={{ color: '#faad14' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="完成率"
              value={stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0}
              suffix="%"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={<Title level={4} style={{ margin: 0 }}>装修押金申请列表</Title>}
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchApplications}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<ExportOutlined />}
              onClick={handleExport}
            >
              导出Excel
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              新增申请
            </Button>
          </Space>
        }
      >
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索申请编号、房间号、业主姓名"
            allowClear
            style={{ width: 300 }}
            prefix={<SearchOutlined />}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <Select
            placeholder="筛选状态"
            allowClear
            style={{ width: 150 }}
            onChange={handleStatusChange}
          >
            <Option value="pending">待处理</Option>
            <Option value="completed">已完成退款</Option>
          </Select>
        </Space>

        <Table
          columns={columns}
          dataSource={applications}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1300 }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`
          }}
        />
      </Card>

      <Modal
        title="新增装修押金申请"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            label="申请编号"
            name="application_no"
            rules={[{ required: true, message: '请输入申请编号' }]}
            initialValue={`ZK-${dayjs().format('YYYY')}-${String(Date.now()).slice(-6)}`}
          >
            <Input placeholder="如：ZK-2024-001" />
          </Form.Item>
          <Form.Item
            label="房间号"
            name="room_no"
            rules={[{ required: true, message: '请输入房间号' }]}
          >
            <Input placeholder="如：1栋2单元301" />
          </Form.Item>
          <Form.Item
            label="业主姓名"
            name="owner_name"
            rules={[{ required: true, message: '请输入业主姓名' }]}
          >
            <Input placeholder="如：张三" />
          </Form.Item>
          <Form.Item
            label="联系电话"
            name="phone"
          >
            <Input placeholder="如：13800138001" />
          </Form.Item>
          <Form.Item
            label="押金金额"
            name="deposit_amount"
            rules={[{ required: true, message: '请输入押金金额' }]}
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="如：5000"
              addonAfter="元"
            />
          </Form.Item>
          <Form.Item
            label="申请日期"
            name="application_date"
            rules={[{ required: true, message: '请选择申请日期' }]}
            initialValue={dayjs()}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ApplicationList;
