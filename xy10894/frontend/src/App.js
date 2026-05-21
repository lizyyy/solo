import React, { useState, useEffect } from 'react';
import { Layout, Menu, Card, Table, Button, Statistic, Row, Col, Tag, Modal, Form, Input, Select, Space, message, Steps, Timeline, Descriptions, Popconfirm, Divider, InputNumber } from 'antd';
import { PlusOutlined, FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, ExportOutlined, EyeOutlined, UserOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Header, Content, Sider } = Layout;
const { Option } = Select;
const { Step } = Steps;

const API_BASE = 'http://localhost:3001/api';

const statusColors = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'blue',
  APPROVING: 'orange',
  APPROVED: 'green',
  PUBLISHING: 'cyan',
  PUBLISHED: 'success',
  REJECTED: 'red',
  ABOLISHED: 'error'
};

const statusLabels = {
  DRAFT: '草稿',
  PENDING_APPROVAL: '待审批',
  APPROVING: '审批中',
  APPROVED: '已通过',
  PUBLISHING: '发布中',
  PUBLISHED: '已发布',
  REJECTED: '已驳回',
  ABOLISHED: '已废止'
};

const channelStatusLabels = {
  PENDING: '待发布',
  PUBLISHING: '发布中',
  SUCCESS: '发布成功',
  FAILED: '发布失败'
};

function App() {
  const [selectedKey, setSelectedKey] = useState('dashboard');
  const [policies, setPolicies] = useState([]);
  const [stats, setStats] = useState({ total: 0, byStatus: {} });
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [readingModalVisible, setReadingModalVisible] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [form] = Form.useForm();
  const [readingForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [selectedKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [policiesRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE}/policies`),
        axios.get(`${API_BASE}/policies/stats/summary`)
      ]);
      setPolicies(policiesRes.data.data || []);
      setStats(statsRes.data.data || { total: 0, byStatus: {} });
    } catch (e) {
      message.error('加载数据失败');
    }
    setLoading(false);
  };

  const handleCreatePolicy = async (values) => {
    try {
      const approvalNodes = values.approvalNodes?.split(',').map((name, i) => ({
        nodeName: name.trim(),
        approverRole: `ROLE_${i}`
      })) || [];
      
      const publishChannels = values.publishChannels?.split(',').map((name, i) => ({
        channelName: name.trim(),
        channelType: `TYPE_${i}`
      })) || [];

      const applicableDepartments = values.applicableDepartments?.split(',').map(d => d.trim()).filter(d => d) || [];
      
      const references = values.references?.split(',').map(code => ({
        referencedPolicyCode: code.trim(),
        referenceType: '引用'
      })).filter(r => r.referencedPolicyCode) || [];

      await axios.post(`${API_BASE}/policies`, {
        ...values,
        approvalNodes,
        publishChannels,
        applicableDepartments,
        references,
        content: { description: values.description }
      });
      
      message.success('创建成功');
      setModalVisible(false);
      form.resetFields();
      loadData();
    } catch (e) {
      message.error(e.response?.data?.error || '创建失败');
    }
  };

  const handleViewDetail = async (policy) => {
    try {
      const res = await axios.get(`${API_BASE}/policies/${policy.id}`);
      setSelectedPolicy(res.data.data);
      setDetailModalVisible(true);
    } catch (e) {
      message.error('加载详情失败');
    }
  };

  const handleSubmitApproval = async (policyId) => {
    try {
      await axios.post(`${API_BASE}/policies/${policyId}/submit-approval`);
      message.success('提交审批成功');
      loadData();
    } catch (e) {
      message.error(e.response?.data?.error || '提交失败');
    }
  };

  const handleApprove = async (nodeId) => {
    try {
      await axios.post(`${API_BASE}/policies/approval-nodes/${nodeId}/approve`, {
        approverUser: 'current_user',
        comment: '同意'
      });
      message.success('审批通过');
      if (selectedPolicy) {
        handleViewDetail({ id: selectedPolicy.id });
      }
      loadData();
    } catch (e) {
      message.error(e.response?.data?.error || '审批失败');
    }
  };

  const handleReject = async (nodeId) => {
    try {
      await axios.post(`${API_BASE}/policies/approval-nodes/${nodeId}/reject`, {
        approverUser: 'current_user',
        comment: '驳回'
      });
      message.success('已驳回');
      if (selectedPolicy) {
        handleViewDetail({ id: selectedPolicy.id });
      }
      loadData();
    } catch (e) {
      message.error(e.response?.data?.error || '操作失败');
    }
  };

  const handlePublish = async (policyId) => {
    try {
      await axios.post(`${API_BASE}/policies/${policyId}/publish`);
      message.success('发布完成');
      if (selectedPolicy) {
        handleViewDetail({ id: selectedPolicy.id });
      }
      loadData();
    } catch (e) {
      message.error(e.response?.data?.error || '发布失败');
    }
  };

  const handleRetryChannel = async (channelId) => {
    try {
      await axios.post(`${API_BASE}/policies/publish-channels/${channelId}/retry`);
      message.success('重试成功');
      if (selectedPolicy) {
        handleViewDetail({ id: selectedPolicy.id });
      }
      loadData();
    } catch (e) {
      message.error(e.response?.data?.error || '重试失败');
    }
  };

  const handleConfirmReading = async (values) => {
    try {
      await axios.post(`${API_BASE}/policies/${selectedPolicy.id}/confirm-reading`, {
        userId: values.userId,
        userName: values.userName
      });
      message.success('阅读确认成功');
      setReadingModalVisible(false);
      readingForm.resetFields();
      handleViewDetail({ id: selectedPolicy.id });
    } catch (e) {
      message.error(e.response?.data?.error || '确认失败');
    }
  };

  const handleAbolish = async (policyId) => {
    try {
      await axios.post(`${API_BASE}/policies/${policyId}/abolish`, {
        reason: '制度废止',
        abolishedBy: 'admin'
      });
      message.success('废止成功');
      setDetailModalVisible(false);
      loadData();
    } catch (e) {
      message.error(e.response?.data?.error || '废止失败');
    }
  };

  const getCurrentPendingNode = (nodes) => {
    if (!nodes || nodes.length === 0) return null;
    const pendingNodes = nodes.filter(n => n.status === 'PENDING');
    return pendingNodes.length > 0 ? pendingNodes[0] : null;
  };

  const columns = [
    { title: '制度编号', dataIndex: 'policyCode', key: 'policyCode' },
    { title: '版本', dataIndex: 'versionNumber', key: 'versionNumber', width: 80 },
    { title: '标题', dataIndex: 'title', key: 'title' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
    },
    { title: '创建人', dataIndex: 'createdBy', key: 'createdBy', width: 120 },
    { 
      title: '创建时间', 
      dataIndex: 'createdAt', 
      key: 'createdAt',
      render: (t) => dayjs(t).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          {record.status === 'DRAFT' && (
            <Button size="small" type="primary" onClick={() => handleSubmitApproval(record.id)}>
              提交审批
            </Button>
          )}
          {record.status === 'APPROVED' && (
            <Button size="small" type="primary" onClick={() => handlePublish(record.id)}>
              发布
            </Button>
          )}
        </Space>
      )
    }
  ];

  const renderDashboard = () => (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="制度总数" value={stats.total} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        {Object.entries(stats.byStatus || {}).map(([status, count]) => (
          <Col span={3} key={status}>
            <Card>
              <Statistic 
                title={statusLabels[status]} 
                value={count} 
                valueStyle={{ color: status === 'PUBLISHED' ? '#3f8600' : undefined }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card 
        title="制度列表" 
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            新建制度
          </Button>
        }
      >
        <Table 
          columns={columns} 
          dataSource={policies} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );

  const renderDetail = () => {
    if (!selectedPolicy) return null;

    const currentPendingNode = getCurrentPendingNode(selectedPolicy.approvalNodes);

    return (
      <Modal
        title={`制度详情 - ${selectedPolicy.title}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>,
          selectedPolicy.status === 'APPROVED' && (
            <Button key="publish" type="primary" onClick={() => handlePublish(selectedPolicy.id)}>
              发布
            </Button>
          ),
          selectedPolicy.status === 'PUBLISHED' && (
            <Space key="actions">
              <Button 
                icon={<UserOutlined />} 
                onClick={() => setReadingModalVisible(true)}
              >
                确认阅读
              </Button>
              <Popconfirm
                title="确认废止该制度？"
                onConfirm={() => handleAbolish(selectedPolicy.id)}
                okText="确认"
                cancelText="取消"
              >
                <Button danger>废止</Button>
              </Popconfirm>
            </Space>
          )
        ]}
      >
        <Descriptions column={2} style={{ marginBottom: 24 }} bordered>
          <Descriptions.Item label="制度编号">{selectedPolicy.policyCode}</Descriptions.Item>
          <Descriptions.Item label="版本号">{selectedPolicy.versionNumber}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusColors[selectedPolicy.status]}>{statusLabels[selectedPolicy.status]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="创建人">{selectedPolicy.createdBy}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{dayjs(selectedPolicy.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          <Descriptions.Item label="适用部门">
            {selectedPolicy.applicableDepartments && selectedPolicy.applicableDepartments.length > 0 
              ? selectedPolicy.applicableDepartments.join(', ') 
              : '全部部门'}
          </Descriptions.Item>
        </Descriptions>

        {selectedPolicy.approvalNodes && selectedPolicy.approvalNodes.length > 0 && (
          <Card title="审批流程" size="small" style={{ marginBottom: 16 }}>
            <Steps direction="vertical" size="small">
              {selectedPolicy.approvalNodes.map((node) => {
                const isCurrentPending = currentPendingNode && currentPendingNode.id === node.id;
                const stepStatus = node.status === 'APPROVED' ? 'finish' :
                                   node.status === 'REJECTED' ? 'error' :
                                   isCurrentPending ? 'process' : 'wait';
                
                return (
                  <Step 
                    key={node.id}
                    title={node.nodeName}
                    status={stepStatus}
                    description={
                      <Space>
                        {node.approverUser && <span>审批人: {node.approverUser}</span>}
                        {node.comment && <span>意见: {node.comment}</span>}
                        {isCurrentPending && selectedPolicy.status === 'APPROVING' && (
                          <Space>
                            <Tag color="orange">当前审批节点</Tag>
                            <Button size="small" type="primary" onClick={() => handleApprove(node.id)}>
                              通过
                            </Button>
                            <Button size="small" danger onClick={() => handleReject(node.id)}>
                              驳回
                            </Button>
                          </Space>
                        )}
                        {node.status === 'PENDING' && !isCurrentPending && (
                          <Tag>待审批（需等前面节点完成）</Tag>
                        )}
                      </Space>
                    }
                  />
                );
              })}
            </Steps>
          </Card>
        )}

        {selectedPolicy.publishChannels && selectedPolicy.publishChannels.length > 0 && (
          <Card title="发布渠道" size="small" style={{ marginBottom: 16 }}>
            {selectedPolicy.publishChannels.map((channel) => (
              <div key={channel.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div>
                  <span>{channel.channelName}</span>
                  <Tag 
                    color={channel.status === 'SUCCESS' ? 'green' : channel.status === 'FAILED' ? 'red' : 'orange'} 
                    style={{ marginLeft: 8 }}
                  >
                    {channelStatusLabels[channel.status]}
                  </Tag>
                  {channel.errorMessage && (
                    <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>
                      错误: {channel.errorMessage}
                    </div>
                  )}
                </div>
                {channel.status === 'FAILED' && (
                  <Button size="small" icon={<ReloadOutlined />} onClick={() => handleRetryChannel(channel.id)}>
                    重试
                  </Button>
                )}
              </div>
            ))}
          </Card>
        )}

        {selectedPolicy.readingConfirmations && selectedPolicy.readingConfirmations.length > 0 && (
          <Card title="阅读确认记录" size="small" style={{ marginBottom: 16 }}>
            <Timeline>
              {selectedPolicy.readingConfirmations.map((c) => (
                <Timeline.Item key={c.id}>
                  {c.userName} 于 {dayjs(c.confirmedAt).format('YYYY-MM-DD HH:mm')} 确认阅读
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        )}

        {selectedPolicy.references && selectedPolicy.references.length > 0 && (
          <Card title="引用关系" size="small">
            <ul>
              {selectedPolicy.references.map((ref, i) => (
                <li key={i}>
                  {ref.referenceType}: {ref.referencedPolicyCode}
                  {ref.referencedVersionNumber && ` (版本 ${ref.referencedVersionNumber})`}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Modal
          title="确认阅读"
          open={readingModalVisible}
          onCancel={() => setReadingModalVisible(false)}
          footer={null}
        >
          <Form form={readingForm} layout="vertical" onFinish={handleConfirmReading}>
            <Form.Item name="userId" label="用户ID" rules={[{ required: true }]}>
              <Input placeholder="请输入用户ID" />
            </Form.Item>
            <Form.Item name="userName" label="用户姓名" rules={[{ required: true }]}>
              <Input placeholder="请输入用户姓名" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block>
                确认阅读
              </Button>
            </Form.Item>
          </Form>
        </Modal>
      </Modal>
    );
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', color: '#fff', display: 'flex', alignItems: 'center' }}>
        <h2 style={{ color: '#fff', margin: 0 }}>制度审批发布控制台</h2>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            style={{ height: '100%', borderRight: 0 }}
            onSelect={({ key }) => setSelectedKey(key)}
          >
            <Menu.Item key="dashboard" icon={<FileTextOutlined />}>总览</Menu.Item>
            <Menu.Item key="export" icon={<ExportOutlined />}>导出</Menu.Item>
          </Menu>
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content>
            {selectedKey === 'dashboard' && renderDashboard()}
            {selectedKey === 'export' && (
              <Card title="数据导出">
                <Button type="primary" onClick={() => window.open(`${API_BASE}/policies/export/csv`)}>
                  导出 CSV
                </Button>
              </Card>
            )}
          </Content>
        </Layout>
      </Layout>

      {renderDetail()}

      <Modal
        title="新建制度"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreatePolicy}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="policyCode" label="制度编号" rules={[{ required: true }]}>
                <Input placeholder="例如: POL-001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="title" label="制度标题" rules={[{ required: true }]}>
                <Input placeholder="请输入制度标题" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="制度描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="applicableDepartments" label="适用部门（用逗号分隔）">
            <Input placeholder="例如: 技术部,人事部,财务部（留空表示全部部门）" />
          </Form.Item>
          <Divider orientation="left" plain>审批与发布配置</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="approvalNodes" label="审批节点（用逗号分隔）">
                <Input placeholder="例如: 部门经理,HR总监,CEO" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="publishChannels" label="发布渠道（用逗号分隔）">
                <Input placeholder="例如: 内部OA,企业微信,邮件通知" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="references" label="引用的其他制度编号（用逗号分隔）">
            <Input placeholder="例如: POL-001,POL-002（留空表示无引用）" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建制度
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}

export default App;
