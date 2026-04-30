import React, { useState, useEffect } from 'react';
import { Layout, Tabs, Button, Form, Input, Table, Modal, Select, DatePicker, message, Tag, Card, Space, Typography } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';

const { Header, Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

const API_BASE = '/api';

function App() {
  const [members, setMembers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [requests, setRequests] = useState([]);
  const [logs, setLogs] = useState([]);
  
  const [memberModal, setMemberModal] = useState(false);
  const [templateModal, setTemplateModal] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [swapModal, setSwapModal] = useState(false);
  
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [selectedResponder, setSelectedResponder] = useState(null);
  
  const [form] = Form.useForm();
  const [templateForm] = Form.useForm();
  const [scheduleForm] = Form.useForm();
  const [swapForm] = Form.useForm();

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [mRes, tRes, sRes, rRes, lRes] = await Promise.all([
        axios.get(`${API_BASE}/members`),
        axios.get(`${API_BASE}/shift-templates`),
        axios.get(`${API_BASE}/schedules`),
        axios.get(`${API_BASE}/swap-requests`),
        axios.get(`${API_BASE}/audit-logs`)
      ]);
      setMembers(mRes.data.members);
      setTemplates(tRes.data.templates);
      setSchedules(sRes.data.schedules);
      setRequests(rRes.data.requests);
      setLogs(lRes.data.logs);
    } catch (err) {
      console.error(err);
      message.error('获取数据失败');
    }
  };

  const addMember = async (values) => {
    try {
      await axios.post(`${API_BASE}/members`, values);
      message.success('成员添加成功');
      setMemberModal(false);
      form.resetFields();
      fetchAll();
    } catch (err) {
      message.error(err.response?.data?.error || '添加失败');
    }
  };

  const deleteMember = async (id) => {
    try {
      await axios.delete(`${API_BASE}/members/${id}`);
      message.success('成员删除成功');
      fetchAll();
    } catch (err) {
      message.error('删除失败');
    }
  };

  const addTemplate = async (values) => {
    try {
      await axios.post(`${API_BASE}/shift-templates`, values);
      message.success('班次添加成功');
      setTemplateModal(false);
      templateForm.resetFields();
      fetchAll();
    } catch (err) {
      message.error(err.response?.data?.error || '添加失败');
    }
  };

  const deleteTemplate = async (id) => {
    try {
      await axios.delete(`${API_BASE}/shift-templates/${id}`);
      message.success('班次删除成功');
      fetchAll();
    } catch (err) {
      message.error('删除失败');
    }
  };

  const addSchedule = async (values) => {
    try {
      await axios.post(`${API_BASE}/schedules`, {
        member_id: values.member,
        shift_template_id: values.shift,
        date: values.date.format('YYYY-MM-DD')
      });
      message.success('排班添加成功');
      setScheduleModal(false);
      scheduleForm.resetFields();
      fetchAll();
    } catch (err) {
      message.error(err.response?.data?.error || '添加失败');
    }
  };

  const deleteSchedule = async (id) => {
    try {
      await axios.delete(`${API_BASE}/schedules/${id}`);
      message.success('排班删除成功');
      fetchAll();
    } catch (err) {
      message.error('删除失败');
    }
  };

  const createSwapRequest = async () => {
    if (!selectedSchedule || !selectedResponder) {
      message.error('请选择要交换的班次和对方');
      return;
    }
    const responderSchedule = schedules.find(s => s.member_id === selectedResponder && s.date === selectedSchedule.date);
    if (!responderSchedule) {
      message.error('对方在该日期没有排班');
      return;
    }
    try {
      await axios.post(`${API_BASE}/swap-requests`, {
        requester_id: selectedSchedule.member_id,
        responder_id: selectedResponder,
        requester_schedule_id: selectedSchedule.id,
        responder_schedule_id: responderSchedule.id
      });
      message.success('换班申请已提交');
      setSwapModal(false);
      setSelectedSchedule(null);
      setSelectedResponder(null);
      swapForm.resetFields();
      fetchAll();
    } catch (err) {
      message.error(err.response?.data?.error || '申请失败');
    }
  };

  const handleSwapAction = async (id, action) => {
    try {
      await axios.put(`${API_BASE}/swap-requests/${id}`, { action });
      message.success(action === 'approve' ? '换班已批准' : '换班已拒绝');
      fetchAll();
    } catch (err) {
      message.error(err.response?.data?.error || '操作失败');
    }
  };

  const getWeekDates = () => {
    const today = dayjs();
    const startOfWeek = today.startOf('week');
    return Array.from({ length: 7 }, (_, i) => startOfWeek.add(i, 'day').format('YYYY-MM-DD'));
  };

  const weekDates = getWeekDates();

  const scheduleGrid = weekDates.map(date => {
    const daySchedules = schedules.filter(s => s.date === date);
    return { date, schedules: daySchedules };
  });

  const memberColumns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '角色', dataIndex: 'role', key: 'role' },
    { title: '操作', key: 'action', render: (_, record) => <Button type="link" danger onClick={() => deleteMember(record.id)}>删除</Button> }
  ];

  const templateColumns = [
    { title: '班次名称', dataIndex: 'name', key: 'name' },
    { title: '开始时间', dataIndex: 'start_time', key: 'start_time' },
    { title: '结束时间', dataIndex: 'end_time', key: 'end_time' },
    { title: '颜色', dataIndex: 'color', key: 'color', render: (color) => <Tag color={color}>{color}</Tag> },
    { title: '操作', key: 'action', render: (_, record) => <Button type="link" danger onClick={() => deleteTemplate(record.id)}>删除</Button> }
  ];

  const scheduleColumns = [
    { title: '日期', dataIndex: 'date', key: 'date' },
    { title: '成员', dataIndex: 'member_name', key: 'member_name' },
    { title: '班次', dataIndex: 'shift_name', key: 'shift_name', render: (name, record) => <Tag color={record.color}>{name} {record.start_time}-{record.end_time}</Tag> },
    { title: '操作', key: 'action', render: (_, record) => (
      <Space>
        <Button type="link" onClick={() => { setSelectedSchedule(record); setSwapModal(true); }}>申请换班</Button>
        <Button type="link" danger onClick={() => deleteSchedule(record.id)}>删除</Button>
      </Space>
    ) }
  ];

  const requestColumns = [
    { title: '申请人', dataIndex: 'requester_name', key: 'requester_name' },
    { title: '被申请人', dataIndex: 'responder_name', key: 'responder_name' },
    { title: '申请人班次', dataIndex: 'requester_shift', key: 'requester_shift', render: (name, record) => `${name} (${record.requester_date})` },
    { title: '被申请人班次', dataIndex: 'responder_shift', key: 'responder_shift', render: (name, record) => `${name} (${record.responder_date})` },
    { title: '状态', dataIndex: 'status', key: 'status', render: (status) => {
      let color = 'default';
      if (status === 'pending') color = 'orange';
      if (status === 'approved') color = 'green';
      if (status === 'rejected') color = 'red';
      return <Tag color={color}>{status === 'pending' ? '待处理' : status === 'approved' ? '已批准' : '已拒绝'}</Tag>;
    } },
    { title: '操作', key: 'action', render: (_, record) => record.status === 'pending' && (
      <Space>
        <Button type="primary" size="small" onClick={() => handleSwapAction(record.id, 'approve')}>批准</Button>
        <Button size="small" danger onClick={() => handleSwapAction(record.id, 'reject')}>拒绝</Button>
      </Space>
    ) }
  ];

  const logColumns = [
    { title: '操作', dataIndex: 'action', key: 'action' },
    { title: '详情', dataIndex: 'details', key: 'details' },
    { title: '时间', dataIndex: 'created_at', key: 'created_at' }
  ];

  const weekDayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 50px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Title level={3} style={{ margin: 0, lineHeight: '64px' }}>临时排班换班板</Title>
      </Header>
      <Content style={{ padding: '30px 50px', background: '#f0f2f5' }}>
        <Tabs defaultActiveKey="1">
          <Tabs.TabPane tab="排班表" key="1">
            <Card title="本周排班">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '16px', marginBottom: '20px' }}>
                {scheduleGrid.map((day, idx) => (
                  <Card key={day.date} title={`${weekDayNames[idx]} ${day.date}`} size="small">
                    {day.schedules.length === 0 ? (
                      <div style={{ color: '#999', textAlign: 'center', padding: '20px 0' }}>暂无排班</div>
                    ) : (
                      day.schedules.map(s => (
                        <div key={s.id} style={{ marginBottom: '8px', padding: '8px', background: s.color + '20', borderRadius: '4px', borderLeft: `4px solid ${s.color}` }}>
                          <div style={{ fontWeight: 'bold' }}>{s.member_name}</div>
                          <div style={{ fontSize: '12px', color: '#666' }}>{s.shift_name} {s.start_time}-{s.end_time}</div>
                          <Button type="link" size="small" onClick={() => { setSelectedSchedule(s); setSwapModal(true); }}>申请换班</Button>
                        </div>
                      ))
                    )}
                  </Card>
                ))}
              </div>
              <Button type="primary" onClick={() => setScheduleModal(true)}>添加排班</Button>
              <Table columns={scheduleColumns} dataSource={schedules} rowKey="id" style={{ marginTop: '20px' }} pagination={{ pageSize: 10 }} />
            </Card>
          </Tabs.TabPane>
          
          <Tabs.TabPane tab="换班申请" key="2">
            <Card title="待处理申请">
              <Table columns={requestColumns} dataSource={requests} rowKey="id" pagination={{ pageSize: 10 }} />
            </Card>
          </Tabs.TabPane>
          
          <Tabs.TabPane tab="成员管理" key="3">
            <Card title="成员列表" extra={<Button type="primary" onClick={() => setMemberModal(true)}>添加成员</Button>}>
              <Table columns={memberColumns} dataSource={members} rowKey="id" />
            </Card>
          </Tabs.TabPane>
          
          <Tabs.TabPane tab="班次管理" key="4">
            <Card title="班次模板" extra={<Button type="primary" onClick={() => setTemplateModal(true)}>添加班次</Button>}>
              <Table columns={templateColumns} dataSource={templates} rowKey="id" />
            </Card>
          </Tabs.TabPane>
          
          <Tabs.TabPane tab="审计日志" key="5">
            <Card title="操作记录">
              <Table columns={logColumns} dataSource={logs} rowKey="id" pagination={{ pageSize: 20 }} />
            </Card>
          </Tabs.TabPane>
        </Tabs>

        <Modal title="添加成员" open={memberModal} onCancel={() => setMemberModal(false)} onOk={() => form.submit()}>
          <Form form={form} onFinish={addMember} layout="vertical">
            <Form.Item label="姓名" name="name" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item label="角色" name="role" rules={[{ required: true }]}><Input /></Form.Item>
          </Form>
        </Modal>

        <Modal title="添加班次模板" open={templateModal} onCancel={() => setTemplateModal(false)} onOk={() => templateForm.submit()}>
          <Form form={templateForm} onFinish={addTemplate} layout="vertical">
            <Form.Item label="班次名称" name="name" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item label="开始时间" name="start_time" rules={[{ required: true }]}><Input placeholder="例如: 09:00" /></Form.Item>
            <Form.Item label="结束时间" name="end_time" rules={[{ required: true }]}><Input placeholder="例如: 18:00" /></Form.Item>
            <Form.Item label="颜色" name="color" initialValue="#1890ff"><Input type="color" /></Form.Item>
          </Form>
        </Modal>

        <Modal title="添加排班" open={scheduleModal} onCancel={() => setScheduleModal(false)} onOk={() => scheduleForm.submit()}>
          <Form form={scheduleForm} onFinish={addSchedule} layout="vertical">
            <Form.Item label="成员" name="member" rules={[{ required: true }]}>
              <Select>
                {members.map(m => <Option key={m.id} value={m.id}>{m.name}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item label="班次" name="shift" rules={[{ required: true }]}>
              <Select>
                {templates.map(t => <Option key={t.id} value={t.id}>{t.name}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item label="日期" name="date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          </Form>
        </Modal>

        <Modal title="申请换班" open={swapModal} onCancel={() => { setSwapModal(false); setSelectedSchedule(null); setSelectedResponder(null); }} onOk={createSwapRequest}>
          <Form layout="vertical">
            {selectedSchedule && (
              <Form.Item label="我的班次">
                <Input disabled value={`${selectedSchedule.member_name} - ${selectedSchedule.shift_name} (${selectedSchedule.date})`} />
              </Form.Item>
            )}
            <Form.Item label="选择换班对象">
              <Select onChange={setSelectedResponder}>
                {members.filter(m => selectedSchedule && m.id !== selectedSchedule.member_id).map(m => (
                  <Option key={m.id} value={m.id}>{m.name}</Option>
                ))}
              </Select>
            </Form.Item>
            {selectedResponder && selectedSchedule && (
              <div style={{ marginBottom: '16px', padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
                <div>对方排班：</div>
                {schedules.filter(s => s.member_id === selectedResponder && s.date === selectedSchedule.date).map(s => (
                  <div key={s.id} style={{ marginTop: '8px' }}>
                    <Tag color={s.color}>{s.shift_name} ({s.date})</Tag>
                  </div>
                ))}
                {schedules.filter(s => s.member_id === selectedResponder && s.date === selectedSchedule.date).length === 0 && (
                  <div style={{ color: 'red', marginTop: '8px' }}>对方在该日期没有排班，无法交换</div>
                )}
              </div>
            )}
          </Form>
        </Modal>
      </Content>
    </Layout>
  );
}

export default App;
