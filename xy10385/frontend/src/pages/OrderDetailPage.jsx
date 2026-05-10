import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Descriptions, Tag, Space, Button, Timeline, Table, Modal,
  Form, Select, Input, InputNumber, message, Divider, Statistic, Row, Col,
  Popconfirm, Steps, Alert
} from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, MoneyCollectOutlined,
  StopOutlined, ReloadOutlined, CheckOutlined, ExportOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';

const { Option } = Select;
const { Step } = Steps;
const { TextArea } = Input;

const statusMap = {
  pending: { text: '待处理', color: 'default' },
  accepted: { text: '已接单', color: 'blue' },
  in_progress: { text: '进行中', color: 'processing' },
  completed: { text: '已完成', color: 'success' },
  cancelled: { text: '已取消', color: 'red' },
  refunded: { text: '已退款', color: 'orange' }
};

function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [examinations, setExaminations] = useState([]);
  const [addExamModal, setAddExamModal] = useState(false);
  const [billModal, setBillModal] = useState(false);
  const [refundModal, setRefundModal] = useState(false);
  const [addForm] = Form.useForm();
  const [billForm] = Form.useForm();
  const [refundForm] = Form.useForm();

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const [orderRes, examRes] = await Promise.all([
        api.getOrder(id),
        api.getExaminations()
      ]);
      setOrder(orderRes.data);
      setExaminations(examRes.data);
    } catch (e) {
      message.error('加载订单失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleAdvanceTimeline = async (nodeType) => {
    try {
      const res = await api.advanceTimeline(id, { node_type: nodeType, operator: '操作员' });
      message.success(res.data.message);
      fetchOrder();
    } catch (e) {
      message.error(e.response?.data?.error || '操作失败');
    }
  };

  const handleAddExamination = async () => {
    try {
      const values = await addForm.validateFields();
      const res = await api.addExamination(id, {
        examination_id: values.examination_id,
        operator: '操作员'
      });
      message.success(res.data.message);
      setAddExamModal(false);
      addForm.resetFields();
      fetchOrder();
    } catch (e) {
      message.error(e.response?.data?.error || '添加失败');
    }
  };

  const handleBill = async () => {
    try {
      const values = await billForm.validateFields();
      const res = await api.billOrder(id, { operator: values.operator || '财务' });
      if (res.data.idempotent) {
        message.info(res.data.message);
      } else {
        message.success(res.data.message);
      }
      setBillModal(false);
      billForm.resetFields();
      fetchOrder();
    } catch (e) {
      message.error(e.response?.data?.error || '计费失败');
    }
  };

  const handleRefund = async () => {
    try {
      const values = await refundForm.validateFields();
      const res = await api.refundOrder(id, {
        refund_amount: values.refund_amount,
        operator: values.operator || '管理员',
        reason: values.reason
      });
      if (res.data.idempotent) {
        message.info(res.data.message);
      } else {
        message.success(res.data.message);
      }
      setRefundModal(false);
      refundForm.resetFields();
      fetchOrder();
    } catch (e) {
      message.error(e.response?.data?.error || '退款失败');
    }
  };

  const handleCancel = async () => {
    Modal.confirm({
      title: '确认取消订单',
      content: '取消后将无法恢复，确定要取消吗？',
      onOk: async () => {
        try {
          const res = await api.cancelOrder(id, { operator: '操作员', reason: '用户取消' });
          message.success(res.data.message);
          fetchOrder();
        } catch (e) {
          message.error(e.response?.data?.error || '取消失败');
        }
      }
    });
  };

  const exportReport = async () => {
    try {
      const res = await api.getOrderReport(id);
      const report = res.data;
      const jsonStr = JSON.stringify(report, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${report.订单号}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('报告已导出');
    } catch (e) {
      message.error('导出失败');
    }
  };

  if (!order) return <Card loading={loading} />;

  const statusInfo = statusMap[order.status] || { text: order.status, color: 'default' };
  const isCompleted = ['completed', 'cancelled', 'refunded'].includes(order.status);
  const currentStep = order.timeline.findIndex(t => t.status === 'pending');

  const examColumns = [
    { title: '项目名称', dataIndex: 'exam_name', key: 'exam_name' },
    { title: '科室', dataIndex: 'department', key: 'department' },
    { title: '单价', dataIndex: 'unit_price', key: 'unit_price', render: v => `¥${v}` },
    { title: '类型', dataIndex: 'is_added', key: 'is_added', render: v => v ? <Tag color="orange">临时加项</Tag> : <Tag color="blue">预约</Tag> },
    {
      title: '审批状态',
      dataIndex: 'approval_status',
      key: 'approval_status',
      render: v => {
        const map = { pending: '待审批', approved: '已通过', rejected: '已拒绝' };
        const color = { pending: 'gold', approved: 'green', rejected: 'red' };
        return <Tag color={color[v]}>{map[v] || v}</Tag>;
      }
    },
    {
      title: '计费状态',
      dataIndex: 'billed',
      key: 'billed',
      render: v => v ? <Tag color="green">已计费</Tag> : <Tag color="default">未计费</Tag>
    }
  ];

  const feeColumns = [
    { title: '项目名称', dataIndex: 'item_name', key: 'item_name' },
    {
      title: '类型',
      dataIndex: 'fee_type',
      key: 'fee_type',
      render: v => {
        const map = { service: '服务费', examination: '检查费', refund: '退款' };
        return <Tag>{map[v] || v}</Tag>;
      }
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: v => (
        <span className={v > 0 ? 'amount-positive' : 'amount-negative'}>
          {v > 0 ? '+' : ''}¥{v}
        </span>
      )
    },
    { title: '交易号', dataIndex: 'transaction_no', key: 'transaction_no', render: t => <code>{t}</code> },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', render: t => dayjs(t).format('MM-DD HH:mm') }
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>
          返回列表
        </Button>
        <Button icon={<ReloadOutlined />} onClick={fetchOrder}>刷新</Button>
        <Button icon={<ExportOutlined />} onClick={exportReport}>导出报告</Button>
      </Space>

      <Row gutter={16}>
        <Col span={24}>
          <Card
            title={`订单详情 - ${order.order_no}`}
            extra={<Tag color={statusInfo.color}>{statusInfo.text}</Tag>}
            style={{ marginBottom: 16 }}
          >
            <Descriptions bordered column={3}>
              <Descriptions.Item label="订单号">{order.order_no}</Descriptions.Item>
              <Descriptions.Item label="患者">
                {order.patient_name} ({order.patient_gender}, {order.patient_age}岁)
              </Descriptions.Item>
              <Descriptions.Item label="陪诊员">{order.escort_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="科室">{order.department}</Descriptions.Item>
              <Descriptions.Item label="医院">{order.hospital}</Descriptions.Item>
              <Descriptions.Item label="服务时间">
                {order.start_time ? `${dayjs(order.start_time).format('YYYY-MM-DD HH:mm')} ~ ${dayjs(order.end_time).format('HH:mm')}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">{dayjs(order.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>{order.notes || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col span={16}>
          <Card title="服务流程时间线" style={{ marginBottom: 16 }}>
            <Steps
              direction="vertical"
              current={currentStep >= 0 ? currentStep : order.timeline.length}
              status={isCompleted ? 'finish' : 'process'}
              style={{ padding: '0 24px' }}
            >
              {order.timeline.map((node, idx) => (
                <Step
                  key={node.id}
                  title={
                    <Space>
                      {node.node_name}
                      {node.status === 'pending' && !isCompleted && idx === currentStep && (
                        <Button
                          type="primary"
                          size="small"
                          icon={<CheckOutlined />}
                          onClick={() => handleAdvanceTimeline(node.node_type)}
                          disabled={isCompleted}
                        >
                          完成此节点
                        </Button>
                      )}
                    </Space>
                  }
                  description={node.status === 'completed' ? (
                    <span style={{ color: '#52c41a' }}>
                      ✅ 完成于 {dayjs(node.completed_at).format('MM-DD HH:mm')}
                      {node.operator ? ` (${node.operator})` : ''}
                    </span>
                  ) : (
                    <span style={{ color: '#999' }}>待完成</span>
                  )}
                />
              ))}
            </Steps>
          </Card>

          <Card
            title="检查项目"
            style={{ marginBottom: 16 }}
            extra={!isCompleted && (
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAddExamModal(true)}>
                申请加项
              </Button>
            )}
          >
            <Table
              columns={examColumns}
              dataSource={order.examinations}
              rowKey="id"
              pagination={false}
              size="small"
            />
            {order.examinations.filter(e => e.is_added && e.approval_status === 'pending').length > 0 && (
              <Alert
                message="存在待审批的临时加项"
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </Card>
        </Col>

        <Col span={8}>
          <Card title="费用汇总" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="服务费"
                  value={order.fee_summary?.service_fee || 0}
                  prefix="¥"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="检查费"
                  value={order.fee_summary?.examination_fee || 0}
                  prefix="¥"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Col>
            </Row>
            <Divider />
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="退款"
                  value={order.fee_summary?.refund || 0}
                  prefix="-¥"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="实付"
                  value={order.fee_summary?.net_payable || 0}
                  prefix="¥"
                  valueStyle={{ color: '#f5222d', fontWeight: 'bold' }}
                />
              </Col>
            </Row>
          </Card>

          <Card
            title="操作"
            style={{ marginBottom: 16 }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {!isCompleted && order.examinations?.length > 0 && (
                <Button
                  type="primary"
                  icon={<MoneyCollectOutlined />}
                  block
                  onClick={() => setBillModal(true)}
                >
                  计费结算
                </Button>
              )}
              {order.status === 'completed' && (order.fee_summary?.total || 0) > 0 && (order.fee_summary?.refund || 0) === 0 && (
                <Button
                  danger
                  icon={<StopOutlined />}
                  block
                  onClick={() => setRefundModal(true)}
                >
                  申请退款
                </Button>
              )}
              {['pending', 'accepted', 'in_progress'].includes(order.status) && (
                <Popconfirm title="确定取消订单？" onConfirm={handleCancel}>
                  <Button danger block>取消订单</Button>
                </Popconfirm>
              )}
            </Space>
          </Card>

          {order.fees?.length > 0 && (
            <Card title="费用明细">
              <Table
                columns={feeColumns}
                dataSource={order.fees}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title="申请临时加项"
        open={addExamModal}
        onCancel={() => setAddExamModal(false)}
        onOk={handleAddExamination}
      >
        <Form form={addForm} layout="vertical">
          <Form.Item
            label="选择检查项目"
            name="examination_id"
            rules={[{ required: true, message: '请选择检查项目' }]}
          >
            <Select placeholder="请选择">
              {examinations
                .filter(ex => !order.examinations?.find(oe => oe.examination_id === ex.id))
                .map(ex => (
                  <Option key={ex.id} value={ex.id}>
                    {ex.name} - {ex.department} - ¥{ex.price}
                  </Option>
                ))}
            </Select>
          </Form.Item>
          <Alert
            message="加项需审批通过后才能计费"
            type="info"
            showIcon
          />
        </Form>
      </Modal>

      <Modal
        title="计费结算"
        open={billModal}
        onCancel={() => setBillModal(false)}
        onOk={handleBill}
      >
        <Form form={billForm} layout="vertical">
          <Form.Item label="操作员" name="operator">
            <Input placeholder="操作员姓名" />
          </Form.Item>
          <Alert
            message="系统会检查幂等性，重复执行不会重复计费"
            type="info"
            showIcon
          />
        </Form>
      </Modal>

      <Modal
        title="申请退款"
        open={refundModal}
        onCancel={() => setRefundModal(false)}
        onOk={handleRefund}
      >
        <Form form={refundForm} layout="vertical">
          <Form.Item
            label="退款金额"
            name="refund_amount"
            rules={[{ required: true, message: '请输入退款金额' }]}
          >
            <InputNumber
              min={0}
              max={order.total_amount}
              style={{ width: '100%' }}
              placeholder={`最大可退 ¥${order.total_amount}`}
            />
          </Form.Item>
          <Form.Item label="操作员" name="operator">
            <Input placeholder="操作员姓名" />
          </Form.Item>
          <Form.Item label="退款原因" name="reason">
            <TextArea rows={3} />
          </Form.Item>
          <Alert
            message="系统会检查幂等性，相同金额重复执行不会重复退款"
            type="info"
            showIcon
          />
        </Form>
      </Modal>
    </div>
  );
}

export default OrderDetailPage;
