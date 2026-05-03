import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Tag,
  Popconfirm,
  message,
  Card,
  Row,
  Col,
  Divider,
  Typography,
  Switch,
  Checkbox,
  Slider,
  Alert
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  FlagOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;
const { Title, Text } = Typography;

function FlagsPage({ onRefresh }) {
  const [flags, setFlags] = useState([]);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingFlag, setEditingFlag] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [flagsData, segmentsData] = await Promise.all([
        api.getAll(),
        api.segmentsApi.getAll()
      ]);
      setFlags(flagsData);
      setSegments(segmentsData);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingFlag(null);
    form.resetFields();
    form.setFieldsValue({
      enabled: true,
      killSwitch: false,
      percentage: null,
      segments: [],
      dependsOn: []
    });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingFlag(record);
    form.setFieldsValue({
      ...record,
      percentage: record.percentage
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(id);
      message.success('删除成功');
      loadData();
      if (onRefresh) onRefresh();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleToggle = async (id) => {
    try {
      await api.toggle(id);
      message.success('状态切换成功');
      loadData();
      if (onRefresh) onRefresh();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleToggleKillSwitch = async (id) => {
    try {
      await api.toggleKillSwitch(id);
      message.success('Kill Switch 切换成功');
      loadData();
      if (onRefresh) onRefresh();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingFlag) {
        await api.update(editingFlag.id, values);
        message.success('更新成功');
      } else {
        await api.create(values);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      loadData();
      if (onRefresh) onRefresh();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <strong>{text}</strong>
          <div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Key: <code>{record.key}</code>
            </Text>
          </div>
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (enabled, record) => (
        <Space>
          <Tag color={enabled ? 'green' : 'red'}>
            {enabled ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            {' '}{enabled ? '开启' : '关闭'}
          </Tag>
          <Switch
            checked={enabled}
            onChange={() => handleToggle(record.id)}
            size="small"
          />
        </Space>
      )
    },
    {
      title: 'Kill Switch',
      dataIndex: 'killSwitch',
      key: 'killSwitch',
      width: 120,
      render: (killSwitch, record) => (
        <Space>
          {killSwitch && (
            <Tag color="orange" icon={<WarningOutlined />}>
              已启用
            </Tag>
          )}
          <Switch
            checked={killSwitch}
            onChange={() => handleToggleKillSwitch(record.id)}
            size="small"
          />
        </Space>
      )
    },
    {
      title: '灰度策略',
      key: 'strategy',
      render: (_, record) => (
        <Space wrap>
          {record.segments?.length > 0 && (
            <Tag color="blue">
              Segment: {record.segments.length} 个
            </Tag>
          )}
          {record.percentage !== null && record.percentage !== undefined && (
            <Tag color="purple">
              百分比: {record.percentage}%
            </Tag>
          )}
          {record.dependsOn?.length > 0 && (
            <Tag color="cyan">
              依赖: {record.dependsOn.length} 个
            </Tag>
          )}
          {!record.segments?.length && record.percentage === null && !record.dependsOn?.length && (
            <Tag color="green">全量开放</Tag>
          )}
        </Space>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个 Flag 吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <FlagOutlined />
            Feature Flag 管理
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              添加 Flag
            </Button>
          </Space>
        }
      >
        <Alert
          message="Flag 评估优先级"
          description="Kill Switch (最高) → 依赖检查 → 全局开关 → Segment 匹配 → 百分比灰度"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={flags}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>

      <Modal
        title={editingFlag ? '编辑 Flag' : '新建 Flag'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
        width={650}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="key"
            label="Flag Key"
            rules={[
              { required: true, message: '请输入 Flag Key' },
              { pattern: /^[a-z_][a-z0-9_]*$/, message: 'Key 只能包含小写字母、数字和下划线，且不能以数字开头' }
            ]}
          >
            <Input placeholder="例如：new_dashboard_v2" disabled={!!editingFlag} />
          </Form.Item>

          <Form.Item
            name="name"
            label="显示名称"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="例如：新版仪表盘 v2" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={2} placeholder="描述这个 Flag 的用途" />
          </Form.Item>

          <Divider orientation="left">开关配置</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="enabled"
                label="全局开关"
                valuePropName="checked"
              >
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="killSwitch"
                label="Kill Switch"
                valuePropName="checked"
              >
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">灰度策略</Divider>

          <Form.Item
            name="segments"
            label="关联 Segment"
          >
            <Select
              mode="multiple"
              placeholder="选择 Segment（用户命中任一 Segment 即启用）"
              style={{ width: '100%' }}
              options={segments.map(s => ({ label: s.name, value: s.id }))}
            />
          </Form.Item>

          <Form.Item
            name="percentage"
            label="灰度百分比"
          >
            <div style={{ padding: '0 8px' }}>
              <Slider
                min={0}
                max={100}
                step={1}
                marks={{
                  0: '0%',
                  25: '25%',
                  50: '50%',
                  75: '75%',
                  100: '100%'
                }}
              />
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <Text type="secondary">使用稳定哈希算法，同一用户每次计算结果一致</Text>
              </div>
            </div>
          </Form.Item>

          <Form.Item
            name="dependsOn"
            label="依赖 Flag"
          >
            <Select
              mode="multiple"
              placeholder="选择依赖的 Flag（所有依赖必须都启用）"
              style={{ width: '100%' }}
              options={flags
                .filter(f => !editingFlag || f.id !== editingFlag.id)
                .map(f => ({ label: f.name, value: f.key }))}
            />
          </Form.Item>

          <Alert
            message="配置说明"
            description={
              <div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  <li>如果配置了 Segment，用户需要命中任一配置的 Segment</li>
                  <li>如果配置了百分比，会使用稳定哈希计算用户分桶</li>
                  <li>如果配置了依赖 Flag，所有依赖 Flag 都必须启用</li>
                  <li>如果什么都没配置，只要全局开关开启，所有用户都会命中</li>
                </ul>
              </div>
            }
            type="info"
            showIcon
          />
        </Form>
      </Modal>
    </div>
  );
}

export default FlagsPage;
