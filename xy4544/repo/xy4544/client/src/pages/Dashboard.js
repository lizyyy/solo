import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Spin,
  Alert,
  Button,
  Space,
} from 'antd';
import {
  DashboardOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [topRiskCabins, setTopRiskCabins] = useState([]);
  const [hasSampleData, setHasSampleData] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsResponse, statusResponse] = await Promise.all([
        api.analysis.getStats(),
        api.sample.getStatus(),
      ]);
      
      setStats(statsResponse.data);
      setHasSampleData(statusResponse.data.has_sample_data);
      
      if (statusResponse.data.has_sample_data) {
        const analysisResponse = await api.analysis.getAll({
          limit: 10,
          offset: 0,
        });
        setTopRiskCabins(analysisResponse.data.data || []);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case '高风险':
        return 'red';
      case '中风险':
        return 'orange';
      case '低风险':
        return 'blue';
      case '误报':
        return 'default';
      default:
        return 'green';
    }
  };

  const getMaintenancePriorityColor = (priority) => {
    switch (priority) {
      case '高':
        return 'red';
      case '中':
        return 'orange';
      default:
        return 'blue';
    }
  };

  const columns = [
    {
      title: '舱房号',
      dataIndex: 'cabin_number',
      key: 'cabin_number',
      render: (text, record) => (
        <Button
          type="link"
          onClick={() => navigate('/analysis', { state: { cabinNumber: text } })}
        >
          {text}
        </Button>
      ),
    },
    {
      title: '甲板',
      dataIndex: 'deck',
      key: 'deck',
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      key: 'risk_level',
      render: (text) => <Tag color={getRiskColor(text)}>{text}</Tag>,
    },
    {
      title: '风险分数',
      dataIndex: 'risk_score',
      key: 'risk_score',
      render: (score) => (
        <span style={{ fontWeight: 'bold', color: score >= 50 ? '#ff4d4f' : score >= 30 ? '#faad14' : '#52c41a' }}>
          {score}
        </span>
      ),
    },
    {
      title: '维修状态',
      dataIndex: 'maintenance_status',
      key: 'maintenance_status',
      render: (text) => <Tag>{text}</Tag>,
    },
    {
      title: '维修优先级',
      dataIndex: 'maintenance_priority',
      key: 'maintenance_priority',
      render: (text) => <Tag color={getMaintenancePriorityColor(text)}>{text}</Tag>,
    },
    {
      title: '人工改判',
      dataIndex: 'manual_override',
      key: 'manual_override',
      render: (value) => (
        value ? <Tag color="green">已改判</Tag> : <Tag>系统判定</Tag>
      ),
    },
  ];

  const getRiskCount = (riskLevel) => {
    if (!stats || !stats.risk_distribution) return 0;
    const item = stats.risk_distribution.find(r => r.risk_level === riskLevel);
    return item ? item.count : 0;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>
          <DashboardOutlined style={{ marginRight: 8 }} />
          系统仪表板
        </h2>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新数据
        </Button>
      </div>

      {!hasSampleData && (
        <Alert
          message="系统暂无数据"
          description="请先导入示例数据或上传实际数据文件，然后进行分析。"
          type="info"
          showIcon
          action={
            <Button type="primary" size="small" onClick={() => navigate('/import')}>
              前往导入数据
            </Button>
          }
          style={{ marginBottom: 24 }}
        />
      )}

      <Spin spinning={loading}>
        {stats && (
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={6}>
              <Card className="stats-card">
                <Statistic
                  title="高风险舱房"
                  value={getRiskCount('高风险')}
                  valueStyle={{ color: '#ff4d4f' }}
                  prefix={<WarningOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card className="stats-card">
                <Statistic
                  title="中风险舱房"
                  value={getRiskCount('中风险')}
                  valueStyle={{ color: '#faad14' }}
                  prefix={<ExclamationCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card className="stats-card">
                <Statistic
                  title="低风险舱房"
                  value={getRiskCount('低风险')}
                  valueStyle={{ color: '#1890ff' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card className="stats-card">
                <Statistic
                  title="正常/误报舱房"
                  value={getRiskCount('正常') + getRiskCount('误报')}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>
        )}

        {stats && stats.deck_summary && stats.deck_summary.length > 0 && (
          <Card title="各甲板风险分布" style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              {stats.deck_summary.map((deck) => (
                <Col key={deck.deck} xs={12} sm={6} md={4}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>
                      {deck.deck}层
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      共计 {deck.total_cabins} 舱
                    </div>
                    <div style={{ marginTop: 8 }}>
                      {deck.high_risk > 0 && (
                        <Tag color="red" style={{ margin: 2 }}>
                          高风险: {deck.high_risk}
                        </Tag>
                      )}
                      {deck.medium_risk > 0 && (
                        <Tag color="orange" style={{ margin: 2 }}>
                          中风险: {deck.medium_risk}
                        </Tag>
                      )}
                      {deck.low_risk > 0 && (
                        <Tag color="blue" style={{ margin: 2 }}>
                          低风险: {deck.low_risk}
                        </Tag>
                      )}
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        )}

        {hasSampleData && topRiskCabins.length > 0 && (
          <Card title="高风险舱房列表 (Top 10)">
            <Table
              columns={columns}
              dataSource={topRiskCabins}
              rowKey="cabin_number"
              pagination={false}
              size="middle"
            />
          </Card>
        )}

        {hasSampleData && (
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Space>
              <Button type="primary" onClick={() => navigate('/analysis')}>
                查看完整分析结果
              </Button>
              <Button onClick={() => navigate('/export')}>
                导出维修报告
              </Button>
            </Space>
          </div>
        )}
      </Spin>
    </div>
  );
};

export default Dashboard;
