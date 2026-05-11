import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Space } from 'antd';
import { 
  FileTextOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  DollarOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { claimApi, shipmentApi } from '../services/api';

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [recentClaims, setRecentClaims] = useState([]);
  const [pendingShipments, setPendingShipments] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, claimsRes, shipmentsRes] = await Promise.all([
        claimApi.getStats(),
        claimApi.list({ page: 1, pageSize: 5 }),
        shipmentApi.list({ page: 1, pageSize: 5, status: 'claim_pending' })
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (claimsRes.success) setRecentClaims(claimsRes.data);
      if (shipmentsRes.success) setPendingShipments(shipmentsRes.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      'draft': <Tag color="default">草稿</Tag>,
      'pending_review': <Tag color="orange">待审批</Tag>,
      'approved': <Tag color="green">已批准</Tag>,
      'rejected': <Tag color="red">已驳回</Tag>,
      'paid': <Tag color="blue">已赔付</Tag>,
      'closed': <Tag color="gray">已关闭</Tag>
    };
    return statusMap[status] || status;
  };

  const claimColumns = [
    {
      title: '索赔单号',
      dataIndex: 'claimNo',
      key: 'claimNo',
      render: (text, record) => (
        <a onClick={() => navigate(`/claims/${record.id}`)}>{text}</a>
      )
    },
    {
      title: '运单号',
      dataIndex: ['shipment', 'shipmentNo'],
      key: 'shipmentNo'
    },
    {
      title: '索赔金额',
      dataIndex: 'claimAmount',
      key: 'claimAmount',
      render: (val) => `¥${val?.toLocaleString() || 0}`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag
    }
  ];

  const shipmentColumns = [
    {
      title: '运单号',
      dataIndex: 'shipmentNo',
      key: 'shipmentNo',
      render: (text, record) => (
        <a onClick={() => navigate(`/shipments/${record.id}`)}>{text}</a>
      )
    },
    {
      title: '客户',
      dataIndex: 'customerName',
      key: 'customerName'
    },
    {
      title: '货物类型',
      dataIndex: ['cargoType', 'name'],
      key: 'cargoType'
    },
    {
      title: '货值',
      dataIndex: 'cargoValue',
      key: 'cargoValue',
      render: (val) => `¥${val?.toLocaleString() || 0}`
    }
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总索赔数"
              value={stats.totalClaims || 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理"
              value={stats.pendingClaims || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已批准"
              value={stats.approvedClaims || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已赔付金额"
              value={stats.totalApprovedAmount || 0}
              prefix={<DollarOutlined />}
              precision={2}
              formatter={(value) => `¥${value?.toLocaleString() || 0}`}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card 
            title="最近索赔" 
            extra={<a onClick={() => navigate('/claims')}>查看全部</a>}
          >
            <Table
              columns={claimColumns}
              dataSource={recentClaims}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card 
            title="待处理运单" 
            extra={<a onClick={() => navigate('/shipments')}>查看全部</a>}
          >
            <Table
              columns={shipmentColumns}
              dataSource={pendingShipments}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;
