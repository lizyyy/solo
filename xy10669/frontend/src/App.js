import React, { useState, useEffect } from 'react';
import { Layout, Menu, Card, Statistic, Row, Col, Table, Button, Space, DatePicker, Input, Select, Modal, Form, message, Tag, Tabs, Descriptions } from 'antd';
import { DashboardOutlined, FileTextOutlined, AlertOutlined, CalendarOutlined, EditOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getStats, getAppointments, getExceptions, getReports, resolveException, generateReport, exportReports, getHistory, addAddon, addWaiver, getItems, getPackages } from './api';

const { Header, Content, Sider } = Layout;
const { RangePicker } = DatePicker;
const { Option } = Select;

function App() {
  const [currentMenu, setCurrentMenu] = useState('dashboard');
  const [stats, setStats] = useState({});
  const [appointments, setAppointments] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [reports, setReports] = useState([]);
  const [items, setItems] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [history, setHistory] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    loadStats();
    loadData();
  }, [currentMenu, filters]);

  const loadStats = async () => {
    try {
      const res = await getStats();
      setStats(res.data);
    } catch (err) {
      message.error('加载统计数据失败');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (currentMenu === 'appointments') {
        const [aptRes, itemsRes, pkgRes] = await Promise.all([
          getAppointments(filters),
          getItems(),
          getPackages()
        ]);
        setAppointments(aptRes.data);
        setItems(itemsRes.data);
        setPackages(pkgRes.data);
      } else if (currentMenu === 'exceptions') {
        const res = await getExceptions(filters);
        setExceptions(res.data);
      } else if (currentMenu === 'reports') {
        const res = await getReports(filters);
        setReports(res.data);
      }
    } catch (err) {
      message.error('加载数据失败');
    }
    setLoading(false);
  };

  const handleResolveException = async (values) => {
    try {
      await resolveException(selectedRecord.id, values);
      message.success('处理成功');
      setModalVisible(false);
      loadData();
    } catch (err) {
      message.error('处理失败');
    }
  };

  const handleGenerateReport = async () => {
    try {
      await generateReport(selectedRecord.id, { archivedBy: 'admin' });
      message.success('报告生成成功');
      setModalVisible(false);
      loadData();
    } catch (err) {
      message.error('报告生成失败');
    }
  };

  const handleAddAddon = async (values) => {
    try {
      await addAddon(selectedRecord.id, { ...values, createdBy: 'admin' });
      message.success('加项成功');
      setModalVisible(false);
      loadData();
    } catch (err) {
      message.error('加项失败: ' + err.response?.data?.error);
    }
  };

  const handleAddWaiver = async (values) => {
    try {
      await addWaiver(selectedRecord.id, { ...values, handledBy: 'admin' });
      message.success('弃检成功');
      setModalVisible(false);
      loadData();
    } catch (err) {
      message.error('弃检失败');
    }
  };

  const handleExportReports = async () => {
    try {
      const reportIds = reports.map(r => r.id);
      const res = await exportReports(reportIds);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'reports.xlsx';
      link.click();
      message.success('导出成功');
    } catch (err) {
      message.error('导出失败');
    }
  };

  const loadHistory = async (entityType, entityId) => {
    try {
      const res = await getHistory(entityType, entityId);
      setHistory(res.data);
    } catch (err) {
      message.error('加载历史记录失败');
    }
  };

  const renderDashboard = () => (
    <div>
      <h2>数据概览</h2>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic title="体检套餐" value={stats.packages || 0} prefix={<DashboardOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="体检项目" value={stats.items || 0} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="预约数量" value={stats.appointments || 0} prefix={<CalendarOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="今日预约" value={stats.todayAppointments || 0} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="已归档报告" value={stats.reports || 0} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="异常数量" value={stats.exceptions?.open_count || 0} prefix={<AlertOutlined />} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="异常看板" extra={<Button type="link" onClick={() => setCurrentMenu('exceptions')}>查看全部</Button>}>
            <Table
              dataSource={exceptions.slice(0, 5)}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: '类型', dataIndex: 'type', key: 'type', render: t => <Tag color={t === 'item_exclusion' ? 'red' : 'orange'}>{t}</Tag> },
                { title: '用户', dataIndex: 'user_name', key: 'user_name' },
                { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
                { title: '状态', dataIndex: 'status', key: 'status', render: s => <Tag color={s === 'open' ? 'red' : 'green'}>{s}</Tag> }
              ]}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="最近预约">
            <Table
              dataSource={appointments.slice(0, 5)}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: '用户', dataIndex: 'user_name', key: 'user_name' },
                { title: '套餐', dataIndex: 'package_name', key: 'package_name' },
                { title: '日期', dataIndex: 'appointment_date', key: 'appointment_date' },
                { title: '状态', dataIndex: 'status', key: 'status', render: s => <Tag color={s === 'scheduled' ? 'blue' : 'green'}>{s}</Tag> }
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );

  const appointmentColumns = [
    { title: '用户姓名', dataIndex: 'user_name', key: 'user_name' },
    { title: '联系电话', dataIndex: 'user_phone', key: 'user_phone' },
    { title: '套餐名称', dataIndex: 'package_name', key: 'package_name' },
    { title: '预约日期', dataIndex: 'appointment_date', key: 'appointment_date' },
    { title: '预约时间', dataIndex: 'appointment_time', key: 'appointment_time' },
    { title: '加项', dataIndex: 'addons', key: 'addons', render: addons => addons?.length ? addons.map(a => <Tag key={a.id} color="blue">{a.name}</Tag>) : '-' },
    { title: '弃检', dataIndex: 'waivers', key: 'waivers', render: waivers => waivers?.length ? waivers.map(w => <Tag key={w.id} color="orange">{w.name}</Tag>) : '-' },
    { title: '状态', dataIndex: 'status', key: 'status', render: s => <Tag color={s === 'scheduled' ? 'blue' : s === 'completed' ? 'green' : 'default'}>{s}</Tag> },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => { setSelectedRecord(record); setModalType('addon'); setModalVisible(true); }}>加项</Button>
          <Button type="link" size="small" onClick={() => { setSelectedRecord(record); setModalType('waiver'); setModalVisible(true); }}>弃检</Button>
          <Button type="link" size="small" onClick={() => { setSelectedRecord(record); loadHistory('appointment', record.id); setModalType('history'); setModalVisible(true); }}>修改历史</Button>
          <Button type="link" size="small" onClick={() => { setSelectedRecord(record); setModalType('report'); setModalVisible(true); }}>生成报告</Button>
        </Space>
      )
    }
  ];

  const exceptionColumns = [
    { title: '异常类型', dataIndex: 'type', key: 'type', render: t => <Tag color={t === 'item_exclusion' ? 'red' : 'orange'}>{t}</Tag> },
    { title: '用户姓名', dataIndex: 'user_name', key: 'user_name' },
    { title: '关联项目', dataIndex: 'item_name', key: 'item_name' },
    { title: '异常描述', dataIndex: 'description', key: 'description' },
    { title: '严重程度', dataIndex: 'severity', key: 'severity', render: s => <Tag color={s === 'error' ? 'red' : 'orange'}>{s}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: s => <Tag color={s === 'open' ? 'red' : 'green'}>{s}</Tag> },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => record.status === 'open' && (
        <Button type="link" size="small" onClick={() => { setSelectedRecord(record); setModalType('resolve'); setModalVisible(true); }}>处理</Button>
      )
    }
  ];

  const reportColumns = [
    { title: '报告编号', dataIndex: 'report_number', key: 'report_number' },
    { title: '用户姓名', dataIndex: 'user_name', key: 'user_name' },
    { title: '套餐名称', dataIndex: 'package_name', key: 'package_name' },
    { title: '预约日期', dataIndex: 'appointment_date', key: 'appointment_date' },
    { title: '总金额', dataIndex: 'total_price', key: 'total_price', render: p => `¥${p}` },
    { title: '归档人', dataIndex: 'archived_by', key: 'archived_by' },
    { title: '归档时间', dataIndex: 'archived_at', key: 'archived_at' }
  ];

  const renderContent = () => {
    switch (currentMenu) {
      case 'dashboard':
        return renderDashboard();
      case 'appointments':
        return (
          <div>
            <h2>预约管理</h2>
            <Card style={{ marginBottom: 16 }}>
              <Space>
                <Input placeholder="搜索用户姓名" prefix={<SearchOutlined />} onChange={e => setFilters({ ...filters, userName: e.target.value })} />
                <RangePicker onChange={dates => setFilters({ ...filters, startDate: dates?.[0]?.format('YYYY-MM-DD'), endDate: dates?.[1]?.format('YYYY-MM-DD') })} />
                <Select placeholder="状态" style={{ width: 120 }} allowClear onChange={v => setFilters({ ...filters, status: v })}>
                  <Option value="scheduled">已预约</Option>
                  <Option value="completed">已完成</Option>
                </Select>
                <Button type="primary" onClick={loadData}>搜索</Button>
              </Space>
            </Card>
            <Table columns={appointmentColumns} dataSource={appointments} rowKey="id" loading={loading} />
          </div>
        );
      case 'exceptions':
        return (
          <div>
            <h2>异常看板</h2>
            <Card style={{ marginBottom: 16 }}>
              <Space>
                <Select placeholder="状态" style={{ width: 120 }} allowClear onChange={v => setFilters({ ...filters, status: v })}>
                  <Option value="open">待处理</Option>
                  <Option value="resolved">已解决</Option>
                </Select>
                <Select placeholder="严重程度" style={{ width: 120 }} allowClear onChange={v => setFilters({ ...filters, severity: v })}>
                  <Option value="error">错误</Option>
                  <Option value="warning">警告</Option>
                </Select>
                <Button type="primary" onClick={loadData}>搜索</Button>
              </Space>
            </Card>
            <Table columns={exceptionColumns} dataSource={exceptions} rowKey="id" loading={loading} />
          </div>
        );
      case 'reports':
        return (
          <div>
            <h2>报告归档</h2>
            <Card style={{ marginBottom: 16 }}>
              <Space>
                <Input placeholder="归档人" onChange={e => setFilters({ ...filters, handledBy: e.target.value })} />
                <RangePicker onChange={dates => setFilters({ ...filters, startDate: dates?.[0]?.format('YYYY-MM-DD'), endDate: dates?.[1]?.format('YYYY-MM-DD') })} />
                <Button type="primary" onClick={loadData}>搜索</Button>
                <Button icon={<DownloadOutlined />} onClick={handleExportReports}>导出Excel</Button>
              </Space>
            </Card>
            <Table columns={reportColumns} dataSource={reports} rowKey="id" loading={loading} />
          </div>
        );
      default:
        return renderDashboard();
    }
  };

  const renderModal = () => {
    switch (modalType) {
      case 'resolve':
        return (
          <Modal title="处理异常" open={modalVisible} onCancel={() => setModalVisible(false)} onOk={() => form.submit()}>
            <Form form={form} onFinish={handleResolveException}>
              <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
                <Descriptions.Item label="异常类型">{selectedRecord?.type}</Descriptions.Item>
                <Descriptions.Item label="异常描述">{selectedRecord?.description}</Descriptions.Item>
              </Descriptions>
              <Form.Item name="handledBy" label="处理人" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="resolution" label="处理方案" rules={[{ required: true }]}>
                <Input.TextArea rows={4} />
              </Form.Item>
            </Form>
          </Modal>
        );
      case 'addon':
        return (
          <Modal title="添加加项" open={modalVisible} onCancel={() => setModalVisible(false)} onOk={() => form.submit()}>
            <Form form={form} onFinish={handleAddAddon}>
              <Form.Item name="itemId" label="选择项目" rules={[{ required: true }]}>
                <Select>
                  {items.map(item => (
                    <Option key={item.id} value={item.id}>{item.name} (¥{item.price})</Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="quantity" label="数量" initialValue={1}>
                <Input type="number" min={1} />
              </Form.Item>
              <Form.Item name="price" label="价格" rules={[{ required: true }]}>
                <Input type="number" />
              </Form.Item>
            </Form>
          </Modal>
        );
      case 'waiver':
        return (
          <Modal title="添加弃检" open={modalVisible} onCancel={() => setModalVisible(false)} onOk={() => form.submit()}>
            <Form form={form} onFinish={handleAddWaiver}>
              <Form.Item name="itemId" label="选择弃检项目" rules={[{ required: true }]}>
                <Select>
                  {packages.find(p => p.id === selectedRecord?.package_id)?.items.map(item => (
                    <Option key={item.id} value={item.id}>{item.name}</Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="reason" label="弃检原因" rules={[{ required: true }]}>
                <Input.TextArea rows={4} />
              </Form.Item>
              <Form.Item name="reasonType" label="原因类型">
                <Select>
                  <Option value="medical">医疗原因</Option>
                  <Option value="personal">个人原因</Option>
                  <Option value="other">其他</Option>
                </Select>
              </Form.Item>
            </Form>
          </Modal>
        );
      case 'report':
        return (
          <Modal title="生成报告" open={modalVisible} onCancel={() => setModalVisible(false)} onOk={handleGenerateReport}>
            <p>确认为用户 <strong>{selectedRecord?.user_name}</strong> 生成体检报告？</p>
            <p>报告将包含：加项、弃检、最终项目和总金额</p>
          </Modal>
        );
      case 'history':
        return (
          <Modal title="修改历史" open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={800}>
            <Table
              dataSource={history}
              rowKey="id"
              pagination={false}
              columns={[
                { title: '字段', dataIndex: 'field_name', key: 'field_name' },
                { title: '修改前', dataIndex: 'old_value', key: 'old_value' },
                { title: '修改后', dataIndex: 'new_value', key: 'new_value' },
                { title: '修改人', dataIndex: 'modified_by', key: 'modified_by' },
                { title: '修改时间', dataIndex: 'modified_at', key: 'modified_at' }
              ]}
            />
          </Modal>
        );
      default:
        return null;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light">
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 'bold' }}>
          体检管理系统
        </div>
        <Menu
          mode="inline"
          selectedKeys={[currentMenu]}
          onClick={e => setCurrentMenu(e.key)}
          items={[
            { key: 'dashboard', icon: <DashboardOutlined />, label: '数据概览' },
            { key: 'appointments', icon: <CalendarOutlined />, label: '预约管理' },
            { key: 'exceptions', icon: <AlertOutlined />, label: '异常看板' },
            { key: 'reports', icon: <FileTextOutlined />, label: '报告归档' }
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <span>管理员</span>
        </Header>
        <Content style={{ margin: '24px', padding: 24, background: '#fff', minHeight: 280 }}>
          {renderContent()}
        </Content>
      </Layout>
      {renderModal()}
    </Layout>
  );
}

export default App;
