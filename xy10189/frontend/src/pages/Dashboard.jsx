import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Progress, Table, Tag, Button } from 'antd';
import { 
  UserOutlined, 
  ShoppingCartOutlined, 
  RollbackOutlined, 
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { reportApi } from '../utils/api';

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, alertsRes, customersRes] = await Promise.all([
        reportApi.getStatistics(),
        reportApi.getRiskAlerts({ unread_only: true, limit: 10 }),
        fetch('/api/customers').then(res => res.json())
      ]);

      if (statsRes.data.success) {
        setStats(statsRes.data.data);
      }
      if (alertsRes.data.success) {
        setAlerts(alertsRes.data.data);
      }
      if (customersRes.success) {
        setCustomers(customersRes.data.slice(0, 5));
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'high': return 'red';
      case 'medium': return 'orange';
      default: return 'green';
    }
  };

  const getProgressColor = (ratio) => {
    if (ratio >= 90) return 'progress-high';
    if (ratio >= 70) return 'progress-medium';
    return 'progress-low';
  };

  const customerColumns = [
    {
      title: '客户名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <a onClick={() => navigate(`/customers/${record.id}`)}>{text}</a>
      )
    },
    {
      title: '额度使用率',
      dataIndex: 'usage_ratio',
      key: 'usage_ratio',
      width: 200,
      render: (ratio) => (
        <div className={getProgressColor(ratio)}>
          <Progress percent={Number(ratio.toFixed(1))} showInfo={true} />
        </div>
      )
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      key: 'risk_level',
      render: (level) => (
        <Tag color={getRiskColor(level)}>
          {level === 'high' ? '高风险' : level === 'medium' ? '中风险' : '低风险'}
        </Tag>
      )
    }
  ];

  if (!stats) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card>
            <Statistic 
              title="客户总数" 
              value={stats.overview.total_customers} 
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="订单总数" 
              value={stats.overview.total_orders} 
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="退货单数" 
              value={stats.overview.total_returns} 
              prefix={<RollbackOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="待审批调额" 
              value={stats.overview.pending_adjustments} 
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="额度总览">
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: '#666' }}>总额度</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }}>
                    ¥{stats.credit_summary.total_limit.toLocaleString()}
                  </div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: '#666' }}>已用额度</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#fa541c' }}>
                    ¥{stats.credit_summary.total_used.toLocaleString()}
                  </div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: '#666' }}>可用额度</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}>
                    ¥{stats.credit_summary.total_available.toLocaleString()}
                  </div>
                </div>
              </Col>
            </Row>
            <div style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 8 }}>
                整体使用率: <strong>{stats.credit_summary.usage_ratio.toFixed(2)}%</strong>
              </div>
              <Progress 
                percent={Number(stats.credit_summary.usage_ratio.toFixed(2))} 
                status={stats.credit_summary.usage_ratio >= 90 ? 'exception' : stats.credit_summary.usage_ratio >= 70 ? 'normal' : 'active'}
              />
            </div>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="风险分布">
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: '#666' }}>低风险</div>
                  <div style={{ fontSize: 28, fontWeight: 'bold', color: '#52c41a' }}>
                    {stats.risk_distribution.low}
                  </div>
                  <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a', marginTop: 8 }} />
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: '#666' }}>中风险</div>
                  <div style={{ fontSize: 28, fontWeight: 'bold', color: '#faad14' }}>
                    {stats.risk_distribution.medium}
                  </div>
                  <ExclamationCircleOutlined style={{ fontSize: 24, color: '#faad14', marginTop: 8 }} />
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: '#666' }}>高风险</div>
                  <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ff4d4f' }}>
                    {stats.risk_distribution.high}
                  </div>
                  <ExclamationCircleOutlined style={{ fontSize: 24, color: '#ff4d4f', marginTop: 8 }} />
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card 
            title="客户额度预警" 
            extra={<Button type="link" onClick={() => navigate('/risk-alerts')}>查看全部</Button>}
          >
            <Table 
              dataSource={customers}
              columns={customerColumns}
              pagination={false}
              rowKey="id"
              size="small"
            />
          </Card>
        </Col>

        <Col span={12}>
          <Card 
            title="最新风险提示" 
            extra={<Button type="link" onClick={() => navigate('/risk-alerts')}>查看全部</Button>}
          >
            {alerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                暂无未读风险提示
              </div>
            ) : (
              <div>
                {alerts.map(alert => (
                  <div key={alert.id} className="alert-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Tag color={getRiskColor(alert.alert_level)}>
                        {alert.alert_level === 'high' ? '高' : alert.alert_level === 'medium' ? '中' : '低'}
                      </Tag>
                      <span style={{ color: '#999', fontSize: 12 }}>{alert.created_at}</span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 13 }}>
                      <strong>{alert.customer_name}:</strong> {alert.alert_message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;
