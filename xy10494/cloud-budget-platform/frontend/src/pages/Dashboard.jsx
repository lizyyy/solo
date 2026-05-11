import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Select,
  Table,
  Progress,
  Tag,
  Button,
  Tabs,
  List,
  Modal,
  Form,
  Input,
  Popconfirm,
  Space,
  Empty,
  Descriptions,
  message,
  Spin,
} from 'antd';
import {
  CloudOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  DownloadOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { dashboardApi, projectApi, billApi } from '../services/api';
import {
  formatCurrency,
  formatPercent,
  getCurrentMonth,
  getMonthList,
  getBudgetUsageColor,
  downloadJSON,
  isFinance,
  parseTags,
} from '../utils/helpers';
import {
  ENVIRONMENT_LABELS,
  ENVIRONMENT_COLORS,
  ANOMALY_TYPE_LABELS,
  SEVERITY_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  ALLOCATION_METHOD_LABELS,
  ALLOCATION_METHOD_COLORS,
} from '../utils/constants';

const { Option } = Select;
const { TabPane } = Tabs;

function Dashboard({ user }) {
  const [loading, setLoading] = useState(false);
  const [billMonth, setBillMonth] = useState(getCurrentMonth());
  const [stats, setStats] = useState(null);
  const [projectCosts, setProjectCosts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [manualHistory, setManualHistory] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [recordDetail, setRecordDetail] = useState(null);
  const [projectList, setProjectList] = useState([]);
  const [assignForm] = Form.useForm();

  const monthList = getMonthList(12);

  useEffect(() => {
    loadDashboardData();
    loadProjectList();
  }, [billMonth]);

  const loadProjectList = async () => {
    try {
      const response = await projectApi.list({ pageSize: 100 });
      if (response.data.success) {
        setProjectList(response.data.data);
      }
    } catch (error) {
      console.error('加载项目列表失败:', error);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, costsRes, alertsRes, historyRes] = await Promise.all([
        dashboardApi.getStats(billMonth),
        dashboardApi.getProjectCosts(billMonth),
        dashboardApi.getAlerts({ billMonth }),
        dashboardApi.getManualHistory({ billMonth, pageSize: 10 }),
      ]);

      if (statsRes.data.success) setStats(statsRes.data.data);
      if (costsRes.data.success) setProjectCosts(costsRes.data.data);
      if (alertsRes.data.success) setAlerts(alertsRes.data.data);
      if (historyRes.data.success) setManualHistory(historyRes.data.data);
    } catch (error) {
      message.error('加载看板数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = async () => {
    try {
      const response = await dashboardApi.exportReport(billMonth);
      downloadJSON(response.data, `cost-report-${billMonth}.json`);
      message.success('报表导出成功');
    } catch (error) {
      message.error('导出报表失败');
    }
  };

  const handleAcknowledgeAlert = async (alertId) => {
    try {
      await dashboardApi.acknowledgeAlert(alertId);
      message.success('预警已确认');
      loadDashboardData();
    } catch (error) {
      message.error('确认预警失败');
    }
  };

  const handleViewRecordDetail = async (recordId) => {
    try {
      const response = await billApi.getRecord(recordId);
      if (response.data.success) {
        setRecordDetail(response.data.data);
        setDetailModalVisible(true);
      }
    } catch (error) {
      message.error('获取详情失败');
    }
  };

  const handleManualAssign = async (values) => {
    try {
      await billApi.manualAssign(selectedRecord.id, {
        projectId: values.projectId,
        reason: values.reason,
      });
      message.success('人工分配成功');
      setDetailModalVisible(false);
      assignForm.resetFields();
      loadDashboardData();
    } catch (error) {
      message.error('分配失败');
    }
  };

  const getAllocationChartOption = () => {
    if (!stats) return {};
    return {
      tooltip: { trigger: 'item' },
      legend: { top: 'bottom' },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
          label: { show: true, formatter: '{b}: ¥{c}' },
          data: [
            { value: stats.autoAllocatedCost, name: '自动匹配', itemStyle: { color: '#52c41a' } },
            { value: stats.manualAllocatedCost, name: '人工分配', itemStyle: { color: '#1890ff' } },
            { value: stats.sharedServiceCost, name: '共享分摊', itemStyle: { color: '#722ed1' } },
          ],
        },
      ],
    };
  };

  const getProjectCostChartOption = () => {
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: projectCosts.map(p => p.name) },
      yAxis: { type: 'value' },
      series: [
        { name: '直接成本', type: 'bar', stack: 'total', data: projectCosts.map(p => p.directCost), itemStyle: { color: '#1890ff' } },
        { name: '分摊成本', type: 'bar', stack: 'total', data: projectCosts.map(p => p.sharedCost), itemStyle: { color: '#722ed1' } },
      ],
    };
  };

  const statCards = stats ? [
    { title: '总成本', value: formatCurrency(stats.totalCost), icon: <CloudOutlined style={{ color: '#1890ff' }} />, color: '#e6f7ff' },
    { title: '自动匹配', value: formatCurrency(stats.autoAllocatedCost), icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />, color: '#f6ffed' },
    { title: '未分配资源', value: stats.unallocatedCount, icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />, color: '#fff2f0' },
    { title: '活跃项目', value: stats.totalProjects, icon: <TeamOutlined style={{ color: '#722ed1' }} />, color: '#f9f0ff' },
    { title: '待处理异常', value: stats.openAnomalies, icon: <SafetyCertificateOutlined style={{ color: '#faad14' }} />, color: '#fffbe6' },
    { title: '活跃预警', value: stats.activeAlerts, icon: <DollarOutlined style={{ color: '#eb2f96' }} />, color: '#fff0f6' },
  ] : [];

  const projectColumns = [
    { title: '项目名称', dataIndex: 'name', key: 'name', render: (text, record) => (
      <div>
        <div style={{ fontWeight: 500 }}>{text}</div>
        <div style={{ color: '#999', fontSize: 12 }}>{record.code}</div>
      </div>
    ) },
    { title: '直接成本', dataIndex: 'directCost', key: 'directCost', render: v => formatCurrency(v) },
    { title: '分摊成本', dataIndex: 'sharedCost', key: 'sharedCost', render: v => formatCurrency(v) },
    { title: '总成本', dataIndex: 'totalCost', key: 'totalCost', render: v => formatCurrency(v) },
    { title: '预算', dataIndex: 'budgetAmount', key: 'budgetAmount', render: v => formatCurrency(v) },
    { title: '预算使用', dataIndex: 'budgetUsage', key: 'budgetUsage', render: (v, record) => (
      <div style={{ minWidth: 150 }}>
        <Progress
          percent={Math.min(v, 100)}
          strokeColor={getBudgetUsageColor(v)}
          size="small"
          format={percent => `${formatPercent(percent)}`}
        />
        {v > 100 && <Tag color="red">超预算 {formatPercent(v - 100)}</Tag>}
      </div>
    ) },
    { title: '剩余预算', dataIndex: 'budgetRemaining', key: 'budgetRemaining', render: (v, record) => (
      <span style={{ color: record.isOverBudget ? '#ff4d4f' : '#52c41a' }}>
        {formatCurrency(v)}
      </span>
    ) },
  ];

  const historyColumns = [
    { title: '资源名称', dataIndex: ['billRecord', 'resourceName'], key: 'resourceName' },
    { title: '分配到', dataIndex: ['project', 'name'], key: 'projectName' },
    { title: '分配人', dataIndex: ['assignedByUser', 'fullName'], key: 'assignedBy' },
    { title: '分配时间', dataIndex: 'createdAt', key: 'createdAt', render: v => new Date(v).toLocaleString('zh-CN') },
  ];

  return (
    <Spin spinning={loading}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 className="page-header-title">成本看板</h2>
            <p className="page-header-desc">查看项目成本归属、预算使用情况和异常告警</p>
          </div>
          <Space>
            <Select
              value={billMonth}
              onChange={setBillMonth}
              style={{ width: 150 }}
            >
              {monthList.map(m => (
                <Option key={m.value} value={m.value}>{m.label}</Option>
              ))}
            </Select>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleExportReport}>
              导出报表
            </Button>
          </Space>
        </div>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          {statCards.map((card, index) => (
            <Col span={4} key={index}>
              <Card style={{ background: card.color, border: 'none' }}>
                <Statistic
                  title={card.title}
                  value={card.value}
                  prefix={card.icon}
                />
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card title="成本分配方式">
              {stats && (
                <ReactECharts option={getAllocationChartOption()} style={{ height: 300 }} />
              )}
            </Card>
          </Col>
          <Col span={16}>
            <Card title="预算预警">
              {alerts.length === 0 ? (
                <Empty description="暂无预警" />
              ) : (
                <List
                  dataSource={alerts}
                  renderItem={alert => (
                    <List.Item
                      actions={!alert.isAcknowledged ? [
                        <Button type="link" onClick={() => handleAcknowledgeAlert(alert.id)}>
                          确认
                        </Button>
                      ] : []}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <Tag color={alert.alertType === 'exceeded' ? 'red' : 'orange'}>
                              {alert.alertType === 'threshold_70' ? '预算70%' : 
                               alert.alertType === 'threshold_90' ? '预算90%' : 
                               alert.alertType === 'exceeded' ? '超预算' : '预测超支'}
                            </Tag>
                            {alert.project?.name}
                          </Space>
                        }
                        description={
                          <div>
                            {alert.message}
                            <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
                              预算: {formatCurrency(alert.budgetAmount)} | 
                              实际: {formatCurrency(alert.actualAmount)}
                              {alert.forecastAmount && ` | 预测: ${formatCurrency(alert.forecastAmount)}`}
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>
        </Row>

        <Tabs defaultActiveKey="1">
          <TabPane tab="项目成本" key="1">
            <Card>
              {projectCosts.length > 0 ? (
                <ReactECharts option={getProjectCostChartOption()} style={{ height: 400, marginBottom: 24 }} />
              ) : null}
              <Table
                dataSource={projectCosts}
                columns={projectColumns}
                rowKey="id"
                pagination={false}
              />
            </Card>
          </TabPane>
          <TabPane tab="人工分配历史" key="2">
            <Card>
              <Table
                dataSource={manualHistory}
                columns={historyColumns}
                rowKey="id"
                pagination={{ pageSize: 10 }}
              />
            </Card>
          </TabPane>
        </Tabs>
      </div>

      <Modal
        title="账单详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={800}
        footer={null}
      >
        {recordDetail && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="资源ID" span={2}>{recordDetail.resourceId}</Descriptions.Item>
              <Descriptions.Item label="资源名称" span={2}>{recordDetail.resourceName}</Descriptions.Item>
              <Descriptions.Item label="产品">{recordDetail.productName}</Descriptions.Item>
              <Descriptions.Item label="区域">{recordDetail.region}</Descriptions.Item>
              <Descriptions.Item label="费用">{formatCurrency(recordDetail.costAmount)}</Descriptions.Item>
              <Descriptions.Item label="使用量">
                {recordDetail.usageAmount} {recordDetail.usageUnit}
              </Descriptions.Item>
              <Descriptions.Item label="分配方式">
                <Tag color={ALLOCATION_METHOD_COLORS[recordDetail.allocationMethod]}>
                  {ALLOCATION_METHOD_LABELS[recordDetail.allocationMethod]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="归属项目">
                {recordDetail.project?.name || '未分配'}
              </Descriptions.Item>
              {recordDetail.environment && (
                <Descriptions.Item label="环境">
                  <Tag color={ENVIRONMENT_COLORS[recordDetail.environment]}>
                    {ENVIRONMENT_LABELS[recordDetail.environment]}
                  </Tag>
                </Descriptions.Item>
              )}
            </Descriptions>

            {recordDetail.tags && Object.keys(recordDetail.tags).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ marginBottom: 8 }}>标签</h4>
                <Space wrap>
                  {Object.entries(recordDetail.tags).map(([key, value]) => (
                    <Tag key={key}>{key}: {value}</Tag>
                  ))}
                </Space>
              </div>
            )}

            {recordDetail.allocations && recordDetail.allocations.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ marginBottom: 8 }}>分摊详情</h4>
                <div className="allocation-detail">
                  <div style={{ marginBottom: 8, fontWeight: 500 }}>
                    总费用: {formatCurrency(recordDetail.costAmount)}
                  </div>
                  {recordDetail.allocations.map((alloc, idx) => (
                    <div key={idx} className="allocation-item">
                      <span>
                        <Tag color="purple">{alloc.project?.name}</Tag>
                        占比 {formatPercent(alloc.ratio * 100, 0)}
                      </span>
                      <span style={{ fontWeight: 600 }}>
                        {formatCurrency(alloc.allocatedAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recordDetail.suggestedCandidates && recordDetail.allocationMethod === 'unallocated' && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ marginBottom: 8 }}>可能归属</h4>
                <div className="allocation-detail">
                  {recordDetail.suggestedCandidates.map((candidate, idx) => (
                    <div key={idx} className="allocation-item">
                      <span>
                        <Tag color="blue">{candidate.key}</Tag>
                        <span style={{ marginLeft: 8, color: '#999' }}>{candidate.reason}</span>
                      </span>
                      <span style={{ color: '#faad14' }}>匹配度: {candidate.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recordDetail.allocationMethod === 'unallocated' && isFinance(user?.role) && (
              <div style={{ marginTop: 24 }}>
                <h4 style={{ marginBottom: 8 }}>人工分配</h4>
                <Form form={assignForm} layout="vertical" onFinish={handleManualAssign}>
                  <Form.Item
                    name="projectId"
                    label="分配到项目"
                    rules={[{ required: true, message: '请选择项目' }]}
                  >
                    <Select placeholder="请选择项目">
                      {projectList.map(p => (
                        <Option key={p.id} value={p.id}>{p.name} ({p.code})</Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item name="reason" label="分配原因">
                    <Input.TextArea rows={2} placeholder="请输入分配原因（可选）" />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" onClick={() => setSelectedRecord(recordDetail)}>
                      确认分配
                    </Button>
                  </Form.Item>
                </Form>
              </div>
            )}

            {recordDetail.manualAssignments && recordDetail.manualAssignments.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ marginBottom: 8 }}>分配历史</h4>
                <List
                  dataSource={recordDetail.manualAssignments}
                  renderItem={item => (
                    <List.Item>
                      <List.Item.Meta
                        title={`分配到: ${item.project?.name}`}
                        description={
                          <div>
                            分配人: {item.assignedByUser?.fullName} | 
                            时间: {new Date(item.createdAt).toLocaleString('zh-CN')}
                            {item.reason && <div>原因: {item.reason}</div>}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </Spin>
  );
}

export default Dashboard;
