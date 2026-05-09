import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Progress, Spin, message } from 'antd';
import { FileTextOutlined, ExclamationCircleOutlined, WalletOutlined, ShopOutlined, CopyOutlined } from '@ant-design/icons';
import { getStatsOverview } from '../services/api';
import { StatsOverview } from '../types';
import { getReceiptStatusTag, getAppealStatusTag, getSettlementStatusTag, formatMoney, formatDateTime } from '../utils';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await getStatsOverview();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      message.error('加载统计数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '100px' }}><Spin size="large" /></div>;
  }

  if (!stats) return null;

  const { receipt_stats, appeal_stats, employee_stats, settlement_stats, recent_activity, department_stats } = stats;

  const activityColumns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => {
        const icons: Record<string, React.ReactNode> = {
          receipt: <FileTextOutlined style={{ color: '#1890ff' }} />,
          appeal: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
          settlement: <ShopOutlined style={{ color: '#52c41a' }} />,
        };
        const labels: Record<string, string> = {
          receipt: '小票',
          appeal: '申诉',
          settlement: '结算',
        };
        return (
          <span>
            {icons[type]} {labels[type]}
          </span>
        );
      },
    },
    {
      title: '编号/月份',
      dataIndex: 'receipt_no',
      key: 'receipt_no',
      render: (text: string, record: any) => {
        if (record.type === 'receipt') return text || '-';
        if (record.type === 'settlement') return record.receipt_no;
        return '-';
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => amount ? formatMoney(amount) : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: any) => {
        if (record.type === 'receipt') {
          const tag = getReceiptStatusTag(status as any);
          return <Tag color={tag.color}>{tag.text}</Tag>;
        }
        if (record.type === 'appeal') {
          const tag = getAppealStatusTag(status as any);
          return <Tag color={tag.color}>{tag.text}</Tag>;
        }
        const tag = getSettlementStatusTag(status as any);
        return <Tag color={tag.color}>{tag.text}</Tag>;
      },
    },
    {
      title: '相关人员',
      dataIndex: 'related_name',
      key: 'related_name',
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: formatDateTime,
    },
  ];

  const departmentColumns = [
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
    },
    {
      title: '员工数',
      dataIndex: 'employee_count',
      key: 'employee_count',
    },
    {
      title: '总补贴',
      dataIndex: 'total_allowance',
      key: 'total_allowance',
      render: formatMoney,
    },
    {
      title: '已使用',
      dataIndex: 'total_used',
      key: 'total_used',
      render: formatMoney,
    },
    {
      title: '剩余',
      dataIndex: 'total_remaining',
      key: 'total_remaining',
      render: formatMoney,
    },
    {
      title: '平均使用率',
      dataIndex: 'avg_usage_rate',
      key: 'avg_usage_rate',
      render: (rate: number) => (
        <Progress
          percent={Math.round(rate || 0)}
          size="small"
          status={rate > 90 ? 'exception' : rate > 70 ? 'normal' : 'success'}
        />
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h2>工作台概览</h2>
        <p>快速查看补贴核销台的整体运行状况</p>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card className="stats-card" onClick={() => navigate('/receipts')} style={{ cursor: 'pointer' }}>
            <Statistic
              title="本月小票总数"
              value={receipt_stats.total_receipts}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stats-card" onClick={() => navigate('/receipts?status=pending')} style={{ cursor: 'pointer' }}>
            <Statistic
              title="待审核"
              value={receipt_stats.pending_count}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stats-card" onClick={() => navigate('/duplicates')} style={{ cursor: 'pointer' }}>
            <Statistic
              title="重复小票"
              value={receipt_stats.duplicate_count}
              prefix={<CopyOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stats-card" onClick={() => navigate('/appeals')} style={{ cursor: 'pointer' }}>
            <Statistic
              title="待处理申诉"
              value={appeal_stats.pending_appeals}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card className="stats-card" onClick={() => navigate('/balances')} style={{ cursor: 'pointer' }}>
            <Statistic
              title="员工总数"
              value={employee_stats.total_employees}
              prefix={<WalletOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stats-card">
            <Statistic
              title="补贴总余额"
              value={employee_stats.total_remaining}
              prefix="¥"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stats-card">
            <Statistic
              title="合作商户"
              value={employee_stats.total_employees}
              prefix={<ShopOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stats-card">
            <Statistic
              title="本月已结算"
              value={settlement_stats.completed_amount}
              prefix="¥"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="最近活动">
            <Table
              columns={activityColumns}
              dataSource={recent_activity}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="各部门补贴使用情况">
            <Table
              columns={departmentColumns}
              dataSource={department_stats}
              rowKey="department"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
