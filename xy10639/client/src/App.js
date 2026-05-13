import React, { useState, useEffect } from 'react';
import { Layout, Menu, theme, Typography, Card, Row, Col, Table, Button, Space, Modal, Form, Input, Select, DatePicker, message, Tag, Badge, Tabs, InputNumber } from 'antd';
import { DashboardOutlined, RouteOutlined, CalendarOutlined, ClockCircleOutlined, CarOutlined, AlertOutlined, BarChartOutlined, FileExcelOutlined, HistoryOutlined, PlusOutlined, EditOutlined, CheckOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const API_BASE = '/api';
const CURRENT_USER = { id: 'ADMIN001', name: '管理员' };

function App() {
  const { token: { colorBgContainer } } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);
  const [activeKey, setActiveKey] = useState('1');
  const [routes, setRoutes] = useState([]);
  const [stations, setStations] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [waitlists, setWaitlists] = useState([]);
  const [tempBuses, setTempBuses] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [loadRates, setLoadRates] = useState([]);
  const [operationLogs, setOperationLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const [routeModalVisible, setRouteModalVisible] = useState(false);
  const [stationModalVisible, setStationModalVisible] = useState(false);
  const [tempBusModalVisible, setTempBusModalVisible] = useState(false);
  const [exceptionModalVisible, setExceptionModalVisible] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [editingStation, setEditingStation] = useState(null);
  const [handlingException, setHandlingException] = useState(null);

  const [searchFilters, setSearchFilters] = useState({
    routeId: null,
    startDate: null,
    endDate: null,
    status: null
  });

  const [form] = Form.useForm();
  const [stationForm] = Form.useForm();
  const [tempBusForm] = Form.useForm();
  const [exceptionForm] = Form.useForm();

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [routesRes, statisticsRes, exceptionsRes, logsRes] = await Promise.all([
        axios.get(`${API_BASE}/routes`),
        axios.get(`${API_BASE}/statistics`),
        axios.get(`${API_BASE}/exceptions`, { params: { status: 'pending' } }),
        axios.get(`${API_BASE}/operation-logs`)
      ]);
      setRoutes(routesRes.data);
      setStatistics(statisticsRes.data);
      setExceptions(exceptionsRes.data);
      setOperationLogs(logsRes.data);
    } catch (error) {
      message.error('数据加载失败');
    }
    setLoading(false);
  };

  const loadStations = async (routeId) => {
    try {
      const res = await axios.get(`${API_BASE}/stations`, { params: { route_id: routeId } });
      setStations(res.data);
    } catch (error) {
      message.error('站点加载失败');
    }
  };

  const loadReservations = async (params) => {
    try {
      const res = await axios.get(`${API_BASE}/reservations`, { params });
      setReservations(res.data);
    } catch (error) {
      message.error('预约数据加载失败');
    }
  };

  const loadWaitlists = async (params) => {
    try {
      const res = await axios.get(`${API_BASE}/waitlists`, { params });
      setWaitlists(res.data);
    } catch (error) {
      message.error('候补数据加载失败');
    }
  };

  const loadTempBuses = async (params) => {
    try {
      const res = await axios.get(`${API_BASE}/temp-buses`, { params });
      setTempBuses(res.data);
    } catch (error) {
      message.error('临时加车数据加载失败');
    }
  };

  const loadLoadRates = async (params) => {
    try {
      const res = await axios.get(`${API_BASE}/load-rates`, { params });
      setLoadRates(res.data);
    } catch (error) {
      message.error('满载率数据加载失败');
    }
  };

  const handleMenuClick = ({ key }) => {
    setActiveKey(key);
    switch (key) {
      case '2':
        loadStations();
        break;
      case '3':
        loadReservations();
        break;
      case '4':
        loadWaitlists();
        break;
      case '5':
        loadTempBuses();
        break;
      case '6':
        break;
      case '7':
        loadLoadRates();
        break;
      case '8':
        break;
    }
  };

  const handleSaveRoute = async (values) => {
    try {
      if (editingRoute) {
        await axios.put(`${API_BASE}/routes/${editingRoute.id}`, {
          ...values,
          operator_id: CURRENT_USER.id,
          operator_name: CURRENT_USER.name
        });
        message.success('线路更新成功');
      } else {
        await axios.post(`${API_BASE}/routes`, {
          ...values,
          operator_id: CURRENT_USER.id,
          operator_name: CURRENT_USER.name
        });
        message.success('线路创建成功');
      }
      setRouteModalVisible(false);
      form.resetFields();
      setEditingRoute(null);
      loadAllData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleSaveStation = async (values) => {
    try {
      if (editingStation) {
        await axios.put(`${API_BASE}/stations/${editingStation.id}`, {
          ...values,
          arrival_time: values.arrival_time ? values.arrival_time.format('HH:mm') : null,
          operator_id: CURRENT_USER.id,
          operator_name: CURRENT_USER.name
        });
        message.success('站点更新成功');
      } else {
        await axios.post(`${API_BASE}/stations`, {
          ...values,
          arrival_time: values.arrival_time ? values.arrival_time.format('HH:mm') : null,
          operator_id: CURRENT_USER.id,
          operator_name: CURRENT_USER.name
        });
        message.success('站点创建成功');
      }
      setStationModalVisible(false);
      stationForm.resetFields();
      setEditingStation(null);
      loadStations();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handlePromoteWaitlist = async (id) => {
    try {
      await axios.post(`${API_BASE}/waitlists/${id}/promote`, {
        operator_id: CURRENT_USER.id,
        operator_name: CURRENT_USER.name
      });
      message.success('候补转正成功');
      loadWaitlists();
      loadAllData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleSaveTempBus = async (values) => {
    try {
      await axios.post(`${API_BASE}/temp-buses`, {
        ...values,
        effective_date: values.effective_date.format('YYYY-MM-DD'),
        time_slot: values.time_slot.format('HH:mm'),
        operator_id: CURRENT_USER.id,
        operator_name: CURRENT_USER.name
      });
      message.success('临时加车成功');
      setTempBusModalVisible(false);
      tempBusForm.resetFields();
      loadTempBuses();
      loadAllData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleHandleException = async (values) => {
    try {
      await axios.put(`${API_BASE}/exceptions/${handlingException.id}/handle`, {
        ...values,
        handler_id: CURRENT_USER.id,
        handler_name: CURRENT_USER.name
      });
      message.success('异常处理完成');
      setExceptionModalVisible(false);
      exceptionForm.resetFields();
      setHandlingException(null);
      loadAllData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleCalculateLoadRate = async (routeId) => {
    try {
      const today = dayjs().format('YYYY-MM-DD');
      await axios.post(`${API_BASE}/load-rates/calculate`, {
        route_id: routeId,
        stat_date: today,
        time_slot: '08:00',
        operator_id: CURRENT_USER.id,
        operator_name: CURRENT_USER.name
      });
      message.success('满载率计算完成');
      loadLoadRates();
    } catch (error) {
      message.error('计算失败');
    }
  };

  const handleExportReport = async () => {
    try {
      const params = {
        start_date: searchFilters.startDate ? searchFilters.startDate.format('YYYY-MM-DD') : null,
        end_date: searchFilters.endDate ? searchFilters.endDate.format('YYYY-MM-DD') : null,
        route_id: searchFilters.routeId,
        operator_id: CURRENT_USER.id
      };
      
      const res = await axios.get(`${API_BASE}/reports/export`, {
        params,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `班车管理报表_${dayjs().format('YYYY-MM-DD')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success('报表导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const statCards = [
    { title: '运营线路', value: statistics.totalRoutes, icon: <RouteOutlined />, color: '#1890ff' },
    { title: '今日预约', value: statistics.activeReservations, icon: <CalendarOutlined />, color: '#52c41a' },
    { title: '候补人数', value: statistics.waitingCount, icon: <ClockCircleOutlined />, color: '#faad14' },
    { title: '临时加车', value: statistics.tempBusCount, icon: <CarOutlined />, color: '#13c2c2' },
    { title: '待处理异常', value: statistics.pendingExceptions, icon: <AlertOutlined />, color: '#ff4d4f' }
  ];

  const routeColumns = [
    { title: '线路代码', dataIndex: 'route_code', key: 'route_code' },
    { title: '线路名称', dataIndex: 'route_name', key: 'route_name' },
    { title: '方向', dataIndex: 'direction', key: 'direction' },
    { title: '容量', dataIndex: 'capacity', key: 'capacity' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s) => <Tag color={s === 'active' ? 'green' : 'red'}>{s === 'active' ? '运营中' : '停运'}</Tag> },
    { title: '操作', key: 'action', render: (_, r) => <Button type="link" icon={<EditOutlined />} onClick={() => { setEditingRoute(r); form.setFieldsValue(r); setRouteModalVisible(true); }}>编辑</Button> }
  ];

  const stationColumns = [
    { title: '线路', dataIndex: 'route_name', key: 'route_name' },
    { title: '站点名称', dataIndex: 'station_name', key: 'station_name' },
    { title: '顺序', dataIndex: 'station_order', key: 'station_order' },
    { title: '到达时间', dataIndex: 'arrival_time', key: 'arrival_time' },
    { title: '操作', key: 'action', render: (_, s) => <Button type="link" icon={<EditOutlined />} onClick={() => { setEditingStation(s); stationForm.setFieldsValue({ ...s, arrival_time: s.arrival_time ? dayjs(s.arrival_time, 'HH:mm') : null }); setStationModalVisible(true); }}>编辑</Button> }
  ];

  const reservationColumns = [
    { title: '用户ID', dataIndex: 'user_id', key: 'user_id' },
    { title: '用户姓名', dataIndex: 'user_name', key: 'user_name' },
    { title: '线路', dataIndex: 'route_name', key: 'route_name' },
    { title: '站点', dataIndex: 'station_name', key: 'station_name' },
    { title: '预约日期', dataIndex: 'reservation_date', key: 'reservation_date' },
    { title: '时段', dataIndex: 'time_slot', key: 'time_slot' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s) => <Tag color={s === 'confirmed' ? 'green' : s === 'no_show' ? 'red' : 'orange'}>{s === 'confirmed' ? '已确认' : s === 'no_show' ? '爽约' : '取消'}</Tag> }
  ];

  const waitlistColumns = [
    { title: '用户ID', dataIndex: 'user_id', key: 'user_id' },
    { title: '用户姓名', dataIndex: 'user_name', key: 'user_name' },
    { title: '线路', dataIndex: 'route_name', key: 'route_name' },
    { title: '站点', dataIndex: 'station_name', key: 'station_name' },
    { title: '候补日期', dataIndex: 'reservation_date', key: 'reservation_date' },
    { title: '优先级', dataIndex: 'priority', key: 'priority' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s) => <Tag color={s === 'waiting' ? 'orange' : 'green'}>{s === 'waiting' ? '等待中' : '已转正'}</Tag> },
    { title: '操作', key: 'action', render: (_, w) => w.status === 'waiting' && <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => handlePromoteWaitlist(w.id)}>转正</Button> }
  ];

  const tempBusColumns = [
    { title: '车牌号', dataIndex: 'bus_number', key: 'bus_number' },
    { title: '线路', dataIndex: 'route_name', key: 'route_name' },
    { title: '容量', dataIndex: 'capacity', key: 'capacity' },
    { title: '司机', dataIndex: 'driver_name', key: 'driver_name' },
    { title: '生效日期', dataIndex: 'effective_date', key: 'effective_date' },
    { title: '时段', dataIndex: 'time_slot', key: 'time_slot' },
    { title: '原因', dataIndex: 'reason', key: 'reason', ellipsis: true }
  ];

  const exceptionColumns = [
    { title: '异常类型', dataIndex: 'exception_type', key: 'exception_type', render: (t) => <Tag color={t === 'overload' ? 'red' : 'orange'}>{t === 'overload' ? '超载' : t === 'credit_abnormal' ? '信用异常' : t}</Tag> },
    { title: '严重程度', dataIndex: 'severity', key: 'severity', render: (s) => <Tag color={s === 'high' ? 'red' : s === 'medium' ? 'orange' : 'blue'}>{s === 'high' ? '高' : s === 'medium' ? '中' : '低'}</Tag> },
    { title: '线路', dataIndex: 'route_name', key: 'route_name' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s) => <Tag color={s === 'pending' ? 'orange' : 'green'}>{s === 'pending' ? '待处理' : '已处理'}</Tag> },
    { title: '操作', key: 'action', render: (_, e) => e.status === 'pending' && <Button type="primary" size="small" onClick={() => { setHandlingException(e); exceptionForm.resetFields(); setExceptionModalVisible(true); }}>处理</Button> }
  ];

  const loadRateColumns = [
    { title: '线路', dataIndex: 'route_name', key: 'route_name' },
    { title: '统计日期', dataIndex: 'stat_date', key: 'stat_date' },
    { title: '时段', dataIndex: 'time_slot', key: 'time_slot' },
    { title: '基础容量', dataIndex: 'base_capacity', key: 'base_capacity' },
    { title: '临时容量', dataIndex: 'temp_capacity', key: 'temp_capacity' },
    { title: '总容量', dataIndex: 'total_capacity', key: 'total_capacity' },
    { title: '预约人数', dataIndex: 'reserved_count', key: 'reserved_count' },
    { title: '候补转正', dataIndex: 'waitlist_promoted_count', key: 'waitlist_promoted_count' },
    { title: '爽约扣减', dataIndex: 'no_show_deduction', key: 'no_show_deduction' },
    { title: '满载率', dataIndex: 'final_load_rate', key: 'final_load_rate', render: (v) => <Badge count={`${v}%`} showZero color={v >= 100 ? '#ff4d4f' : v >= 80 ? '#faad14' : '#52c41a'} /> }
  ];

  const logColumns = [
    { title: '模块', dataIndex: 'module', key: 'module', render: (m) => <Tag>{m}</Tag> },
    { title: '操作类型', dataIndex: 'operation_type', key: 'operation_type' },
    { title: '原值', dataIndex: 'old_value', key: 'old_value', ellipsis: true, render: (v) => v ? <code style={{ fontSize: '12px' }}>{v.substring(0, 50)}</code> : '-' },
    { title: '新值', dataIndex: 'new_value', key: 'new_value', ellipsis: true, render: (v) => v ? <code style={{ fontSize: '12px' }}>{v.substring(0, 50)}</code> : '-' },
    { title: '责任人', dataIndex: 'operator_name', key: 'operator_name' },
    { title: '处理时间', dataIndex: 'created_at', key: 'created_at' }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 32, margin: 16, background: 'rgba(255,255,255,0.2)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: collapsed ? 12 : 16 }}>
          {collapsed ? '班车' : '班车管理系统'}
        </div>
        <Menu theme="dark" defaultSelectedKeys={['1']} mode="inline" selectedKeys={[activeKey]} onClick={handleMenuClick}>
          <Menu.Item key="1" icon={<DashboardOutlined />}>数据概览</Menu.Item>
          <Menu.Item key="2" icon={<RouteOutlined />}>线路站点</Menu.Item>
          <Menu.Item key="3" icon={<CalendarOutlined />}>预约管理</Menu.Item>
          <Menu.Item key="4" icon={<ClockCircleOutlined />}>候补转正</Menu.Item>
          <Menu.Item key="5" icon={<CarOutlined />}>临时加车</Menu.Item>
          <Menu.Item key="6" icon={<AlertOutlined />}>异常看板</Menu.Item>
          <Menu.Item key="7" icon={<BarChartOutlined />}>满载率统计</Menu.Item>
          <Menu.Item key="8" icon={<HistoryOutlined />}>操作日志</Menu.Item>
        </Menu>
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: colorBgContainer, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
          <Title level={4} style={{ margin: 0 }}>企业班车候补加车管理系统</Title>
          <div>当前用户：{CURRENT_USER.name}</div>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280, background: colorBgContainer }}>
          {activeKey === '1' && (
            <div>
              <Row gutter={[16, 16]}>
                {statCards.map((card, index) => (
                  <Col span={Math.floor(24 / statCards.length)} key={index}>
                    <Card>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>{card.title}</div>
                          <div style={{ fontSize: 28, fontWeight: 'bold', color: card.color }}>{card.value || 0}</div>
                        </div>
                        <div style={{ fontSize: 48, color: card.color, opacity: 0.3 }}>{card.icon}</div>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
              <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
                <Col span={12}>
                  <Card title="待处理异常" extra={<Button type="link" onClick={() => setActiveKey('6')}>查看全部</Button>}>
                    <Table dataSource={exceptions.slice(0, 5)} columns={exceptionColumns} pagination={false} size="small" />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="最近操作日志" extra={<Button type="link" onClick={() => setActiveKey('8')}>查看全部</Button>}>
                    <Table dataSource={operationLogs.slice(0, 5)} columns={logColumns} pagination={false} size="small" />
                  </Card>
                </Col>
              </Row>
            </div>
          )}

          {activeKey === '2' && (
            <Tabs defaultActiveKey="routes">
              <TabPane tab="线路管理" key="routes">
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRoute(null); form.resetFields(); setRouteModalVisible(true); }}>新增线路</Button>
                </div>
                <Table dataSource={routes} columns={routeColumns} rowKey="id" />
              </TabPane>
              <TabPane tab="站点管理" key="stations">
                <div style={{ marginBottom: 16 }}>
                  <Space>
                    <Select placeholder="选择线路" style={{ width: 200 }} onChange={(v) => loadStations(v)} allowClear>
                      {routes.map(r => <Option key={r.id} value={r.id}>{r.route_name}</Option>)}
                    </Select>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingStation(null); stationForm.resetFields(); setStationModalVisible(true); }}>新增站点</Button>
                  </Space>
                </div>
                <Table dataSource={stations} columns={stationColumns} rowKey="id" />
              </TabPane>
            </Tabs>
          )}

          {activeKey === '3' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <Space>
                  <Select placeholder="选择线路" style={{ width: 200 }} allowClear onChange={(v) => loadReservations({ route_id: v })}>
                    {routes.map(r => <Option key={r.id} value={r.id}>{r.route_name}</Option>)}
                  </Select>
                  <DatePicker placeholder="选择日期" onChange={(d) => loadReservations({ date: d ? d.format('YYYY-MM-DD') : null })} />
                  <Select placeholder="选择状态" style={{ width: 150 }} allowClear onChange={(v) => loadReservations({ status: v })}>
                    <Option value="confirmed">已确认</Option>
                    <Option value="no_show">爽约</Option>
                    <Option value="cancelled">取消</Option>
                  </Select>
                  <Button icon={<SearchOutlined />} onClick={() => loadReservations()}>查询</Button>
                </Space>
              </div>
              <Table dataSource={reservations} columns={reservationColumns} rowKey="id" />
            </div>
          )}

          {activeKey === '4' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <Space>
                  <Select placeholder="选择线路" style={{ width: 200 }} allowClear onChange={(v) => loadWaitlists({ route_id: v })}>
                    {routes.map(r => <Option key={r.id} value={r.id}>{r.route_name}</Option>)}
                  </Select>
                  <DatePicker placeholder="选择日期" onChange={(d) => loadWaitlists({ date: d ? d.format('YYYY-MM-DD') : null })} />
                  <Button icon={<SearchOutlined />} onClick={() => loadWaitlists()}>查询</Button>
                </Space>
              </div>
              <Table dataSource={waitlists} columns={waitlistColumns} rowKey="id" />
            </div>
          )}

          {activeKey === '5' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <Space>
                  <Select placeholder="选择线路" style={{ width: 200 }} allowClear onChange={(v) => loadTempBuses({ route_id: v })}>
                    {routes.map(r => <Option key={r.id} value={r.id}>{r.route_name}</Option>)}
                  </Select>
                  <DatePicker placeholder="选择日期" onChange={(d) => loadTempBuses({ date: d ? d.format('YYYY-MM-DD') : null })} />
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => { tempBusForm.resetFields(); setTempBusModalVisible(true); }}>新增临时加车</Button>
                  <Button icon={<SearchOutlined />} onClick={() => loadTempBuses()}>查询</Button>
                </Space>
              </div>
              <Table dataSource={tempBuses} columns={tempBusColumns} rowKey="id" />
            </div>
          )}

          {activeKey === '6' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <Space>
                  <Select placeholder="选择线路" style={{ width: 200 }} allowClear>
                    {routes.map(r => <Option key={r.id} value={r.id}>{r.route_name}</Option>)}
                  </Select>
                  <Select placeholder="严重程度" style={{ width: 150 }} allowClear>
                    <Option value="high">高</Option>
                    <Option value="medium">中</Option>
                    <Option value="low">低</Option>
                  </Select>
                  <Select placeholder="状态" style={{ width: 150 }} allowClear defaultValue="pending">
                    <Option value="pending">待处理</Option>
                    <Option value="handled">已处理</Option>
                  </Select>
                  <Button icon={<SearchOutlined />} onClick={loadAllData}>查询</Button>
                </Space>
              </div>
              <Table dataSource={exceptions} columns={exceptionColumns} rowKey="id" />
            </div>
          )}

          {activeKey === '7' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <Space>
                  <Select placeholder="选择线路" style={{ width: 200 }} allowClear onChange={(v) => loadLoadRates({ route_id: v })}>
                    {routes.map(r => <Option key={r.id} value={r.id}>{r.route_name}</Option>)}
                  </Select>
                  <DatePicker.RangePicker placeholder={['开始日期', '结束日期']} onChange={(dates) => loadLoadRates({ start_date: dates && dates[0] ? dates[0].format('YYYY-MM-DD') : null, end_date: dates && dates[1] ? dates[1].format('YYYY-MM-DD') : null })} />
                  <Button type="primary" onClick={() => routes.length > 0 && handleCalculateLoadRate(routes[0].id)}>计算今日满载率</Button>
                  <Button icon={<SearchOutlined />} onClick={() => loadLoadRates()}>查询</Button>
                </Space>
              </div>
              <Table dataSource={loadRates} columns={loadRateColumns} rowKey="id" />
            </div>
          )}

          {activeKey === '8' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <Space>
                  <Select placeholder="选择模块" style={{ width: 150 }} allowClear>
                    <Option value="route">线路</Option>
                    <Option value="station">站点</Option>
                    <Option value="reservation">预约</Option>
                    <Option value="waitlist">候补</Option>
                    <Option value="temp_bus">临时加车</Option>
                    <Option value="exception">异常</Option>
                  </Select>
                  <DatePicker.RangePicker placeholder={['开始日期', '结束日期']} />
                  <Button icon={<SearchOutlined />}>查询</Button>
                </Space>
              </div>
              <Table dataSource={operationLogs} columns={logColumns} rowKey="id" pagination={{ pageSize: 20 }} />
            </div>
          )}
        </Content>
      </Layout>

      <Modal title={editingRoute ? '编辑线路' : '新增线路'} open={routeModalVisible} onCancel={() => setRouteModalVisible(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleSaveRoute}>
          <Form.Item name="route_code" label="线路代码" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="route_name" label="线路名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="direction" label="方向" rules={[{ required: true }]}>
            <Select><Option value="上班">上班</Option><Option value="下班">下班</Option></Select>
          </Form.Item>
          <Form.Item name="capacity" label="容量" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select><Option value="active">运营中</Option><Option value="inactive">停运</Option></Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>保存</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={editingStation ? '编辑站点' : '新增站点'} open={stationModalVisible} onCancel={() => setStationModalVisible(false)} footer={null}>
        <Form form={stationForm} layout="vertical" onFinish={handleSaveStation}>
          <Form.Item name="route_id" label="所属线路" rules={[{ required: true }]}>
            <Select>{routes.map(r => <Option key={r.id} value={r.id}>{r.route_name}</Option>)}</Select>
          </Form.Item>
          <Form.Item name="station_name" label="站点名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="station_order" label="顺序" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="arrival_time" label="到达时间">
            <DatePicker picker="time" style={{ width: '100%' }} format="HH:mm" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>保存</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="新增临时加车" open={tempBusModalVisible} onCancel={() => setTempBusModalVisible(false)} footer={null}>
        <Form form={tempBusForm} layout="vertical" onFinish={handleSaveTempBus}>
          <Form.Item name="route_id" label="所属线路" rules={[{ required: true }]}>
            <Select>{routes.map(r => <Option key={r.id} value={r.id}>{r.route_name}</Option>)}</Select>
          </Form.Item>
          <Form.Item name="bus_number" label="车牌号" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="capacity" label="容量" rules={[{ required: true }]} initialValue={45}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="driver_name" label="司机姓名"><Input /></Form.Item>
          <Form.Item name="effective_date" label="生效日期" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="time_slot" label="时段" rules={[{ required: true }]}><DatePicker picker="time" style={{ width: '100%' }} format="HH:mm" /></Form.Item>
          <Form.Item name="reason" label="加车原因" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>保存</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="处理异常" open={exceptionModalVisible} onCancel={() => setExceptionModalVisible(false)} footer={null}>
        <Form form={exceptionForm} layout="vertical" onFinish={handleHandleException}>
          <Form.Item label="异常信息">
            <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <p><strong>类型：</strong>{handlingException?.exception_type}</p>
              <p><strong>描述：</strong>{handlingException?.description}</p>
              <p><strong>原因：</strong>{handlingException?.reason}</p>
            </div>
          </Form.Item>
          <Form.Item name="old_value" label="修正前值"><Input.TextArea rows={2} placeholder="请输入修正前的值" /></Form.Item>
          <Form.Item name="new_value" label="修正后值" rules={[{ required: true }]}><Input.TextArea rows={2} placeholder="请输入修正后的值" /></Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>确认处理</Button>
          </Form.Item>
        </Form>
      </Modal>

      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 999 }}>
        <Button type="primary" shape="circle" size="large" icon={<FileExcelOutlined />} onClick={handleExportReport} />
      </div>
    </Layout>
  );
}

export default App;
