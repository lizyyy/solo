import React, { useState, useEffect } from 'react';
import { Layout, Card, Statistic, Table, Button, Modal, Form, Select, Tag, Space, Descriptions, Input, message, Tabs, Timeline } from 'antd';
import { ReloadOutlined, PlusOutlined, EyeOutlined, CheckOutlined, CloseOutlined, DownloadOutlined, WarningOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Header, Content, Sider } = Layout;
const { TextArea } = Input;

const API_BASE = 'http://localhost:3001/api';

const STATUS_COLORS = {
  pending: 'orange',
  processing: 'blue',
  completed: 'green',
  failed: 'red',
  rejected: 'default'
};

const STATUS_TEXT = {
  pending: '待审批',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
  rejected: '已拒绝'
};

function App() {
  const [overview, setOverview] = useState({});
  const [tasks, setTasks] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [overviewRes, tasksRes, rolesRes] = await Promise.all([
        axios.get(`${API_BASE}/tasks/statistics/overview`),
        axios.get(`${API_BASE}/tasks/list`),
        axios.get(`${API_BASE}/roles`)
      ]);
      setOverview(overviewRes.data);
      setTasks(tasksRes.data.tasks);
      setRoles(rolesRes.data);
    } catch (err) {
      console.error('加载数据失败', err);
    }
  };

  const handleCreateTask = async (values) => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/tasks/create`, {
        ...values,
        created_by: 'current_user'
      });
      message.success('任务创建成功');
      setCreateVisible(false);
      form.resetFields();
      loadData();
    } catch (err) {
      message.error('创建失败: ' + (err.response?.data?.error || err.message));
    }
    setLoading(false);
  };

  const handleViewDetail = async (taskId) => {
    try {
      const res = await axios.get(`${API_BASE}/tasks/${taskId}`);
      setSelectedTask(res.data);
      setDetailVisible(true);
    } catch (err) {
      message.error('加载详情失败');
    }
  };

  const handleApprove = async (taskId) => {
    try {
      await axios.post(`${API_BASE}/tasks/${taskId}/approve`, {
        approver: 'admin',
        comment: '审批通过'
      });
      message.success('审批成功');
      loadData();
      if (selectedTask?.task.task_id === taskId) {
        handleViewDetail(taskId);
      }
    } catch (err) {
      message.error('审批失败');
    }
  };

  const handleReject = async (taskId) => {
    try {
      await axios.post(`${API_BASE}/tasks/${taskId}/reject`, {
        approver: 'admin',
        comment: '审批拒绝'
      });
      message.success('已拒绝');
      loadData();
    } catch (err) {
      message.error('操作失败');
    }
  };

  const handleRetry = async (taskId) => {
    try {
      await axios.post(`${API_BASE}/tasks/${taskId}/retry`);
      message.success('重试成功');
      loadData();
    } catch (err) {
      message.error('重试失败');
    }
  };

  const handleDownload = async (taskId) => {
    try {
      const res = await axios.get(`${API_BASE}/tasks/${taskId}/download`, {
        params: { downloaded_by: 'current_user' }
      });
      message.success('下载成功');
      console.log('导出数据:', res.data);
      Modal.info({
        title: '导出数据预览',
        width: 800,
        content: (
          <div>
            <p><strong>文件名:</strong> {res.data.filename}</p>
            <p><strong>策略版本:</strong> {res.data.strategy_version}</p>
            <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4, overflowX: 'auto' }}>
              {JSON.stringify(res.data.data, null, 2)}
            </pre>
          </div>
        )
      });
      loadData();
    } catch (err) {
      message.error('下载失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const columns = [
    { title: '任务ID', dataIndex: 'task_id', key: 'task_id', ellipsis: true, width: 200 },
    { title: '任务名称', dataIndex: 'task_name', key: 'task_name', width: 150 },
    { title: '角色', dataIndex: 'role_name', key: 'role_name', width: 100 },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status', 
      width: 100,
      render: (status) => <Tag color={STATUS_COLORS[status]}>{STATUS_TEXT[status]}</Tag>
    },
    { title: '策略版本', dataIndex: 'strategy_version', key: 'strategy_version', width: 100 },
    { title: '重试次数', dataIndex: 'retry_count', key: 'retry_count', width: 80 },
    { title: '创建人', dataIndex: 'created_by', key: 'created_by', width: 100 },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_, record) => (
        <Space size="small">
          <Button icon={<EyeOutlined />} size="small" onClick={() => handleViewDetail(record.task_id)}>
            详情
          </Button>
          {record.status === 'pending' && record.need_approval === 1 && (
            <>
              <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => handleApprove(record.task_id)}>
                通过
              </Button>
              <Button danger size="small" icon={<CloseOutlined />} onClick={() => handleReject(record.task_id)}>
                拒绝
              </Button>
            </>
          )}
          {record.status === 'failed' && (
            <Button type="primary" size="small" icon={<ReloadOutlined />} onClick={() => handleRetry(record.task_id)}>
              重试
            </Button>
          )}
          {record.status === 'completed' && (
            <Button type="primary" size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(record.task_id)}>
              下载
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', color: '#fff', display: 'flex', alignItems: 'center' }}>
        <h2 style={{ color: '#fff', margin: 0 }}>导出脱敏策略控制台</h2>
      </Header>
      <Layout>
        <Content style={{ padding: '24px' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <Card>
                <Statistic title="任务总数" value={overview.total || 0} suffix="个" />
              </Card>
              <Card>
                <Statistic title="今日新增" value={overview.today || 0} suffix="个" />
              </Card>
              <Card>
                <Statistic title="处理中" value={overview.status_breakdown?.find(s => s.status === 'processing')?.count || 0} suffix="个" />
              </Card>
              <Card>
                <Statistic 
                  title="失败任务" 
                  value={overview.failed || 0} 
                  suffix="个"
                  valueStyle={{ color: '#ff4d4f' }}
                  prefix={<WarningOutlined />}
                />
              </Card>
            </div>

            <Card title="任务管理" extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>
                新建导出任务
              </Button>
            }>
              <Table 
                columns={columns} 
                dataSource={tasks} 
                rowKey="task_id" 
                pagination={{ pageSize: 10 }}
                scroll={{ x: 1200 }}
              />
            </Card>

            <Card title="脱敏策略配置">
              <Tabs 
                items={roles.map(role => ({
                  key: role.role_code,
                  label: `${role.role_name} (${role.strategy_version})`,
                  children: (
                    <Table
                      dataSource={role.strategies}
                      rowKey="id"
                      pagination={false}
                    >
                      <Table.Column title="字段名" dataIndex="field_name" key="field_name" />
                      <Table.Column title="脱敏类型" dataIndex="masking_type" key="masking_type" 
                        render={(type) => {
                          const typeMap = { none: '不脱敏', middle: '中间脱敏', last4: '后4位', full: '全脱敏' };
                          return <Tag>{typeMap[type] || type}</Tag>;
                        }}
                      />
                      <Table.Column title="示例" dataIndex="masking_pattern" key="masking_pattern" />
                    </Table>
                  )
                }))}
              />
            </Card>
          </Space>
        </Content>
      </Layout>

      <Modal
        title="新建导出任务"
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleCreateTask} layout="vertical">
          <Form.Item name="task_name" label="任务名称" rules={[{ required: true }]}>
            <Input placeholder="请输入任务名称" />
          </Form.Item>
          <Form.Item name="role_code" label="导出角色" rules={[{ required: true }]}>
            <Select placeholder="请选择导出角色">
              {roles.map(role => (
                <Select.Option key={role.role_code} value={role.role_code}>
                  {role.role_name} ({role.strategy_version})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="parameters.data_range" label="数据范围">
            <Select placeholder="请选择数据范围">
              <Select.Option value="7d">最近7天</Select.Option>
              <Select.Option value="30d">最近30天</Select.Option>
              <Select.Option value="90d">最近90天</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              创建任务
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="任务详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        width={900}
        footer={selectedTask?.task?.status === 'pending' && selectedTask?.task?.need_approval === 1 ? [
          <Button key="reject" danger onClick={() => handleReject(selectedTask.task.task_id)}>
            拒绝
          </Button>,
          <Button key="approve" type="primary" onClick={() => handleApprove(selectedTask.task.task_id)}>
            通过
          </Button>
        ] : selectedTask?.task?.status === 'failed' ? [
          <Button key="retry" type="primary" onClick={() => handleRetry(selectedTask.task.task_id)}>
            重试任务
          </Button>
        ] : selectedTask?.task?.status === 'completed' ? [
          <Button key="download" type="primary" onClick={() => handleDownload(selectedTask.task.task_id)} icon={<DownloadOutlined />}>
            下载导出
          </Button>
        ] : null}
      >
        {selectedTask && (
          <Tabs items={[
            {
              key: 'basic',
              label: '基本信息',
              children: (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <Descriptions column={2} bordered>
                    <Descriptions.Item label="任务ID">{selectedTask.task.task_id}</Descriptions.Item>
                    <Descriptions.Item label="任务名称">{selectedTask.task.task_name}</Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Tag color={STATUS_COLORS[selectedTask.task.status]}>
                        {STATUS_TEXT[selectedTask.task.status]}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="策略版本">{selectedTask.task.strategy_version}</Descriptions.Item>
                    <Descriptions.Item label="创建人">{selectedTask.task.created_by}</Descriptions.Item>
                    <Descriptions.Item label="创建时间">{selectedTask.task.created_at}</Descriptions.Item>
                    <Descriptions.Item label="重试次数">{selectedTask.task.retry_count}</Descriptions.Item>
                    <Descriptions.Item label="需要审批">{selectedTask.task.need_approval ? '是' : '否'}</Descriptions.Item>
                  </Descriptions>
                  
                  {selectedTask.task.error_message && (
                    <Card title="错误信息" type="inner" style={{ borderColor: '#ff4d4f' }}>
                      <p style={{ color: '#ff4d4f' }}>{selectedTask.task.error_message}</p>
                    </Card>
                  )}

                  <Card title="脱敏策略" type="inner">
                    <Table dataSource={selectedTask.strategies} rowKey="id" pagination={false} size="small">
                      <Table.Column title="字段" dataIndex="field_name" />
                      <Table.Column title="脱敏类型" dataIndex="masking_type" />
                    </Table>
                  </Card>
                </Space>
              )
            },
            {
              key: 'approval',
              label: '审批记录',
              children: (
                <Timeline>
                  {selectedTask.approvals.map((item, idx) => (
                    <Timeline.Item key={idx} color={item.action === 'approve' ? 'green' : 'red'}>
                      <p><strong>{item.approver}</strong> 在 {item.created_at} {item.action === 'approve' ? '通过' : '拒绝'} 了此任务</p>
                      {item.comment && <p>备注: {item.comment}</p>}
                    </Timeline.Item>
                  ))}
                  {selectedTask.approvals.length === 0 && <p>暂无审批记录</p>}
                </Timeline>
              )
            },
            {
              key: 'download',
              label: '下载日志',
              children: (
                <Table dataSource={selectedTask.downloads} rowKey="id" pagination={false}>
                  <Table.Column title="下载人" dataIndex="downloaded_by" />
                  <Table.Column title="下载IP" dataIndex="download_ip" />
                  <Table.Column title="下载时间" dataIndex="created_at" />
                </Table>
              )
            }
          ]} />
        )}
      </Modal>
    </Layout>
  );
}

export default App;