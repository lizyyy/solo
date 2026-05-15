import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Descriptions,
  Card,
  Tag,
  Button,
  Space,
  Timeline,
  List,
  message,
  Modal,
  Form,
  Select,
  Input,
  Tabs,
  Typography,
} from 'antd';
import { ArrowLeftOutlined, StarOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import apiService, { ApiEntry, Permission, ExampleRequest, ChangeLog } from '../services/api';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

const statusColors: Record<string, string> = {
  draft: 'default',
  reviewing: 'orange',
  active: 'green',
  deprecated: 'red',
  archived: 'default',
};

const methodColors: Record<string, string> = {
  GET: 'green',
  POST: 'blue',
  PUT: 'orange',
  DELETE: 'red',
  PATCH: 'purple',
};

const ApiDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [apiDetail, setApiDetail] = useState<ApiEntry | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [examples, setExamples] = useState<ExampleRequest[]>([]);
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [exampleModalVisible, setExampleModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [exampleForm] = Form.useForm();

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await apiService.getApiDetail(parseInt(id));
      if (response.data.success) {
        const data = response.data.data;
        setApiDetail(data);
        setPermissions(data.permissions || []);
        setExamples(data.examples || []);
        setChangeLogs(data.changeLogs || []);
      }
    } catch (error) {
      message.error('获取 API 详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleStatusChange = async (values: { new_status: string; reason: string }) => {
    if (!id) return;
    try {
      const response = await apiService.updateApiStatus(parseInt(id), {
        ...values,
        changed_by: 'user@example.com',
      });
      if (response.data.success) {
        message.success('状态更新成功');
        setStatusModalVisible(false);
        form.resetFields();
        fetchDetail();
      }
    } catch (error: any) {
      message.error(error.response?.data?.details || '状态更新失败');
    }
  };

  const handleAddExample = async (values: Partial<ExampleRequest>) => {
    if (!id) return;
    try {
      const response = await apiService.addExampleRequest(parseInt(id), values);
      if (response.data.success) {
        message.success('示例添加成功');
        setExampleModalVisible(false);
        exampleForm.resetFields();
        fetchDetail();
      }
    } catch (error) {
      message.error('示例添加失败');
    }
  };

  const handleToggleFavorite = async () => {
    if (!id) return;
    try {
      const response = await apiService.toggleFavorite(parseInt(id), 'user@example.com');
      if (response.data.success) {
        message.success(response.data.data.isFavorited ? '已添加收藏' : '已取消收藏');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  if (!apiDetail) {
    return <div>加载中...</div>;
  }

  const tabItems = [
    {
      key: 'basic',
      label: '基本信息',
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Descriptions title="API 信息" bordered column={2}>
            <Descriptions.Item label="名称" span={2}>{apiDetail.name}</Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>{apiDetail.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="端点">
              <Space>
                <Tag color={methodColors[apiDetail.method]}>{apiDetail.method}</Tag>
                <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>{apiDetail.endpoint}</code>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColors[apiDetail.status]}>{apiDetail.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="负责人">{apiDetail.owner_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="权限等级">
              <Tag>{apiDetail.permission_level}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="版本">{apiDetail.version}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{apiDetail.created_at}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{apiDetail.updated_at}</Descriptions.Item>
          </Descriptions>

          <Card title="权限要求" extra={<Tag>{permissions.length} 条规则</Tag>}>
            <List
              dataSource={permissions}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Tag color="blue">{item.role}</Tag>}
                    title={item.description}
                    description={`添加于 ${item.created_at}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Space>
      ),
    },
    {
      key: 'examples',
      label: '示例请求',
      children: (
        <Card
          title="示例请求列表"
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setExampleModalVisible(true)}>
              添加示例
            </Button>
          }
        >
          <List
            dataSource={examples}
            renderItem={(item) => (
              <List.Item>
                <Card size="small" title={item.title} style={{ width: '100%' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {item.headers && (
                      <div>
                        <Text strong>Headers:</Text>
                        <Paragraph code>{item.headers}</Paragraph>
                      </div>
                    )}
                    {item.request_body && (
                      <div>
                        <Text strong>请求体:</Text>
                        <Paragraph code>{item.request_body}</Paragraph>
                      </div>
                    )}
                    {item.response_body && (
                      <div>
                        <Text strong>响应体:</Text>
                        <Paragraph code>{item.response_body}</Paragraph>
                      </div>
                    )}
                  </Space>
                </Card>
              </List.Item>
            )}
          />
        </Card>
      ),
    },
    {
      key: 'timeline',
      label: '变更时间线',
      children: (
        <Card title="变更历史">
          <Timeline mode="left">
            {changeLogs.map((log) => (
              <Timeline.Item key={log.id}>
                <Space direction="vertical">
                  <Text strong>{log.description}</Text>
                  <Text type="secondary">
                    变更类型: {log.change_type} | 操作人: {log.changed_by}
                  </Text>
                  <Text type="secondary">{log.created_at}</Text>
                  {log.old_value && (
                    <div>
                      <Text type="warning">原值: {log.old_value}</Text>
                    </div>
                  )}
                  {log.new_value && (
                    <div>
                      <Text type="success">新值: {log.new_value}</Text>
                    </div>
                  )}
                </Space>
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
          返回列表
        </Button>
        <Button icon={<StarOutlined />} onClick={handleToggleFavorite}>
          收藏
        </Button>
        <Button type="primary" icon={<EditOutlined />} onClick={() => setStatusModalVisible(true)}>
          更新状态
        </Button>
      </Space>

      <Tabs defaultActiveKey="basic" items={tabItems} />

      <Modal
        title="更新 API 状态"
        open={statusModalVisible}
        onCancel={() => setStatusModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleStatusChange}>
          <Form.Item
            name="new_status"
            label="新状态"
            rules={[{ required: true, message: '请选择新状态' }]}
          >
            <Select>
              <Select.Option value="draft">草稿</Select.Option>
              <Select.Option value="reviewing">审核中</Select.Option>
              <Select.Option value="active">活跃</Select.Option>
              <Select.Option value="deprecated">废弃</Select.Option>
              <Select.Option value="archived">归档</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="reason"
            label="变更原因"
            rules={[{ required: true, message: '请输入变更原因' }]}
          >
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              提交
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加示例请求"
        open={exampleModalVisible}
        onCancel={() => setExampleModalVisible(false)}
        footer={null}
      >
        <Form form={exampleForm} layout="vertical" onFinish={handleAddExample}>
          <Form.Item
            name="title"
            label="示例标题"
            rules={[{ required: true, message: '请输入示例标题' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="headers" label="请求头">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="request_body" label="请求体">
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item name="response_body" label="响应体">
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              添加
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ApiDetail;
