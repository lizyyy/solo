import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  List,
  Card,
  Tag,
  Button,
  Space,
  Empty,
  message,
} from 'antd';
import { EyeOutlined, BellFilled } from '@ant-design/icons';
import apiService, { ApiEntry } from '../services/api';

const Subscriptions: React.FC = () => {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<ApiEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const response = await apiService.getSubscriptions('user@example.com');
      if (response.data.success) {
        setSubscriptions(response.data.data);
      }
    } catch (error) {
      message.error('获取订阅列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const methodColors: Record<string, string> = {
    GET: 'green',
    POST: 'blue',
    PUT: 'orange',
    DELETE: 'red',
    PATCH: 'purple',
  };

  return (
    <div>
      <Card title="我的订阅">
        {subscriptions.length === 0 ? (
          <Empty description="暂无订阅的 API" />
        ) : (
          <List
            dataSource={subscriptions}
            loading={loading}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => navigate(`/apis/${item.id}`)}
                  >
                    查看
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<BellFilled style={{ color: '#1890ff', fontSize: 24 }} />}
                  title={
                    <Space>
                      <span>{item.name}</span>
                      <Tag color={methodColors[item.method]}>{item.method}</Tag>
                      <code>{item.endpoint}</code>
                    </Space>
                  }
                  description={
                    <Space>
                      <span>负责人: {item.owner_name || '-'}</span>
                      <Tag>{item.permission_level}</Tag>
                      <span>版本: {item.version}</span>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
};

export default Subscriptions;
