import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Progress } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, StopOutlined, DollarOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const Dashboard = () => {
  const [statistics, setStatistics] = useState({
    totalBudgets: 0,
    totalActivities: 0,
    pendingReviews: 0,
    completedPayments: 0
  });
  const [recentLogs, setRecentLogs] = useState([]);

  useEffect(() => {
    loadStatistics();
    loadRecentLogs();
  }, []);

  const loadStatistics = async () => {
    try {
      const [budgets, activities, invoices, payments] = await Promise.all([
        axios.get('/api/budgets'),
        axios.get('/api/activities'),
        axios.get('/api/invoices'),
        axios.get('/api/payments')
      ]);

      setStatistics({
        totalBudgets: budgets.data.length,
        totalActivities: activities.data.length,
        pendingReviews: invoices.data.filter(i => i.status === 'pending').length,
        completedPayments: payments.data.filter(p => p.status === 'completed').length
      });
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  };

  const loadRecentLogs = async () => {
    try {
      const response = await axios.get('/api/logs', { params: { limit: 10 } });
      setRecentLogs(response.data);
    } catch (error) {
      console.error('加载日志失败:', error);
    }
  };

  const logColumns = [
    { title: '操作类型', dataIndex: 'operation_type', key: 'type', width: 100,
      render: (text) => {
        const colors = {
          'create': 'blue',
          'update': 'orange',
          'approve': 'green',
          'reject': 'red',
          'status_change': 'purple',
          'payment': 'cyan'
        };
        return <Tag color={colors[text] || 'default'}>{text}</Tag>;
      }
    },
    { title: '目标类型', dataIndex: 'target_type', key: 'target', width: 100 },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 100 },
    { title: '详情', dataIndex: 'details', key: 'details', ellipsis: true },
    { title: '时间', dataIndex: 'created_at', key: 'time', width: 180,
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss')
    }
  ];

  return (
    <div>
      <h2>系统仪表盘</h2>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总预算数"
              value={statistics.totalBudgets}
              prefix={<DollarOutlined style={{ color: '#3f8600' }} />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活动申请数"
              value={statistics.totalActivities}
              prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待审核票据"
              value={statistics.pendingReviews}
              prefix={<ClockCircleOutlined style={{ color: '#cf1322' }} />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成支付"
              value={statistics.completedPayments}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={24}>
          <Card title="报销流程说明" style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col span={6}>
                <div style={{ textAlign: 'center', padding: '20px', background: '#e6f7ff', borderRadius: 8 }}>
                  <h3>正常路径</h3>
                  <Progress percent={100} status="success" />
                  <p style={{ marginTop: 8, fontSize: 12 }}>
                    预算创建 → 活动申请 → 采购明细 → 票据审核 → 支付完成
                  </p>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center', padding: '20px', background: '#fff2e8', borderRadius: 8 }}>
                  <h3>拦截路径</h3>
                  <Progress percent={60} status="exception" />
                  <p style={{ marginTop: 8, fontSize: 12 }}>
                    票据异常 → 审核拒绝 → 活动终止
                  </p>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center', padding: '20px', background: '#fffbe6', borderRadius: 8 }}>
                  <h3>复核路径</h3>
                  <Progress percent={80} status="active" />
                  <p style={{ marginTop: 8, fontSize: 12 }}>
                    待复核 → 补资料 → 重新审核 → 通过支付
                  </p>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center', padding: '20px', background: '#f6ffed', borderRadius: 8 }}>
                  <h3>导出路径</h3>
                  <Progress percent={100} status="success" />
                  <p style={{ marginTop: 8, fontSize: 12 }}>
                    按责任人筛选 → 按时间筛选 → 导出Excel报表
                  </p>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Card title="最近操作记录">
        <Table
          columns={logColumns}
          dataSource={recentLogs}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
};

export default Dashboard;
