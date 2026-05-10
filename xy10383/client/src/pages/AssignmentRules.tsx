import React, { useEffect, useState } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Tag, 
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  message,
  Popconfirm,
  Row,
  Col,
  Descriptions,
  Divider
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ArrowUpOutlined
} from '@ant-design/icons';
import { rulesApi, salesApi } from '../services/api';
import { IAssignmentRule, ISalesPerson, CustomerLevel } from '../types';
import { REGION_OPTIONS, PRODUCT_OPTIONS, LEVEL_LABELS } from '../utils/constants';

const { Option } = Select;
const { TextArea } = Input;

const AssignmentRules: React.FC = () => {
  const [rules, setRules] = useState<IAssignmentRule[]>([]);
  const [salesPeople, setSalesPeople] = useState<ISalesPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<IAssignmentRule | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadRules();
    loadSalesPeople();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const response = await rulesApi.getAll();
      setRules(response.data.data);
    } catch (error) {
      message.error('加载分配规则失败');
    } finally {
      setLoading(false);
    }
  };

  const loadSalesPeople = async () => {
    try {
      const response = await salesApi.getAll();
      setSalesPeople(response.data.data);
    } catch (error) {
      message.error('加载销售人员失败');
    }
  };

  const handleAdd = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({
      enabled: true,
      priority: 0,
      conditions: {},
      actions: { autoAssign: true, needsReview: false }
    });
    setModalVisible(true);
  };

  const handleEdit = (rule: IAssignmentRule) => {
    setEditingRule(rule);
    form.setFieldsValue({
      name: rule.name,
      description: rule.description,
      enabled: rule.enabled,
      priority: rule.priority,
      conditions: rule.conditions,
      actions: rule.actions
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await rulesApi.delete(id);
      message.success('删除成功');
      loadRules();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingRule) {
        await rulesApi.update(editingRule.id, values);
        message.success('更新成功');
      } else {
        await rulesApi.create(values);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      loadRules();
    } catch (error) {
      message.error('保存失败');
    }
  };

  const columns = [
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      align: 'center' as const,
      render: (value: number) => (
        <span style={{ fontWeight: 'bold', color: value > 50 ? '#f5222d' : '#1890ff' }}>
          {value}
        </span>
      )
    },
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (text: string, record: IAssignmentRule) => (
        <Space>
          {text}
          {!record.enabled && <Tag color="default">已禁用</Tag>}
        </Space>
      )
    },
    {
      title: '匹配条件',
      key: 'conditions',
      width: 350,
      render: (_: any, record: IAssignmentRule) => {
        const conditions = [];
        if (record.conditions.regions?.length) {
          conditions.push(
            <span key="regions">
              <Tag color="blue">地区</Tag>
              {record.conditions.regions.join('、')}
            </span>
          );
        }
        if (record.conditions.products?.length) {
          conditions.push(
            <span key="products" style={{ marginLeft: 8 }}>
              <Tag color="green">产品</Tag>
              {record.conditions.products.slice(0, 2).join('、')}
              {record.conditions.products.length > 2 && `...+${record.conditions.products.length - 2}`}
            </span>
          );
        }
        if (record.conditions.customerLevels?.length) {
          conditions.push(
            <span key="levels" style={{ marginLeft: 8 }}>
              <Tag color="orange">等级</Tag>
              {record.conditions.customerLevels.map(l => LEVEL_LABELS[l]?.label || l).join('、')}
            </span>
          );
        }
        return conditions.length > 0 ? conditions : <span style={{ color: '#999' }}>无特殊条件</span>;
      }
    },
    {
      title: '执行动作',
      key: 'actions',
      width: 280,
      render: (_: any, record: IAssignmentRule) => {
        const actions = [];
        if (record.actions.assignTo?.length) {
          const salesNames = record.actions.assignTo
            .map(id => salesPeople.find(s => s.id === id)?.name || id)
            .join('、');
          actions.push(<Tag color="blue" key="assign">指定：{salesNames}</Tag>);
        }
        if (record.actions.autoAssign) {
          actions.push(<Tag color="green" key="auto">自动分配</Tag>);
        }
        if (record.actions.needsReview) {
          actions.push(<Tag color="orange" key="review">需复核</Tag>);
        }
        return <Space>{actions}</Space>;
      }
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean) => (
        enabled 
          ? <Tag icon={<CheckCircleOutlined />} color="success">启用</Tag>
          : <Tag icon={<CloseCircleOutlined />} color="default">禁用</Tag>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: any, record: IAssignmentRule) => (
        <Space>
          <Button 
            type="link" 
            size="small" 
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该规则？"
            description="删除后无法恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button 
              type="link" 
              size="small" 
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card>
        <Row justify="space-between" style={{ marginBottom: 16 }}>
          <Col>
            <h3 style={{ margin: 0 }}>分配规则管理</h3>
            <p style={{ margin: 0, color: '#666', fontSize: 12 }}>
              配置线索自动分配规则，优先级数字越大越先执行
            </p>
          </Col>
          <Col>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              添加规则
            </Button>
          </Col>
        </Row>

        <Card 
          type="inner" 
          title="规则说明" 
          style={{ marginBottom: 16, background: '#fafafa' }}
        >
          <Row gutter={[16, 8]}>
            <Col span={12}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="优先级">
                  数字越大，优先级越高，先执行匹配
                </Descriptions.Item>
                <Descriptions.Item label="匹配条件">
                  同时满足所有条件才会触发该规则
                </Descriptions.Item>
              </Descriptions>
            </Col>
            <Col span={12}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="指定分配">
                  优先分配给指定的销售人员
                </Descriptions.Item>
                <Descriptions.Item label="需复核">
                  不自动分配，需要人工手动分配
                </Descriptions.Item>
              </Descriptions>
            </Col>
          </Row>
        </Card>

        <Divider />

        <Table
          columns={columns}
          dataSource={rules.sort((a, b) => b.priority - a.priority)}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条规则`
          }}
        />
      </Card>

      {/* 编辑/新增弹窗 */}
      <Modal
        title={editingRule ? '编辑分配规则' : '添加分配规则'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="name"
                label="规则名称"
                rules={[{ required: true, message: '请输入规则名称' }]}
              >
                <Input placeholder="如：高价值客户优先分配" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="priority"
                label="优先级"
                rules={[{ required: true, message: '请输入优先级' }]}
              >
                <InputNumber 
                  min={0} 
                  max={100} 
                  style={{ width: '100%' }}
                  addonBefore={<ArrowUpOutlined />}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="description" label="规则描述">
                <TextArea rows={2} placeholder="描述该规则的用途和适用场景" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">匹配条件</Divider>
          
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name={['conditions', 'regions']}
                label="适用地区"
              >
                <Select
                  mode="multiple"
                  placeholder="选择适用地区（不选则不限）"
                  style={{ width: '100%' }}
                  allowClear
                >
                  {REGION_OPTIONS.map(region => (
                    <Option key={region} value={region}>{region}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name={['conditions', 'products']}
                label="适用产品"
              >
                <Select
                  mode="multiple"
                  placeholder="选择适用产品（不选则不限）"
                  style={{ width: '100%' }}
                  allowClear
                >
                  {PRODUCT_OPTIONS.map(product => (
                    <Option key={product} value={product}>{product}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name={['conditions', 'customerLevels']}
                label="适用客户等级"
              >
                <Select
                  mode="multiple"
                  placeholder="选择适用客户等级（不选则不限）"
                  style={{ width: '100%' }}
                  allowClear
                >
                  {Object.entries(LEVEL_LABELS).map(([key, val]) => (
                    <Option key={key} value={key}>{val.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">执行动作</Divider>
          
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name={['actions', 'assignTo']}
                label="指定分配给"
              >
                <Select
                  mode="multiple"
                  placeholder="选择指定的销售人员（不选则不指定）"
                  style={{ width: '100%' }}
                  allowClear
                >
                  {salesPeople.map(sales => (
                    <Option key={sales.id} value={sales.id}>
                      {sales.name} (负责：{sales.regions.join('、') || '不限'})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['actions', 'autoAssign']}
                label="自动分配"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['actions', 'needsReview']}
                label="需人工复核"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="enabled"
                label="启用状态"
                valuePropName="checked"
              >
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Col>
          </Row>

          <Card 
            size="small" 
            style={{ background: '#f5f5f5', marginTop: 16 }}
          >
            <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
              <strong>提示：</strong>如果"需人工复核"开启，则不会执行自动分配，该线索将进入"待复核"状态。
              如果"指定分配"和"自动分配"同时开启，则优先从指定人员中选择负载最低的进行分配。
            </p>
          </Card>
        </Form>
      </Modal>
    </div>
  );
};

export default AssignmentRules;
