import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Select,
  Button,
  Card,
  message,
  Space,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import apiService, { Owner } from '../services/api';

const { TextArea } = Input;
const { Option } = Select;

const CreateApi: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [owners, setOwners] = useState<Owner[]>([]);

  useEffect(() => {
    const fetchOwners = async () => {
      try {
        const response = await apiService.getOwners();
        if (response.data.success) {
          setOwners(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch owners');
      }
    };
    fetchOwners();
  }, []);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const response = await apiService.createApiEntry(values);
      if (response.data.success) {
        message.success('API 创建成功');
        navigate(`/apis/${response.data.data.id}`);
      }
    } catch (error: any) {
      message.error(error.response?.data?.details || 'API 创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
          返回列表
        </Button>
      </Space>

      <Card title="新建 API 条目">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            method: 'GET',
            permission_level: 'internal',
            version: '1.0.0',
          }}
        >
          <Form.Item
            name="name"
            label="API 名称"
            rules={[{ required: true, message: '请输入 API 名称' }]}
          >
            <Input placeholder="例如：获取用户信息" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={3} placeholder="简要描述这个 API 的用途" />
          </Form.Item>

          <Form.Item
            name="endpoint"
            label="端点路径"
            rules={[
              { required: true, message: '请输入端点路径' },
              { pattern: /^\/api/, message: '端点必须以 /api 开头' },
            ]}
          >
            <Input placeholder="/api/v1/users/:id" />
          </Form.Item>

          <Form.Item
            name="method"
            label="HTTP 方法"
            rules={[{ required: true, message: '请选择 HTTP 方法' }]}
          >
            <Select>
              <Option value="GET">GET</Option>
              <Option value="POST">POST</Option>
              <Option value="PUT">PUT</Option>
              <Option value="DELETE">DELETE</Option>
              <Option value="PATCH">PATCH</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="owner_id"
            label="负责人"
          >
            <Select placeholder="选择负责人" allowClear>
              {owners.map((owner) => (
                <Option key={owner.id} value={owner.id}>
                  {owner.name} ({owner.email})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="permission_level"
            label="权限等级"
            rules={[{ required: true, message: '请选择权限等级' }]}
          >
            <Select>
              <Option value="public">public - 公开访问</Option>
              <Option value="internal">internal - 内部访问</Option>
              <Option value="confidential">confidential - 机密访问</Option>
              <Option value="restricted">restricted - 受限访问</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="version"
            label="版本号"
            rules={[
              { required: true, message: '请输入版本号' },
              { pattern: /^\d+\.\d+\.\d+$/, message: '版本号格式必须为 x.y.z' },
            ]}
          >
            <Input placeholder="1.0.0" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />} block>
              创建 API
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default CreateApi;
