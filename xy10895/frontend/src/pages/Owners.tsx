import React, { useEffect, useState } from 'react';
import {
  List,
  Card,
  Button,
  Modal,
  Form,
  Input,
  message,
  Avatar,
  Space,
  Tag,
} from 'antd';
import { UserOutlined, PlusOutlined } from '@ant-design/icons';
import apiService, { Owner } from '../services/api';

const Owners: React.FC = () => {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchOwners = async () => {
    setLoading(true);
    try {
      const response = await apiService.getOwners();
      if (response.data.success) {
        setOwners(response.data.data);
      }
    } catch (error) {
      message.error('获取负责人列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOwners();
  }, []);

  const handleCreateOwner = async (values: Partial<Owner>) => {
    try {
      const response = await apiService.createOwner(values);
      if (response.data.success) {
        message.success('负责人创建成功');
        setModalVisible(false);
        form.resetFields();
        fetchOwners();
      }
    } catch (error: any) {
      message.error(error.response?.data?.details || '创建失败');
    }
  };

  return (
    <div>
      <Card
        title="负责人管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            添加负责人
          </Button>
        }
      >
        <List
          dataSource={owners}
          loading={loading}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Avatar size={48} icon={<UserOutlined />} />}
                title={
                  <Space>
                    <span style={{ fontWeight: 'bold', fontSize: 16 }}>{item.name}</span>
                    <Tag>{item.department || '未分配部门'}</Tag>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={0}>
                    <span>邮箱: {item.email}</span>
                    <span>负责 API 数量: {item.api_count}</span>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title="添加负责人"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateOwner}>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="张三" />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="zhangsan@company.com" />
          </Form.Item>

          <Form.Item
            name="department"
            label="部门"
          >
            <Input placeholder="技术部" />
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

export default Owners;
