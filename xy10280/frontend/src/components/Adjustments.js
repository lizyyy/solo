import React, { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Space, Button, Modal, Form, Input, Select, message,
  Row, Col, Descriptions, Divider, Progress, Alert, List, Statistic,
  Timeline, Empty, Steps, Popconfirm
} from 'antd';
import {
  PlusOutlined, EyeOutlined, CheckOutlined, CloseOutlined,
  WarningOutlined, UserOutlined, RiseOutlined,
  ReloadOutlined, TeamOutlined, SafetyCertificateOutlined
} from '@ant-design/icons';
import { adjustmentsAPI, stationsAPI, routesAPI } from '../services/api';

const { Option } = Select;
const { Step } = Steps;

const Adjustments = () => {
  const [tasks, setTasks] = useState([]);
  const [stations, setStations] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [impactData, setImpactData] = useState(null);
  const [interceptionData, setInterceptionData] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksResult, stationsResult, routesResult] = await Promise.all([
        adjustmentsAPI.getAll({ status: statusFilter }),
        stationsAPI.getAll(),
        routesAPI.getAll(),
      ]);
      setTasks(tasksResult);
      setStations(stationsResult);
      setRoutes(routesResult);
    } catch (error) {
      message.error('加载数据失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const getStatusMap = (status) => {
    const map = {
      pending: { color: 'blue', text: '待处理', icon: null },
      pending_review: { color: 'orange', text: '待复核', icon: <WarningOutlined /> },
      approved: { color: 'green', text: '已通过', icon: <CheckOutlined /> },
      rejected: { color: 'red', text: '已拒绝', icon: <CloseOutlined /> },
      escalated: { color: 'purple', text: '已上报', icon: <RiseOutlined /> },
    };
    return map[status] || { color: 'default', text: status, icon: null };
  };

  const handleAdd = () => {
    form.resetFields();
    setInterceptionData(null);
    setModalVisible(true);
  };

  const handleView = async (record) => {
    setSelectedTask(record);
    try {
      const impact = await adjustmentsAPI.getImpact(record.id);
      setImpactData(impact);
    } catch (error) {
      console.error('加载影响分析失败:', error);
    }
    setDetailModalVisible(true);
  };

  const handleReview = async (action, comment = '') => {
    try {
      await adjustmentsAPI.review(selectedTask.id, {
        action,
        comment,
        reviewed_by: '系统管理员',
      });
      message.success(`操作成功: ${action === 'approve' ? '已通过' : action === 'reject' ? '已拒绝' : '已上报'}`);
      setDetailModalVisible(false);
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const result = await adjustmentsAPI.create({
        ...values,
        type: 'withdrawal',
      });
      setInterceptionData(result);
      
      if (result.interception?.needsReview) {
        message.warning('任务已创建，但触发拦截规则，需要人工复核');
      } else {
        message.success('任务创建成功');
        setModalVisible(false);
      }
      
      loadData();
    } catch (error) {
      message.error('创建失败');
    }
  };

  const columns = [
    {
      title: '任务标题',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <Space>
          {record.status === 'pending_review' && <Tag color="orange" icon={<WarningOutlined />}>需复核</Tag>}
          {text}
        </Space>
      ),
    },
    { title: '站点', dataIndex: 'station_name', key: 'station_name', width: 150 },
    { title: '线路', dataIndex: 'route_name', key: 'route_name', width: 120 },
    {
      title: '报名/实乘',
      key: 'counts',
      width: 120,
      render: (_, record) => `${record.registration_count}/${record.actual_count}`,
    },
    {
      title: '差异率',
      dataIndex: 'difference_rate',
      key: 'difference_rate',
      width: 100,
      render: (rate) => (
        <span style={{ color: rate >= 0.5 ? '#ff4d4f' : '#52c41a', fontWeight: 'bold' }}>
          {(rate * 100).toFixed(1)}%
        </span>
      ),
    },
    {
      title: '热度指数',
      key: 'heat_score',
      width: 150,
      render: (_, record) => (
        <Progress
          percent={Math.round(record.heat_score || 0)}
          size="small"
          status={record.heat_score >= 70 ? 'normal' : record.heat_score >= 40 ? 'active' : 'exception'}
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const s = getStatusMap(status);
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            详情
          </Button>
        </Space>
      ),
    },
  ];

  const pendingCount = tasks.filter(t => t.status === 'pending' || t.status === 'pending_review').length;
  const approvedCount = tasks.filter(t => t.status === 'approved').length;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>调整任务管理</h2>
        <Space>
          <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 150 }} placeholder="状态筛选" allowClear>
            <Option value="pending">待处理</Option>
            <Option value="pending_review">待复核</Option>
            <Option value="approved">已通过</Option>
            <Option value="rejected">已拒绝</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            发起撤点申请
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card className="stat-card">
            <Statistic
              title="待处理任务"
              value={pendingCount}
              valueStyle={{ color: '#faad14' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="stat-card">
            <Statistic
              title="已通过任务"
              value={approvedCount}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="stat-card">
            <Statistic
              title="总任务数"
              value={tasks.length}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="调整任务列表">
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={interceptionData ? '任务创建结果' : '发起撤点申请'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setInterceptionData(null); }}
        onOk={() => !interceptionData && form.submit()}
        okText={interceptionData ? '关闭' : '创建任务'}
        cancelText="取消"
        footer={null}
        width={700}
        destroyOnClose
      >
        {interceptionData ? (
          <div>
            <Alert
              message={interceptionData.interception?.needsReview ? '任务已创建，触发拦截规则，需人工复核' : '任务创建成功'}
              type={interceptionData.interception?.needsReview ? 'warning' : 'success'}
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="报名人数" value={interceptionData.registration_count} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="实际乘车" value={interceptionData.actual_count} valueStyle={{ color: '#1890ff' }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="差异率" value={(interceptionData.difference_rate * 100).toFixed(1)} suffix="%" />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="热度指数"
                    value={interceptionData.heat_score?.toFixed(1)}
                    valueStyle={{ color: interceptionData.heat_score >= 70 ? '#52c41a' : '#ff4d4f' }}
                  />
                </Card>
              </Col>
            </Row>

            {interceptionData.interception?.warnings?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 8 }}>拦截/警告信息</h4>
                <List
                  dataSource={interceptionData.interception.warnings}
                  renderItem={item => (
                    <List.Item className={`${item.type}-warning`} style={{ background: '#fafafa', padding: '12px 16px', marginBottom: 8, borderRadius: 4 }}>
                      <Alert
                        message={item.message}
                        type={item.type === 'block' ? 'error' : item.type === 'warning' ? 'warning' : 'info'}
                        showIcon
                        style={{ width: '100%' }}
                      />
                    </List.Item>
                  )}
                />
              </div>
            )}

            <Divider orientation="left">系统建议</Divider>
            <Alert
              message={interceptionData.proposal}
              type="info"
              showIcon
            />

            <div style={{ marginTop: 24, textAlign: 'right' }}>
              <Button onClick={() => { setModalVisible(false); setInterceptionData(null); }}>
                关闭
              </Button>
            </div>
          </div>
        ) : (
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item name="station_id" label="选择站点" rules={[{ required: true, message: '请选择站点' }]}>
              <Select placeholder="选择要撤点的站点">
                {stations.filter(s => s.status === 'active').map(station => (
                  <Option key={station.id} value={station.id}>
                    {station.name} - {station.route_name || '未分配'}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="route_id" label="所属线路" rules={[{ required: true, message: '请选择线路' }]}>
              <Select placeholder="选择线路">
                {routes.map(route => (
                  <Option key={route.id} value={route.id}>{route.name}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="title" label="任务标题" rules={[{ required: true, message: '请输入任务标题' }]}>
              <Input placeholder="如：XX站点撤点申请" />
            </Form.Item>
            <Form.Item name="description" label="调整原因">
              <Input.TextArea rows={3} placeholder="请说明撤点原因" />
            </Form.Item>
            
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setModalVisible(false)}>取消</Button>
                <Button type="primary" onClick={() => form.submit()}>
                  试算并创建
                </Button>
              </Space>
            </div>
          </Form>
        )}
      </Modal>

      <Modal
        title="调整任务详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={1000}
      >
        {selectedTask && (
          <div>
            <Steps style={{ marginBottom: 24 }} current={
              selectedTask.status === 'pending' ? 0 :
              selectedTask.status === 'pending_review' ? 1 :
              selectedTask.status === 'approved' || selectedTask.status === 'escalated' ? 2 : 3
            }>
              <Step title="创建" description={selectedTask.created_at?.substring(0, 16)} />
              <Step title="复核" description={selectedTask.reviewed_at?.substring(0, 16) || '待处理'} />
              <Step title="执行" description={selectedTask.status === 'approved' ? '已执行' : '待执行'} />
            </Steps>

            <Row gutter={16}>
              <Col span={16}>
                <Card title="任务信息" size="small" style={{ marginBottom: 16 }}>
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="任务ID">#{selectedTask.id}</Descriptions.Item>
                    <Descriptions.Item label="类型">
                      {selectedTask.type === 'withdrawal' ? <Tag color="red">撤点</Tag> : <Tag>调整</Tag>}
                    </Descriptions.Item>
                    <Descriptions.Item label="站点">{selectedTask.station_name}</Descriptions.Item>
                    <Descriptions.Item label="线路">{selectedTask.route_name}</Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Tag color={getStatusMap(selectedTask.status).color}>
                        {getStatusMap(selectedTask.status).text}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="创建时间">{selectedTask.created_at}</Descriptions.Item>
                    <Descriptions.Item label="描述" span={2}>{selectedTask.description}</Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card title="热度分析" size="small" style={{ marginBottom: 16 }}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Card size="small">
                        <Statistic title="报名人数" value={selectedTask.registration_count} />
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small">
                        <Statistic title="实际乘车" value={selectedTask.actual_count} valueStyle={{ color: '#1890ff' }} />
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small">
                        <Statistic
                          title="差异率"
                          value={(selectedTask.difference_rate * 100).toFixed(1)}
                          suffix="%"
                          valueStyle={{ color: selectedTask.difference_rate >= 0.5 ? '#ff4d4f' : '#52c41a' }}
                        />
                      </Card>
                    </Col>
                  </Row>
                  <div style={{ marginTop: 16 }}>
                    <strong>热度指数: </strong>
                    <Progress
                      percent={Math.round(selectedTask.heat_score || 0)}
                      status={selectedTask.heat_score >= 70 ? 'normal' : selectedTask.heat_score >= 40 ? 'active' : 'exception'}
                    />
                  </div>
                </Card>

                <Card title="系统建议" size="small">
                  <Alert message={selectedTask.proposal} type="info" showIcon />
                </Card>
              </Col>

              <Col span={8}>
                <Card
                  title={
                    <Space>
                      <TeamOutlined />
                      员工影响分析
                    </Space>
                  }
                  size="small"
                  style={{ marginBottom: 16 }}
                >
                  {impactData ? (
                    <div>
                      <div className="impact-summary" style={{ marginBottom: 16 }}>
                        <Statistic
                          title="预计受影响员工"
                          value={impactData.affected_count}
                          valueStyle={{ color: 'white', fontSize: 28 }}
                        />
                      </div>

                      {Object.keys(impactData.department_breakdown || {}).length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <h4 style={{ marginBottom: 8 }}>部门分布</h4>
                          {Object.entries(impactData.department_breakdown).map(([dept, count]) => (
                            <div key={dept} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span>{dept}</span>
                              <Tag>{count}人</Tag>
                            </div>
                          ))}
                        </div>
                      )}

                      <div>
                        <h4 style={{ marginBottom: 8 }}>备选方案</h4>
                        {impactData.alternative_options?.map((opt, idx) => (
                          <Alert key={idx} message={opt.name} type="info" showIcon style={{ marginBottom: 8 }} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Empty description="加载中..." />
                  )}
                </Card>

                {(selectedTask.status === 'pending' || selectedTask.status === 'pending_review') && (
                  <Card title="复核操作" size="small">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Popconfirm
                        title="确认通过该调整任务？"
                        description="通过后将执行相应的站点调整操作。"
                        onConfirm={() => handleReview('approve')}
                        okText="确认通过"
                        cancelText="取消"
                      >
                        <Button type="primary" icon={<CheckOutlined />} block>
                          通过审批
                        </Button>
                      </Popconfirm>
                      <Popconfirm
                        title="确认上报上级？"
                        description="将此任务标记为需要更高层级审批。"
                        onConfirm={() => handleReview('escalate')}
                        okText="确认上报"
                        cancelText="取消"
                      >
                        <Button icon={<RiseOutlined />} block>
                          上报上级
                        </Button>
                      </Popconfirm>
                      <Popconfirm
                        title="确认拒绝该调整任务？"
                        onConfirm={() => handleReview('reject')}
                        okText="确认拒绝"
                        cancelText="取消"
                      >
                        <Button danger icon={<CloseOutlined />} block>
                          拒绝申请
                        </Button>
                      </Popconfirm>
                    </Space>
                  </Card>
                )}
              </Col>
            </Row>

            {impactData?.affected_employees?.length > 0 && (
              <Card title="受影响员工详情" size="small" style={{ marginTop: 16 }}>
                <Table
                  dataSource={impactData.affected_employees}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                  size="small"
                  columns={[
                    { title: '姓名', dataIndex: 'employee_name', key: 'employee_name' },
                    { title: '部门', dataIndex: 'department', key: 'department' },
                    { title: '电话', dataIndex: 'phone', key: 'phone' },
                    { title: '邮箱', dataIndex: 'email', key: 'email' },
                    { title: '周期', dataIndex: 'period', key: 'period' },
                  ]}
                />
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Adjustments;
