import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Space,
  Popconfirm,
  Tag,
  Descriptions,
  Divider,
  Drawer,
  Row,
  Col,
  Empty,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TagOutlined,
  SettingOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons';
import { projectApi } from '../services/api';
import {
  BUDGET_PERIOD_LABELS,
  BUDGET_PERIODS,
  MATCH_TYPE_LABELS,
  MATCH_TYPES,
} from '../utils/constants';
import { formatCurrency, isFinance } from '../utils/helpers';

const { Option } = Select;
const { TextArea } = Input;

function Projects({ user }) {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [tagRules, setTagRules] = useState([]);
  const [form] = Form.useForm();
  const [tagRuleForm] = Form.useForm();
  const [editingProject, setEditingProject] = useState(null);
  const [editingTagRule, setEditingTagRule] = useState(null);
  const [tagRuleModalVisible, setTagRuleModalVisible] = useState(false);

  const canEdit = isFinance(user?.role);

  useEffect(() => {
    loadProjects();
  }, [pagination.page, pagination.pageSize]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await projectApi.list({
        page: pagination.page,
        pageSize: pagination.pageSize,
      });
      if (response.data.success) {
        setProjects(response.data.data);
        setPagination(p => ({
          ...p,
          total: response.data.pagination?.total || 0,
        }));
      }
    } catch (error) {
      message.error('加载项目列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingProject(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleOpenEdit = (project) => {
    setEditingProject(project);
    form.setFieldsValue({
      name: project.name,
      code: project.code,
      description: project.description,
      budgetAmount: parseFloat(project.budgetAmount),
      budgetPeriod: project.budgetPeriod,
    });
    setModalVisible(true);
  };

  const handleSave = async (values) => {
    try {
      if (editingProject) {
        await projectApi.update(editingProject.id, values);
        message.success('项目更新成功');
      } else {
        await projectApi.create(values);
        message.success('项目创建成功');
      }
      setModalVisible(false);
      loadProjects();
    } catch (error) {
      message.error(error.response?.data?.message || '保存失败');
    }
  };

  const handleDelete = async (projectId) => {
    try {
      await projectApi.delete(projectId);
      message.success('项目已停用');
      loadProjects();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleOpenTagRules = async (project) => {
    setSelectedProject(project);
    try {
      const response = await projectApi.getTagRules(project.id);
      if (response.data.success) {
        setTagRules(response.data.data);
      }
      setDrawerVisible(true);
    } catch (error) {
      message.error('加载标签规则失败');
    }
  };

  const handleOpenCreateTagRule = () => {
    setEditingTagRule(null);
    tagRuleForm.resetFields();
    setTagRuleModalVisible(true);
  };

  const handleOpenEditTagRule = (rule) => {
    setEditingTagRule(rule);
    tagRuleForm.setFieldsValue({
      tagKey: rule.tagKey,
      tagValue: rule.tagValue,
      matchType: rule.matchType,
      priority: rule.priority,
    });
    setTagRuleModalVisible(true);
  };

  const handleSaveTagRule = async (values) => {
    try {
      if (editingTagRule) {
        await projectApi.updateTagRule(editingTagRule.id, values);
        message.success('标签规则更新成功');
      } else {
        await projectApi.createTagRule(selectedProject.id, values);
        message.success('标签规则创建成功');
      }
      setTagRuleModalVisible(false);
      const response = await projectApi.getTagRules(selectedProject.id);
      if (response.data.success) {
        setTagRules(response.data.data);
      }
    } catch (error) {
      message.error('保存标签规则失败');
    }
  };

  const handleDeleteTagRule = async (ruleId) => {
    try {
      await projectApi.deleteTagRule(ruleId);
      message.success('标签规则删除成功');
      const response = await projectApi.getTagRules(selectedProject.id);
      if (response.data.success) {
        setTagRules(response.data.data);
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{record.code}</div>
        </div>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '预算金额',
      dataIndex: 'budgetAmount',
      key: 'budgetAmount',
      render: (v, record) => (
        <div>
          {formatCurrency(v)}
          <Tag color="blue" style={{ marginLeft: 8 }}>
            {BUDGET_PERIOD_LABELS[record.budgetPeriod]}
          </Tag>
        </div>
      ),
    },
    {
      title: '标签规则',
      dataIndex: 'tagRules',
      key: 'tagRules',
      render: rules => (
        <Tag color={rules?.length > 0 ? 'green' : 'orange'}>
          {rules?.length || 0} 条规则
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: isActive => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<TagOutlined />}
            onClick={() => handleOpenTagRules(record)}
          >
            标签规则
          </Button>
          {canEdit && (
            <>
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => handleOpenEdit(record)}
              >
                编辑
              </Button>
              <Popconfirm
                title="确定要停用此项目吗？"
                onConfirm={() => handleDelete(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" danger icon={<DeleteOutlined />}>
                  停用
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  const tagRuleColumns = [
    { title: '标签键', dataIndex: 'tagKey', key: 'tagKey' },
    { title: '标签值', dataIndex: 'tagValue', key: 'tagValue' },
    {
      title: '匹配方式',
      dataIndex: 'matchType',
      key: 'matchType',
      render: type => MATCH_TYPE_LABELS[type],
    },
    { title: '优先级', dataIndex: 'priority', key: 'priority' },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: isActive => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleOpenEditTagRule(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除此规则吗？"
            onConfirm={() => handleDeleteTagRule(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 className="page-header-title">项目管理</h2>
          <p className="page-header-desc">管理成本归属项目和标签匹配规则</p>
        </div>
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            新建项目
          </Button>
        )}
      </div>

      <Card>
        <Table
          dataSource={projects}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            onChange: (page, pageSize) => setPagination(p => ({ ...p, page, pageSize })),
          }}
        />
      </Card>

      <Modal
        title={editingProject ? '编辑项目' : '新建项目'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="项目名称"
                rules={[{ required: true, message: '请输入项目名称' }]}
              >
                <Input placeholder="请输入项目名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="code"
                label="项目编码"
                rules={[{ required: true, message: '请输入项目编码' }]}
              >
                <Input placeholder="请输入项目编码" disabled={!!editingProject} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="项目描述">
            <TextArea rows={3} placeholder="请输入项目描述" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="budgetAmount"
                label="预算金额"
                rules={[{ required: true, message: '请输入预算金额' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入预算金额"
                  min={0}
                  step={100}
                  formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/\¥\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="budgetPeriod"
                label="预算周期"
                initialValue={BUDGET_PERIODS.MONTHLY}
              >
                <Select>
                  {Object.entries(BUDGET_PERIOD_LABELS).map(([key, label]) => (
                    <Option key={key} value={key}>{label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                {editingProject ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={`标签规则 - ${selectedProject?.name}`}
        width={800}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        extra={
          canEdit && (
            <Button
              type="primary"
              icon={<PlusCircleOutlined />}
              onClick={handleOpenCreateTagRule}
            >
              新建规则
            </Button>
          )
        }
      >
        {selectedProject && (
          <div>
            <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="项目名称">{selectedProject.name}</Descriptions.Item>
              <Descriptions.Item label="项目编码">{selectedProject.code}</Descriptions.Item>
              <Descriptions.Item label="预算" span={2}>
                {formatCurrency(selectedProject.budgetAmount)} / {BUDGET_PERIOD_LABELS[selectedProject.budgetPeriod]}
              </Descriptions.Item>
            </Descriptions>
            <Divider orientation="left">标签匹配规则</Divider>
            <Table
              dataSource={tagRules}
              columns={tagRuleColumns}
              rowKey="id"
              pagination={false}
              locale={{ emptyText: <Empty description="暂无标签规则，请创建规则来匹配云资源标签" /> }}
            />
            <div style={{ marginTop: 16, padding: 16, background: '#fafafa', borderRadius: 8 }}>
              <h4 style={{ marginBottom: 8 }}>规则说明</h4>
              <ul style={{ margin: 0, paddingLeft: 20, color: '#666', fontSize: 13 }}>
                <li><b>精确匹配</b>: 标签值必须完全一致</li>
                <li><b>包含匹配</b>: 标签值包含指定内容即可</li>
                <li><b>前缀匹配</b>: 标签值以指定内容开头</li>
                <li><b>正则表达式</b>: 使用正则表达式匹配标签值</li>
                <li>优先级数字越大，规则越先匹配</li>
              </ul>
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        title={editingTagRule ? '编辑标签规则' : '新建标签规则'}
        open={tagRuleModalVisible}
        onCancel={() => setTagRuleModalVisible(false)}
        footer={null}
      >
        <Form form={tagRuleForm} layout="vertical" onFinish={handleSaveTagRule}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="tagKey"
                label="标签键 (Tag Key)"
                rules={[{ required: true, message: '请输入标签键' }]}
              >
                <Input placeholder="例如: Project, Service, Environment" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="tagValue"
                label="标签值 (Tag Value)"
                rules={[{ required: true, message: '请输入标签值' }]}
              >
                <Input placeholder="例如: ecommerce, gateway" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="matchType"
                label="匹配方式"
                initialValue={MATCH_TYPES.EXACT}
              >
                <Select>
                  {Object.entries(MATCH_TYPE_LABELS).map(([key, label]) => (
                    <Option key={key} value={key}>{label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="priority"
                label="优先级"
                initialValue={0}
                rules={[{ required: true, message: '请输入优先级' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} placeholder="数字越大优先级越高" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setTagRuleModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                {editingTagRule ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Projects;
