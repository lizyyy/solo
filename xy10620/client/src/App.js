import React, { useState, useEffect } from 'react';
import { Layout, Menu, Table, Button, Input, Select, DatePicker, Space, Card, Modal, Form, Upload, message, Tag, Timeline, Tabs, Badge, Row, Col, Statistic } from 'antd';
import { UploadOutlined, DownloadOutlined, FilterOutlined, ReloadOutlined, CheckOutlined, CloseOutlined, ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined, ToolOutlined, RetweetOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Header, Content, Sider } = Layout;
const { Option } = Select;
const { TabPane } = Tabs;

const api = axios.create({ baseURL: '/api' });

const App = () => {
  const [activeKey, setActiveKey] = useState('1');
  const [appointments, setAppointments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [reschedules, setReschedules] = useState([]);
  const [yieldLimits, setYieldLimits] = useState([]);
  const [weatherDelays, setWeatherDelays] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [form] = Form.useForm();
  const [rescheduleForm] = Form.useForm();

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.customer_name) params.customer_name = filters.customer_name;
      if (filters.status) params.status = filters.status;
      if (filters.batch_id) params.batch_id = filters.batch_id;
      const res = await api.get('/timeline', {});
      setTimeline(res.data);
      const res2 = await api.get('/appointments', { params });
      setAppointments(res2.data);
    } catch (err) {
      message.error('加载数据失败');
    }
    setLoading(false);
  };

  const fetchBatches = async () => {
    try {
      const res = await api.get('/batches');
      setBatches(res.data);
    } catch (err) {
      message.error('加载批次失败');
    }
  };

  const fetchReschedules = async () => {
    try {
      const res = await api.get('/reschedules');
      setReschedules(res.data);
    } catch (err) {
      message.error('加载改期记录失败');
    }
  };

  const fetchYieldLimits = async () => {
    try {
      const res = await api.get('/yield-limits');
      setYieldLimits(res.data);
    } catch (err) {
      message.error('加载产量预警失败');
    }
  };

  const fetchWeatherDelays = async () => {
    try {
      const res = await api.get('/weather-delays');
      setWeatherDelays(res.data);
    } catch (err) {
      message.error('加载天气延期失败');
    }
  };

  useEffect(() => {
    fetchAppointments();
    fetchBatches();
    fetchReschedules();
    fetchYieldLimits();
    fetchWeatherDelays();
  }, [filters]);

  const handleExport = async () => {
    try {
      const res = await api.get('/appointments/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'appointments.csv';
      link.click();
      message.success('导出成功');
    } catch (err) {
      message.error('导出失败');
    }
  };

  const handleImport = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/appointments/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success(`成功导入 ${res.data.imported} 条记录`);
      fetchAppointments();
    } catch (err) {
      message.error('导入失败');
    }
    return false;
  };

  const handleDemo = async (type) => {
    try {
      setLoading(true);
      await api.get(`/demo/${type}`);
      message.success('演示数据已生成');
      fetchAppointments();
      fetchReschedules();
      fetchYieldLimits();
    } catch (err) {
      message.error('生成演示数据失败');
    }
    setLoading(false);
  };

  const handleReschedule = async (values) => {
    try {
      const res = await api.post('/reschedules', {
        appointmentId: selectedRecord.id,
        newDate: dayjs(values.newDate).format('YYYY-MM-DD'),
        reason: values.reason,
        operator: 'admin'
      });
      if (res.data.success) {
        message.success('改期申请已提交');
        setRescheduleModalVisible(false);
        fetchReschedules();
        fetchAppointments();
      } else {
        message.error(res.data.reason || '改期失败');
      }
    } catch (err) {
      message.error('改期失败');
    }
  };

  const handleReview = async (approved) => {
    try {
      const res = await api.post(`/reschedules/${selectedRecord.id}/review`, {
        approved,
        reviewed_by: 'admin',
        notes: approved ? '审核通过' : '审核拒绝'
      });
      if (res.data.success) {
        message.success(approved ? '审核通过' : '已拒绝');
        setReviewModalVisible(false);
        fetchReschedules();
      }
    } catch (err) {
      message.error('审核失败');
    }
  };

  const columns = [
    { title: '客户姓名', dataIndex: 'customer_name', key: 'customer_name' },
    { title: '联系电话', dataIndex: 'customer_phone', key: 'customer_phone' },
    { title: '果园批次', dataIndex: 'batch_code', key: 'batch_code' },
    { title: '水果类型', dataIndex: 'fruit_type', key: 'fruit_type' },
    { title: '预约日期', dataIndex: 'appointment_date', key: 'appointment_date' },
    { title: '数量(kg)', dataIndex: 'quantity', key: 'quantity' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => {
        const colorMap = {
          pending: 'orange',
          confirmed: 'green',
          cancelled: 'red',
          rescheduled: 'blue'
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => { setSelectedRecord(record); setRescheduleModalVisible(true); }}>改期</Button>
        </Space>
      )
    }
  ];

  const rescheduleColumns = [
    { title: '时间', dataIndex: 'created_at', key: 'created_at', render: (t) => dayjs(t).format('YYYY-MM-DD HH:mm:ss') },
    { title: '类型', dataIndex: 'entity_type', key: 'entity_type', render: (t) => <Tag>{t}</Tag> },
    { title: '操作', dataIndex: 'action', key: 'action' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '操作人', dataIndex: 'operator', key: 'operator' }
  ];

  const demoButtons = [
    { key: 'success', label: '成功路径', icon: <CheckCircleOutlined />, type: 'primary', description: '演示正常改期流程' },
    { key: 'blocked', label: '拦截路径', icon: <CloseCircleOutlined />, type: 'danger', description: '演示产量超限拦截' },
    { key: 'manual', label: '人工修正', icon: <ToolOutlined />, type: 'warning', description: '演示人工修正流程' },
    { key: 'duplicate', label: '重复提交', icon: <RetweetOutlined />, type: 'default', description: '演示幂等性处理' }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px' }}>
        <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>
          🍎 农场采摘预售改期管理系统
        </div>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            defaultSelectedKeys={['1']}
            defaultOpenKeys={['sub1']}
            style={{ height: '100%', borderRight: 0 }}
            items={[
              { key: '1', label: '预约管理' },
              { key: '2', label: '改期记录' },
              { key: '3', label: '产量预警' },
              { key: '4', label: '天气延期' },
              { key: '5', label: '系统演示' }
            ]}
            onClick={({ key }) => setActiveKey(key)}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content>
            {activeKey === '1' && (
              <div>
                <Card title="预约管理" extra={
                  <Space>
                    <Button icon={<DownloadOutlined />} onClick={handleExport}>导出</Button>
                    <Upload beforeUpload={handleImport} showUploadList={false}>
                      <Button icon={<UploadOutlined />}>批量导入</Button>
                    </Upload>
                  </Space>
                }>
                  <Space style={{ marginBottom: 16 }} wrap>
                    <Input
                      placeholder="客户姓名"
                      style={{ width: 200 }}
                      allowClear
                      onChange={(e) => setFilters({ ...filters, customer_name: e.target.value })}
                    />
                    <Select
                      placeholder="状态"
                      style={{ width: 150 }}
                      allowClear
                      onChange={(v) => setFilters({ ...filters, status: v })}
                    >
                      <Option value="pending">待确认</Option>
                      <Option value="confirmed">已确认</Option>
                      <Option value="cancelled">已取消</Option>
                      <Option value="rescheduled">已改期</Option>
                    </Select>
                    <Select
                      placeholder="批次"
                      style={{ width: 200 }}
                      allowClear
                      onChange={(v) => setFilters({ ...filters, batch_id: v })}
                    >
                      {batches.map(b => (
                        <Option key={b.id} value={b.id}>{b.batch_code}</Option>
                      ))}
                    </Select>
                    <Button icon={<ReloadOutlined />} onClick={fetchAppointments}>刷新</Button>
                  </Space>
                  <Table
                    columns={columns}
                    dataSource={appointments}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                  />
                </Card>
              </div>
            )}

            {activeKey === '2' && (
              <Card title="改期记录">
                <Table
                  columns={[
                    { title: '时间', dataIndex: 'created_at', render: (t) => dayjs(t).format('YYYY-MM-DD HH:mm') },
                    { title: '客户', dataIndex: 'customer_name' },
                    { title: '原日期', dataIndex: 'original_date' },
                    { title: '新日期', dataIndex: 'new_date' },
                    { title: '原因', dataIndex: 'reason' },
                    { 
                      title: '状态', 
                      dataIndex: 'status',
                      render: (s) => {
                        const colors = { pending_review: 'orange', approved: 'green', rejected: 'red', failed: 'default' };
                        return <Tag color={colors[s]}>{s}</Tag>;
                      }
                    },
                    {
                      title: '操作',
                      render: (_, record) => record.status === 'pending_review' && (
                        <Button size="small" onClick={() => { setSelectedRecord(record); setReviewModalVisible(true); }}>
                          审核
                        </Button>
                      )
                    }
                  ]}
                  dataSource={reschedules}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            )}

            {activeKey === '3' && (
              <Card title="产量预警">
                <Table
                  columns={[
                    { title: '时间', dataIndex: 'created_at', render: (t) => dayjs(t).format('YYYY-MM-DD HH:mm') },
                    { title: '批次', dataIndex: 'batch_code' },
                    { title: '阈值', dataIndex: 'threshold' },
                    { title: '当前值', dataIndex: 'current_value' },
                    { 
                      title: '级别', 
                      dataIndex: 'alert_level',
                      render: (l) => <Tag color={l === 'critical' ? 'red' : 'orange'}>{l}</Tag>
                    }
                  ]}
                  dataSource={yieldLimits}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            )}

            {activeKey === '4' && (
              <Card title="天气延期">
                <Table
                  columns={[
                    { title: '时间', dataIndex: 'created_at', render: (t) => dayjs(t).format('YYYY-MM-DD HH:mm') },
                    { title: '批次', dataIndex: 'batch_code' },
                    { title: '延期原因', dataIndex: 'delay_reason' },
                    { title: '原日期', dataIndex: 'original_date' },
                    { title: '新日期', dataIndex: 'new_date' },
                    { title: '影响级别', dataIndex: 'impact_level', render: (l) => <Tag>{l}</Tag> }
                  ]}
                  dataSource={weatherDelays}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            )}

            {activeKey === '5' && (
              <Card title="系统演示">
                <Row gutter={[16, 16]}>
                  {demoButtons.map(item => (
                    <Col span={12} key={item.key}>
                      <Card hoverable>
                        <Statistic
                          title={
                            <Space>
                              {item.icon}
                              {item.label}
                            </Space>
                          }
                          value={item.description}
                          valueStyle={{ fontSize: '14px', color: '#666' }}
                        />
                        <Button
                          type={item.type === 'primary' ? 'primary' : item.type === 'danger' ? 'primary' : 'default'}
                          danger={item.type === 'danger'}
                          style={{ marginTop: 16, width: '100%' }}
                          onClick={() => handleDemo(item.key)}
                          loading={loading}
                        >
                          运行演示
                        </Button>
                      </Card>
                    </Col>
                  ))}
                </Row>
                <Card title="操作日志" style={{ marginTop: 24 }}>
                  <Table
                    columns={rescheduleColumns}
                    dataSource={timeline}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                  />
                </Card>
              </Card>
            )}
          </Content>
        </Layout>
      </Layout>

      <Modal
        title="改期申请"
        open={rescheduleModalVisible}
        onCancel={() => setRescheduleModalVisible(false)}
        onOk={() => rescheduleForm.submit()}
      >
        <Form form={rescheduleForm} onFinish={handleReschedule}>
          <Form.Item name="newDate" label="新日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="改期原因" rules={[{ required: true }]}>
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="改期审核"
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        footer={[
          <Button key="reject" danger onClick={() => handleReview(false)}>拒绝</Button>,
          <Button key="approve" type="primary" onClick={() => handleReview(true)}>通过</Button>
        ]}
      >
        {selectedRecord && (
          <div>
            <p><strong>客户:</strong> {selectedRecord.customer_name}</p>
            <p><strong>原日期:</strong> {selectedRecord.original_date}</p>
            <p><strong>新日期:</strong> {selectedRecord.new_date}</p>
            <p><strong>原因:</strong> {selectedRecord.reason}</p>
          </div>
        )}
      </Modal>
    </Layout>
  );
};

export default App;
