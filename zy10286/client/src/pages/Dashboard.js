import React, { useState, useEffect } from 'react';
import { Row, Col, Statistic, Card, List, Tag, Button, Space, Typography } from 'antd';
import { 
  TeamOutlined, 
  VideoCameraOutlined, 
  SafetyOutlined, 
  EyeOutlined,
  ArrowUpOutlined,
  ReloadOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
const { Title, Text } = Typography;
function Dashboard() {
 const [stats, setStats] = useState({ classes: 0, students: 0, sessions: 0, permissions: 0 });
 const [recentEvents, setRecentEvents] = useState([]);
 const [accessTrend, setAccessTrend] = useState([]);
 const [anomalies, setAnomalies] = useState([]);
 useEffect(() => {
 fetchStats();
 fetchRecentEvents();
 fetchAccessTrend();
 fetchAnomalies();
 }, []);
 const fetchStats = async () => {
 try {
 const [classesRes, studentsRes, sessionsRes, permissionsRes] = await Promise.all([
 fetch('/api/classes'),
 fetch('/api/students'),
 fetch('/api/sessions'),
 fetch('/api/permissions')
 ]);
 setStats({
 classes: (await classesRes.json()).length,
 students: (await studentsRes.json()).length,
 sessions: (await sessionsRes.json()).length,
 permissions: (await permissionsRes.json()).length
 });
 } catch (error) {
 console.error('获取统计数据失败:', error);
 }
 };
 const fetchRecentEvents = async () => {
 try {
 const response = await fetch('/api/events?limit=10');
 const data = await response.json();
 setRecentEvents(data);
 } catch (error) {
 console.error('获取最近事件失败:', error);
 }
 };
 const fetchAccessTrend = async () => {
 const trendData = [];
 for (let i = 6; i >= 0; i--) {
 const date = new Date();
 date.setDate(date.getDate() - i);
 trendData.push({
 date: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
 accesses: Math.floor(Math.random() * 50) + 20,
 denied: Math.floor(Math.random() * 5)
 });
 }
 setAccessTrend(trendData);
 };
 const fetchAnomalies = async () => {
 try {
 const response = await fetch('/api/anomalies?status=open');
 const data = await response.json();
 setAnomalies(data.slice(0, 5));
 } catch (error) {
 console.error('获取异常数据失败:', error);
 }
 };
 const getEventTypeIcon = (type) => {
 const icons = {
 'student_enrolled': <TeamOutlined />,
 'permission_granted': <SafetyOutlined />,
 'permission_revoked': <SafetyOutlined style={{ color: '#ff4d4f' }} />,
 'student_transferred': <ArrowUpOutlined />,
 'enrollment_refunded': <ArrowUpOutlined style={{ color: '#ff4d4f' }} />
 };
 return icons[type] || <EyeOutlined />;
 };
 const getEventTypeColor = (type) => {
 if (type.includes('revoked') || type.includes('refund')) return 'red';
 if (type.includes('granted') || type.includes('enrolled')) return 'green';
 return 'blue';
 };
 const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
 const permissionSourceData = [
 { name: '报名授权', value: Math.floor(stats.permissions * 0.7) },
 { name: '转班授权', value: Math.floor(stats.permissions * 0.2) },
 { name: '手动授权', value: Math.floor(stats.permissions * 0.1) }
 ];
 return (<div>
 <div className="page-header">
 <Space>
 <Title level={3} style={{ margin: 0 }}>控制台</Title>
 <Button icon={<ReloadOutlined />} onClick={fetchStats}>刷新</Button>
 </Space>
 <Text type="secondary">系统运行状态与关键指标概览</Text>
 </div>

 <Row gutter={[16, 16]}>
 <Col xs={24} sm={12} lg={6}>
 <Card>
 <Statistic title="班级总数" value={stats.classes} prefix={<TeamOutlined />} valueStyle={{ color: '#1890ff' }}/>
 </Card>
 </Col>
 <Col xs={24} sm={12} lg={6}>
 <Card>
 <Statistic title="学员总数" value={stats.students} prefix={<TeamOutlined />} valueStyle={{ color: '#52c41a' }}/>
 </Card>
 </Col>
 <Col xs={24} sm={12} lg={6}>
 <Card>
 <Statistic title="直播场次" value={stats.sessions} prefix={<VideoCameraOutlined />} valueStyle={{ color: '#722ed1' }}/>
 </Card>
 </Col>
 <Col xs={24} sm={12} lg={6}>
 <Card>
 <Statistic title="活跃权限" value={stats.permissions} prefix={<SafetyOutlined />} valueStyle={{ color: '#fa8c16' }}/>
 </Card>
 </Col>
 </Row>

 <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
 <Col xs={24} lg={16}>
 <Card title="访问趋势" extra={<Button size="small" type="link">查看详情</Button>}>
 <ResponsiveContainer width="100%" height={300}>
 <LineChart data={accessTrend}>
 <CartesianGrid strokeDasharray="3 3"/>
 <XAxis dataKey="date"/>
 <YAxis />
 <Tooltip />
 <Line type="monotone" dataKey="accesses" stroke="#1890ff" strokeWidth={2} name="成功访问"/>
 <Line type="monotone" dataKey="denied" stroke="#ff4d4f" strokeWidth={2} name="拒绝访问"/>
 </LineChart>
 </ResponsiveContainer>
 </Card>
 </Col>
 <Col xs={24} lg={8}>
 <Card title="权限来源分布">
 <ResponsiveContainer width="100%" height={200}>
 <PieChart>
 <Pie data={permissionSourceData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} fill="#8884d8" dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
 {permissionSourceData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}/>))}
 </Pie>
 <Tooltip />
 </PieChart>
 </ResponsiveContainer>
 </Card>
 </Col>
 </Row>

 <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
 <Col xs={24} lg={14}>
 <Card title="最近操作记录" extra={<Button size="small" type="link" onClick={() => window.location.href = '/logs'}>查看全部</Button>}>
 <List dataSource={recentEvents} renderItem={(item) => (<List.Item>
 <List.Item.Meta avatar={getEventTypeIcon(item.event_type)} title={<Tag color={getEventTypeColor(item.event_type)}>{item.description}</Tag>} description={new Date(item.created_at).toLocaleString('zh-CN')}/>
 </List.Item>)}/>
 {recentEvents.length === 0 && (<Text type="secondary" style={{ textAlign: 'center', display: 'block', padding: '20px' }}>
 暂无操作记录
 </Text>)}
 </Card>
 </Col>
 <Col xs={24} lg={10}>
 <Card title="待处理异常" extra={anomalies.length > 0 && (<Button size="small" type="primary" danger onClick={() => window.location.href = '/anomalies'}>
 处理全部
 </Button>)}>
 {anomalies.length > 0 ? (<List dataSource={anomalies} renderItem={(item) => (<List.Item>
 <List.Item.Meta avatar={<WarningOutlined style={{ color: item.severity === 'high' ? '#ff4d4f' : item.severity === 'medium' ? '#faad14' : '#52c41a', fontSize: 20 }}/>} title={<Tag color={item.severity === 'high' ? 'red' : item.severity === 'medium' ? 'orange' : 'green'}>
 {item.description}
 </Tag>} description={`${item.student_name || ''} ${item.detected_at}`}/>
 </List.Item>)}/>) : (<div style={{ textAlign: 'center', padding: '40px' }}>
 <SafetyOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }}/>
 <Text type="success">系统运行正常，无待处理异常</Text>
 </div>)}
 </Card>
 </Col>
 </Row>
 </div>);
}
export default Dashboard;
