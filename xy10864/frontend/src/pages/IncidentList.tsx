import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Tag,
  Space,
  Card,
  Row,
  Col,
  Statistic,
  message,
} from 'antd';
import { PlusOutlined, ExclamationCircleOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { incidentApi } from '../services/api';
import { Incident, statusLabels, severityLabels } from '../types';
import moment from 'moment';

const { Option } = Select;
const { TextArea } = Input;

const IncidentList: React.FC = () => {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await incidentApi.getAll({ page: pagination.page, limit: pagination.limit });
      setIncidents(res.data.data);
      setPagination({ ...pagination, total: res.data.pagination.total });
    } catch (error) {
      message.error('获取事故列表失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchIncidents();
  }, [pagination.page]);

  const handleCreate = async (values: any) => {
    try {
      await incidentApi.create({
        ...values,
        startTime: values.startTime.toISOString(),
      });
      message.success('创建事故单成功');
      setIsModalOpen(false);
      form.resetFields();
      fetchIncidents();
    } catch (error) {
      message.error('创建失败');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'gold';
      case 'low': return 'green';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'archived': return 'default';
      case 'reviewing': return 'purple';
      case 'monitoring': return 'blue';
      case 'fixing': return 'orange';
      case 'verifying': return 'cyan';
      default: return 'processing';
    }
  };

  const stats = {
    total: incidents.length,
    active: incidents.filter(i => !['archived', 'reviewing'].includes(i.status)).length,
    critical: incidents.filter(i => i.severity === 'critical').length,
    reviewing: incidents.filter(i => i.status === 'reviewing').length,
  };

  const columns = [
    { title: '事故ID', dataIndex: 'incidentId', key: 'incidentId', width: 120 },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: Incident) => (
        <a onClick={() => navigate(`/incident/${record._id}`)}>{text}</a>
      ),
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (s: string) => <Tag color={getSeverityColor(s)}>{severityLabels[s]}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => <Tag color={getStatusColor(s)}>{statusLabels[s]}</Tag>,
    },
    { title: '责任人', dataIndex: 'owner', key: 'owner', width: 100 },
    { title: '发现人', dataIndex: 'detectedBy', key: 'detectedBy', width: 100 },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 160,
      render: (t: string) => moment(t).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '行动项',
      key: 'actions',
      width: 100,
      render: (_: any, record: Incident) => (
        <span>{record.actionItems?.length || 0} 项</span>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="事故总数"
              value={stats.total}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="进行中"
              value={stats.active}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="致命事故"
              value={stats.critical}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待复盘"
              value={stats.reviewing}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>事故列表</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
          新建事故单
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={incidents}
        loading={loading}
        rowKey="_id"
        pagination={{
          current: pagination.page,
          pageSize: pagination.limit,
          total: pagination.total,
          onChange: (page) => setPagination({ ...pagination, page }),
        }}
      />

      <Modal
        title="新建事故单"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="请输入事故标题" />
          </Form.Item>
          <Form.Item name="description" label="描述" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="请输入事故描述" />
          </Form.Item>
          <Form.Item name="severity" label="严重程度" rules={[{ required: true }]}>
            <Select placeholder="请选择严重程度">
              <Option value="critical">致命</Option>
              <Option value="high">严重</Option>
              <Option value="medium">中等</Option>
              <Option value="low">轻微</Option>
            </Select>
          </Form.Item>
          <Form.Item name="startTime" label="发生时间" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="detectedBy" label="发现人" rules={[{ required: true }]}>
            <Input placeholder="请输入发现人" />
          </Form.Item>
          <Form.Item name="owner" label="责任人" rules={[{ required: true }]}>
            <Input placeholder="请输入责任人" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
              <Button onClick={() => setIsModalOpen(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default IncidentList;
