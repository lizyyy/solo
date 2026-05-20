import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  message,
  InputNumber,
  Divider,
  List,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { ReleaseOrderCreate, EnvironmentType } from '../types';
import { releaseOrderApi } from '../api';

const { TextArea } = Input;

const environmentOptions = [
  { label: '开发', value: EnvironmentType.DEV },
  { label: '测试', value: EnvironmentType.TEST },
  { label: '预发布', value: EnvironmentType.STAGING },
  { label: '生产', value: EnvironmentType.PROD },
];

export default function CreateReleaseOrder() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [checkItems, setCheckItems] = useState<{ name: string; description?: string }[]>([]);
  const [approvers, setApprovers] = useState<string[]>([]);
  const [newApprover, setNewApprover] = useState('');

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const data: ReleaseOrderCreate = {
        ...values,
        check_items: checkItems,
        approvers: approvers,
      };
      const response = await releaseOrderApi.create(data);
      message.success('发布单创建成功');
      navigate(`/release/${response.data.id}`);
    } catch (error) {
      message.error('创建失败');
    } finally {
      setLoading(false);
    }
  };

  const addCheckItem = () => {
    setCheckItems([...checkItems, { name: '', description: '' }]);
  };

  const updateCheckItem = (index: number, field: string, value: string) => {
    const newItems = [...checkItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setCheckItems(newItems);
  };

  const removeCheckItem = (index: number) => {
    setCheckItems(checkItems.filter((_, i) => i !== index));
  };

  const addApprover = () => {
    if (newApprover.trim() && !approvers.includes(newApprover.trim())) {
      setApprovers([...approvers, newApprover.trim()]);
      setNewApprover('');
    }
  };

  const removeApprover = (approver: string) => {
    setApprovers(approvers.filter((a) => a !== approver));
  };

  return (
    <div>
      <Card title="新建发布单">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ timeout_hours: 24 }}
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入发布单标题" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <TextArea rows={4} placeholder="请输入发布描述" />
          </Form.Item>

          <Form.Item name="version" label="版本号">
            <Input placeholder="例如: v1.0.0" />
          </Form.Item>

          <Form.Item
            name="environment"
            label="环境"
            rules={[{ required: true, message: '请选择环境' }]}
          >
            <Select options={environmentOptions} placeholder="请选择部署环境" />
          </Form.Item>

          <Form.Item
            name="created_by"
            label="创建人"
            rules={[{ required: true, message: '请输入创建人' }]}
          >
            <Input placeholder="请输入创建人姓名" />
          </Form.Item>

          <Form.Item name="timeout_hours" label="超时时间(小时)">
            <InputNumber min={1} max={168} style={{ width: '100%' }} placeholder="默认24小时" />
          </Form.Item>

          <Divider>检查项</Divider>

          <List
            dataSource={checkItems}
            renderItem={(item, index) => (
              <List.Item
                actions={[
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeCheckItem(index)}
                  >
                    删除
                  </Button>,
                ]}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Input
                    placeholder="检查项名称"
                    value={item.name}
                    onChange={(e) => updateCheckItem(index, 'name', e.target.value)}
                  />
                  <Input
                    placeholder="检查项描述(可选)"
                    value={item.description}
                    onChange={(e) => updateCheckItem(index, 'description', e.target.value)}
                  />
                </Space>
              </List.Item>
            )}
          />

          <Button type="dashed" onClick={addCheckItem} icon={<PlusOutlined />} block>
            添加检查项
          </Button>

          <Divider>审批人</Divider>

          <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
            <Input
              placeholder="输入审批人"
              value={newApprover}
              onChange={(e) => setNewApprover(e.target.value)}
              onPressEnter={addApprover}
            />
            <Button type="primary" onClick={addApprover} icon={<PlusOutlined />}>
              添加
            </Button>
          </Space.Compact>

          <List
            dataSource={approvers}
            renderItem={(approver) => (
              <List.Item
                actions={[
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => removeApprover(approver)}
                  >
                    删除
                  </Button>,
                ]}
              >
                {approver}
              </List.Item>
            )}
          />

          <Divider />

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                创建发布单
              </Button>
              <Button onClick={() => navigate('/')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
