import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Button, Space, message, Alert, Typography } from 'antd';
import {
  UserOutlined,
  PartitionOutlined,
  FlagOutlined,
  HistoryOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  TeamOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import api from '../services/api';

const { Title, Text } = Typography;

function Dashboard({ onRefresh }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (error) {
      message.error('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadStats();
    if (onRefresh) onRefresh();
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Alert
          message="欢迎使用 Feature Flag 灰度规则演练台"
          description="这是一个用于演练和验证 Feature Flag 灰度规则的工具。你可以创建用户样本、定义 Segment 规则、配置 Feature Flags，然后通过演练功能验证规则是否按预期工作。"
          type="info"
          showIcon
          action={
            <Space>
              <Button type="primary" icon={<ReloadOutlined />} onClick={handleRefresh}>
                刷新数据
              </Button>
            </Space>
          }
        />
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="用户样本"
              value={stats?.users || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <div style={{ marginTop: 16 }}>
              <Link to="/users">
                <Button type="link" style={{ padding: 0 }}>
                  管理用户样本 →
                </Button>
              </Link>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="Segment 规则"
              value={stats?.segments || 0}
              prefix={<PartitionOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <div style={{ marginTop: 16 }}>
              <Link to="/segments">
                <Button type="link" style={{ padding: 0 }}>
                  管理 Segment →
                </Button>
              </Link>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="Feature Flags"
              value={stats?.flags || 0}
              prefix={<FlagOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <div style={{ marginTop: 16 }}>
              <Link to="/flags">
                <Button type="link" style={{ padding: 0 }}>
                  管理 Flags →
                </Button>
              </Link>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="审计记录"
              value={stats?.audit || 0}
              prefix={<HistoryOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
            <div style={{ marginTop: 16 }}>
              <Link to="/audit">
                <Button type="link" style={{ padding: 0 }}>
                  查看审计记录 →
                </Button>
              </Link>
            </div>
          </Card>
        </Col>
      </Row>

      <div style={{ marginTop: 32 }}>
        <Title level={4}>快速开始</Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card
              hoverable
              title={
                <Space>
                  <TeamOutlined style={{ color: '#1890ff' }} />
                  单用户演练
                </Space>
              }
              extra={
                <Link to="/evaluate/single">
                  <Button type="primary" icon={<PlayCircleOutlined />}>
                    开始演练
                  </Button>
                </Link>
              }
            >
              <Text type="secondary">
                选择一个用户，查看每个 Flag 的最终状态，并了解详细的规则链路解释。
                包括：命中了哪个 Segment、百分比分桶是多少、是否被依赖或 Kill Switch 覆盖。
              </Text>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card
              hoverable
              title={
                <Space>
                  <BarChartOutlined style={{ color: '#722ed1' }} />
                  批量演练
                </Space>
              }
              extra={
                <Link to="/evaluate/batch">
                  <Button type="primary" icon={<BarChartOutlined />}>
                    开始演练
                  </Button>
                </Link>
              }
            >
              <Text type="secondary">
                对所有用户进行批量演练，查看每个 Flag 的命中人数统计、冲突/被覆盖数量，
                并能筛选出异常用户。
              </Text>
            </Card>
          </Col>
        </Row>
      </div>

      <div style={{ marginTop: 32 }}>
        <Title level={4}>规则评估优先级</Title>
        <Alert
          message="Flag 评估顺序"
          description={
            <div>
              <ol>
                <li><strong>Kill Switch</strong>：如果启用，直接返回关闭（最高优先级）</li>
                <li><strong>依赖检查</strong>：检查依赖的 Flag 是否都已启用</li>
                <li><strong>全局开关</strong>：检查 Flag 的全局开关状态</li>
                <li><strong>Segment 匹配</strong>：如果配置了 Segment，检查用户是否匹配</li>
                <li><strong>百分比灰度</strong>：使用稳定哈希计算用户分桶，检查是否在灰度范围内</li>
              </ol>
            </div>
          }
          type="info"
          showIcon
        />
      </div>
    </div>
  );
}

export default Dashboard;
