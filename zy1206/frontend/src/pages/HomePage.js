import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Empty,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { experimentApi } from '../api';
import dayjs from 'dayjs';

const { Option } = Select;

const CONSISTENCY_MODELS = [
  { value: 'strong', label: '强一致性 (Strong)', description: '所有节点同步写入，线性一致' },
  { value: 'eventual', label: '最终一致性 (Eventual)', description: '异步复制，存在短暂不一致' },
  { value: 'raft', label: 'Raft 算法', description: 'Leader 选举 + 日志复制，多数确认' },
  { value: 'paxos', label: 'Paxos 算法', description: 'Prepare + Accept 两阶段提交' },
];

function HomePage() {
  const navigate = useNavigate();
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadExperiments();
  }, []);

  const loadExperiments = async () => {
    setLoading(true);
    try {
      const result = await experimentApi.getAll();
      setExperiments(result.data || []);
    } catch (error) {
      message.error('加载实验列表失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExperiment = async (values) => {
    try {
      const result = await experimentApi.create({
        name: values.name,
        consistencyModel: values.consistencyModel,
        config: values.config || {},
      });
      message.success('实验创建成功！');
      setIsModalOpen(false);
      form.resetFields();
      loadExperiments();
      navigate(`/experiment/${result.data.id}`);
    } catch (error) {
      message.error('创建实验失败: ' + error.message);
    }
  };

  const getConsistencyTag = (model) => {
    const colors = {
      strong: 'green',
      eventual: 'orange',
      raft: 'blue',
      paxos: 'purple',
    };
    const labels = {
      strong: '强一致',
      eventual: '最终一致',
      raft: 'Raft',
      paxos: 'Paxos',
    };
    return <Tag color={colors[model]}>{labels[model] || model}</Tag>;
  };

  const columns = [
    {
      title: '实验名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <DatabaseOutlined />
          <span style={{ fontWeight: 'bold' }}>{text}</span>
        </Space>
      ),
    },
    {
      title: '一致性模型',
      dataIndex: 'consistency_model',
      key: 'consistency_model',
      render: (model) => getConsistencyTag(model),
    },
    {
      title: 'Seed',
      dataIndex: 'seed',
      key: 'seed',
      render: (seed) => <Tag color="cyan">{seed}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => navigate(`/experiment/${record.id}`)}
          >
            进入
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="实验列表"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsModalOpen(true)}
          >
            创建新实验
          </Button>
        }
      >
        {experiments.length === 0 ? (
          <Empty
            description="暂无实验，点击上方按钮创建第一个实验"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={experiments}
            rowKey="id"
            loading={loading}
          />
        )}
      </Card>

      <Modal
        title="创建新实验"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateExperiment}
        >
          <Form.Item
            name="name"
            label="实验名称"
            rules={[{ required: true, message: '请输入实验名称' }]}
          >
            <Input placeholder="例如：Raft 选举演练" />
          </Form.Item>

          <Form.Item
            name="consistencyModel"
            label="一致性模型"
            rules={[{ required: true, message: '请选择一致性模型' }]}
          >
            <Select placeholder="请选择一致性模型">
              {CONSISTENCY_MODELS.map((model) => (
                <Option key={model.value} value={model.value}>
                  <div>
                    <strong>{model.label}</strong>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {model.description}
                    </div>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="config" label="初始配置（可选）">
            <Input.TextArea
              rows={4}
              placeholder='{"nodeCount": 3, "autoCreateNodes": true}'
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                创建实验
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default HomePage;
