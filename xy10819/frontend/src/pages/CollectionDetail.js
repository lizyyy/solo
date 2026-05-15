import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  List,
  message,
  Row,
  Col,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { collections, steps, batches, executions } from '../services/api';

function CollectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [collection, setCollection] = useState(null);
  const [stepList, setStepList] = useState([]);
  const [batchList, setBatchList] = useState([]);
  const [stepModalVisible, setStepModalVisible] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [collectionRes, stepsRes, batchesRes] = await Promise.all([
        collections.getById(id),
        steps.getByCollection(id),
        batches.getByCollection(id),
      ]);
      setCollection(collectionRes.data);
      setStepList(stepsRes.data);
      setBatchList(batchesRes.data);
    } catch (error) {
      message.error('加载数据失败');
    }
  };

  const handleAddStep = () => {
    setEditingStep(null);
    form.resetFields();
    form.setFieldsValue({
      method: 'GET',
      headers: [],
      assertions: [],
      order_index: stepList.length,
    });
    setStepModalVisible(true);
  };

  const handleEditStep = (record) => {
    setEditingStep(record);
    form.setFieldsValue({
      ...record,
      headers: record.headers || [],
      assertions: record.assertions || [],
    });
    setStepModalVisible(true);
  };

  const handleDeleteStep = async (stepId) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个步骤吗？',
      onOk: async () => {
        try {
          await steps.delete(stepId);
          message.success('删除成功');
          loadData();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleStepOk = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        collection_id: id,
      };
      if (editingStep) {
        await steps.update(editingStep.id, data);
        message.success('更新成功');
      } else {
        await steps.create(data);
        message.success('创建成功');
      }
      setStepModalVisible(false);
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleRun = async () => {
    try {
      const res = await executions.runCollection(id);
      message.success('执行已开始');
      navigate(`/batches/${res.data.batchId}`);
    } catch (error) {
      message.error('启动执行失败');
    }
  };

  const stepColumns = [
    {
      title: '序号',
      dataIndex: 'order_index',
      key: 'order_index',
      width: 80,
    },
    {
      title: '步骤名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      width: 100,
      render: (method) => (
        <Tag color={method === 'GET' ? 'green' : method === 'POST' ? 'blue' : 'orange'}>
          {method}
        </Tag>
      ),
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
    },
    {
      title: '断言数',
      key: 'assertions',
      width: 80,
      render: (_, record) => record.assertions?.length || 0,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditStep(record)}>
            编辑
          </Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteStep(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const batchColumns = [
    {
      title: '批次ID',
      dataIndex: 'id',
      key: 'id',
      render: (text) => text.substring(0, 8),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colorMap = {
          completed: 'success',
          failed: 'error',
          running: 'processing',
          pending: 'default',
        };
        return <Tag color={colorMap[status]}>{status}</Tag>;
      },
    },
    {
      title: '步骤',
      key: 'steps',
      render: (_, record) => `${record.passed_steps}/${record.total_steps}`,
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
        <Button type="link" onClick={() => navigate(`/batches/${record.id}`)}>
          查看详情
        </Button>
      ),
    },
  ];

  if (!collection) return <div>加载中...</div>;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/collections')}>
          返回列表
        </Button>
      </div>

      <Card
        title={collection.name}
        extra={
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleRun}>
            执行巡检
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <p>{collection.description}</p>
      </Card>

      <Row gutter={16}>
        <Col span={24}>
          <Card
            title="接口步骤"
            extra={
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddStep}>
                添加步骤
              </Button>
            }
            style={{ marginBottom: 16 }}
          >
            <Table columns={stepColumns} dataSource={stepList} rowKey="id" pagination={false} />
          </Card>

          <Card title="执行历史">
            <Table columns={batchColumns} dataSource={batchList} rowKey="id" />
          </Card>
        </Col>
      </Row>

      <Modal
        title={editingStep ? '编辑步骤' : '添加步骤'}
        open={stepModalVisible}
        onOk={handleStepOk}
        onCancel={() => setStepModalVisible(false)}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="步骤名称" rules={[{ required: true }]}>
            <Input placeholder="请输入步骤名称" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="method" label="请求方法" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: 'GET', value: 'GET' },
                    { label: 'POST', value: 'POST' },
                    { label: 'PUT', value: 'PUT' },
                    { label: 'DELETE', value: 'DELETE' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={18}>
              <Form.Item name="url" label="URL" rules={[{ required: true }]}>
                <Input placeholder="https://example.com/api" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="body" label="请求体 (JSON)">
            <Input.TextArea placeholder='{"key": "value"}' rows={3} />
          </Form.Item>
          <Divider>断言配置</Divider>
          <List
            dataSource={form.getFieldValue('assertions') || []}
            renderItem={(item, index) => (
              <List.Item>
                <Space>
                  <span>类型: {item.type}</span>
                  <span>期望值: {item.expected}</span>
                </Space>
              </List.Item>
            )}
          />
          <Form.Item name="order_index" label="排序" hidden>
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default CollectionDetail;
