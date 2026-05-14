import React, { useState, useEffect } from 'react';
import { Layout, Card, Button, Table, Modal, Form, Input, Select, Space, Tag, Timeline, message, Statistic, Row, Col } from 'antd';
import { PlusOutlined, EyeOutlined, ExportOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { afterSalesApi } from './api';

const { Header, Content } = Layout;
const { Option } = Select;
const { TextArea } = Input;

const statusColors: Record<string, string> = {
  CREATED: 'blue',
  QA_IN_PROGRESS: 'cyan',
  QA_PASSED: 'green',
  QA_FAILED: 'orange',
  REFUND_IN_PROGRESS: 'purple',
  REFUND_SUCCESS: 'green',
  REFUND_FAILED: 'red',
  COMPENSATION_IN_PROGRESS: 'purple',
  COMPENSATION_SUCCESS: 'green',
  COMPENSATION_FAILED: 'red',
  REVIEW_PENDING: 'orange',
  REVIEW_APPROVED: 'green',
  REVIEW_REJECTED: 'red',
  CLOSED: 'default',
  CANCELLED: 'default',
};

const statusLabels: Record<string, string> = {
  CREATED: '已创建',
  QA_IN_PROGRESS: '质检中',
  QA_PASSED: '质检通过',
  QA_FAILED: '质检不通过',
  REFUND_IN_PROGRESS: '退款中',
  REFUND_SUCCESS: '退款成功',
  REFUND_FAILED: '退款失败',
  COMPENSATION_IN_PROGRESS: '补偿券发放中',
  COMPENSATION_SUCCESS: '补偿券发放成功',
  COMPENSATION_FAILED: '补偿券发放失败',
  REVIEW_PENDING: '待复核',
  REVIEW_APPROVED: '复核通过',
  REVIEW_REJECTED: '复核驳回',
  CLOSED: '已关闭',
  CANCELLED: '已取消',
};

const App: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>({});
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [qaVisible, setQaVisible] = useState(false);
  const [correctVisible, setCorrectVisible] = useState(false);
  const [form] = Form.useForm();
  const [qaForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [correctForm] = Form.useForm();

  const loadData = async () => {
    try {
      const [ordersRes, statsRes] = await Promise.all([
        afterSalesApi.getOrders(),
        afterSalesApi.getStatistics(),
      ]);
      setOrders(ordersRes.data.data);
      setStatistics(statsRes.data.data);
    } catch (error) {
      message.error('加载数据失败');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateOrder = async (values: any) => {
    try {
      const res = await afterSalesApi.createOrder({
        ...values,
        idempotencyKey: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      });
      message.success(res.data.message);
      setCreateVisible(false);
      form.resetFields();
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建失败');
    }
  };

  const handleViewDetail = async (order: any) => {
    setSelectedOrder(order);
    try {
      const res = await afterSalesApi.getOrderDetail(order.id);
      setOrderDetail(res.data.data);
      setDetailVisible(true);
    } catch (error) {
      message.error('加载详情失败');
    }
  };

  const handleStartQa = async () => {
    try {
      await afterSalesApi.startQa(selectedOrder.id, {
        inspectorId: 'inspector-001',
        inspectorName: '质检员张三',
      });
      message.success('质检已开始');
      setDetailVisible(false);
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleSubmitQa = async (values: any) => {
    try {
      await afterSalesApi.submitQa(selectedOrder.id, {
        ...values,
        inspectorId: 'inspector-001',
        inspectorName: '质检员张三',
      });
      message.success('质检结果已提交');
      setQaVisible(false);
      setDetailVisible(false);
      qaForm.resetFields();
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleStartRefund = async (method: string) => {
    try {
      await afterSalesApi.startRefund(selectedOrder.id, {
        method,
        operator: '管理员',
      });
      message.success('退款已开始');
      setDetailVisible(false);
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleProcessRefund = async (success: boolean) => {
    try {
      await afterSalesApi.processRefund(selectedOrder.id, {
        success,
        transactionId: success ? `TXN${Date.now()}` : undefined,
        errorMessage: success ? undefined : '支付通道异常',
      });
      message.success(success ? '退款成功' : '退款已标记失败');
      setDetailVisible(false);
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleStartCompensation = async () => {
    try {
      await afterSalesApi.startCompensation(selectedOrder.id, {
        operator: '管理员',
      });
      message.success('补偿券发放已开始');
      setDetailVisible(false);
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleProcessCompensation = async (success: boolean) => {
    try {
      await afterSalesApi.processCompensation(selectedOrder.id, {
        success,
        errorMessage: success ? undefined : '优惠券系统异常',
      });
      message.success(success ? '补偿券发放成功' : '补偿券发放已标记失败');
      setDetailVisible(false);
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleCorrectCompensation = async (values: any) => {
    try {
      await afterSalesApi.correctCompensation(selectedOrder.id, {
        ...values,
        operator: '管理员',
      });
      message.success('补偿券修正成功');
      setCorrectVisible(false);
      setDetailVisible(false);
      correctForm.resetFields();
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleReview = async (values: any) => {
    try {
      await afterSalesApi.review(selectedOrder.id, {
        ...values,
        reviewer: '复核员李四',
      });
      message.success('复核完成');
      setReviewVisible(false);
      setDetailVisible(false);
      reviewForm.resetFields();
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleCloseOrder = async () => {
    try {
      await afterSalesApi.closeOrder(selectedOrder.id, {
        operator: '管理员',
      });
      message.success('订单已关闭');
      setDetailVisible(false);
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleRecalculate = async () => {
    try {
      await afterSalesApi.recalculate(selectedOrder.id);
      message.success('重新计算完成');
      handleViewDetail(selectedOrder);
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleExportLedger = async () => {
    try {
      const res = await afterSalesApi.exportLedger();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `售后账本-${dayjs().format('YYYYMMDDHHmmss')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const columns = [
    { title: '售后单号', dataIndex: 'orderNo', key: 'orderNo' },
    { title: '用户', dataIndex: 'userName', key: 'userName' },
    { title: '商品', dataIndex: 'productName', key: 'productName' },
    { title: '金额', dataIndex: 'amount', key: 'amount', render: (v: number) => `¥${v}` },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColors[v]}>{statusLabels[v]}</Tag>,
    },
    { title: '重试次数', dataIndex: 'retryCount', key: 'retryCount' },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
          详情
        </Button>
      ),
    },
  ];

  const chartOption = {
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [
      {
        name: '订单状态分布',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
        labelLine: { show: false },
        data: Object.entries(statistics.statusCounts || {}).map(([key, value]) => ({
          value,
          name: statusLabels[key] || key,
        })),
      },
    ],
  };

  const renderActions = () => {
    if (!selectedOrder) return null;
    const status = selectedOrder.status;
    const actions = [];

    if (status === 'CREATED') {
      actions.push(<Button key="qa" type="primary" onClick={handleStartQa}>开始质检</Button>);
    }
    if (status === 'QA_IN_PROGRESS') {
      actions.push(<Button key="submit-qa" type="primary" onClick={() => setQaVisible(true)}>提交质检结果</Button>);
    }
    if (status === 'QA_PASSED' || status === 'REVIEW_APPROVED') {
      actions.push(
        <Select key="refund-method" style={{ width: 150 }} placeholder="选择退款方式" onSelect={handleStartRefund}>
          <Option value="ORIGINAL_PAYMENT">原路退回</Option>
          <Option value="BANK_TRANSFER">银行转账</Option>
          <Option value="COUPON">优惠券补偿</Option>
        </Select>
      );
      actions.push(<Button key="review" onClick={() => setReviewVisible(true)}>进入复核</Button>);
    }
    if (status === 'REFUND_IN_PROGRESS') {
      actions.push(<Button key="refund-success" type="primary" onClick={() => handleProcessRefund(true)}>标记退款成功</Button>);
      actions.push(<Button key="refund-fail" danger onClick={() => handleProcessRefund(false)}>标记退款失败</Button>);
    }
    if (status === 'REFUND_FAILED') {
      actions.push(<Button key="compensation" type="primary" onClick={handleStartCompensation}>发放补偿券</Button>);
    }
    if (status === 'COMPENSATION_IN_PROGRESS') {
      actions.push(<Button key="comp-success" type="primary" onClick={() => handleProcessCompensation(true)}>标记发放成功</Button>);
      actions.push(<Button key="comp-fail" danger onClick={() => handleProcessCompensation(false)}>标记发放失败</Button>);
    }
    if (status === 'COMPENSATION_FAILED') {
      actions.push(<Button key="correct" type="primary" onClick={() => setCorrectVisible(true)}>修正补偿券</Button>);
    }
    if (status === 'REVIEW_PENDING' || status === 'QA_FAILED') {
      actions.push(<Button key="review" type="primary" onClick={() => setReviewVisible(true)}>处理复核</Button>);
    }
    if (['REFUND_SUCCESS', 'COMPENSATION_SUCCESS', 'REVIEW_APPROVED', 'REVIEW_REJECTED'].includes(status)) {
      actions.push(<Button key="close" danger onClick={handleCloseOrder}>关闭订单</Button>);
    }
    actions.push(<Button key="recalc" onClick={handleRecalculate}>重新计算状态</Button>);

    return <Space wrap>{actions}</Space>;
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px' }}>
        <div style={{ color: 'white', fontSize: 20, fontWeight: 'bold', lineHeight: '64px' }}>
          售后退款状态机管理系统
        </div>
      </Header>
      <Content style={{ padding: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Row gutter={16}>
            <Col span={6}>
              <Card>
                <Statistic title="总订单数" value={statistics.total || 0} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="今日新增" value={statistics.todayCount || 0} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="总金额" value={statistics.totalAmount || 0} prefix="¥" precision={2} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Button type="primary" icon={<ExportOutlined />} onClick={handleExportLedger} block>
                  导出售后账本
                </Button>
              </Card>
            </Col>
          </Row>

          <Card title="状态统计">
            <ReactECharts option={chartOption} style={{ height: 300 }} />
          </Card>

          <Card
            title="售后订单列表"
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>
                创建订单
              </Button>
            }
          >
            <Table columns={columns} dataSource={orders} rowKey="id" />
          </Card>
        </Space>
      </Content>

      <Modal title="创建售后订单" open={createVisible} onCancel={() => setCreateVisible(false)} footer={null}>
        <Form form={form} onFinish={handleCreateOrder} layout="vertical">
          <Form.Item name="orderNo" label="售后单号" rules={[{ required: true }]}>
            <Input placeholder="请输入售后单号" />
          </Form.Item>
          <Form.Item name="userId" label="用户ID" rules={[{ required: true }]}>
            <Input placeholder="请输入用户ID" />
          </Form.Item>
          <Form.Item name="userName" label="用户姓名" rules={[{ required: true }]}>
            <Input placeholder="请输入用户姓名" />
          </Form.Item>
          <Form.Item name="productName" label="商品名称" rules={[{ required: true }]}>
            <Input placeholder="请输入商品名称" />
          </Form.Item>
          <Form.Item name="amount" label="退款金额" rules={[{ required: true }]}>
            <Input type="number" placeholder="请输入退款金额" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>创建</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="提交质检结果" open={qaVisible} onCancel={() => setQaVisible(false)} footer={null}>
        <Form form={qaForm} onFinish={handleSubmitQa} layout="vertical">
          <Form.Item name="result" label="质检结果" rules={[{ required: true }]}>
            <Select>
              <Option value="PASSED">通过</Option>
              <Option value="FAILED">不通过</Option>
            </Select>
          </Form.Item>
          <Form.Item name="rejectReason" label="拒绝原因">
            <Select>
              <Option value="PRODUCT_USED">商品已使用</Option>
              <Option value="OUT_OF_WARRANTY">超出保修期</Option>
              <Option value="MISSING_ACCESSORIES">配件缺失</Option>
              <Option value="USER_ERROR">用户操作问题</Option>
              <Option value="OTHER">其他原因</Option>
            </Select>
          </Form.Item>
          <Form.Item name="remarks" label="质检备注">
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>提交</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="复核拒绝原因" open={reviewVisible} onCancel={() => setReviewVisible(false)} footer={null}>
        <Form form={reviewForm} onFinish={handleReview} layout="vertical">
          <Form.Item name="approved" label="复核结果" rules={[{ required: true }]}>
            <Select>
              <Option value={true}>通过</Option>
              <Option value={false}>驳回</Option>
            </Select>
          </Form.Item>
          <Form.Item name="reviewComments" label="复核意见" rules={[{ required: true }]}>
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>提交复核结果</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="修正补偿券" open={correctVisible} onCancel={() => setCorrectVisible(false)} footer={null}>
        <Form form={correctForm} onFinish={handleCorrectCompensation} layout="vertical">
          <Form.Item name="reason" label="修正原因" rules={[{ required: true }]}>
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item name="newAmount" label="新补偿金额">
            <Input type="number" placeholder="留空则不修改" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>提交修正</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="订单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={renderActions()}
        width={900}
      >
        {orderDetail && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card title="基本信息" size="small">
              <Row gutter={16}>
                <Col span={8}><p>售后单号: {orderDetail.order.orderNo}</p></Col>
                <Col span={8}><p>用户: {orderDetail.order.userName}</p></Col>
                <Col span={8}><p>商品: {orderDetail.order.productName}</p></Col>
                <Col span={8}><p>金额: ¥{orderDetail.order.amount}</p></Col>
                <Col span={8}>
                  <p>状态: <Tag color={statusColors[orderDetail.order.status]}>{statusLabels[orderDetail.order.status]}</Tag></p>
                </Col>
                <Col span={8}><p>重试次数: {orderDetail.order.retryCount}/{orderDetail.order.maxRetries}</p></Col>
              </Row>
            </Card>

            <Card title="操作时间线" size="small">
              <Timeline>
                {orderDetail.ledger.map((item: any, idx: number) => (
                  <Timeline.Item key={idx} color={item.status === 'SUCCESS' || item.status === 'APPROVED' ? 'green' : 'blue'}>
                    <p>{dayjs(item.operationTime).format('YYYY-MM-DD HH:mm:ss')} - {item.operator}</p>
                    <p>{item.remarks}</p>
                    {item.amount > 0 && <p>金额: ¥{item.amount}</p>}
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>

            {orderDetail.qaRecords.length > 0 && (
              <Card title="质检记录" size="small">
                {orderDetail.qaRecords.map((qa: any, idx: number) => (
                  <div key={idx} style={{ padding: '8px 0', borderBottom: idx < orderDetail.qaRecords.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                    <p>质检员: {qa.inspectorName}</p>
                    <p>结果: <Tag color={qa.result === 'PASSED' ? 'green' : 'orange'}>{qa.result === 'PASSED' ? '通过' : '不通过'}</Tag></p>
                    {qa.remarks && <p>备注: {qa.remarks}</p>}
                    <p style={{ color: '#999', fontSize: 12 }}>{dayjs(qa.createdAt).format('YYYY-MM-DD HH:mm:ss')}</p>
                  </div>
                ))}
              </Card>
            )}

            {orderDetail.refundRecords.length > 0 && (
              <Card title="退款记录" size="small">
                {orderDetail.refundRecords.map((rf: any, idx: number) => (
                  <div key={idx} style={{ padding: '8px 0', borderBottom: idx < orderDetail.refundRecords.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                    <p>方式: {rf.method}</p>
                    <p>金额: ¥{rf.amount}</p>
                    <p>状态: <Tag color={rf.status === 'SUCCESS' ? 'green' : rf.status === 'FAILED' ? 'red' : 'blue'}>{rf.status}</Tag></p>
                    {rf.transactionId && <p>交易号: {rf.transactionId}</p>}
                    {rf.errorMessage && <p>错误: {rf.errorMessage}</p>}
                    <p style={{ color: '#999', fontSize: 12 }}>{dayjs(rf.createdAt).format('YYYY-MM-DD HH:mm:ss')}</p>
                  </div>
                ))}
              </Card>
            )}

            {orderDetail.coupons.length > 0 && (
              <Card title="补偿券记录" size="small">
                {orderDetail.coupons.map((cp: any, idx: number) => (
                  <div key={idx} style={{ padding: '8px 0', borderBottom: idx < orderDetail.coupons.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                    <p>券码: {cp.couponCode}</p>
                    <p>金额: ¥{cp.amount}</p>
                    <p>状态: <Tag color={cp.status === 'ISSUED' ? 'green' : cp.status === 'FAILED' ? 'red' : 'blue'}>{cp.status}</Tag></p>
                    {cp.errorMessage && <p>错误: {cp.errorMessage}</p>}
                    {cp.correctionReason && (
                      <>
                        <p>修正原因: {cp.correctionReason}</p>
                        <p>修正人: {cp.correctionOperator} - {dayjs(cp.correctionTime).format('YYYY-MM-DD HH:mm:ss')}</p>
                      </>
                    )}
                    <p style={{ color: '#999', fontSize: 12 }}>{dayjs(cp.createdAt).format('YYYY-MM-DD HH:mm:ss')}</p>
                  </div>
                ))}
              </Card>
            )}
          </Space>
        )}
      </Modal>
    </Layout>
  );
};

export default App;