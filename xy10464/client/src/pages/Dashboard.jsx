import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Space, Spin, message } from 'antd';
import {
  FileTextOutlined,
  ToolOutlined,
  WarningOutlined,
  CalculatorOutlined,
  ArrowUpOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { contractsAPI, workOrdersAPI, exemptionsAPI, settlementsAPI } from '../services/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    contracts: 0,
    workOrders: 0,
    pendingExemptions: 0,
    settlements: 0
  });
  const [recentWorkOrders, setRecentWorkOrders] = useState([]);
  const [pendingExemptions, setPendingExemptions] = useState([]);

  const statusMap = {
    created: { color: 'blue', text: '已创建' },
    responded: { color: 'cyan', text: '已响应' },
    paused: { color: 'orange', text: '已暂停' },
    in_progress: { color: 'purple', text: '处理中' },
    repaired: { color: 'green', text: '已修复' },
    closed: { color: 'default', text: '已关闭' }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        const [contractsRes, workOrdersRes, exemptionsRes, settlementsRes] = await Promise.all([
          contractsAPI.getAll(),
          workOrdersAPI.getAll(),
          exemptionsAPI.getAll({ status: 'pending' }),
          settlementsAPI.getAll()
        ]);

        setStats({
          contracts: contractsRes.data.length,
          workOrders: workOrdersRes.data.length,
          pendingExemptions: exemptionsRes.data.length,
          settlements: settlementsRes.data.length
        });

        const recent = workOrdersRes.data.slice(0, 5).map(wo => ({
          ...wo,
          key: wo.id
        }));
        setRecentWorkOrders(recent);

        const pending = exemptionsRes.data.slice(0, 5).map(e => ({
          ...e,
          key: e.id
        }));
        setPendingExemptions(pending);

      } catch (error) {
        message.error('加载数据失败');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const workOrderColumns = [
    {
      title: '工单编号',
      dataIndex: 'work_order_number',
      key: 'work_order_number',
      render: (text, record) => (
        <a onClick={() => navigate(`/workorders/${record.id}`)}>{text}</a>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusMap[status]?.color}>{statusMap[status]?.text}</Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at'
    }
  ];

  const exemptionColumns = [
    {
      title: '工单编号',
      dataIndex: 'work_order_number',
      key: 'work_order_number'
    },
    {
      title: '类型',
      dataIndex: 'exemption_type',
      key: 'exemption_type',
      render: (type) => type === 'response' ? '响应超时' : '修复超时'
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => `¥${amount.toFixed(2)}`
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true
    }
  ];

  if (loading) {
    return <Spin tip="加载中..." />;
  }

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card onClick={() => navigate('/contracts')} style={{ cursor: 'pointer' }}>
            <Statistic
              title="合同数量"
              value={stats.contracts}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card onClick={() => navigate('/workorders')} style={{ cursor: 'pointer' }}>
            <Statistic
              title="工单总数"
              value={stats.workOrders}
              prefix={<ToolOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card onClick={() => navigate('/exemptions')} style={{ cursor: 'pointer' }}>
            <Statistic
              title="待审批免责"
              value={stats.pendingExemptions}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#cf1322' }}
              suffix={<ArrowUpOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card onClick={() => navigate('/settlements')} style={{ cursor: 'pointer' }}>
            <Statistic
              title="结算单"
              value={stats.settlements}
              prefix={<CalculatorOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card 
            title="最近工单" 
            extra={<a onClick={() => navigate('/workorders')}>查看全部</a>}
          >
            <Table
              columns={workOrderColumns}
              dataSource={recentWorkOrders}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card 
            title="待审批免责申请" 
            extra={<a onClick={() => navigate('/exemptions')}>查看全部</a>}
          >
            <Table
              columns={exemptionColumns}
              dataSource={pendingExemptions}
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
