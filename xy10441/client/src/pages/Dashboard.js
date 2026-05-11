import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, List, Tag, Button, Alert, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  ProjectOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ projects: 0, versions: 0, confirmed: 0, pending: 0 });
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [recentProjects, setRecentProjects] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/projects'),
      api.get('/proposals/pending-attachments'),
      api.get('/proposals/confirmed-proposals')
    ]).then(([projectsRes, attachmentsRes, confirmedRes]) => {
      const projects = projectsRes.data;
      let totalVersions = 0;
      let confirmed = 0;
      projects.forEach(p => {
        totalVersions += p.version_count || 0;
        confirmed += p.confirmed_count || 0;
      });
      
      setStats({
        projects: projects.length,
        versions: totalVersions,
        confirmed: confirmedRes.data.length,
        pending: attachmentsRes.data.length
      });
      
      setPendingAttachments(attachmentsRes.data);
      setRecentProjects(projects.slice(0, 5));
    });
  }, []);

  const getStatusTag = (isConfirmed, isVoided) => {
    if (isVoided) return <Tag color="red">已作废</Tag>;
    if (isConfirmed) return <Tag color="green" icon={<CheckCircleOutlined />}>有效版本</Tag>;
    return <Tag color="orange">草稿</Tag>;
  };

  return (
    <div>
      <Title level={3}>工作台</Title>
      
      {stats.pending > 0 && (
        <Alert
          message="待补附件提醒"
          description={`您有 ${stats.pending} 个必需附件尚未上传，请及时处理`}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 24 }}
          action={
            <Button size="small" type="primary" onClick={() => navigate('/projects')}>
              查看详情
            </Button>
          }
        />
      )}

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="项目总数"
              value={stats.projects}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="方案版本数"
              value={stats.versions}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已确认有效方案"
              value={stats.confirmed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待补附件"
              value={stats.pending}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card 
            title="待补附件列表" 
            extra={
              <Button type="link" onClick={() => navigate('/projects')}>
                全部 <ArrowRightOutlined />
              </Button>
            }
          >
            {pendingAttachments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                <CheckCircleOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <p>暂无待补附件</p>
              </div>
            ) : (
              <List
                dataSource={pendingAttachments}
                renderItem={item => (
                  <List.Item
                    actions={[
                      <Button type="link" size="small" onClick={() => navigate(`/projects`)}>
                        去处理
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<Tag color="orange">必需</Tag>}
                      title={item.file_name}
                      description={
                        <span>
                          <Text strong>{item.customer_name}</Text> - {item.project_name}
                          <br />
                          版本 {item.version_number}：{item.version_name}
                        </span>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        <Col span={12}>
          <Card 
            title="最近项目" 
            extra={
              <Button type="link" onClick={() => navigate('/projects')}>
                全部 <ArrowRightOutlined />
              </Button>
            }
          >
            <List
              dataSource={recentProjects}
              renderItem={item => (
                <List.Item
                  actions={[
                    <Button type="link" size="small" onClick={() => navigate(`/projects/${item.id}`)}>
                      查看
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Tag color="blue">{item.status}</Tag>}
                    title={item.name}
                    description={
                      <span>
                        客户：{item.customer_name}
                        <br />
                        <Text type="secondary">
                          {dayjs(item.updated_at).format('YYYY-MM-DD HH:mm')} · 
                          {item.version_count} 个版本 · 
                          {item.confirmed_count} 个已确认
                        </Text>
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
