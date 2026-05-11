import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  DatePicker,
  message,
  Space,
  Tag,
  Modal,
  Form,
  Row,
  Col,
  Descriptions,
  Divider,
  Empty,
  Collapse,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  EditOutlined,
  TagOutlined,
  ClusterOutlined,
  UserOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { billApi, projectApi } from '../services/api';
import {
  ALLOCATION_METHOD_LABELS,
  ALLOCATION_METHOD_COLORS,
  ENVIRONMENT_LABELS,
  ENVIRONMENT_COLORS,
  CLOUD_PROVIDER_LABELS,
} from '../utils/constants';
import { formatCurrency, isFinance, getMonthList } from '../utils/helpers';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { TextArea } = Input;
const { Panel } = Collapse;

function BillRecords({ user }) {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [projects, setProjects] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({
    resourceId: '',
    allocationMethod: '',
    projectId: '',
    billMonth: '',
    keyword: '',
  });
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [assignVisible, setAssignVisible] = useState(false);
  const [assignForm] = Form.useForm();

  const canAssign = isFinance(user?.role);

  useEffect(() => {
    loadRecords();
    loadProjects();
  }, [pagination.page, pagination.pageSize, filters]);

  const loadProjects = async () => {
    try {
      const response = await projectApi.list({ page: 1, pageSize: 100 });
      if (response.data.success) {
        setProjects(response.data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadRecords = async () => {
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
      const response = await billApi.getRecords(params);
      if (response.data.success) {
        setRecords(response.data.data);
        setPagination((p) => ({
          ...p,
          total: response.data.pagination?.total || 0,
        }));
      }
    } catch (error) {
      message.error('加载账单明细失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const handleViewDetail = async (record) => {
    try {
      const response = await billApi.getRecord(record.id);
      if (response.data.success) {
        setSelectedRecord(response.data.data);
        setDetailVisible(true);
      }
    } catch (error) {
      message.error('加载详情失败');
    }
  };

  const handleOpenAssign = (record) => {
    setSelectedRecord(record);
    assignForm.setFieldsValue({
      projectId: record.projectId,
      reason: '',
    });
    setAssignVisible(true);
  };

  const handleAssignSubmit = async (values) => {
    try {
      await billApi.manualAssign(selectedRecord.id, values);
      message.success('人工分配成功');
      setAssignVisible(false);
      loadRecords();
    } catch (error) {
      message.error(error.response?.data?.message || '分配失败');
    }
  };

  const renderTags = (tags) => {
    if (!tags || tags.length === 0) {
      return <Tag color="red">无标签</Tag>;
    }
    if (typeof tags === 'string') {
      try {
        const parsed = JSON.parse(tags);
        tags = Array.isArray(parsed) ? parsed : Object.entries(parsed).map(([key, value]) => ({ key, value }));
      } catch {
        tags = [];
      }
    }
    return (
      <Space wrap size={[4, 4]}>
        {tags.slice(0, 5).map((tag, idx) => (
          <Tag key={idx} style={{ margin: 0 }}>
            {tag.key}: {tag.value}
          </Tag>
        ))}
        {tags.length > 5 && (
          <Tag color="blue">+{tags.length - 5} 更多</Tag>
        )}
      </Space>
    );
  };

  const columns = [
    {
      title: '资源ID',
      dataIndex: 'resourceId',
      key: 'resourceId',
      width: 200,
      render: (text, record) => (
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{text}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{record.resourceType}</div>
        </div>
      ),
    },
    {
      title: '资源名称',
      dataIndex: 'resourceName',
      key: 'resourceName',
      ellipsis: true,
    },
    {
      title: '费用',
      dataIndex: 'cost',
      key: 'cost',
      width: 120,
      render: (v) => formatCurrency(v),
      sorter: (a, b) => parseFloat(a.cost) - parseFloat(b.cost),
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      width: 100,
      render: (v) => (
        <Tag color={ENVIRONMENT_COLORS[v] || '#999'}>
          {ENVIRONMENT_LABELS[v] || v || '-'}
        </Tag>
      ),
    },
    {
      title: '归属项目',
      dataIndex: 'projectName',
      key: 'projectName',
      width: 140,
      render: (v) => v || <Tag color="orange">未分配</Tag>,
    },
    {
      title: '分配方式',
      dataIndex: 'allocationMethod',
      key: 'allocationMethod',
      width: 120,
      render: (v) => (
        <Tag color={ALLOCATION_METHOD_COLORS[v] || '#999'}>
          {ALLOCATION_METHOD_LABELS[v] || v}
        </Tag>
      ),
      filters: Object.entries(ALLOCATION_METHOD_LABELS).map(([key, label]) => ({
        text: label,
        value: key,
      })),
      onFilter: (value, record) => record.allocationMethod === value,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags) => renderTags(tags),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
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
          {canAssign && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleOpenAssign(record)}
            >
              人工分配
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const monthOptions = getMonthList(12);

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
          <h2 className="page-header-title">账单明细</h2>
          <p className="page-header-desc">查看所有账单记录，支持人工分配归属项目</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadRecords}>
          刷新
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Select
              style={{ width: '100%' }}
              placeholder="选择账单月份"
              allowClear
              value={filters.billMonth || undefined}
              onChange={(v) => handleSearch({ billMonth: v })}
            >
              {monthOptions.map((m) => (
                <Option key={m.value} value={m.value}>
                  {m.label}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <Select
              style={{ width: '100%' }}
              placeholder="选择项目"
              allowClear
              value={filters.projectId || undefined}
              onChange={(v) => handleSearch({ projectId: v })}
            >
              {projects.map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <Select
              style={{ width: '100%' }}
              placeholder="分配方式"
              allowClear
              value={filters.allocationMethod || undefined}
              onChange={(v) => handleSearch({ allocationMethod: v })}
            >
              {Object.entries(ALLOCATION_METHOD_LABELS).map(([key, label]) => (
                <Option key={key} value={key}>
                  {label}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <Input
              placeholder="搜索资源ID/名称"
              prefix={<SearchOutlined />}
              allowClear
              value={filters.keyword}
              onChange={(e) => handleSearch({ keyword: e.target.value })}
            />
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          dataSource={records}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) =>
              setPagination((p) => ({ ...p, page, pageSize })),
          }}
          locale={{ emptyText: <Empty description="暂无账单记录" /> }}
        />
      </Card>

      <Modal
        title="账单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
          canAssign && (
            <Button
              key="assign"
              type="primary"
              icon={<EditOutlined />}
              onClick={() => {
                setDetailVisible(false);
                handleOpenAssign(selectedRecord);
              }}
            >
              人工分配
            </Button>
          ),
        ]}
      >
        {selectedRecord && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="资源ID" span={2}>
                <span style={{ fontFamily: 'monospace' }}>
                  {selectedRecord.resourceId}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="资源名称">
                {selectedRecord.resourceName}
              </Descriptions.Item>
              <Descriptions.Item label="资源类型">
                {selectedRecord.resourceType}
              </Descriptions.Item>
              <Descriptions.Item label="云厂商">
                {CLOUD_PROVIDER_LABELS[selectedRecord.cloudProvider] || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="环境">
                <Tag color={ENVIRONMENT_COLORS[selectedRecord.environment]}>
                  {ENVIRONMENT_LABELS[selectedRecord.environment]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="费用">
                <span style={{ fontWeight: 600, fontSize: 16, color: '#1890ff' }}>
                  {formatCurrency(selectedRecord.cost)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="账单月份">
                {selectedRecord.billMonth}
              </Descriptions.Item>
              <Descriptions.Item label="归属项目" span={2}>
                {selectedRecord.projectName || (
                  <Tag color="orange">未分配</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="分配方式" span={2}>
                <Tag color={ALLOCATION_METHOD_COLORS[selectedRecord.allocationMethod]}>
                  {ALLOCATION_METHOD_LABELS[selectedRecord.allocationMethod]}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">标签信息</Divider>
            {selectedRecord.tags &&
            (Array.isArray(selectedRecord.tags) ? selectedRecord.tags.length > 0 : Object.keys(selectedRecord.tags).length > 0) ? (
              <div style={{ marginBottom: 16 }}>
                {renderTags(selectedRecord.tags)}
              </div>
            ) : (
              <div style={{ color: '#999', marginBottom: 16 }}>该资源无标签</div>
            )}

            {selectedRecord.sharedAllocations && selectedRecord.sharedAllocations.length > 0 && (
              <Divider orientation="left">
                <Space>
                  <ClusterOutlined />
                  共享分摊详情（可展开查看）
                </Space>
              </Divider>
            )}

            {selectedRecord.sharedAllocations && selectedRecord.sharedAllocations.length > 0 && (
              <Collapse>
                <Panel header="查看分摊计算过程" key="1">
                  <div>
                    <p style={{ color: '#666', marginBottom: 16 }}>
                      该资源属于共享服务
                      <Tag color="purple" style={{ marginLeft: 8 }}>
                        {selectedRecord.sharedAllocations[0].sharedServiceName}
                      </Tag>
                    </p>
                    <Table
                      dataSource={selectedRecord.sharedAllocations}
                      columns={[
                        {
                          title: '分摊到项目',
                          dataIndex: 'projectName',
                          key: 'projectName',
                        },
                        {
                          title: '分摊比例',
                          dataIndex: 'ratio',
                          key: 'ratio',
                          render: (v) => `${v}%`,
                        },
                        {
                          title: '分摊金额',
                          dataIndex: 'allocatedCost',
                          key: 'allocatedCost',
                          render: (v) => formatCurrency(v),
                        },
                      ]}
                      rowKey="id"
                      pagination={false}
                      size="small"
                      summary={() => (
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0} colSpan={2}>
                            <span style={{ fontWeight: 600 }}>总计</span>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={2}>
                            <span style={{ fontWeight: 600, color: '#1890ff' }}>
                              {formatCurrency(
                                selectedRecord.sharedAllocations.reduce(
                                  (sum, a) => sum + parseFloat(a.allocatedCost),
                                  0
                                )
                              )}
                            </span>
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      )}
                    />
                    <div
                      style={{
                        marginTop: 16,
                        padding: 12,
                        background: '#fafafa',
                        borderRadius: 8,
                        fontSize: 12,
                        color: '#666',
                      }}
                    >
                      <b>计算公式：</b>
                      原费用 {formatCurrency(selectedRecord.cost)} × 分摊比例 = 分摊金额
                    </div>
                  </div>
                </Panel>
              </Collapse>
            )}

            {selectedRecord.candidateProjects && selectedRecord.candidateProjects.length > 0 && (
              <Divider orientation="left">
                <Space>
                  <TagOutlined />
                  候选项目推荐
                </Space>
              </Divider>
            )}

            {selectedRecord.candidateProjects && selectedRecord.candidateProjects.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {selectedRecord.candidateProjects.map((c, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 12,
                      marginBottom: 8,
                      background: idx === 0 ? '#f0f5ff' : '#fafafa',
                      borderRadius: 8,
                      border: idx === 0 ? '1px solid #91caff' : '1px solid #f0f0f0',
                    }}
                  >
                    <Space>
                      <Tag color={idx === 0 ? 'blue' : 'default'}>
                        匹配度 {c.score}%
                      </Tag>
                      <span style={{ fontWeight: 600 }}>{c.projectName}</span>
                    </Space>
                    <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                      {c.reason}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedRecord.manualAssignments && selectedRecord.manualAssignments.length > 0 && (
              <Divider orientation="left">
                <Space>
                  <UserOutlined />
                  人工分配历史
                </Space>
              </Divider>
            )}

            {selectedRecord.manualAssignments && selectedRecord.manualAssignments.length > 0 && (
              <Table
                dataSource={selectedRecord.manualAssignments}
                columns={[
                  {
                    title: '时间',
                    dataIndex: 'createdAt',
                    key: 'createdAt',
                    render: (t) => new Date(t).toLocaleString('zh-CN'),
                  },
                  { title: '操作人', dataIndex: 'userName', key: 'userName' },
                  {
                    title: '分配到',
                    dataIndex: 'projectName',
                    key: 'projectName',
                  },
                  { title: '原因', dataIndex: 'reason', key: 'reason' },
                ]}
                rowKey="id"
                pagination={false}
                size="small"
              />
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="人工分配归属项目"
        open={assignVisible}
        onCancel={() => setAssignVisible(false)}
        onOk={() => assignForm.submit()}
        confirmLoading={false}
        width={500}
      >
        <Form form={assignForm} layout="vertical" onFinish={handleAssignSubmit}>
          <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
            <Row>
              <Col span={12}>
                <div style={{ color: '#999', fontSize: 12 }}>资源</div>
                <div style={{ fontWeight: 500 }}>{selectedRecord?.resourceName}</div>
              </Col>
              <Col span={12}>
                <div style={{ color: '#999', fontSize: 12 }}>费用</div>
                <div style={{ fontWeight: 600, color: '#1890ff' }}>
                  {formatCurrency(selectedRecord?.cost)}
                </div>
              </Col>
            </Row>
          </Card>

          <Form.Item
            name="projectId"
            label="归属项目"
            rules={[{ required: true, message: '请选择项目' }]}
          >
            <Select placeholder="请选择归属项目">
              {projects.map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="reason" label="分配原因">
            <TextArea rows={3} placeholder="请输入分配原因（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BillRecords;
