import React, { useState } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Button,
  Space,
  Divider,
  Row,
  Col,
  message,
  Tabs,
  Radio,
  Table,
  Popconfirm,
  Tag
} from 'antd';
import {
  SaveOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  ImportOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import api from '../api';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

const defaultTrafficPlan = [
  { id: uuidv4(), type: 'write', key: 'user:1', value: '{"name": "Alice", "age": 25}', delayMs: 0 },
  { id: uuidv4(), type: 'read', key: 'user:1', value: '', delayMs: 100 },
  { id: uuidv4(), type: 'write', key: 'user:1', value: '{"name": "Alice", "age": 26}', delayMs: 200 },
  { id: uuidv4(), type: 'read', key: 'user:1', value: '', delayMs: 100 },
  { id: uuidv4(), type: 'read', key: 'user:1', value: '', delayMs: 0 }
];

const predefinedPlans = [
  {
    name: '一致性测试',
    description: '测试写入后读取的一致性问题',
    steps: [
      { id: uuidv4(), type: 'write', key: 'product:1', value: '{"price": 100}', delayMs: 0 },
      { id: uuidv4(), type: 'read', key: 'product:1', value: '', delayMs: 50 },
      { id: uuidv4(), type: 'write', key: 'product:1', value: '{"price": 200}', delayMs: 100 },
      { id: uuidv4(), type: 'read', key: 'product:1', value: '', delayMs: 0 },
      { id: uuidv4(), type: 'read', key: 'product:1', value: '', delayMs: 500 }
    ]
  },
  {
    name: '穿透测试',
    description: '测试不存在key的穿透问题',
    steps: [
      { id: uuidv4(), type: 'read', key: 'not_exist:1', value: '', delayMs: 0 },
      { id: uuidv4(), type: 'read', key: 'not_exist:1', value: '', delayMs: 100 },
      { id: uuidv4(), type: 'read', key: 'not_exist:2', value: '', delayMs: 100 },
      { id: uuidv4(), type: 'read', key: 'not_exist:3', value: '', delayMs: 100 },
      { id: uuidv4(), type: 'read', key: 'not_exist:1', value: '', delayMs: 100 }
    ]
  },
  {
    name: '雪崩测试',
    description: '测试同一时间大量key过期的雪崩问题',
    steps: [
      { id: uuidv4(), type: 'write', key: 'hot:1', value: '{"value": 1}', delayMs: 0 },
      { id: uuidv4(), type: 'write', key: 'hot:2', value: '{"value": 2}', delayMs: 0 },
      { id: uuidv4(), type: 'write', key: 'hot:3', value: '{"value": 3}', delayMs: 0 },
      { id: uuidv4(), type: 'write', key: 'hot:4', value: '{"value": 4}', delayMs: 0 },
      { id: uuidv4(), type: 'write', key: 'hot:5', value: '{"value": 5}', delayMs: 0 },
      { id: uuidv4(), type: 'read', key: 'hot:1', value: '', delayMs: 500 },
      { id: uuidv4(), type: 'read', key: 'hot:2', value: '', delayMs: 0 },
      { id: uuidv4(), type: 'read', key: 'hot:3', value: '', delayMs: 0 },
      { id: uuidv4(), type: 'read', key: 'hot:4', value: '', delayMs: 0 },
      { id: uuidv4(), type: 'read', key: 'hot:5', value: '', delayMs: 0 }
    ]
  }
];

const ExperimentCreate = () => {
  const [form] = Form.useForm();
  const [trafficPlan, setTrafficPlan] = useState(defaultTrafficPlan);
  const [preheatKeys, setPreheatKeys] = useState([]);
  const [preheatValues, setPreheatValues] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAddStep = () => {
    const newStep = {
      id: uuidv4(),
      type: 'read',
      key: '',
      value: '',
      delayMs: 0
    };
    setTrafficPlan([...trafficPlan, newStep]);
  };

  const handleDeleteStep = (id) => {
    setTrafficPlan(trafficPlan.filter(step => step.id !== id));
  };

  const handleStepChange = (id, field, value) => {
    setTrafficPlan(trafficPlan.map(step => 
      step.id === id ? { ...step, [field]: value } : step
    ));
  };

  const handleApplyPreset = (preset) => {
    setTrafficPlan(preset.steps.map(step => ({ ...step, id: uuidv4() })));
    message.success(`已应用预设: ${preset.name}`);
  };

  const handleImportJSON = () => {
    const json = prompt('请粘贴JSON格式的流量计划:');
    if (json) {
      try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
          setTrafficPlan(parsed.map(step => ({ ...step, id: uuidv4() })));
          message.success('导入成功');
        } else {
          message.error('JSON格式错误，需要是数组');
        }
      } catch (e) {
        message.error('JSON解析失败');
      }
    }
  };

  const handleCreate = async (values, runNow = false) => {
    try {
      setLoading(true);
      
      const config = {
        name: values.name,
        description: values.description,
        l1Capacity: values.l1Capacity,
        l1Ttl: values.l1Ttl,
        l1TtlJitter: values.l1TtlJitter,
        l2Capacity: values.l2Capacity,
        l2Ttl: values.l2Ttl,
        l2TtlJitter: values.l2TtlJitter,
        dbQueryLatencyMs: values.dbQueryLatencyMs,
        strategy: values.strategy,
        writeStrategy: values.writeStrategy,
        delayDoubleDelete: values.delayDoubleDelete,
        delayDeleteMs: values.delayDeleteMs,
        useMutex: values.useMutex,
        mutexTimeoutMs: values.mutexTimeoutMs,
        useBloomFilter: values.useBloomFilter,
        enablePreheating: values.enablePreheating,
        preheatKeys: values.enablePreheating ? preheatKeys : [],
        preheatValues: values.enablePreheating ? preheatValues : [],
        trafficPlan: trafficPlan
      };
      
      const response = await api.experiments.create(config);
      
      if (response.success) {
        const experimentId = response.data.id;
        message.success('实验创建成功');
        
        if (runNow) {
          try {
            await api.simulations.run(experimentId);
            message.success('实验运行完成');
          } catch (e) {
            message.error('运行实验失败');
          }
        }
        
        navigate(`/experiments/${experimentId}`);
      }
    } catch (error) {
      message.error('创建实验失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const trafficColumns = [
    {
      title: '序号',
      key: 'index',
      render: (_, __, index) => index + 1,
      width: 60
    },
    {
      title: '操作类型',
      dataIndex: 'type',
      key: 'type',
      render: (value, record) => (
        <Radio.Group 
          value={value} 
          onChange={(e) => handleStepChange(record.id, 'type', e.target.value)}
        >
          <Radio value="read">读取</Radio>
          <Radio value="write">写入</Radio>
          <Radio value="delete">删除</Radio>
        </Radio.Group>
      ),
      width: 200
    },
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      render: (value, record) => (
        <Input 
          value={value}
          onChange={(e) => handleStepChange(record.id, 'key', e.target.value)}
          placeholder="如: user:1, product:123"
        />
      )
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      render: (value, record) => record.type === 'write' ? (
        <Input 
          value={value}
          onChange={(e) => handleStepChange(record.id, 'value', e.target.value)}
          placeholder="JSON字符串，如: {\"name\":\"test\"}"
        />
      ) : '-'
    },
    {
      title: '延迟(ms)',
      dataIndex: 'delayMs',
      key: 'delayMs',
      render: (value, record) => (
        <InputNumber 
          value={value}
          onChange={(val) => handleStepChange(record.id, 'delayMs', val)}
          min={0}
          style={{ width: 100 }}
        />
      ),
      width: 120
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Popconfirm
          title="确定删除此步骤？"
          onConfirm={() => handleDeleteStep(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
      width: 80
    }
  ];

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        name: '',
        description: '',
        l1Capacity: 50,
        l1Ttl: 60,
        l1TtlJitter: 0,
        l2Capacity: 200,
        l2Ttl: 300,
        l2TtlJitter: 0,
        dbQueryLatencyMs: 100,
        strategy: 'cache-aside',
        writeStrategy: 'write-through',
        delayDoubleDelete: false,
        delayDeleteMs: 1000,
        useMutex: false,
        mutexTimeoutMs: 5000,
        useBloomFilter: false,
        enablePreheating: false
      }}
      onFinish={(values) => handleCreate(values, false)}
    >
      <Card 
        title="创建新实验"
        extra={
          <Space>
            <Button 
              type="primary" 
              icon={<SaveOutlined />}
              loading={loading}
              onClick={() => form.submit()}
            >
              保存实验
            </Button>
            <Button 
              type="primary" 
              icon={<PlayCircleOutlined />}
              loading={loading}
              onClick={() => form.validateFields().then(values => handleCreate(values, true))}
            >
              保存并运行
            </Button>
          </Space>
        }
      >
        <Tabs defaultActiveKey="basic">
          <TabPane tab="基本信息" key="basic">
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  name="name"
                  label="实验名称"
                  rules={[{ required: true, message: '请输入实验名称' }]}
                >
                  <Input placeholder="输入实验名称" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="description"
                  label="实验描述"
                >
                  <Input placeholder="输入实验描述" />
                </Form.Item>
              </Col>
            </Row>
          </TabPane>

          <TabPane tab="缓存层配置" key="cache">
            <Row gutter={24}>
              <Col span={8}>
                <Card size="small" title="L1 本地缓存">
                  <Form.Item name="l1Capacity" label="容量">
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="l1Ttl" label="TTL (秒)">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="l1TtlJitter" label="TTL抖动 (秒)">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" title="L2 Redis 缓存">
                  <Form.Item name="l2Capacity" label="容量">
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="l2Ttl" label="TTL (秒)">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="l2TtlJitter" label="TTL抖动 (秒)">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" title="数据库">
                  <Form.Item name="dbQueryLatencyMs" label="查询延迟 (ms)">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Card>
              </Col>
            </Row>
          </TabPane>

          <TabPane tab="缓存策略" key="strategy">
            <Row gutter={24}>
              <Col span={12}>
                <Card size="small" title="读取策略">
                  <Form.Item name="strategy" label="缓存策略">
                    <Select>
                      <Option value="cache-aside">Cache-Aside (旁路缓存模式)</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item name="useMutex" label="启用互斥锁">
                    <Switch />
                  </Form.Item>
                  <Form.Item name="mutexTimeoutMs" label="互斥锁超时 (ms)">
                    <InputNumber min={1000} style={{ width: '100%' }} />
                  </Form.Item>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="写入策略">
                  <Form.Item name="writeStrategy" label="写入策略">
                    <Select>
                      <Option value="write-through">Write-Through (直写模式)</Option>
                      <Option value="write-behind">Write-Behind (回写模式)</Option>
                      <Option value="cache-invalidate">Cache-Invalidate (缓存失效)</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item name="delayDoubleDelete" label="启用延迟双删">
                    <Switch />
                  </Form.Item>
                  <Form.Item name="delayDeleteMs" label="延迟删除时间 (ms)">
                    <InputNumber min={100} style={{ width: '100%' }} />
                  </Form.Item>
                </Card>
              </Col>
            </Row>

            <Divider />

            <Row gutter={24}>
              <Col span={8}>
                <Card size="small" title="布隆过滤器">
                  <Form.Item name="useBloomFilter" label="启用布隆过滤器">
                    <Switch />
                  </Form.Item>
                  <p style={{ fontSize: 12, color: '#999' }}>
                    防止缓存穿透，过滤不存在的key
                  </p>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" title="缓存预热">
                  <Form.Item name="enablePreheating" label="启用预热">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="预热Keys">
                    <TextArea 
                      rows={3}
                      placeholder="每行一个key，如:&#10;user:1&#10;user:2&#10;product:123"
                      value={preheatKeys.join('\n')}
                      onChange={(e) => setPreheatKeys(e.target.value.split('\n').filter(k => k))}
                    />
                  </Form.Item>
                  <Form.Item label="预热Values">
                    <TextArea 
                      rows={3}
                      placeholder="每行一个value，与keys对应:&#10;{\"name\":\"a\"}&#10;{\"name\":\"b\"}"
                      value={preheatValues.join('\n')}
                      onChange={(e) => setPreheatValues(e.target.value.split('\n').filter(v => v))}
                    />
                  </Form.Item>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" title="策略说明">
                  <h4>一致性风险场景:</h4>
                  <ul>
                    <li>Write-Through: 一致性最好</li>
                    <li>Cache-Invalidate: 可能有短暂窗口</li>
                    <li>Write-Behind: 一致性窗口最大</li>
                  </ul>
                  <h4>风险防护:</h4>
                  <ul>
                    <li>布隆过滤器: 防穿透</li>
                    <li>互斥锁: 防击穿</li>
                    <li>TTL抖动: 防空瀑</li>
                  </ul>
                </Card>
              </Col>
            </Row>
          </TabPane>

          <TabPane tab="流量计划" key="traffic">
            <Card 
              size="small"
              title="预设流量计划"
              style={{ marginBottom: 16 }}
            >
              <Space>
                {predefinedPlans.map((plan, index) => (
                  <Button 
                    key={index}
                    onClick={() => handleApplyPreset(plan)}
                  >
                    {plan.name}
                  </Button>
                ))}
                <Button icon={<ImportOutlined />} onClick={handleImportJSON}>
                  导入JSON
                </Button>
              </Space>
            </Card>

            <Card 
              size="small"
              title={`流量步骤 (${trafficPlan.length} 步)`}
              extra={
                <Button icon={<PlusOutlined />} onClick={handleAddStep}>
                  添加步骤
                </Button>
              }
            >
              <Table
                dataSource={trafficPlan}
                columns={trafficColumns}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: 800 }}
              />
            </Card>

            <Card size="small" title="流量计划预览 (JSON)" style={{ marginTop: 16 }}>
              <pre style={{ 
                maxHeight: 300, 
                overflow: 'auto',
                background: '#f5f5f5',
                padding: 12,
                borderRadius: 4
              }}>
                {JSON.stringify(trafficPlan, null, 2)}
              </pre>
            </Card>
          </TabPane>
        </Tabs>
      </Card>
    </Form>
  );
};

export default ExperimentCreate;
