import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Tabs, 
  Table, 
  Timeline, 
  Tag, 
  Space, 
  Modal, 
  Form, 
  Input, 
  Select, 
  message, 
  Statistic, 
  Row, 
  Col,
  InputNumber,
  Popconfirm
} from 'antd';
import { 
  ArrowLeftOutlined, 
  CheckOutlined, 
  EditOutlined, 
  ExportOutlined,
  UserOutlined,
  CoffeeOutlined
} from '@ant-design/icons';
import axios from 'axios';
import * as XLSX from 'xlsx';
import moment from 'moment';
import MealVerification from './MealVerification';
import OrderChange from './OrderChange';

const { TabPane } = Tabs;
const { Option } = Select;

function MeetingDetail({ meeting, onBack }) {
  const [visitors, setVisitors] = useState([]);
  const [mealRules, setMealRules] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [expenseSummary, setExpenseSummary] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [editMeetingModal, setEditMeetingModal] = useState(false);
  const [editRulesModal, setEditRulesModal] = useState(false);
  const [verifyModal, setVerifyModal] = useState(false);
  const [changeModal, setChangeModal] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [form] = Form.useForm();
  const [rulesForm] = Form.useForm();

  useEffect(() => {
    if (meeting) {
      fetchMeetingData();
    }
  }, [meeting]);

  const fetchMeetingData = async () => {
    try {
      const [visitorsRes, rulesRes, timelineRes, summaryRes] = await Promise.all([
        axios.get(`/api/meetings/${meeting.id}/visitors`),
        axios.get(`/api/meetings/${meeting.id}/meal-rules`),
        axios.get(`/api/meetings/${meeting.id}/timeline`),
        axios.get(`/api/meetings/${meeting.id}/expense-summary`)
      ]);

      if (visitorsRes.data.success) setVisitors(visitorsRes.data.data);
      if (rulesRes.data.success) setMealRules(rulesRes.data.data);
      if (timelineRes.data.success) setTimeline(timelineRes.data.data);
      if (summaryRes.data.success) setExpenseSummary(summaryRes.data.data);
    } catch (error) {
      message.error('获取会议详情失败');
    }
  };

  const handleUpdateMeeting = async (values) => {
    try {
      const response = await axios.put(`/api/meetings/${meeting.id}`, {
        ...values,
        operator: '当前用户'
      });
      if (response.data.success) {
        message.success('会议信息更新成功');
        setEditMeetingModal(false);
        fetchMeetingData();
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleUpdateRules = async (values) => {
    try {
      const response = await axios.put(`/api/meal-rules/${mealRules.id}`, {
        ...values,
        operator: '当前用户'
      });
      if (response.data.success) {
        message.success('餐标规则更新成功');
        setEditRulesModal(false);
        fetchMeetingData();
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleVerifyMeal = async (visitorId) => {
    try {
      const response = await axios.post('/api/meal-verifications', {
        meetingId: meeting.id,
        visitorId,
        operator: '当前用户'
      });
      if (response.data.success) {
        message.success('核销成功');
        fetchMeetingData();
      }
    } catch (error) {
      message.error(error.response?.data?.message || '核销失败');
    }
  };

  const handleOrderChange = async (visitorId, changeType, reason) => {
    try {
      const response = await axios.post('/api/order-changes', {
        meetingId: meeting.id,
        visitorId,
        changeType,
        reason,
        operator: '当前用户'
      });
      if (response.data.success) {
        message.success('订餐变更成功');
        fetchMeetingData();
      }
    } catch (error) {
      message.error(error.response?.data?.message || '变更失败');
    }
  };

  const handleReview = async () => {
    try {
      const response = await axios.post('/api/review', {
        meetingId: meeting.id,
        operator: '当前用户',
        reviewNotes: '复核完成'
      });
      if (response.data.success) {
        message.success('复核成功');
        fetchMeetingData();
      }
    } catch (error) {
      message.error('复核失败');
    }
  };

  const exportReport = async () => {
    try {
      const response = await axios.get(`/api/report/${meeting.id}`);
      if (response.data.success) {
        const report = response.data.data;
        
        const wb = XLSX.utils.book_new();
        
        const meetingData = [[
          '会议名称', report.meeting.title
        ], [
          '会议日期', report.meeting.date
        ], [
          '会议时间', `${report.meeting.startTime} - ${report.meeting.endTime}`
        ], [
          '会议地点', report.meeting.location
        ], [
          '组织者', report.meeting.organizer
        ]];
        const meetingWS = XLSX.utils.aoa_to_sheet(meetingData);
        XLSX.utils.book_append_sheet(wb, meetingWS, '会议信息');

        const visitorData = report.visitors.map(v => ({
          '姓名': v.name,
          '公司': v.company,
          '电话': v.phone,
          '是否订餐': v.hasMeal ? '是' : '否',
          '是否领餐': v.verified ? '是' : '否'
        }));
        const visitorWS = XLSX.utils.json_to_sheet(visitorData);
        XLSX.utils.book_append_sheet(wb, visitorWS, '访客列表');

        const logData = report.logs.map(l => ({
          '操作类型': l.type,
          '操作人': l.operator,
          '操作时间': l.timestamp,
          '描述': l.description
        }));
        const logWS = XLSX.utils.json_to_sheet(logData);
        XLSX.utils.book_append_sheet(wb, logWS, '操作日志');

        XLSX.writeFile(wb, `${meeting.title}_餐核销报告_${moment().format('YYYYMMDD')}.xlsx`);
        message.success('报告导出成功');
      }
    } catch (error) {
      message.error('导出失败');
    }
  };

  const visitorColumns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '公司', dataIndex: 'company', key: 'company' },
    { title: '电话', dataIndex: 'phone', key: 'phone' },
    { 
      title: '订餐状态', 
      dataIndex: 'hasMeal', 
      key: 'hasMeal',
      render: (hasMeal) => hasMeal ? 
        <Tag color="green">已订餐</Tag> : 
        <Tag color="default">未订餐</Tag>
    },
    { 
      title: '领餐状态', 
      dataIndex: 'verified', 
      key: 'verified',
      render: (verified) => verified ? 
        <Tag color="blue">已领餐</Tag> : 
        <Tag color="orange">未领餐</Tag>
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            size="small"
            onClick={() => {
              setSelectedVisitor(record);
              setVerifyModal(true);
            }}
            disabled={record.verified || !record.hasMeal}
          >
            核销
          </Button>
          <Button 
            type="link" 
            size="small"
            onClick={() => {
              setSelectedVisitor(record);
              setChangeModal(true);
            }}
            disabled={record.verified}
          >
            变更
          </Button>
        </Space>
      )
    }
  ];

  const getTimelineIcon = (type) => {
    switch (type) {
      case 'meeting_created': return <EditOutlined style={{ color: '#1890ff' }} />;
      case 'visitor_added': return <UserOutlined style={{ color: '#52c41a' }} />;
      case 'order_change': return <EditOutlined style={{ color: '#faad14' }} />;
      case 'meal_verified': return <CoffeeOutlined style={{ color: '#722ed1' }} />;
      default: return <CheckOutlined />;
    }
  };

  if (!meeting) return null;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
            返回列表
          </Button>
          <h2 style={{ margin: 0 }}>{meeting.title}</h2>
          <Tag color={meeting.status === 'scheduled' ? 'blue' : 'default'}>
            {meeting.status === 'scheduled' ? '已排期' : meeting.status}
          </Tag>
        </div>
        <Space>
          <Button onClick={() => setEditMeetingModal(true)}>编辑会议</Button>
          <Button onClick={handleReview} disabled={meeting.status === 'reviewed'}>
            复核完成
          </Button>
          <Button type="primary" icon={<ExportOutlined />} onClick={exportReport}>
            导出报告
          </Button>
        </Space>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="基本信息" key="info">
          <Row gutter={16}>
            <Col span={12}>
              <Card title="会议信息">
                <p><strong>日期：</strong>{meeting.date}</p>
                <p><strong>时间：</strong>{meeting.startTime} - {meeting.endTime}</p>
                <p><strong>地点：</strong>{meeting.location}</p>
                <p><strong>组织者：</strong>{meeting.organizer}</p>
                <p><strong>预计访客：</strong>{meeting.expectedVisitors} 人</p>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="餐标规则" extra={<Button type="link" onClick={() => setEditRulesModal(true)}>编辑</Button>}>
                {mealRules ? (
                  <>
                    <p><strong>标准餐费：</strong>{mealRules.standardPrice} 元/人</p>
                    <p><strong>VIP餐费：</strong>{mealRules.vipPrice} 元/人</p>
                    <p><strong>变更截止时间：</strong>会议前 {mealRules.deadlineHours} 小时</p>
                  </>
                ) : (
                  <p>暂无餐标设置</p>
                )}
              </Card>
            </Col>
          </Row>
          
          {expenseSummary && (
            <Card title="费用汇总" style={{ marginTop: 16 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic title="访客总数" value={expenseSummary.totalVisitors} suffix="人" />
                </Col>
                <Col span={6}>
                  <Statistic title="订餐人数" value={expenseSummary.totalWithMeal} suffix="人" />
                </Col>
                <Col span={6}>
                  <Statistic title="已核销" value={expenseSummary.totalVerified} suffix="人" />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="预计总费用" 
                    value={expenseSummary.totalExpected} 
                    prefix="¥" 
                    suffix="元" 
                  />
                </Col>
              </Row>
            </Card>
          )}
        </TabPane>

        <TabPane tab={`访客名单 (${visitors.length})`} key="visitors">
          <Table 
            columns={visitorColumns} 
            dataSource={visitors} 
            rowKey="id"
            pagination={false}
          />
        </TabPane>

        <TabPane tab="时间线" key="timeline">
          <Card>
            <Timeline>
              {timeline.map(item => (
                <Timeline.Item key={item.id} dot={getTimelineIcon(item.type)}>
                  <p style={{ margin: 0 }}>
                    <strong>{item.title}</strong>
                    <span style={{ marginLeft: 8, color: '#999' }}>{item.time}</span>
                  </p>
                  <p style={{ margin: 0 }}>操作人：{item.operator}</p>
                  <p style={{ margin: 0, color: '#666' }}>{item.description}</p>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title="编辑会议信息"
        open={editMeetingModal}
        onCancel={() => setEditMeetingModal(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={meeting}
          onFinish={handleUpdateMeeting}
        >
          <Form.Item name="title" label="会议名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="location" label="会议地点" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="organizer" label="组织者" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>保存</Button>
          </Form.Item>
        </Form>
      </Modal>

      {mealRules && (
        <Modal
          title="编辑餐标规则"
          open={editRulesModal}
          onCancel={() => setEditRulesModal(false)}
          footer={null}
        >
          <Form
            form={rulesForm}
            layout="vertical"
            initialValues={mealRules}
            onFinish={handleUpdateRules}
          >
            <Form.Item name="standardPrice" label="标准餐费（元/人）" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="vipPrice" label="VIP餐费（元/人）" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="deadlineHours" label="变更截止时间（会议前小时）" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block>保存</Button>
            </Form.Item>
          </Form>
        </Modal>
      )}

      <MealVerification
        open={verifyModal}
        onClose={() => setVerifyModal(false)}
        visitor={selectedVisitor}
        onVerify={handleVerifyMeal}
      />

      <OrderChange
        open={changeModal}
        onClose={() => setChangeModal(false)}
        visitor={selectedVisitor}
        onChange={handleOrderChange}
      />
    </div>
  );
}

export default MeetingDetail;