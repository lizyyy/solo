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
import { EyeOutlined, StarFilled } from '@ant-design/icons';
import apiService, { ApiEntry } from '../services/api';

const Favorites: React.FC = () => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<ApiEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const response = await apiService.getFavorites('user@example.com');
      if (response.data.success) {
        setFavorites(response.data.data);
      }
    } catch (error) {
      message.error('获取收藏列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
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
      <Card title="我的收藏">
        {favorites.length === 0 ? (
          <Empty description="暂无收藏的 API" />
        ) : (
          <List
            dataSource={favorites}
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
                  avatar={<StarFilled style={{ color: '#faad14', fontSize: 24 }} />}
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

export default Favorites;
