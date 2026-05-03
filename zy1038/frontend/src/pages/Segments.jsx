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
  Typography
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  PartitionOutlined,
  MinusCircleOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;
const { Title, Text } = Typography;

const CONDITION_FIELDS = [
  { value: 'region', label: '地区 (region)' },
  { value: 'accountType', label: '账号类型 (accountType)' },
  { value: 'tags', label: '标签 (tags)' },
  { value: 'registerDays', label: '注册天数 (registerDays)' },
  { value: 'name', label: '姓名 (name)' },
  { value: 'email', label: '邮箱 (email)' }
];

const OPERATORS = [
  { value: 'equals', label: '等于' },
  { value: 'not_equals', label: '不等于' },
  { value: 'in', label: '在列表中' },
  { value: 'not_in', label: '不在列表中' },
  { value: 'greater_than', label: '大于' },
  { value: 'greater_than_or_equals', label: '大于等于' },
  { value: 'less_than', label: '小于' },
  { value: 'less_than_or_equals', label: '小于等于' },
  { value: 'contains', label: '包含' },
  { value: 'has_tag', label: '有标签' }
];

function SegmentsPage({ onRefresh }) {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSegment, setEditingSegment] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadSegments();
  }, []);

  const loadSegments = async () => {
    setLoading(true);
    try {
      const data = await api.getAll();
      setSegments(data);
    } catch (error) {
      message.error('加载 Segment 列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingSegment(null);
    form.resetFields();
    form.setFieldsValue({ conditions: [{ field: 'region', operator: 'equals', value: '' }] });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingSegment(record);
    form.setFieldsValue({
      ...record,
      conditions: record.conditions || [{ field: 'region', operator: 'equals', value: '' }]
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(id);
      message.success('删除成功');
      loadSegments();
      if (onRefresh) onRefresh();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingSegment) {
        await api.update(editingSegment.id, values);
        message.success('更新成功');
      } else {
        await api.create(values);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      loadSegments();
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
      render: (text) => <strong>{text}</strong>
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '条件数量',
      dataIndex: 'conditions',
      key: 'conditionCount',
      render: (conditions) => (
        <Tag color="blue">{(conditions || []).length} 个条件</Tag>
      )
    },
    {
      title: '条件预览',
      dataIndex: 'conditions',
      key: 'conditions',
      render: (conditions) => (
        <Space wrap>
          {(conditions || []).map((cond, index) => (
            <Tag key={index} className="condition-badge">
              {cond.field} {cond.operator} {String(cond.value)}
            </Tag>
          ))}
        </Space>
      )
    },
    {
      title: '操作',
      key: 'action',
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
            title="确定要删除这个 Segment 吗？"
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
            <PartitionOutlined />
            Segment 规则管理
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadSegments}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              添加 Segment
            </Button>
          </Space>
        }
      >
        <Alert
          message="关于 Segment"
          description="Segment 是一组条件的组合，用于定义用户群体。所有条件都必须同时满足（AND 逻辑）。可用字段包括：地区、账号类型、标签、注册天数等。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={segments}
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
        title={editingSegment ? '编辑 Segment' : '新建 Segment'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入 Segment 名称' }]}
          >
            <Input placeholder="例如：中国付费用户" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={2} placeholder="描述这个 Segment 的用途" />
          </Form.Item>

          <Divider orientation="left">条件配置</Divider>
          
          <Alert
            message="条件逻辑"
            description="所有条件使用 AND 逻辑，用户必须满足所有条件才能命中此 Segment。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.List name="conditions">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name, 'field']}
                      rules={[{ required: true, message: '请选择字段' }]}
                    >
                      <Select placeholder="字段" style={{ width: 180 }}>
                        {CONDITION_FIELDS.map(f => (
                          <Option key={f.value} value={f.value}>{f.label}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'operator']}
                      rules={[{ required: true, message: '请选择操作符' }]}
                    >
                      <Select placeholder="操作符" style={{ width: 140 }}>
                        {OPERATORS.map(op => (
                          <Option key={op.value} value={op.value}>{op.label}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'value']}
                      rules={[{ required: true, message: '请输入值' }]}
                    >
                      <Input placeholder="值" style={{ width: 180 }} />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} />
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    添加条件
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}

export default SegmentsPage;
