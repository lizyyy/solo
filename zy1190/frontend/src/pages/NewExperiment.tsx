import React, { useState, useEffect } from 'react';
import { 
  Card, Form, Input, InputNumber, Select, Button, message, 
  Typography, Row, Col, Space, Divider, Tag, Spin, Tabs
} from 'antd';
import { PlayCircleOutlined, SaveOutlined, ExperimentOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { createExperiment, runExperiment, getTests } from '../services/api';
import type { TestInfo } from '../types';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

interface FormValues {
  name: string;
  description: string;
  test_name: string;
  array_size: number;
  stride: number;
  thread_count: number;
  cache_line_size: number;
  iterations: number;
  seed: number;
  struct_layout: string;
  numa_node: number;
  tags: string[];
}

const NewExperiment: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tests, setTests] = useState<TestInfo[]>([]);
  const [selectedTest, setSelectedTest] = useState<string>('sequential');

  useEffect(() => {
    loadTests();
    
    const state = location.state as any;
    if (state?.defaultTest) {
      setSelectedTest(state.defaultTest);
      form.setFieldValue('test_name', state.defaultTest);
    }
  }, []);

  const loadTests = async () => {
    setLoading(true);
    try {
      const data = await getTests();
      setTests(data);
    } catch (error) {
      console.error('Failed to load tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const testDescriptions: Record<string, { desc: string; tips: string[] }> = {
    sequential: {
      desc: '顺序访问数组元素，最佳缓存利用场景。CPU 会预取相邻的缓存行，因此顺序访问几乎不会有 Cache Miss。',
      tips: [
        '数组越大，冷启动 Cache Miss 越多',
        '顺序访问是性能优化的理想状态',
        '实际命中率取决于数据大小和缓存容量'
      ]
    },
    stride: {
      desc: '以固定步长访问数组。当步长大于缓存行大小（64 字节）时，每次访问都需要加载新的缓存行，导致大量 Cache Miss。',
      tips: [
        '步长 = 1 时接近顺序访问性能',
        '步长 = 16 时（64 字节），每次访问不同缓存行',
        '步长越大，有效带宽越低'
      ]
    },
    random: {
      desc: '随机访问数组元素。由于空间局部性极差，每次访问几乎都会导致 Cache Miss，性能最差。',
      tips: [
        '随机访问是 Cache 性能的最差情况',
        '时间局部性和空间局部性都很差',
        '实际应用中应尽量避免随机访问大数组'
      ]
    },
    false_sharing: {
      desc: '多线程修改同一缓存行的不同变量。即使线程之间不共享数据，只要共享同一缓存行，就会因缓存一致性协议导致大量性能开销。',
      tips: [
        '使用 alignas(64) 让每个线程的变量独占缓存行',
        '将频繁修改的变量与只读变量分开',
        '考虑使用每个线程的私有副本，最后合并结果'
      ]
    },
    numa: {
      desc: 'NUMA 架构下本地内存与远端内存访问对比。在多处理器系统中，访问其他 NUMA 节点的内存会有额外延迟。',
      tips: [
        '尽量让线程访问本地 NUMA 节点的内存',
        '使用 numa_alloc_onnode() 显式分配内存',
        '跨 NUMA 节点的数据共享会带来显著性能损失'
      ]
    }
  };

  const handleSubmit = async (values: FormValues, runNow: boolean) => {
    setSubmitting(true);
    try {
      const config = {
        test_name: values.test_name,
        array_size: values.array_size,
        stride: values.stride,
        thread_count: values.thread_count,
        cache_line_size: values.cache_line_size,
        iterations: values.iterations,
        seed: values.seed,
        struct_layout: values.struct_layout,
        numa_node: values.numa_node
      };

      const experiment = await createExperiment({
        name: values.name,
        description: values.description,
        config: config,
        tags: values.tags
      });

      message.success('实验创建成功');

      if (runNow) {
        message.info('开始运行实验...');
        const result = await runExperiment(experiment.id);
        if (result.status === 'completed') {
          message.success('实验运行完成');
        }
      }

      navigate(`/experiments/${experiment.id}`);
    } catch (error) {
      message.error('操作失败');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const currentTestInfo = testDescriptions[selectedTest] || testDescriptions.sequential;

  const sizeOptions = [
    { value: 67108864, label: '64 MB' },
    { value: 134217728, label: '128 MB' },
    { value: 268435456, label: '256 MB' },
    { value: 536870912, label: '512 MB' },
    { value: 1073741824, label: '1 GB' }
  ];

  const strideOptions = [
    { value: 1, label: '1 (顺序)' },
    { value: 2, label: '2' },
    { value: 4, label: '4' },
    { value: 8, label: '8' },
    { value: 16, label: '16 (64字节/步)' },
    { value: 32, label: '32' },
    { value: 64, label: '64' }
  ];

  const layoutOptions = [
    { value: 'bad', label: '坏布局 (伪共享)' },
    { value: 'good', label: '好布局 (无伪共享)' },
    { value: 'mixed', label: '混合布局' }
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="新建实验">
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                test_name: selectedTest,
                array_size: 67108864,
                stride: 1,
                thread_count: 4,
                cache_line_size: 64,
                iterations: 10,
                seed: 42,
                struct_layout: 'bad',
                numa_node: 0,
                tags: []
              }}
              onValuesChange={(changed) => {
                if (changed.test_name) {
                  setSelectedTest(changed.test_name);
                }
              }}
            >
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item
                    name="name"
                    label="实验名称"
                    rules={[{ required: true, message: '请输入实验名称' }]}
                  >
                    <Input placeholder="例如：顺序访问 64MB 数组" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="description" label="描述">
                <Input.TextArea rows={2} placeholder="描述这个实验的目的..." />
              </Form.Item>

              <Divider>配置参数</Divider>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="test_name"
                    label="测试类型"
                    rules={[{ required: true, message: '请选择测试类型' }]}
                  >
                    <Select>
                      {tests.map(test => (
                        <Option key={test.name} value={test.name}>
                          {test.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                {selectedTest !== 'false_sharing' && (
                  <Col span={12}>
                    <Form.Item name="array_size" label="数组大小">
                      <Select options={sizeOptions} />
                    </Form.Item>
                  </Col>
                )}
              </Row>

              {(selectedTest === 'sequential' || selectedTest === 'stride') && (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="stride" label="访问步长">
                      <Select options={strideOptions} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="cache_line_size" label="缓存行大小 (字节)">
                      <InputNumber min={32} max={256} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              )}

              {selectedTest === 'random' && (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="cache_line_size" label="缓存行大小 (字节)">
                      <InputNumber min={32} max={256} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="seed" label="随机种子">
                      <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              )}

              {selectedTest === 'false_sharing' && (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="thread_count" label="线程数">
                      <InputNumber min={1} max={16} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="struct_layout" label="结构体布局">
                      <Select options={layoutOptions} />
                    </Form.Item>
                  </Col>
                </Row>
              )}

              {selectedTest === 'numa' && (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="numa_node" label="NUMA 节点">
                      <InputNumber min={0} max={8} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="iterations" label="迭代次数">
                      <InputNumber min={1} max={100} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              )}

              <Form.Item name="iterations" label="迭代次数">
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>

              <Divider />

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    loading={submitting}
                    onClick={() => form.validateFields().then(values => handleSubmit(values, true))}
                  >
                    创建并运行
                  </Button>
                  <Button
                    icon={<SaveOutlined />}
                    loading={submitting}
                    onClick={() => form.validateFields().then(values => handleSubmit(values, false))}
                  >
                    仅保存
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<><ExperimentOutlined /> 测试说明</>}>
            <Tabs activeKey={selectedTest} onChange={setSelectedTest}>
              {Object.entries(testDescriptions).map(([key, info]) => (
                <TabPane tab={<span style={{ textTransform: 'capitalize' }}>{key}</span>} key={key}>
                  <Paragraph>{info.desc}</Paragraph>
                  
                  <Text strong>关键要点：</Text>
                  <ul>
                    {info.tips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                </TabPane>
              ))}
            </Tabs>
          </Card>

          <Card title="预设配置" style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                block
                onClick={() => {
                  form.setFieldsValue({
                    name: '顺序访问基准测试',
                    test_name: 'sequential',
                    stride: 1,
                    array_size: 134217728
                  });
                  setSelectedTest('sequential');
                }}
              >
                顺序访问 (128MB)
              </Button>
              
              <Button
                block
                onClick={() => {
                  form.setFieldsValue({
                    name: '大跨步访问测试',
                    test_name: 'stride',
                    stride: 16,
                    array_size: 67108864
                  });
                  setSelectedTest('stride');
                }}
              >
                大跨步访问 (步长=16)
              </Button>
              
              <Button
                block
                onClick={() => {
                  form.setFieldsValue({
                    name: '伪共享对比实验 - 坏布局',
                    test_name: 'false_sharing',
                    thread_count: 4,
                    struct_layout: 'bad'
                  });
                  setSelectedTest('false_sharing');
                }}
              >
                伪共享 - 坏布局
              </Button>
              
              <Button
                block
                onClick={() => {
                  form.setFieldsValue({
                    name: '伪共享对比实验 - 好布局',
                    test_name: 'false_sharing',
                    thread_count: 4,
                    struct_layout: 'good'
                  });
                  setSelectedTest('false_sharing');
                }}
              >
                伪共享 - 好布局
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default NewExperiment;
