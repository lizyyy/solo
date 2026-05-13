import React, { useState, useEffect } from 'react';
import { Layout, Menu, Typography, Card, Row, Col, Table, Button, Modal, Form, Input, Select, DatePicker, Space, Tag, message, Statistic } from 'antd';
import { DashboardOutlined, TableOutlined, QueueOutlined, MergeOutlined, FileTextOutlined, UserOutlined, PhoneOutlined, PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, UndoOutlined, ExclamationCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const App = () => {
  const [activeKey, setActiveKey] = useState('1');
  const [tableTypes, setTableTypes] = useState([]);
  const [tables, setTables] = useState([]);
  const [queues, setQueues] = useState([]);
  const [merges, setMerges] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalType, setModalType] = useState('');
  const [form] = Form.useForm();
  const [filters, setFilters] = useState({});

  useEffect(() => {
    loadData();
  }, [activeKey, filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeKey === '1') {
        const [queuesRes, tablesRes, typesRes] = await Promise.all([
          axios.get('/api/queues'),
          axios.get('/api/tables'),
          axios.get('/api/table-types')
        ]);
        setQueues(queuesRes.data.data);
        setTables(tablesRes.data.data);
        setTableTypes(typesRes.data.data);
      } else if (activeKey === '2') {
        const res = await axios.get('/api/queues', { params: filters });
        setQueues(res.data.data);
      } else if (activeKey === '3') {
        const res = await axios.get('/api/merges', { params: filters });
        setMerges(res.data.data);
      } else if (activeKey === '4') {
        const res = await axios.get('/api/reports', { params: filters });
        setReports(res.data.data);
      }
    } catch (error) {
      message.error('数据加载失败');
    }
    setLoading(false);
  };

  const handleMenuClick = (e) => {
    setActiveKey(e.key);
  };

  const showModal = (type, record = {}) => {
    setModalType(type);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (modalType === 'createQueue') {
        await axios.post('/api/queues', values);
        message.success('排号创建成功');
      }
      setIsModalVisible(false);
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleQueueAction = async (id, action, extraData = {}) => {
    try {
      await axios.put(`/api/queues/${id}/${action}`, extraData);
      message.success('操作成功');
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const exportReport = async () => {
    try {
      const response = await axios.get('/api/reports/export', {
        params: filters,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `queue_report_${moment().format('YYYY-MM-DD')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const dashboardColumns = [
    { title: '排号', dataIndex: 'queue_number', key: 'queue_number', width: 100 },
    { title: '顾客', dataIndex: 'customer_name', key: 'customer_name', width: 100 },
    { title: '人数', dataIndex: 'party_size', key: 'party_size', width: 80 },
    { title: '桌台类型', dataIndex: 'table_type_name', key: 'table_type_name', width: 120 },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status', 
      width: 100,
      render: (status) => {
        const statusMap = {
          waiting: <Tag color="blue">等待中</Tag>,
          calling: <Tag color="orange">呼叫中</Tag>,
          seated: <Tag color="green">已入座</Tag>,
          completed: <Tag color="default">已完成</Tag>,
          cancelled: <Tag color="red">已取消</Tag>,
          skipped: <Tag color="red">过号</Tag>
        };
        return statusMap[status] || status;
      }
    },
    { title: '取号时间', dataIndex: 'checkin_time', key: 'checkin_time', width: 180, render: (t) => t ? moment(t).format('YYYY-MM-DD HH:mm') : '-' },
    {
      title: '操作',
      key: 'action',
      width: 300,
      render: (_, record) => (
        <Space size="small">
          {record.status === 'waiting' && (
            <>
              <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleQueueAction(record.id, 'call')}>呼叫</Button>
              <Button size="small" danger icon={<ExclamationCircleOutlined />} onClick={() => handleQueueAction(record.id, 'skip', { reason: '顾客不在' })}>过号</Button>
            </>
          )}
          {record.status === 'skipped' && (
            <Button size="small" icon={<UndoOutlined />} onClick={() => handleQueueAction(record.id, 'restore')}>恢复</Button>
          )}
          {record.status === 'calling' && (
            <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => {
              const availableTable = tables.find(t => t.status === 'available' && t.type_id === record.table_type_id);
              if (availableTable) {
                handleQueueAction(record.id, 'seat', { table_id: availableTable.id });
              } else {
                message.warning('没有可用桌台');
              }
            }}>入座</Button>
          )}
        </Space>
      )
    }
  ];

  const queueColumns = [
    ...dashboardColumns.slice(0, -1),
    { title: '呼叫时间', dataIndex: 'call_time', key: 'call_time', width: 180, render: (t) => t ? moment(t).format('YYYY-MM-DD HH:mm') : '-' },
    { title: '入座时间', dataIndex: 'seating_time', key: 'seating_time', width: 180, render: (t) => t ? moment(t).format('YYYY-MM-DD HH:mm') : '-' },
    { title: '桌台号', dataIndex: 'table_number', key: 'table_number', width: 100 }
  ];

  const renderDashboard = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic title="等待排号" value={queues.filter(q => q.status === 'waiting').length} prefix={<QueueOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="呼叫中" value={queues.filter(q => q.status === 'calling').length} prefix={<PlayCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已入座" value={queues.filter(q => q.status === 'seated').length} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="过号" value={queues.filter(q => q.status === 'skipped').length} prefix={<ExclamationCircleOutlined />} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>

      <Card title="桌台状态" extra={<Button type="primary" onClick={() => showModal('createQueue')}>新建排号</Button>}>
        <Row gutter={[16, 16]}>
          {tables.map(table => (
            <Col span={4} key={table.id}>
              <Card size="small" style={{ textAlign: 'center', backgroundColor: table.status === 'available' ? '#f6ffed' : table.status === 'occupied' ? '#fff2f0' : '#f5f5f5' }}>
                <Text strong>{table.table_number}</Text>
                <br />
                <Tag color={table.status === 'available' ? 'green' : table.status === 'occupied' ? 'red' : 'default'}>
                  {table.status === 'available' ? '空闲' : table.status === 'occupied' ? '占用' : '其他'}
                </Tag>
                <br />
                <Text type="secondary">{table.type_name}</Text>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title="排号列表">
        <Table
          columns={dashboardColumns}
          dataSource={queues.filter(q => ['waiting', 'calling', 'skipped'].includes(q.status))}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </Space>
  );

  const renderQueueManagement = () => (
    <Card
      title="排号管理"
      extra={
        <Space>
          <Select placeholder="状态筛选" style={{ width: 120 }} allowClear onChange={(v) => setFilters({ ...filters, status: v })}>
            <Option value="waiting">等待中</Option>
            <Option value="calling">呼叫中</Option>
            <Option value="seated">已入座</Option>
            <Option value="completed">已完成</Option>
            <Option value="cancelled">已取消</Option>
            <Option value="skipped">过号</Option>
          </Select>
          <Select placeholder="桌台类型" style={{ width: 120 }} allowClear onChange={(v) => setFilters({ ...filters, table_type_id: v })}>
            {tableTypes.map(t => <Option key={t.id} value={t.id}>{t.name}</Option>)}
          </Select>
          <Button type="primary" onClick={() => showModal('createQueue')}>新建排号</Button>
        </Space>
      }
    >
      <Table
        columns={queueColumns}
        dataSource={queues}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );

  const renderMergeManagement = () => (
    <Card title="拼桌管理">
      <Table
        columns={[
          { title: '排号1', dataIndex: 'queue_number_1', key: 'queue_number_1' },
          { title: '顾客1', dataIndex: 'customer_name_1', key: 'customer_name_1' },
          { title: '人数1', dataIndex: 'party_size_1', key: 'party_size_1' },
          { title: '排号2', dataIndex: 'queue_number_2', key: 'queue_number_2' },
          { title: '顾客2', dataIndex: 'customer_name_2', key: 'customer_name_2' },
          { title: '人数2', dataIndex: 'party_size_2', key: 'party_size_2' },
          { 
            title: '状态', 
            dataIndex: 'status', 
            key: 'status',
            render: (s) => {
              const map = { pending: <Tag color="orange">待审批</Tag>, approved: <Tag color="green">已批准</Tag>, rejected: <Tag color="red">已拒绝</Tag> };
              return map[s] || s;
            }
          },
          { title: '申请时间', dataIndex: 'created_at', key: 'created_at', render: (t) => t ? moment(t).format('YYYY-MM-DD HH:mm') : '-' }
        ]}
        dataSource={merges}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );

  const renderReports = () => (
    <Card
      title="报表导出"
      extra={
        <Space>
          <RangePicker onChange={(dates) => setFilters({ ...filters, start_date: dates?.[0]?.format('YYYY-MM-DD'), end_date: dates?.[1]?.format('YYYY-MM-DD') })} />
          <Select placeholder="状态筛选" style={{ width: 120 }} allowClear onChange={(v) => setFilters({ ...filters, status: v })}>
            <Option value="waiting">等待中</Option>
            <Option value="calling">呼叫中</Option>
            <Option value="seated">已入座</Option>
            <Option value="completed">已完成</Option>
            <Option value="cancelled">已取消</Option>
          </Select>
          <Button type="primary" icon={<DownloadOutlined />} onClick={exportReport}>导出Excel</Button>
        </Space>
      }
    >
      <Table
        columns={[
          { title: '排号', dataIndex: 'queue_number', key: 'queue_number' },
          { title: '顾客', dataIndex: 'customer_name', key: 'customer_name' },
          { title: '联系电话', dataIndex: 'phone', key: 'phone' },
          { title: '人数', dataIndex: 'party_size', key: 'party_size' },
          { title: '桌台类型', dataIndex: 'table_type', key: 'table_type' },
          { title: '状态', dataIndex: 'status', key: 'status' },
          { title: '桌台号', dataIndex: 'table_number', key: 'table_number' },
          { title: '取号时间', dataIndex: 'checkin_time', key: 'checkin_time', render: (t) => t ? moment(t).format('YYYY-MM-DD HH:mm') : '-' },
          { title: '操作人', dataIndex: 'operator', key: 'operator' },
          { title: '操作时间', dataIndex: 'operation_time', key: 'operation_time', render: (t) => t ? moment(t).format('YYYY-MM-DD HH:mm') : '-' }
        ]}
        dataSource={reports}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );

  const renderContent = () => {
    switch (activeKey) {
      case '1': return renderDashboard();
      case '2': return renderQueueManagement();
      case '3': return renderMergeManagement();
      case '4': return renderReports();
      default: return renderDashboard();
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px' }}>
        <Title level={3} style={{ color: 'white', lineHeight: '64px', margin: 0 }}>
          🍽️ 餐厅排号拼桌过号系统
        </Title>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            defaultSelectedKeys={['1']}
            selectedKeys={[activeKey]}
            onClick={handleMenuClick}
            style={{ height: '100%', borderRight: 0 }}
          >
            <Menu.Item key="1" icon={<DashboardOutlined />}>异常看板</Menu.Item>
            <Menu.Item key="2" icon={<QueueOutlined />}>排号管理</Menu.Item>
            <Menu.Item key="3" icon={<MergeOutlined />}>拼桌管理</Menu.Item>
            <Menu.Item key="4" icon={<FileTextOutlined />}>报表导出</Menu.Item>
          </Menu>
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content style={{ background: '#fff', padding: 24, margin: 0, minHeight: 280 }}>
            {renderContent()}
          </Content>
        </Layout>
      </Layout>

      <Modal
        title={modalType === 'createQueue' ? '新建排号' : '操作'}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
      >
        {modalType === 'createQueue' && (
          <Form form={form} layout="vertical">
            <Form.Item name="queue_number" label="排号" rules={[{ required: true }]}>
              <Input placeholder="例如: A001" />
            </Form.Item>
            <Form.Item name="customer_name" label="顾客姓名">
              <Input placeholder="请输入顾客姓名" />
            </Form.Item>
            <Form.Item name="phone" label="联系电话">
              <Input placeholder="请输入联系电话" />
            </Form.Item>
            <Form.Item name="party_size" label="用餐人数" rules={[{ required: true }]}>
              <Input type="number" min={1} />
            </Form.Item>
            <Form.Item name="table_type_id" label="桌台类型" rules={[{ required: true }]}>
              <Select>
                {tableTypes.map(t => (
                  <Option key={t.id} value={t.id}>{t.name} ({t.capacity}人)</Option>
                ))}
              </Select>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </Layout>
  );
};

export default App;
