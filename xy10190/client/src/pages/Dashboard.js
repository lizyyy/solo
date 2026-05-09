import React, { useState, useEffect } from 'react';
import { Row, Col, Card, List, Tag, Descriptions, Button } from 'antd';
import { FileTextOutlined, TeamOutlined, ClockCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import { getDashboardData, exportOffers } from '../services/api';
import { formatDateTime } from '../utils/constants';

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await getDashboardData();
      if (response.success) {
        setData(response.data);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const actionLabels = {
    create_candidate: '创建候选人',
    update_candidate: '更新候选人',
    delete_candidate: '删除候选人',
    create_offer: '创建 Offer',
    update_offer: '更新 Offer',
    submit_offer: '提交审批',
    approve_offer: '审批通过',
    reject_offer: '审批拒绝',
    withdraw_offer: '撤回 Offer',
    accept_offer: '确认接受',
    delete_offer: '删除 Offer'
  };

  if (loading || !data) {
    return <div>加载中...</div>;
  }

  return (
    <div className="page-container">
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card className="dashboard-card">
            <div className="dashboard-number">{data.totalOffers}</div>
            <div className="dashboard-label">
              <FileTextOutlined style={{ marginRight: 4 }} />
              总 Offer 数
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="dashboard-card">
            <div className="dashboard-number" style={{ color: '#52c41a' }}>
              {data.pendingApprovals}
            </div>
            <div className="dashboard-label">
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              待我审批
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="dashboard-card">
            <div className="dashboard-number" style={{ color: '#722ed1' }}>
              {data.totalCandidates}
            </div>
            <div className="dashboard-label">
              <TeamOutlined style={{ marginRight: 4 }} />
              候选人总数
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="dashboard-card">
            <Button 
              type="primary" 
              icon={<DownloadOutlined />}
              onClick={() => exportOffers()}
              size="large"
            >
              导出 Offer 报表
            </Button>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="Offer 状态分布">
            <Descriptions column={2} bordered size="small">
              {Object.entries(data.offersByStatus).map(([status, count]) => (
                <Descriptions.Item key={status} label={status}>
                  <Tag color="blue">{count}</Tag>
                </Descriptions.Item>
              ))}
            </Descriptions>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="候选人状态分布">
            <Descriptions column={2} bordered size="small">
              {Object.entries(data.candidatesByStatus).map(([status, count]) => (
                <Descriptions.Item key={status} label={status}>
                  <Tag color="green">{count}</Tag>
                </Descriptions.Item>
              ))}
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="最近活动">
            <List
              dataSource={data.recentActivity}
              renderItem={(log) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <span>
                        <strong>{log.user_name}</strong>
                        <Tag style={{ marginLeft: 8 }}>{actionLabels[log.action] || log.action}</Tag>
                      </span>
                    }
                    description={
                      <span style={{ color: '#666' }}>
                        {log.entity_type && `${log.entity_type}: `}
                        {formatDateTime(log.created_at)}
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
}

export default Dashboard;
