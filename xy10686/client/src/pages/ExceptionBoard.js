import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Button, Space, message, Modal, Form, Input, Select } from 'antd';
import { AlertOutlined, WarningOutlined, CheckCircleOutlined, DollarOutlined, SyncOutlined } from '@ant-design/icons';
import { inspectionApi, orderApi, paymentApi } from '../api';

const ExceptionBoard = () => {
  const [loading, setLoading] = useState(false);
  const [pendingReturns, setPendingReturns] = useState([]);
  const [paymentVerifyList, setPaymentVerifyList] = useState([]);
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [inspectionRes, orderRes] = await Promise.all([
        inspectionApi.getAll(),
        orderApi.getAll()
      ]);

      if (inspectionRes.data.success) {
        const pending = inspectionRes.data.data.filter(
          item => !item.isReturnProcessed && item.rejectedQuantity > 0
        );
        setPendingReturns(pending);
      }

      if (orderRes.data.success) {
        const forVerify = orderRes.data.data.filter(
          item => item.status === 'inspected' || item.status === 'delivered'
        );
        setPaymentVerifyList(forVerify);
      }
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentVerify = async (record) => {
    setSelectedOrder(record);
    setVerifyModalVisible(true);
  };

  const submitVerify = async () => {
    try {
      const values = await form.validateFields();
      await paymentApi.verify({
        orderId: selectedOrder.id,
        operator: values.operator
      });
      message.success('付款节点复核通过');
      setVerifyModalVisible(false);
      fetchData();
    } catch (error) {
      message.error(error.response?.data?.message || '复核失败');
    }
  };

  const returnColumns = [
    { title: '验收单号', dataIndex: 'inspectionNo', key: 'inspectionNo', width: 120 },
    { title: '订单编号', key: 'orderNo', render: (_, r) => r.order?.orderNo, width: 120 },
    { title: '项目名称', key: 'projectName', render: (_, r) => r.order?.projectName, width: 150 },
    { title: '材料名称', key: 'materialName', render: (_, r) => r.order?.materialName, width: 120 },
    { title: '拒收数量', dataIndex: 'rejectedQuantity', key: 'rejectedQuantity', width: 100 },
    { title: '拒收原因', dataIndex: 'rejectReason', key: 'rejectReason', width: 200, ellipsis: true },
    { title: '质检员', dataIndex: 'inspector', key: 'inspector', width: 80 },
    {
      title: '状态',
      dataIndex: 'isReturnProcessed',
      key: 'status',
      width: 100,
      render: (processed) => (
        <Tag color={processed ? 'success' : 'error'}>
          {processed ? '已处理' : '待处理'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          danger
          onClick={() => handleProcessReturn(record)}
        >
          处理退货
        </Button>
      )
    }
  ];

  const paymentColumns = [
    { title: '订单编号', dataIndex: 'orderNo', key: 'orderNo', width: 120 },
    { title: '项目名称', dataIndex: 'projectName', key: 'projectName', width: 150 },
    { title: '材料名称', dataIndex: 'materialName', key: 'materialName', width: 120 },
    { title: '总金额', dataIndex: 'totalAmount', key: 'totalAmount', width: 100 },
    { title: '供应商', dataIndex: 'supplier', key: 'supplier', width: 150 },
    { title: '责任人', dataIndex: 'responsiblePerson', key: 'responsiblePerson', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const statusMap = {
          pending: { text: '待送货', color: 'default' },
          delivered: { text: '已送货', color: 'processing' },
          inspected: { text: '已验收', color: 'purple' },
          completed: { text: '已完成', color: 'success' }
        };
        const info = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<DollarOutlined />}
          onClick={() => handlePaymentVerify(record)}
        >
          复核付款
        </Button>
      )
    }
  ];

  const handleProcessReturn = async (record) => {
    try {
      await inspectionApi.processReturn(record.id, 'current_user');
      message.success('退货处理完成');
      fetchData();
    } catch (error) {
      message.error('处理失败');
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>异常看板</h2>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card" style={{ borderLeft: '4px solid #ff4d4f' }}>
            <Statistic
              title="待处理退货"
              value={pendingReturns.length}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<AlertOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card" style={{ borderLeft: '4px solid #faad14' }}>
            <Statistic
              title="待付款复核"
              value={paymentVerifyList.length}
              valueStyle={{ color: '#faad14' }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <WarningOutlined style={{ color: '#ff4d4f' }} />
            待处理退货列表
          </Space>
        }
        style={{ marginBottom: 24 }}
        extra={
          <Button icon={<SyncOutlined />} onClick={fetchData} size="small">
            刷新
          </Button>
        }
      >
        <Table
          columns={returnColumns}
          dataSource={pendingReturns}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1100 }}
        />
      </Card>

      <Card
        title={
          <Space>
            <DollarOutlined style={{ color: '#faad14' }} />
            付款节点复核列表
          </Space>
        }
        extra={
          <Button icon={<SyncOutlined />} onClick={fetchData} size="small">
            刷新
          </Button>
        }
      >
        <Table
          columns={paymentColumns}
          dataSource={paymentVerifyList}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Modal
        title="付款节点复核"
        open={verifyModalVisible}
        onOk={submitVerify}
        onCancel={() => setVerifyModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="订单编号">
            <Input value={selectedOrder?.orderNo} disabled />
          </Form.Item>
          <Form.Item label="项目名称">
            <Input value={selectedOrder?.projectName} disabled />
          </Form.Item>
          <Form.Item name="operator" label="复核人" rules={[{ required: true, message: '请输入复核人' }]}>
            <Input placeholder="请输入复核人姓名" />
          </Form.Item>
          <div style={{ padding: '12px', background: '#fffbe6', borderRadius: '4px' }}>
            <p style={{ margin: 0 }}>
              <WarningOutlined style={{ marginRight: 8, color: '#faad14' }} />
              复核将验证送货数量与验收合格数量是否一致，以及是否存在未处理退货。
            </p>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default ExceptionBoard;
