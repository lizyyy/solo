import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Select,
  message,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Row,
  Col,
  Descriptions,
  Divider,
  Empty,
  Statistic,
  Badge,
  Steps,
  Timeline,
} from 'antd';
import {
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  BugOutlined,
  ClusterOutlined,
  FileSearchOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { anomalyApi } from '../services/api';
import {
  ANOMALY_TYPE_LABELS,
  ANOMALY_TYPES,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  ENVIRONMENT_LABELS,
} from '../utils/constants';
import { formatCurrency, isFinance, getCurrentMonth, getMonthList } from '../utils/helpers';

const { Option } = Select;
const { TextArea } = Input;

const anomalyTypeIcons = {
  no_tags: <WarningOutlined />,
  tag_conflict: <ExclamationCircleOutlined />,
  allocation_over_total: <ClusterOutlined />,
  duplicate_import: <FileSearchOutlined />,
  allocation_ratio_invalid: <SettingOutlined />,
};

function Anomalies({ user }) {
  const [loading, setLoading] = useState(false);
  const [anomalies, setAnomalies] = useState([]);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    severity: '',
    billMonth: getCurrentMonth(),
  });
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [resolveVisible, setResolveVisible] = useState(false);
  const [resolveForm] = Form.useForm();
  const [filterLoading, setFilterLoading] = useState(false);

  const canResolve = isFinance(user?.role);

  useEffect(() => {
    loadAnomalies();
    loadStats();
  }, [pagination.page, pagination.pageSize, filters]);

  const loadStats = async () => {
    try {
      const response = await anomalyApi.getStats({ billMonth: filters.billMonth });
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadAnomalies = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        ...filters,
      };
      Object.keys(params).forEach(
        (key) => !params[key] && delete params[key]
      );
      const response = await anomalyApi.list(params);
      if (response.data.success) {
        setAnomalies(response.data.data);
        setPagination((p) => ({
          ...p,
          total: response.data.pagination?.total || 0,
        }));
      }
    } catch (error) {
      message.error('加载异常列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilterLoading(true);
    setTimeout(() => {
      setFilters((prev) => ({ ...prev, ...newFilters }));
      setPagination((p) => ({ ...p, page: 1 }));
      setFilterLoading(false);
    }, 100);
  };

  const handleViewDetail = async (record) => {
    try {
      const response = await anomalyApi.get(record.id);
      if (response.data.success) {
        setSelectedAnomaly(response.data.data);
        setDetailVisible(true);
      }
    } catch (error) {
      message.error('加载详情失败');
    }
  };

  const handleOpenResolve = (record) => {
    setSelectedAnomaly(record);
    resolveForm.setFieldsValue({
      status: 'resolved',
      note: '',
    });
    setResolveVisible(true);
  };

  const handleResolveSubmit = async (values) => {
    try {
      await anomalyApi.update(selectedAnomaly.id, values);
      message.success('状态更新成功');
      setResolveVisible(false);
      loadAnomalies();
      loadStats();
    } catch (error) {
      message.error('更新失败');
    }
  };

  const columns = [
    {
      title: '异常类型',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (type) => (
        <Space>
          {anomalyTypeIcons[type]}
          {ANOMALY_TYPE_LABELS[type] || type}
        </Space>
      ),
      filters: Object.entries(ANOMALY_TYPE_LABELS).map(([key, label]) => ({
        text: label,
        value: key,
      })),
      onFilter: (value, record) => record.type === value,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '涉及资源',
      dataIndex: 'relatedEntity',
      key: 'relatedEntity',
      width: 180,
      render: (v) => v || '-',
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity) => (
        <Tag color={SEVERITY_COLORS[severity]}>
          {SEVERITY_LABELS[severity]}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={STATUS_COLORS[status]}>
          {STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: '发现时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (t) => new Date(t).toLocaleString('zh-CN'),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {canResolve && record.status !== 'resolved' && (
            <Button
              type="link"
              icon={<CheckCircleOutlined />}
              onClick={() => handleOpenResolve(record)}
            >
              处理
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const monthOptions = getMonthList(12);

  const statsCards = [
    {
      title: '待处理',
      value: stats.openCount || 0,
      color: '#ff4d4f',
      icon: <ExclamationCircleOutlined />,
      bg: 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)',
    },
    {
      title: '处理中',
      value: stats.inProgressCount || 0,
      color: '#faad14',
      icon: <WarningOutlined />,
      bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    },
    {
      title: '已解决',
      value: stats.resolvedCount || 0,
      color: '#52c41a',
      icon: <CheckCircleOutlined />,
      bg: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    },
    {
      title: '无标签资源',
      value: stats.noTagsCount || 0,
      color: '#1890ff',
      icon: <BugOutlined />,
      bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <h2 className="page-header-title">异常处理</h2>
          <p className="page-header-desc">
            检测并处理无标签资源、标签冲突、分摊异常等问题
          </p>
        </div>
        <Space>
          <Select
            style={{ width: 160 }}
            value={filters.billMonth}
            onChange={(v) => handleFilterChange({ billMonth: v })}
            loading={filterLoading}
          >
            {monthOptions.map((m) => (
              <Option key={m.value} value={m.value}>
                {m.label}
              </Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={() => { loadAnomalies(); loadStats(); }}>
            刷新
          </Button>
        </Space>
      </div>

      <div style={{ marginBottom: 24, display: 'flex', gap: 16 }}>
        {statsCards.map((stat, idx) => (
          <Card
            key={idx}
            size="small"
            style={{ flex: 1 }}
            cover={
              <div
                style={{
                  padding: 20,
                  background: stat.bg,
                  color: 'white',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 4 }}>
                  {stat.icon}
                </div>
                <div style={{ fontSize: 28, fontWeight: 600 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  {stat.title}
                </div>
              </div>
            }
          />
        ))}
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Select
              style={{ width: '100%' }}
              placeholder="异常类型"
              allowClear
              value={filters.type || undefined}
              onChange={(v) => handleFilterChange({ type: v })}
            >
              {Object.entries(ANOMALY_TYPE_LABELS).map(([key, label]) => (
                <Option key={key} value={key}>
                  {label}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={8}>
            <Select
              style={{ width: '100%' }}
              placeholder="严重程度"
              allowClear
              value={filters.severity || undefined}
              onChange={(v) => handleFilterChange({ severity: v })}
            >
              {Object.entries(SEVERITY_LABELS).map(([key, label]) => (
                <Option key={key} value={key}>
                  {label}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={8}>
            <Select
              style={{ width: '100%' }}
              placeholder="状态"
              allowClear
              value={filters.status || undefined}
              onChange={(v) => handleFilterChange({ status: v })}
            >
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <Option key={key} value={key}>
                  {label}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          dataSource={anomalies}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) =>
              setPagination((p) => ({ ...p, page, pageSize })),
          }}
          locale={{ emptyText: <Empty description="暂无异常记录" /> }}
        />
      </Card>

      <Modal
        title="异常详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
          canResolve && selectedAnomaly?.status !== 'resolved' && (
            <Button
              key="resolve"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => {
                setDetailVisible(false);
                handleOpenResolve(selectedAnomaly);
              }}
            >
              处理
            </Button>
          ),
        ]}
      >
        {selectedAnomaly && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="异常类型" span={2}>
                <Space>
                  {anomalyTypeIcons[selectedAnomaly.type]}
                  <Tag color={SEVERITY_COLORS[selectedAnomaly.severity]}>
                    {SEVERITY_LABELS[selectedAnomaly.severity]}
                  </Tag>
                  <span style={{ fontWeight: 500 }}>
                    {ANOMALY_TYPE_LABELS[selectedAnomaly.type]}
                  </span>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_COLORS[selectedAnomaly.status]}>
                  {STATUS_LABELS[selectedAnomaly.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="账单月份">
                {selectedAnomaly.billMonth || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="涉及实体" span={2}>
                {selectedAnomaly.relatedEntity || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="发现时间">
                {new Date(selectedAnomaly.createdAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {new Date(selectedAnomaly.updatedAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {selectedAnomaly.description}
              </Descriptions.Item>
            </Descriptions>

            {selectedAnomaly.detail && (
              <>
                <Divider orientation="left">详细信息</Divider>
                <Card size="small" style={{ background: '#fafafa' }}>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>
                    {typeof selectedAnomaly.detail === 'string'
                      ? selectedAnomaly.detail
                      : JSON.stringify(selectedAnomaly.detail, null, 2)}
                  </pre>
                </Card>
              </>
            )}

            {selectedAnomaly.resolutionNote && (
              <>
                <Divider orientation="left">处理备注</Divider>
                <Card size="small">
                  <p style={{ margin: 0, color: '#666' }}>
                    {selectedAnomaly.resolutionNote}
                  </p>
                </Card>
              </>
            )}

            <Divider orientation="left">处理建议</Divider>
            <Timeline>
              <Timeline.Item color="blue">
                <b>了解问题</b>：查看详细信息，了解异常产生的原因
              </Timeline.Item>
              {selectedAnomaly.type === ANOMALY_TYPES.NO_TAGS && (
                <Timeline.Item color="green">
                  <b>标签修复</b>：在云控制台为该资源添加正确的项目标签，或使用人工分配功能
                </Timeline.Item>
              )}
              {selectedAnomaly.type === ANOMALY_TYPES.TAG_CONFLICT && (
                <Timeline.Item color="green">
                  <b>规则调整</b>：检查标签规则配置，调整优先级或修改规则匹配条件
                </Timeline.Item>
              )}
              {selectedAnomaly.type === ANOMALY_TYPES.ALLOCATION_OVER_TOTAL && (
                <Timeline.Item color="green">
                  <b>分摊调整</b>：检查共享服务分摊比例，确保比例之和不超过100%
                </Timeline.Item>
              )}
              {selectedAnomaly.type === ANOMALY_TYPES.DUPLICATE_IMPORT && (
                <Timeline.Item color="green">
                  <b>导入检查</b>：确认该月份账单是否已正确导入，可忽略此异常
                </Timeline.Item>
              )}
              <Timeline.Item color="purple">
                <b>标记处理</b>：点击"处理"按钮，更新异常状态并填写处理备注
              </Timeline.Item>
            </Timeline>
          </div>
        )}
      </Modal>

      <Modal
        title="处理异常"
        open={resolveVisible}
        onCancel={() => setResolveVisible(false)}
        onOk={() => resolveForm.submit()}
        width={500}
      >
        {selectedAnomaly && (
          <Form form={resolveForm} layout="vertical" onFinish={handleResolveSubmit}>
            <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="异常类型">
                  {ANOMALY_TYPE_LABELS[selectedAnomaly.type]}
                </Descriptions.Item>
                <Descriptions.Item label="描述">
                  {selectedAnomaly.description}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Form.Item
              name="status"
              label="更新状态为"
              rules={[{ required: true, message: '请选择状态' }]}
            >
              <Select>
                <Option value="in_progress">处理中</Option>
                <Option value="resolved">已解决</Option>
                <Option value="ignored">忽略</Option>
              </Select>
            </Form.Item>

            <Form.Item name="note" label="处理备注">
              <TextArea rows={4} placeholder="请输入处理备注" />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}

export default Anomalies;
