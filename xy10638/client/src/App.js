import React, { useState, useEffect } from 'react';
import { Layout, Tabs, Table, Button, Modal, Form, Input, Select, DatePicker, Space, Tag, message, Card } from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined, ExportOutlined, ReloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { Header, Content } = Layout;
const { Option } = Select;
const { TextArea } = Input;

const API_BASE = 'http://localhost:3001/api';
const CURRENT_USER = '张三';

function App() {
  const [properties, setProperties] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [roomChanges, setRoomChanges] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [logs, setLogs] = useState([]);
  const [dealStatus, setDealStatus] = useState([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [form] = Form.useForm();

  const [logFilters, setLogFilters] = useState({ operator: '', startDate: '', endDate: '' });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = () => {
    loadProperties();
    loadSubscriptions();
    loadDeposits();
    loadRoomChanges();
    loadRefunds();
    loadLogs();
    loadDealStatus();
  };

  const loadProperties = () => axios.get(`${API_BASE}/properties`).then(res => setProperties(res.data));
  const loadSubscriptions = () => axios.get(`${API_BASE}/subscriptions`).then(res => setSubscriptions(res.data));
  const loadDeposits = () => axios.get(`${API_BASE}/deposits`).then(res => setDeposits(res.data));
  const loadRoomChanges = () => axios.get(`${API_BASE}/room-changes`).then(res => setRoomChanges(res.data));
  const loadRefunds = () => axios.get(`${API_BASE}/refunds`).then(res => setRefunds(res.data));
  const loadLogs = (params = logFilters) => {
    axios.get(`${API_BASE}/logs`, { params }).then(res => setLogs(res.data));
  };
  const loadDealStatus = () => axios.get(`${API_BASE}/deal-status`).then(res => setDealStatus(res.data));

  const openModal = (type, record = null) => {
    setModalType(type);
    setSelectedRecord(record);
    form.resetFields();
    if (record) {
      form.setFieldsValue(record);
    }
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      switch (modalType) {
        case 'subscription':
          await axios.post(`${API_BASE}/subscriptions`, { ...values, applicant: CURRENT_USER });
          message.success('认购申请提交成功');
          break;
        case 'deposit':
          await axios.post(`${API_BASE}/deposits`, { ...values, operator: CURRENT_USER });
          message.success('定金支付成功');
          break;
        case 'roomChange':
          await axios.post(`${API_BASE}/room-changes`, { ...values, applicant: CURRENT_USER });
          message.success('换房申请提交成功');
          break;
        case 'refund':
          await axios.post(`${API_BASE}/refunds`, { ...values, applicant: CURRENT_USER });
          message.success('退定申请提交成功');
          break;
        case 'reviewSubscription':
          await axios.put(`${API_BASE}/subscriptions/${selectedRecord.id}/review`, { ...values, reviewer: CURRENT_USER });
          message.success('审核完成');
          break;
        case 'reviewRoomChange':
          await axios.put(`${API_BASE}/room-changes/${selectedRecord.id}/review`, { ...values, reviewer: CURRENT_USER });
          message.success('审核完成');
          break;
        case 'reviewRefund':
          await axios.put(`${API_BASE}/refunds/${selectedRecord.id}/review`, { ...values, reviewer: CURRENT_USER });
          message.success('审核完成');
          break;
      }
      
      setModalVisible(false);
      loadAllData();
    } catch (error) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams(logFilters).toString();
    window.open(`${API_BASE}/export?${params}`);
  };

  const loadSampleData = async () => {
    await axios.post(`${API_BASE}/sample-data`, { operator: CURRENT_USER });
    message.success('样例数据导入成功');
    loadAllData();
  };

  const getStatusTag = (status) => {
    const statusMap = {
      'available': <Tag color="green">可售</Tag>,
      'reserved': <Tag color="blue">已预订</Tag>,
      'pending': <Tag color="orange">待审核</Tag>,
      'approved': <Tag color="green">审核通过</Tag>,
      'rejected': <Tag color="red">审核拒绝</Tag>,
      'confirmed': <Tag color="green">已确认</Tag>,
      'refunded': <Tag color="red">已退款</Tag>,
      'deposit_paid': <Tag color="green">已付定</Tag>
    };
    return statusMap[status] || status;
  };

  const propertyColumns = [
    { title: '房源编号', dataIndex: 'property_no', key: 'property_no' },
    { title: '楼栋', dataIndex: 'building_no', key: 'building_no' },
    { title: '单元', dataIndex: 'unit_no', key: 'unit_no' },
    { title: '房号', dataIndex: 'room_no', key: 'room_no' },
    { title: '面积(㎡)', dataIndex: 'area', key: 'area' },
    { title: '总价(元)', dataIndex: 'price', key: 'price', render: val => val?.toLocaleString() },
    { title: '状态', dataIndex: 'status', key: 'status', render: getStatusTag },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: val => moment(val).format('YYYY-MM-DD HH:mm') }
  ];

  const subscriptionColumns = [
    { title: '认购编号', dataIndex: 'subscription_no', key: 'subscription_no' },
    { title: '客户姓名', dataIndex: 'customer_name', key: 'customer_name' },
    { title: '联系电话', dataIndex: 'customer_phone', key: 'customer_phone' },
    { title: '房源', dataIndex: 'property_no', key: 'property_no' },
    { title: '意向价格', dataIndex: 'intended_price', key: 'intended_price', render: val => val?.toLocaleString() },
    { title: '状态', dataIndex: 'status', key: 'status', render: getStatusTag },
    { title: '申请人', dataIndex: 'applicant', key: 'applicant' },
    { title: '申请时间', dataIndex: 'apply_time', key: 'apply_time', render: val => moment(val).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => record.status === 'pending' && (
        <Button type="link" onClick={() => openModal('reviewSubscription', record)}>审核</Button>
      )
    }
  ];

  const depositColumns = [
    { title: '定金编号', dataIndex: 'deposit_no', key: 'deposit_no' },
    { title: '认购编号', dataIndex: 'subscription_no', key: 'subscription_no' },
    { title: '客户姓名', dataIndex: 'customer_name', key: 'customer_name' },
    { title: '金额', dataIndex: 'amount', key: 'amount', render: val => val?.toLocaleString() },
    { title: '支付方式', dataIndex: 'payment_method', key: 'payment_method' },
    { title: '交易号', dataIndex: 'transaction_no', key: 'transaction_no' },
    { title: '状态', dataIndex: 'status', key: 'status', render: getStatusTag },
    { title: '操作人', dataIndex: 'operator', key: 'operator' },
    { title: '支付时间', dataIndex: 'payment_time', key: 'payment_time', render: val => val ? moment(val).format('YYYY-MM-DD HH:mm') : '-' }
  ];

  const roomChangeColumns = [
    { title: '换房编号', dataIndex: 'change_no', key: 'change_no' },
    { title: '认购编号', dataIndex: 'subscription_no', key: 'subscription_no' },
    { title: '客户姓名', dataIndex: 'customer_name', key: 'customer_name' },
    { title: '原房源', dataIndex: 'old_property_no', key: 'old_property_no' },
    { title: '新房源', dataIndex: 'new_property_no', key: 'new_property_no' },
    { title: '差价', dataIndex: 'price_diff', key: 'price_diff', render: val => val?.toLocaleString() },
    { title: '原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
    { title: '状态', dataIndex: 'status', key: 'status', render: getStatusTag },
    { title: '申请人', dataIndex: 'applicant', key: 'applicant' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => record.status === 'pending' && (
        <Button type="link" onClick={() => openModal('reviewRoomChange', record)}>审核</Button>
      )
    }
  ];

  const refundColumns = [
    { title: '退款编号', dataIndex: 'refund_no', key: 'refund_no' },
    { title: '认购编号', dataIndex: 'subscription_no', key: 'subscription_no' },
    { title: '客户姓名', dataIndex: 'customer_name', key: 'customer_name' },
    { title: '原定金金额', dataIndex: 'deposit_amount', key: 'deposit_amount', render: val => val?.toLocaleString() },
    { title: '退款金额', dataIndex: 'amount', key: 'amount', render: val => val?.toLocaleString() },
    { title: '原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
    { title: '状态', dataIndex: 'status', key: 'status', render: getStatusTag },
    { title: '申请人', dataIndex: 'applicant', key: 'applicant' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => record.status === 'pending' && (
        <Button type="link" onClick={() => openModal('reviewRefund', record)}>审核</Button>
      )
    }
  ];

  const logColumns = [
    { title: '模块', dataIndex: 'module', key: 'module' },
    { title: '操作类型', dataIndex: 'operation_type', key: 'operation_type' },
    { title: '操作人', dataIndex: 'operator', key: 'operator' },
    { title: '操作时间', dataIndex: 'operation_time', key: 'operation_time', render: val => moment(val).format('YYYY-MM-DD HH:mm:ss') },
    { title: '备注', dataIndex: 'remark', key: 'remark' },
    { title: '原值', dataIndex: 'old_value', key: 'old_value', ellipsis: true, render: val => val ? JSON.stringify(JSON.parse(val)).substring(0, 50) + '...' : '-' },
    { title: '新值', dataIndex: 'new_value', key: 'new_value', ellipsis: true, render: val => val ? JSON.stringify(JSON.parse(val)).substring(0, 50) + '...' : '-' }
  ];

  const dealStatusColumns = [
    { title: '认购编号', dataIndex: 'subscription_no', key: 'subscription_no' },
    { title: '客户姓名', dataIndex: 'customer_name', key: 'customer_name' },
    { title: '房源', dataIndex: 'property_no', key: 'property_no' },
    { title: '成交状态', dataIndex: 'status', key: 'status', render: getStatusTag },
    { title: '成交时间', dataIndex: 'deal_time', key: 'deal_time', render: val => val ? moment(val).format('YYYY-MM-DD HH:mm') : '-' },
    { title: '操作人', dataIndex: 'operator', key: 'operator' }
  ];

  const renderModalContent = () => {
    switch (modalType) {
      case 'subscription':
        return (
          <Form form={form} layout="vertical">
            <Form.Item name="property_id" label="选择房源" rules={[{ required: true }]}>
              <Select placeholder="请选择房源">
                {properties.filter(p => p.status === 'available').map(p => (
                  <Option key={p.id} value={p.id}>{p.property_no} - {p.room_no} ({(p.price / 10000).toFixed(1)}万)</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="customer_name" label="客户姓名" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="customer_phone" label="联系电话" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="id_card" label="身份证号" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="intended_price" label="意向价格" rules={[{ required: true }]}>
              <Input type="number" />
            </Form.Item>
          </Form>
        );
      case 'deposit':
        return (
          <Form form={form} layout="vertical">
            <Form.Item name="subscription_id" label="选择认购" rules={[{ required: true }]}>
              <Select placeholder="请选择认购申请">
                {subscriptions.filter(s => s.status === 'approved').map(s => (
                  <Option key={s.id} value={s.id}>{s.subscription_no} - {s.customer_name}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="amount" label="定金金额" rules={[{ required: true }]}>
              <Input type="number" />
            </Form.Item>
            <Form.Item name="payment_method" label="支付方式" rules={[{ required: true }]}>
              <Select>
                <Option value="cash">现金</Option>
                <Option value="bank">银行转账</Option>
                <Option value="wechat">微信</Option>
                <Option value="alipay">支付宝</Option>
              </Select>
            </Form.Item>
            <Form.Item name="transaction_no" label="交易号">
              <Input />
            </Form.Item>
          </Form>
        );
      case 'roomChange':
        return (
          <Form form={form} layout="vertical">
            <Form.Item name="subscription_id" label="选择认购" rules={[{ required: true }]}>
              <Select placeholder="请选择认购申请">
                {subscriptions.filter(s => s.status !== 'refunded').map(s => (
                  <Option key={s.id} value={s.id}>{s.subscription_no} - {s.customer_name}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="new_property_id" label="新房源" rules={[{ required: true }]}>
              <Select placeholder="请选择新房源">
                {properties.filter(p => p.status === 'available').map(p => (
                  <Option key={p.id} value={p.id}>{p.property_no} - {p.room_no}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="reason" label="换房原因" rules={[{ required: true }]}>
              <TextArea rows={3} />
            </Form.Item>
          </Form>
        );
      case 'refund':
        return (
          <Form form={form} layout="vertical">
            <Form.Item name="subscription_id" label="选择认购" rules={[{ required: true }]}>
              <Select placeholder="请选择认购申请">
                {subscriptions.filter(s => s.status !== 'refunded').map(s => (
                  <Option key={s.id} value={s.id}>{s.subscription_no} - {s.customer_name}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="deposit_id" label="选择定金记录" rules={[{ required: true }]}>
              <Select placeholder="请选择定金记录">
                {deposits.filter(d => d.status === 'confirmed').map(d => (
                  <Option key={d.id} value={d.id}>{d.deposit_no} - {d.amount}元</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="amount" label="退款金额" rules={[{ required: true }]}>
              <Input type="number" />
            </Form.Item>
            <Form.Item name="reason" label="退款原因" rules={[{ required: true }]}>
              <TextArea rows={3} />
            </Form.Item>
          </Form>
        );
      case 'reviewSubscription':
      case 'reviewRoomChange':
      case 'reviewRefund':
        return (
          <Form form={form} layout="vertical">
            <Form.Item name="status" label="审核结果" rules={[{ required: true }]}>
              <Select>
                <Option value="approved">审核通过</Option>
                <Option value="rejected">审核拒绝</Option>
              </Select>
            </Form.Item>
            <Form.Item name="review_comment" label="审核意见">
              <TextArea rows={3} />
            </Form.Item>
          </Form>
        );
      default:
        return null;
    }
  };

  const getModalTitle = () => {
    const titles = {
      'subscription': '新增认购申请',
      'deposit': '定金支付',
      'roomChange': '换房申请',
      'refund': '退定申请',
      'reviewSubscription': '认购审核',
      'reviewRoomChange': '换房审核',
      'reviewRefund': '退定审核'
    };
    return titles[modalType];
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>售楼认购锁房定金系统</h1>
          <Space>
            <span>当前用户：{CURRENT_USER}</span>
            <Button icon={<ReloadOutlined />} onClick={loadAllData}>刷新</Button>
            <Button type="primary" onClick={loadSampleData}>导入样例数据</Button>
          </Space>
        </div>
      </Header>
      <Content style={{ padding: '24px' }}>
        <Card>
          <Tabs defaultActiveKey="properties" items={[
            {
              key: 'properties',
              label: '房源销控',
              children: (
                <>
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                    <Space>
                      <Tag color="green">可售：{properties.filter(p => p.status === 'available').length}</Tag>
                      <Tag color="blue">已预订：{properties.filter(p => p.status === 'reserved').length}</Tag>
                    </Space>
                  </div>
                  <Table columns={propertyColumns} dataSource={properties} rowKey="id" />
                </>
              )
            },
            {
              key: 'subscriptions',
              label: '认购申请',
              children: (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal('subscription')}>
                      新增认购
                    </Button>
                  </div>
                  <Table columns={subscriptionColumns} dataSource={subscriptions} rowKey="id" />
                </>
              )
            },
            {
              key: 'deposits',
              label: '定金支付',
              children: (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal('deposit')}>
                      新增支付
                    </Button>
                  </div>
                  <Table columns={depositColumns} dataSource={deposits} rowKey="id" />
                </>
              )
            },
            {
              key: 'roomChanges',
              label: '换房审批',
              children: (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal('roomChange')}>
                      换房申请
                    </Button>
                  </div>
                  <Table columns={roomChangeColumns} dataSource={roomChanges} rowKey="id" />
                </>
              )
            },
            {
              key: 'refunds',
              label: '退定流程',
              children: (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal('refund')}>
                      退定申请
                    </Button>
                  </div>
                  <Table columns={refundColumns} dataSource={refunds} rowKey="id" />
                </>
              )
            },
            {
              key: 'dealStatus',
              label: '成交状态',
              children: (
                <Table columns={dealStatusColumns} dataSource={dealStatus} rowKey="id" />
              )
            },
            {
              key: 'logs',
              label: '操作日志',
              children: (
                <>
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                    <Space>
                      <Input
                        placeholder="操作人"
                        style={{ width: 150 }}
                        value={logFilters.operator}
                        onChange={e => setLogFilters({ ...logFilters, operator: e.target.value })}
                      />
                      <DatePicker
                        placeholder="开始日期"
                        value={logFilters.startDate ? moment(logFilters.startDate) : null}
                        onChange={(date, dateString) => setLogFilters({ ...logFilters, startDate: dateString })}
                      />
                      <DatePicker
                        placeholder="结束日期"
                        value={logFilters.endDate ? moment(logFilters.endDate) : null}
                        onChange={(date, dateString) => setLogFilters({ ...logFilters, endDate: dateString })}
                      />
                      <Button onClick={() => loadLogs()}>查询</Button>
                    </Space>
                    <Button type="primary" icon={<ExportOutlined />} onClick={handleExport}>
                      导出报告
                    </Button>
                  </div>
                  <Table columns={logColumns} dataSource={logs} rowKey="id" />
                </>
              )
            }
          ]} />
        </Card>
      </Content>

      <Modal
        title={getModalTitle()}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确认"
        cancelText="取消"
      >
        {renderModalContent()}
      </Modal>
    </Layout>
  );
}

export default App;
