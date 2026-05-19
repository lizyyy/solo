import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Modal,
  Form,
  InputNumber,
  Switch,
  Upload,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ExportOutlined,
  ImportOutlined,
  EyeOutlined,
  FileSearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { templateApi, commonApi } from '../api';

const { Option } = Select;
const { TextArea } = Input;

const statusMap = {
  draft: { label: '草稿', color: 'default' },
  pending_approval: { label: '待审批', color: 'warning' },
  approved: { label: '已批准', color: 'processing' },
  gray: { label: '灰度中', color: 'blue' },
  published: { label: '已发布', color: 'success' },
  rejected: { label: '已驳回', color: 'error' },
};

function TemplateList() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ scenario: '', status: '', search: '' });
  const [scenarios, setScenarios] = useState([]);
  const [stats, setStats] = useState({ total: 0, by_status: {}, by_scenario: {} });
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchTemplates = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const res = await templateApi.getTemplates({
        page,
        per_page: pageSize,
        scenario: filters.scenario || undefined,
        status: filters.status || undefined,
        search: filters.search || undefined,
      });
      setTemplates(res.data.data);
      setPagination({
        current: res.data.page,
        pageSize: res.data.per_page,
        total: res.data.total,
      });
    } catch (error) {
      message.error('获取模板列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await commonApi.getStats();
      setStats(res.data);
    } catch (error) {
      console.error('获取统计数据失败');
    }
  };

  const fetchScenarios = async () => {
    try {
      const res = await commonApi.getScenarios();
      setScenarios(res.data.scenarios);
    } catch (error) {
      console.error('获取场景列表失败');
    }
  };

  useEffect(() => {
    fetchTemplates(pagination.current, pagination.pageSize);
    fetchStats();
    fetchScenarios();
  }, [filters]);

  const handleTableChange = (pagination) => {
    fetchTemplates(pagination.current, pagination.pageSize);
  };

  const handleCreateTemplate = async (values) => {
    try {
      const variables = values.variables ? values.variables.split(',').map(v => ({
        name: v.trim(),
        type: 'string',
        required: true,
      })) : [];

      await templateApi.createTemplate({
        ...values,
        variables,
        created_by: '当前用户',
      });
      message.success('创建成功');
      setCreateModalVisible(false);
      form.resetFields();
      fetchTemplates(pagination.current, pagination.pageSize);
      fetchStats();
    } catch (error) {
      message.error(error.response?.data?.error || '创建失败');
    }
  };

  const handleImport = async (file) => {
    try {
      const res = await templateApi.importTemplates(file);
      message.success(res.data.message);
      if (res.data.errors && res.data.errors.length > 0) {
        message.warning(`有 ${res.data.errors.length} 个模板导入失败`);
      }
      setImportModalVisible(false);
      fetchTemplates(pagination.current, pagination.pageSize);
      fetchStats();
    } catch (error) {
      message.error(error.response?.data?.error || '导入失败');
    }
    return false;
  };

  const handleExport = () => {
    templateApi.exportTemplates();
    message.success('导出任务已开始');
  };

  const columns = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text, record) => (
        <a onClick={() => navigate(`/template/${record.template_id}`)}>
          {text}
        </a>
      ),
    },
    {
      title: '模板ID',
      dataIndex: 'template_id',
      key: 'template_id',
      width: 180,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '适用场景',
      dataIndex: 'scenario',
      key: 'scenario',
      width: 120,
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const config = statusMap[status] || { label: status, color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '版本',
      dataIndex: 'current_version',
      key: 'current_version',
      width: 80,
      render: (v) => `v${v}`,
    },
    {
      title: '变量',
      dataIndex: 'variables',
      key: 'variables',
      width: 150,
      render: (variables) => (
        <Space wrap>
          {variables?.slice(0, 3).map((v, i) => (
            <Tag key={i} size="small">{v.name}</Tag>
          ))}
          {variables?.length > 3 && <Tag size="small">+{variables.length - 3}</Tag>}
        </Space>
      ),
    },
    {
      title: '创建人',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 100,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm'),
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
          onClick={() => navigate(`/template/${record.template_id}`)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card className="stats-card">
            <Statistic
              title="模板总数"
              value={stats.total}
              prefix={<FileSearchOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stats-card">
            <Statistic
              title="已发布"
              value={stats.by_status?.published || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stats-card">
            <Statistic
              title="待审批"
              value={stats.by_status?.pending_approval || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stats-card">
            <Statistic
              title="灰度中"
              value={stats.by_status?.gray || 0}
              prefix={<CloudUploadOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Row gutter={16} className="filter-row" align="middle">
          <Col span={6}>
            <Input
              placeholder="搜索模板名称/描述"
              prefix={<SearchOutlined />}
              allowClear
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="状态"
              allowClear
              style={{ width: '100%' }}
              value={filters.status || undefined}
              onChange={(value) => setFilters({ ...filters, status: value })}
            >
              {Object.entries(statusMap).map(([key, value]) => (
                <Option key={key} value={key}>{value.label}</Option>
              ))}
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="适用场景"
              allowClear
              style={{ width: '100%' }}
              value={filters.scenario || undefined}
              onChange={(value) => setFilters({ ...filters, scenario: value })}
            >
              {scenarios.map((s) => (
                <Option key={s} value={s}>{s}</Option>
              ))}
            </Select>
          </Col>
          <Col span={10} style={{ textAlign: 'right' }}>
            <Space>
              <Button icon={<ImportOutlined />} onClick={() => setImportModalVisible(true)}>
                批量导入
              </Button>
              <Button icon={<ExportOutlined />} onClick={handleExport}>
                导出报告
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                新建模板
              </Button>
            </Space>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={templates}
          rowKey="template_id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1400 }}
        />
      </Card>

      <Modal
        title="新建提示词模板"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateTemplate}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="template_id"
                label="模板ID"
                rules={[{ required: true, message: '请输入模板ID' }]}
              >
                <Input placeholder="例如: customer_service_001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label="模板名称"
                rules={[{ required: true, message: '请输入模板名称' }]}
              >
                <Input placeholder="例如: 客服智能回复模板" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="请输入模板描述" />
          </Form.Item>
          <Form.Item
            name="scenario"
            label="适用场景"
            rules={[{ required: true, message: '请输入适用场景' }]}
          >
            <Input placeholder="例如: customer_service" />
          </Form.Item>
          <Form.Item
            name="content"
            label="提示词内容"
            rules={[{ required: true, message: '请输入提示词内容' }]}
          >
            <TextArea rows={8} placeholder="使用 {variable_name} 格式定义变量" />
          </Form.Item>
          <Form.Item name="variables" label="变量列表">
            <Input placeholder="用逗号分隔，例如: customer_question, order_info" />
          </Form.Item>
          <Form.Item name="changelog" label="变更说明">
            <Input placeholder="例如: 初始版本" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量导入模板"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
      >
        <Upload.Dragger
          beforeUpload={handleImport}
          accept=".xlsx,.xls,.csv"
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon">
            <ImportOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
          <p className="ant-upload-hint">支持 .xlsx, .xls, .csv 格式</p>
        </Upload.Dragger>
      </Modal>
    </div>
  );
}

export default TemplateList;
