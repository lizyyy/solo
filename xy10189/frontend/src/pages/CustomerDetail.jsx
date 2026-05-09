import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Descriptions, 
  Progress, 
  Tag, 
  Tabs, 
  Table, 
  Button, 
  Space,
  message,
  Statistic,
  Row,
  Col
} from 'antd';
import { ArrowLeftOutlined, ShoppingCartOutlined, RollbackOutlined, AuditOutlined } from '@ant-design/icons';
import { customerApi, reportApi } from '../utils/api';

function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [returns, setReturns] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [customerRes, ordersRes, returnsRes, adjustmentsRes, historyRes] = await Promise.all([
        customerApi.getById(id),
        customerApi.getOrders(id),
        customerApi.getReturns(id),
        customerApi.getAdjustments(id),
        reportApi.getCreditHistory({ customer_id: id, limit: 50 })
      ]);

      if (customerRes.data.success) {
        setCustomer(customerRes.data.data);
      }
      if (ordersRes.data.success) {
        setOrders(ordersRes.data.data);
      }
      if (returnsRes.data.success) {
        setReturns(returnsRes.data.data);
      }
      if (adjustmentsRes.data.success) {
        setAdjustments(adjustmentsRes.data.data);
      }
      if (historyRes.data.success) {
        setHistory(historyRes.data.data);
      }
    } catch (error) {
      message.error('获取客户详情失败');
    } finally {
      setLoading(false);
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

  const getTypeText = (type) => {
    switch (type) {
      case 'order_occupy': return '订单占用';
      case 'return_release': return '退货释放';
      case 'credit_adjustment': return '额度调额';
      default: return type;
    }
  };

  const orderColumns = [
    { title: '订单号', dataIndex: 'order_no', key: 'order_no' },
    { title: '订单金额', dataIndex: 'amount', key: 'amount', render: (val) => `¥${val.toLocaleString()}` },
    { title: '占用额度', dataIndex: 'credit_used', key: 'credit_used', render: (val) => <span style={{ color: '#ff4d4f' }}>-¥{val.toLocaleString()}</span> },
    { title: '状态', dataIndex: 'order_status', key: 'order_status', render: (s) => <Tag color="green">已完成</Tag> },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' }
  ];

  const returnColumns = [
    { title: '退货单号', dataIndex: 'return_no', key: 'return_no' },
    { title: '原订单号', dataIndex: 'order_no', key: 'order_no' },
    { title: '退货金额', dataIndex: 'return_amount', key: 'return_amount', render: (val) => `¥${val.toLocaleString()}` },
    { title: '释放额度', dataIndex: 'credit_released', key: 'credit_released', render: (val) => <span style={{ color: '#52c41a' }}>+¥{val.toLocaleString()}</span> },
    { title: '状态', dataIndex: 'return_status', key: 'return_status', render: (s) => <Tag color="green">已完成</Tag> },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' }
  ];

  const adjustmentColumns = [
    { title: '调额单号', dataIndex: 'adjustment_no', key: 'adjustment_no' },
    { title: '调额类型', dataIndex: 'adjustment_type', key: 'adjustment_type', render: (t) => t === 'increase' ? <Tag color="green">调增</Tag> : <Tag color="orange">调减</Tag> },
    { title: '金额', dataIndex: 'amount', key: 'amount', render: (val) => `¥${val.toLocaleString()}` },
    { title: '原因', dataIndex: 'reason', key: 'reason' },
    { title: '申请人', dataIndex: 'requester', key: 'requester' },
    { title: '审批状态', dataIndex: 'approval_status', key: 'approval_status', render: (s) => {
      const map = { pending: <Tag color="orange">待审批</Tag>, approved: <Tag color="green">已通过</Tag>, rejected: <Tag color="red">已驳回</Tag> };
      return map[s] || s;
    }},
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' }
  ];

  const historyColumns = [
    { title: '交易类型', dataIndex: 'transaction_type', key: 'transaction_type', render: getTypeText },
    { title: '交易单号', dataIndex: 'transaction_no', key: 'transaction_no' },
    { title: '变动金额', dataIndex: 'change_amount', key: 'change_amount', render: (val) => (
      <span style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f' }}>
        {val >= 0 ? '+' : ''}¥{val.toLocaleString()}
      </span>
    )},
    { title: '变动前可用', dataIndex: 'before_available', key: 'before_available', render: (val) => `¥${val.toLocaleString()}` },
    { title: '变动后可用', dataIndex: 'after_available', key: 'after_available', render: (val) => `¥${val.toLocaleString()}` },
    { title: '操作人', dataIndex: 'operator', key: 'operator' },
    { title: '操作时间', dataIndex: 'created_at', key: 'created_at' }
  ];

  if (!customer) {
    return <div>加载中...</div>;
  }

  const tabItems = [
    {
      key: 'overview',
      label: <span><ShoppingCartOutlined />订单记录</span>,
      children: <Table columns={orderColumns} dataSource={orders} rowKey="id" pagination={false} />
    },
    {
      key: 'returns',
      label: <span><RollbackOutlined />退货记录</span>,
      children: <Table columns={returnColumns} dataSource={returns} rowKey="id" pagination={false} />
    },
    {
      key: 'adjustments',
      label: <span><AuditOutlined />调额记录</span>,
      children: <Table columns={adjustmentColumns} dataSource={adjustments} rowKey="id" pagination={false} />
    },
    {
      key: 'history',
      label: <span>额度变动历史</span>,
      children: <Table columns={historyColumns} dataSource={history} rowKey="id" pagination={false} />
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/customers')}>
          返回列表
        </Button>
      </div>

      <Card title="客户信息" loading={loading}>
        <Descriptions column={3} bordered>
          <Descriptions.Item label="客户编码">{customer.code}</Descriptions.Item>
          <Descriptions.Item label="客户名称">{customer.name}</Descriptions.Item>
          <Descriptions.Item label="行业">{customer.industry || '-'}</Descriptions.Item>
          <Descriptions.Item label="联系人">{customer.contact_person || '-'}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{customer.contact_phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="地址">{customer.address || '-'}</Descriptions.Item>
          <Descriptions.Item label="风险等级">
            <Tag color={getRiskColor(customer.risk_level)}>
              {customer.risk_level === 'high' ? '高风险' : customer.risk_level === 'medium' ? '中风险' : '低风险'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="信用状态">
            <Tag color={customer.credit_status === 'normal' ? 'green' : 'red'}>
              {customer.credit_status === 'normal' ? '正常' : '超限'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">{customer.created_at}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="额度信息" style={{ marginTop: 16 }}>
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Statistic title="总额度" value={customer.total_credit_limit} precision={2} prefix="¥" valueStyle={{ color: '#1890ff' }} />
          </Col>
          <Col span={6}>
            <Statistic title="可用额度" value={customer.available_credit} precision={2} prefix="¥" valueStyle={{ color: customer.available_credit < 0 ? '#ff4d4f' : '#52c41a' }} />
          </Col>
          <Col span={6}>
            <Statistic title="已用额度" value={customer.used_credit} precision={2} prefix="¥" valueStyle={{ color: '#fa541c' }} />
          </Col>
          <Col span={6}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 8 }}>
                使用率: <strong>{customer.usage_ratio.toFixed(2)}%</strong>
              </div>
              <div className={getProgressColor(customer.usage_ratio)}>
                <Progress percent={Number(customer.usage_ratio.toFixed(1))} />
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Tabs items={tabItems} />
      </Card>
    </div>
  );
}

export default CustomerDetail;
