import React, { useState, useEffect } from 'react';
import {
  Card,
  Descriptions,
  Table,
  Row,
  Col,
  Statistic,
  Tag,
  Button,
  Space,
  Popconfirm,
  message,
  Spin
} from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, CheckOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { settlementsAPI } from '../services/api';

const SettlementDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [settlement, setSettlement] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [settlementRes, workOrdersRes] = await Promise.all([
        settlementsAPI.getAll(),
        settlementsAPI.getWorkOrders(id)
      ]);

      const settlementData = settlementRes.data.find(s => s.id === parseInt(id));
      setSettlement(settlementData);
      setWorkOrders(workOrdersRes.data.map(wo => ({ ...wo, key: wo.work_order_id })));
    } catch (error) {
      message.error('加载数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleSubmit = async () => {
    try {
      await settlementsAPI.submit(id);
      message.success('结算单提交成功');
      loadData();
    } catch (error) {
      message.error(error.response?.data?.error || '提交失败');
    }
  };

  const handleExport = async () => {
    try {
      const response = await settlementsAPI.export(id);
      
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `settlement-${settlement?.settlement_number || id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
      console.error(error);
    }
  };

  const columns = [
    {
      title: '工单编号',
      dataIndex: 'work_order_number',
      key: 'work_order_number'
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
      key: 'customer_name'
    },
    {
      title: '合同',
      dataIndex: 'contract_name',
      key: 'contract_name'
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '响应罚款',
      dataIndex: 'response_fine',
      key: 'response_fine',
      render: (amount) => (
        <span style={{ color: amount > 0 ? '#ff4d4f' : '#52c41a' }}>
          ¥{amount.toFixed(2)}
        </span>
      )
    },
    {
      title: '修复罚款',
      dataIndex: 'repair_fine',
      key: 'repair_fine',
      render: (amount) => (
        <span style={{ color: amount > 0 ? '#ff4d4f' : '#52c41a' }}>
          ¥{amount.toFixed(2)}
        </span>
      )
    },
    {
      title: '已减免金额',
      dataIndex: 'exempted_amount',
      key: 'exempted_amount',
      render: (amount) => (
        <span style={{ color: '#52c41a' }}>
          ¥{amount.toFixed(2)}
        </span>
      )
    }
  ];

  if (loading || !settlement) {
    return <Spin tip="加载中..." />;
  }

  const statusMap = {
    draft: { color: 'blue', text: '草稿' },
    submitted: { color: 'green', text: '已提交' }
  };

  const statusInfo = statusMap[settlement.status];

  return (
    <div>
      <Button 
        icon={<ArrowLeftOutlined />} 
        onClick={() => navigate('/settlements')}
        style={{ marginBottom: 16 }}
      >
        返回结算列表
      </Button>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions title="结算单详情" bordered>
          <Descriptions.Item label="结算单编号" span={2}>
            {settlement.settlement_number}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusInfo?.color}>{statusInfo?.text}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="结算月份" span={3}>
            {settlement.year}年{settlement.month}月
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {settlement.created_at}
          </Descriptions.Item>
        </Descriptions>

        <Row gutter={16} style={{ marginTop: 24 }}>
          <Col span={6}>
            <Statistic 
              title="响应超时罚款总额" 
              value={settlement.total_response_fine.toFixed(2)}
              prefix="¥"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="修复超时罚款总额" 
              value={settlement.total_repair_fine.toFixed(2)}
              prefix="¥"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="罚款总额" 
              value={settlement.total_fine.toFixed(2)}
              prefix="¥"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="已批准减免总额" 
              value={settlement.total_exempted.toFixed(2)}
              prefix="¥"
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
        </Row>

        <Card 
          style={{ marginTop: 24, background: '#fafafa' }}
          bodyStyle={{ padding: 16 }}
        >
          <Row gutter={16}>
            <Col span={12} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, color: '#8c8c8c', marginBottom: 8 }}>
                净罚款金额
              </div>
              <div style={{ 
                fontSize: 36, 
                fontWeight: 'bold',
                color: settlement.net_fine > 0 ? '#ff4d4f' : '#52c41a'
              }}>
                ¥{settlement.net_fine.toFixed(2)}
              </div>
            </Col>
            <Col span={12} style={{ textAlign: 'center', borderLeft: '1px solid #e8e8e8' }}>
              <div style={{ fontSize: 16, color: '#8c8c8c', marginBottom: 8 }}>
                工单数量
              </div>
              <div style={{ fontSize: 36, fontWeight: 'bold', color: '#1890ff' }}>
                {workOrders.length}
              </div>
            </Col>
          </Row>
        </Card>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Space>
            {settlement.status === 'draft' && (
              <Popconfirm
                title="确认提交此结算单？提交后无法修改关联工单的关键时间和状态。"
                onConfirm={handleSubmit}
                okText="确认提交"
                okType="primary"
                cancelText="取消"
              >
                <Button type="primary" icon={<CheckOutlined />}>
                  提交结算单
                </Button>
              </Popconfirm>
            )}
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出JSON
            </Button>
          </Space>
        </div>
      </Card>

      <Card title="关联工单明细">
        <Table
          columns={columns}
          dataSource={workOrders}
          rowKey="work_order_id"
          pagination={false}
          size="small"
          footer={() => (
            <div style={{ textAlign: 'right', fontWeight: 'bold' }}>
              共 {workOrders.length} 条工单
            </div>
          )}
        />
      </Card>
    </div>
  );
};

export default SettlementDetail;
