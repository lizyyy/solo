import React, { useState, useEffect } from 'react';
import { Layout, Card, Row, Col, Table, Button, Modal, Form, Input, Select, DatePicker, Space, Tag, message, Tabs, Descriptions, Timeline, Divider } from 'antd';
import { PlusOutlined, EyeOutlined, DownloadOutlined, FileTextOutlined, CarOutlined, ToolOutlined, DeleteOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { Header, Content } = Layout;
const { Option } = Select;
const { TextArea } = Input;

const statusLabels = {
  pending: { label: '待处理', color: 'default' },
  inspecting: { label: '检测中', color: 'blue' },
  qualified: { label: '合格', color: 'green' },
  unqualified: { label: '不合格', color: 'red' },
  installing: { label: '装车中', color: 'cyan' },
  installed: { label: '已装车', color: 'purple' },
  installation_failed: { label: '装车失败', color: 'orange' },
  rework: { label: '返工中', color: 'orange' },
  rework_completed: { label: '返工完成', color: 'cyan' },
  rechecking: { label: '复核中', color: 'gold' },
  completed: { label: '完成', color: 'green' },
  scrapped: { label: '已报废', color: 'red' },
  cancelled: { label: '已取消', color: 'default' }
};

const statusActions = {
  pending: ['inspecting', 'cancelled'],
  inspecting: ['qualified', 'unqualified', 'rechecking'],
  qualified: ['installing', 'rework'],
  installing: ['installed', 'installation_failed'],
  installed: ['completed', 'rework'],
  unqualified: ['rework', 'scrap'],
  rework: ['rework_completed', 'scrap'],
  rework_completed: ['inspecting', 'scrap'],
  rechecking: ['qualified', 'unqualified'],
  installation_failed: ['rework', 'scrap'],
  completed: [],
  scrapped: [],
  cancelled: []
};

const actionLabels = {
  inspecting: '开始检测',
  qualified: '标记合格',
  unqualified: '标记不合格',
  rechecking: '进入复核',
  installing: '开始装车',
  installed: '完成装车',
  installation_failed: '装车失败',
  rework: '进入返工',
  rework_completed: '完成返工',
  completed: '完成流程',
  cancelled: '取消',
  scrap: '报废零件'
};

function App() {
  const [parts, setParts] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ part_number: '', status: '' });
  
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentPart, setCurrentPart] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchParts();
    fetchStatistics();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchParts = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/parts', {
        params: {
          page: pagination.current,
          pageSize: pagination.pageSize,
          ...filters
        }
      });
      if (response.data.success) {
        setParts(response.data.data);
        setPagination(prev => ({ ...prev, total: response.data.total }));
      }
    } catch (error) {
      message.error('获取零件列表失败');
    }
    setLoading(false);
  };

  const fetchStatistics = async () => {
    try {
      const response = await axios.get('/api/statistics');
      if (response.data.success) {
        setStatistics(response.data.data);
      }
    } catch (error) {
      console.error('获取统计数据失败');
    }
  };

  const fetchPartDetail = async (id) => {
    try {
      const response = await axios.get(`/api/parts/${id}`);
      if (response.data.success) {
        setCurrentPart(response.data.data);
      }
    } catch (error) {
      message.error('获取零件详情失败');
    }
  };

  const handleCreatePart = async (values) => {
    try {
      const response = await axios.post('/api/parts', {
        ...values,
        request_id: Date.now().toString()
      });
      if (response.data.success) {
        message.success(response.data.idempotent ? '零件已存在' : '零件创建成功');
        setCreateModalVisible(false);
        form.resetFields();
        fetchParts();
        fetchStatistics();
      }
    } catch (error) {
      message.error(error.response?.data?.error || '创建失败');
    }
  };

  const handleStatusChange = async (partId, newStatus) => {
    Modal.confirm({
      title: '确认状态变更',
      content: `确定要将零件状态变更为「${statusLabels[newStatus]?.label || newStatus}」吗？`,
      onOk: async () => {
        try {
          const response = await axios.post(`/api/parts/${partId}/status`, {
            new_status: newStatus,
            changed_by: '当前用户'
          });
          if (response.data.success) {
            message.success('状态变更成功');
            fetchParts();
            fetchStatistics();
            if (currentPart && currentPart.id === partId) {
              fetchPartDetail(partId);
            }
          }
        } catch (error) {
          message.error(error.response?.data?.error || '状态变更失败');
        }
      }
    });
  };

  const handleExport = () => {
    window.open('/api/export', '_blank');
  };

  const columns = [
    {
      title: '零件图号',
      dataIndex: 'part_number',
      key: 'part_number',
      width: 150
    },
    {
      title: '试制版本',
      dataIndex: 'prototype_version',
      key: 'prototype_version',
      width: 100,
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '零件名称',
      dataIndex: 'part_name',
      key: 'part_name',
      width: 150
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const config = statusLabels[status] || { label: status, color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'actions',
      width: 300,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              fetchPartDetail(record.id);
              setDetailModalVisible(true);
            }}
          >
            详情
          </Button>
          {statusActions[record.status]?.map(action => (
            <Button
              key={action}
              size="small"
              type={action === 'scrap' ? 'primary' : 'default'}
              danger={action === 'scrap'}
              onClick={() => handleStatusChange(record.id, action === 'scrap' ? 'scrapped' : action)}
            >
              {actionLabels[action]}
            </Button>
          ))}
        </Space>
      )
    }
  ];

  const statCards = [
    { title: '总数', value: statistics.total || 0, icon: <FileTextOutlined />, color: '#1890ff' },
    { title: '待处理', value: statistics.pending || 0, icon: <ClockCircleOutlined />, color: '#faad14' },
    { title: '检测中', value: statistics.inspecting || 0, icon: <CheckCircleOutlined />, color: '#1890ff' },
    { title: '合格', value: statistics.qualified || 0, icon: <CheckCircleOutlined />, color: '#52c41a' },
    { title: '已装车', value: statistics.installed || 0, icon: <CarOutlined />, color: '#722ed1' },
    { title: '返工中', value: statistics.rework || 0, icon: <ToolOutlined />, color: '#fa8c16' },
    { title: '已报废', value: statistics.scrapped || 0, icon: <DeleteOutlined />, color: '#ff4d4f' },
    { title: '已完成', value: statistics.completed || 0, icon: <CheckCircleOutlined />, color: '#52c41a' }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px' }}>
        <h1 style={{ color: 'white', margin: 0, lineHeight: '64px' }}>试制件版本装车追踪系统</h1>
      </Header>
      <Content style={{ padding: '24px' }}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {statCards.map((stat, index) => (
            <Col xs={12} sm={8} md={6} lg={3} key={index}>
              <Card>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ fontSize: 24, color: stat.color, marginRight: 12 }}>{stat.icon}</div>
                  <div>
                    <div style={{ fontSize: 12, color: '#666' }}>{stat.title}</div>
                    <div style={{ fontSize: 24, fontWeight: 'bold' }}>{stat.value}</div>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        <Card>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Input
                placeholder="搜索零件图号"
                style={{ width: 200 }}
                allowClear
                onChange={(e) => setFilters(prev => ({ ...prev, part_number: e.target.value }))}
              />
              <Select
                placeholder="筛选状态"
                style={{ width: 150 }}
                allowClear
                onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              >
                {Object.entries(statusLabels).map(([key, value]) => (
                  <Option key={key} value={key}>{value.label}</Option>
                ))}
              </Select>
            </Space>
            <Space>
              <Button icon={<DownloadOutlined />} onClick={handleExport}>导出报告</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                新建零件
              </Button>
            </Space>
          </div>

          <Table
            columns={columns}
            dataSource={parts}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`
            }}
            onChange={(page) => setPagination(prev => ({ ...prev, current: page.current, pageSize: page.pageSize }))}
          />
        </Card>

        <Modal
          title="新建零件"
          open={createModalVisible}
          onCancel={() => {
            setCreateModalVisible(false);
            form.resetFields();
          }}
          footer={null}
          width={500}
        >
          <Form form={form} layout="vertical" onFinish={handleCreatePart}>
            <Form.Item
              name="part_number"
              label="零件图号"
              rules={[{ required: true, message: '请输入零件图号' }]}
            >
              <Input placeholder="例如：PART-001" />
            </Form.Item>
            <Form.Item
              name="prototype_version"
              label="试制版本"
              rules={[
                { required: true, message: '请输入试制版本' },
                { pattern: /^V\d+(\.\d+)*$/, message: '格式应为V1.0、V2.1等格式' }
              ]}
            >
              <Input placeholder="例如：V1.0" />
            </Form.Item>
            <Form.Item name="part_name" label="零件名称">
              <Input placeholder="请输入零件名称" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block>
                创建
              </Button>
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="零件详情"
          open={detailModalVisible}
          onCancel={() => {
            setDetailModalVisible(false);
            setCurrentPart(null);
          }}
          footer={null}
          width={1000}
        >
          {currentPart && (
            <div>
              <Descriptions bordered column={2}>
                <Descriptions.Item label="零件图号">{currentPart.part_number}</Descriptions.Item>
                <Descriptions.Item label="试制版本">{currentPart.prototype_version}</Descriptions.Item>
                <Descriptions.Item label="零件名称">{currentPart.part_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="当前状态">
                  <Tag color={statusLabels[currentPart.status]?.color || 'default'}>
                    {statusLabels[currentPart.status]?.label || currentPart.status}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">{moment(currentPart.created_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
                <Descriptions.Item label="更新时间">{moment(currentPart.updated_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
              </Descriptions>

              <Divider />

              <Tabs defaultActiveKey="1">
                <Tabs.TabPane tab="状态历史" key="1">
                  <Timeline>
                    {currentPart.statusHistory?.map((item, index) => (
                      <Timeline.Item key={index}>
                        <p>
                          <Tag color={statusLabels[item.new_status]?.color || 'default'}>
                            {statusLabels[item.new_status]?.label || item.new_status}
                          </Tag>
                          {item.old_status && (
                            <span>
                              {' ← '}
                              <Tag>{statusLabels[item.old_status]?.label || item.old_status}</Tag>
                            </span>
                          )}
                        </p>
                        <p>操作人：{item.changed_by || 'system'}</p>
                        <p>时间：{moment(item.changed_at).format('YYYY-MM-DD HH:mm:ss')}</p>
                        {item.change_reason && <p>原因：{item.change_reason}</p>}
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </Tabs.TabPane>

                <Tabs.TabPane tab="修改历史" key="2">
                  <Table
                    dataSource={currentPart.modificationHistory || []}
                    rowKey="id"
                    pagination={false}
                  >
                    <Table.Column title="字段" dataIndex="field_name" />
                    <Table.Column title="原值" dataIndex="old_value" />
                    <Table.Column title="新值" dataIndex="new_value" />
                    <Table.Column title="修改人" dataIndex="modified_by" />
                    <Table.Column
                      title="修改时间"
                      dataIndex="modified_at"
                      render={(text) => moment(text).format('YYYY-MM-DD HH:mm:ss')}
                    />
                  </Table>
                </Tabs.TabPane>

                <Tabs.TabPane tab="检测报告" key="3">
                  <Table
                    dataSource={currentPart.inspectionReports || []}
                    rowKey="id"
                    pagination={false}
                  >
                    <Table.Column title="报告编号" dataIndex="report_number" />
                    <Table.Column title="检测员" dataIndex="inspector" />
                    <Table.Column title="检测日期" dataIndex="inspection_date" />
                    <Table.Column title="结果" dataIndex="result" />
                    <Table.Column title="备注" dataIndex="remarks" />
                  </Table>
                </Tabs.TabPane>

                <Tabs.TabPane tab="装车记录" key="4">
                  <Table
                    dataSource={currentPart.installationRecords || []}
                    rowKey="id"
                    pagination={false}
                  >
                    <Table.Column title="车辆编号" dataIndex="vehicle_number" />
                    <Table.Column title="装车日期" dataIndex="installation_date" />
                    <Table.Column title="装车人" dataIndex="installer" />
                    <Table.Column title="位置" dataIndex="location" />
                    <Table.Column title="备注" dataIndex="remarks" />
                  </Table>
                </Tabs.TabPane>

                <Tabs.TabPane tab="返工工序" key="5">
                  <Table
                    dataSource={currentPart.reworkProcesses || []}
                    rowKey="id"
                    pagination={false}
                  >
                    <Table.Column title="工序名称" dataIndex="process_name" />
                    <Table.Column title="操作员" dataIndex="operator" />
                    <Table.Column title="开始时间" dataIndex="start_time" />
                    <Table.Column title="结束时间" dataIndex="end_time" />
                    <Table.Column title="结果" dataIndex="result" />
                    <Table.Column title="备注" dataIndex="remarks" />
                  </Table>
                </Tabs.TabPane>

                <Tabs.TabPane tab="报废记录" key="6">
                  <Table
                    dataSource={currentPart.scrapRecords || []}
                    rowKey="id"
                    pagination={false}
                  >
                    <Table.Column title="报废日期" dataIndex="scrap_date" />
                    <Table.Column title="报废原因" dataIndex="reason" />
                    <Table.Column title="责任人" dataIndex="responsible_person" />
                    <Table.Column title="报废去向" dataIndex="disposal_location" />
                    <Table.Column title="备注" dataIndex="remarks" />
                  </Table>
                </Tabs.TabPane>
              </Tabs>
            </div>
          )}
        </Modal>
      </Content>
    </Layout>
  );
}

export default App;
