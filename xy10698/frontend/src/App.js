import React, { useState, useEffect } from 'react';
import { Layout, Card, Row, Col, Statistic, Input, Select, Table, Tag, Button, Modal, Timeline, Form, Space, Tabs, Progress } from 'antd';
const { TextArea } = Input;
import { SearchOutlined, DownloadOutlined, EyeOutlined, CheckCircleOutlined, ExclamationCircleOutlined, RollbackOutlined, MergeCellsOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Header, Content } = Layout;
const { Option } = Select;
const { TabPane } = Tabs;

const API_BASE = 'http://localhost:3001/api';

function App() {
  const [stats, setStats] = useState({});
  const [intents, setIntents] = useState([]);
  const [selectedIntent, setSelectedIntent] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    loadStats();
    loadIntents();
    loadUsers();
  }, []);

  const loadStats = async () => {
    const res = await axios.get(`${API_BASE}/stats`);
    setStats(res.data);
  };

  const loadIntents = async (search = '', category = '') => {
    const res = await axios.get(`${API_BASE}/intents`, { params: { search, category } });
    setIntents(res.data);
  };

  const loadUsers = async () => {
    const res = await axios.get(`${API_BASE}/users`);
    setUsers(res.data);
  };

  const loadIntentDetail = async (id) => {
    const res = await axios.get(`${API_BASE}/intents/${id}`);
    setDetailData(res.data);
    const timelineRes = await axios.get(`${API_BASE}/timeline/${id}`);
    setTimeline(timelineRes.data);
  };

  const handleSearch = () => {
    loadIntents(searchText, categoryFilter);
  };

  const handleViewDetail = (intent) => {
    setSelectedIntent(intent);
    loadIntentDetail(intent.id);
    setModalVisible(true);
  };

  const handleUpgradeFeedback = async (feedbackId) => {
    await axios.put(`${API_BASE}/feedbacks/${feedbackId}/upgrade`);
    loadIntentDetail(selectedIntent.id);
    loadStats();
  };

  const handleRollbackVersion = async (versionId) => {
    await axios.post(`${API_BASE}/rollback-version`, {
      intent_id: selectedIntent.id,
      version_id: versionId,
      revised_by: 'user-3'
    });
    loadIntentDetail(selectedIntent.id);
  };

  const handleSubmitRevision = async (values) => {
    await axios.post(`${API_BASE}/reply-versions`, {
      intent_id: selectedIntent.id,
      content: values.content,
      created_by: 'user-3'
    });
    await axios.post(`${API_BASE}/revisions`, {
      intent_id: selectedIntent.id,
      action: 'update',
      revised_by: 'user-3',
      remark: values.remark
    });
    form.resetFields();
    setReviewModalVisible(false);
    loadIntentDetail(selectedIntent.id);
    loadStats();
  };

  const columns = [
    {
      title: '意图名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <a>{text}</a>
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (cat) => <Tag color="blue">{cat}</Tag>
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '启用' : '停用'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
          查看详情
        </Button>
      )
    }
  ];

  const getTimelineIcon = (type) => {
    switch (type) {
      case 'version': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'hit': return <EyeOutlined style={{ color: '#1890ff' }} />;
      case 'feedback': return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 'revision': return <RollbackOutlined style={{ color: '#722ed1' }} />;
      default: return <CheckCircleOutlined />;
    }
  };

  const getTimelineColor = (type) => {
    switch (type) {
      case 'version': return 'green';
      case 'hit': return 'blue';
      case 'feedback': return 'orange';
      case 'revision': return 'purple';
      default: return 'gray';
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>
        知识库命中反馈闭环系统
      </Header>
      <Content style={{ padding: '24px' }}>
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="命中率"
                value={stats.hitRate || 0}
                suffix="%"
                valueStyle={{ color: '#3f8600' }}
                prefix={<Progress type="circle" percent={stats.hitRate || 0} width={50} />}
              />
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                总命中数: {stats.totalHits || 0}
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="待修订条目"
                value={stats.pendingRevisions || 0}
                valueStyle={{ color: '#cf1322' }}
                prefix={<ExclamationCircleOutlined />}
              />
              <Button type="link" style={{ padding: 0 }} onClick={() => setCategoryFilter('')}>
                查看全部
              </Button>
            </Card>
          </Col>
          <Col span={12}>
            <Card title="责任人">
              <Row gutter={[8, 8]}>
                {(stats.responsiblePersons || []).map(person => (
                  <Col key={person.id} span={12}>
                    <Tag color="blue" style={{ width: '100%', textAlign: 'center', padding: '4px 8px' }}>
                      {person.name}: {person.count} 条
                    </Tag>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        </Row>

        <Card title="知识库意图列表" style={{ marginBottom: '24px' }}>
          <Space style={{ marginBottom: '16px' }}>
            <Input
              placeholder="搜索意图名称或描述"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
            />
            <Select
              placeholder="筛选分类"
              value={categoryFilter}
              onChange={setCategoryFilter}
              style={{ width: 150 }}
              allowClear
            >
              <Option value="订单">订单</Option>
              <Option value="配送">配送</Option>
              <Option value="售后">售后</Option>
              <Option value="促销">促销</Option>
              <Option value="账户">账户</Option>
            </Select>
            <Button type="primary" onClick={handleSearch}>搜索</Button>
            <Button icon={<DownloadOutlined />} onClick={() => window.open(`${API_BASE}/export?type=feedbacks`)}>
              导出反馈
            </Button>
          </Space>
          <Table columns={columns} dataSource={intents} rowKey="id" />
        </Card>

        <Modal
          title={`意图详情 - ${selectedIntent?.name}`}
          visible={modalVisible}
          onCancel={() => setModalVisible(false)}
          width={1200}
          footer={[
            <Button key="close" onClick={() => setModalVisible(false)}>关闭</Button>,
            <Button key="review" type="primary" onClick={() => setReviewModalVisible(true)}>
              修订回复
            </Button>
          ]}
        >
          <Tabs defaultActiveKey="timeline">
            <TabPane tab="时间线" key="timeline">
              <Timeline>
                {timeline.map((item, index) => (
                  <Timeline.Item
                    key={index}
                    dot={getTimelineIcon(item.eventType)}
                    color={getTimelineColor(item.eventType)}
                  >
                    <div>
                      <Tag color={getTimelineColor(item.eventType)} style={{ marginBottom: '8px' }}>
                        {item.eventType === 'version' ? '新版本' :
                         item.eventType === 'hit' ? '命中记录' :
                         item.eventType === 'feedback' ? '反馈' : '修订'}
                      </Tag>
                      <div>{item.created_at}</div>
                      <div style={{ marginTop: '4px' }}>
                        {item.eventType === 'version' && `版本 ${item.version}: ${item.content.substring(0, 50)}...`}
                        {item.eventType === 'hit' && `用户查询: ${item.user_query} (采纳: ${item.adopted ? '是' : '否'}, 追问: ${item.follow_up ? '是' : '否'})`}
                        {item.eventType === 'feedback' && `反馈类型: ${item.type}, 原因: ${item.reason || '无'}, 优先级: ${item.priority}`}
                        {item.eventType === 'revision' && `操作: ${item.action}, 备注: ${item.remark || '无'}`}
                      </div>
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            </TabPane>
            <TabPane tab="回复版本" key="versions">
              <Table
                dataSource={detailData?.versions || []}
                rowKey="id"
                columns={[
                  { title: '版本号', dataIndex: 'version', key: 'version' },
                  { title: '内容', dataIndex: 'content', key: 'content', ellipsis: true },
                  { title: '是否当前', dataIndex: 'is_current', key: 'is_current', render: (v) => v ? <Tag color="green">是</Tag> : '否' },
                  { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
                  {
                    title: '操作',
                    key: 'action',
                    render: (_, record) => (
                      <Button
                        size="small"
                        icon={<RollbackOutlined />}
                        disabled={record.is_current}
                        onClick={() => handleRollbackVersion(record.id)}
                      >
                        回滚到此版本
                      </Button>
                    )
                  }
                ]}
              />
            </TabPane>
            <TabPane tab="反馈列表" key="feedbacks">
              <Table
                dataSource={detailData?.feedbacks || []}
                rowKey="id"
                columns={[
                  { title: '类型', dataIndex: 'type', key: 'type', render: (t) => <Tag color={t === 'wrong_answer' ? 'red' : 'green'}>{t}</Tag> },
                  { title: '原因', dataIndex: 'reason', key: 'reason' },
                  { title: '优先级', dataIndex: 'priority', key: 'priority', render: (p) => <Tag color={p === 'high' ? 'red' : p === 'medium' ? 'orange' : 'blue'}>{p}</Tag> },
                  { title: '状态', dataIndex: 'status', key: 'status', render: (s) => <Tag color={s === 'pending' ? 'orange' : 'green'}>{s}</Tag> },
                  { title: '时间', dataIndex: 'created_at', key: 'created_at' },
                  {
                    title: '操作',
                    key: 'action',
                    render: (_, record) => (
                      <Space>
                        <Button size="small" type="primary" onClick={() => handleUpgradeFeedback(record.id)}>
                          升级优先级
                        </Button>
                      </Space>
                    )
                  }
                ]}
              />
            </TabPane>
          </Tabs>
        </Modal>

        <Modal
          title="修订回复"
          visible={reviewModalVisible}
          onCancel={() => setReviewModalVisible(false)}
          footer={null}
        >
          <Form form={form} layout="vertical" onFinish={handleSubmitRevision}>
            <Form.Item
              name="content"
              label="新回复内容"
              rules={[{ required: true, message: '请输入回复内容' }]}
            >
              <TextArea rows={6} placeholder="请输入新的回复内容..." />
            </Form.Item>
            <Form.Item
              name="remark"
              label="修订备注"
              rules={[{ required: true, message: '请输入修订备注' }]}
            >
              <Input placeholder="请说明修订原因..." />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">提交修订</Button>
                <Button onClick={() => setReviewModalVisible(false)}>取消</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </Content>
    </Layout>
  );
}

export default App;
