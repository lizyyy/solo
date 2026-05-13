import React, { useEffect, useState } from 'react';
import { Row, Col, Card, List, Typography, Tag, Spin, Empty } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import StatCards from '../components/StatCards';
import ExceptionBoard from '../components/ExceptionBoard';
import TypeChart from '../components/TypeChart';
import { statisticsApi } from '../api';
import { ReleaseRequest } from '../types';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<any>(null);
  const [recentRequests, setRecentRequests] = useState<ReleaseRequest[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [typeData, setTypeData] = useState<any[]>([]);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const response = await statisticsApi.getDashboard();
      const data = response.data.data;
      setStatistics(data.overview);
      setRecentRequests(data.recentRequests);
      setExceptions(data.exceptions);
      setTypeData(data.statusByType);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'gold',
      approved: 'blue',
      processing: 'cyan',
      completed: 'green',
      rolled_back: 'red',
      rejected: 'volcano'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      pending: '待审批',
      approved: '已批准',
      processing: '发布中',
      completed: '已完成',
      rolled_back: '已回滚',
      rejected: '已拒绝'
    };
    return texts[status] || status;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={2}>云资源发布审批控制台</Title>
      
      {statistics && <StatCards data={statistics} />}
      
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={16}>
          <Card
            title={
              <span>
                <FileTextOutlined style={{ marginRight: 8 }} />
                最近申请
              </span>
            }
          >
            <List
              dataSource={recentRequests}
              renderItem={(item) => (
                <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <List.Item.Meta
                    avatar={<FileTextOutlined style={{ fontSize: '24px', color: '#1890ff' }} />}
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <Text strong>{item.title}</Text>
                          <Tag color={getStatusColor(item.status)} style={{ marginLeft: 8 }}>
                            {getStatusText(item.status)}
                          </Tag>
                        </div>
                        <Text type="secondary">{item.requestId}</Text>
                      </div>
                    }
                    description={
                      <div>
                        <Text ellipsis style={{ display: 'block', marginBottom: 4 }}>
                          {item.description}
                        </Text>
                        <div style={{ display: 'flex', gap: 24, fontSize: '12px', color: '#999' }}>
                          <span>申请人: {item.applicant}</span>
                          <span>部门: {item.department}</span>
                          <span>创建时间: {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss')}</span>
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
              locale={{ emptyText: <Empty description="暂无申请数据" /> }}
            />
          </Card>
        </Col>
        
        <Col span={8}>
          <ExceptionBoard exceptions={exceptions} />
        </Col>
      </Row>
      
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <TypeChart data={typeData} />
        </Col>
        <Col span={12}>
          <Card title="部门分布">
            <Empty description="暂无数据" />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
