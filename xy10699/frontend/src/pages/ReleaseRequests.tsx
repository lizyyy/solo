import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Card,
  Modal,
  Form,
  message,
  Popconfirm,
  Row,
  Col,
  Descriptions,
  Timeline
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { releaseRequestApi, affectedServiceApi, approvalOpinionApi } from '../api';
import { ReleaseRequest, AffectedService, ApprovalOpinion } from '../types';

const { Option } = Select;

const ReleaseRequests: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<ReleaseRequest[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState<any>({});
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ReleaseRequest | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ReleaseRequest | null>(null);
  const [affectedServices, setAffectedServices] = useState<AffectedService[]>([]);
  const [approvalOpinions, setApprovalOpinions] = useState<ApprovalOpinion[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    loadRequests();
  }, [pagination.current, pagination.pageSize, filters, searchText]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const params = {
        ...filters,
        search: searchText,
        page: pagination.current,
        limit: pagination.pageSize
      };
      const response = await releaseRequestApi.getAll(params);
      setRequests(response.data.data);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total
      }));
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (item: ReleaseRequest) => {
    setEditingItem(item);
    form.setFieldsValue(item);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await releaseRequestApi.delete(id);
      message.success('删除成功');
      loadRequests();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        await releaseRequestApi.update(editingItem.requestId, { ...values, modifiedBy: '当前用户' });
        message.success('更新成功');
      } else {
        await releaseRequestApi.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadRequests();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleViewDetail = async (item: ReleaseRequest) => {
    setSelectedRequest(item);
    setDetailVisible(true);
    try {
      const [servicesRes, opinionsRes] = await Promise.all([
        affectedServiceApi.getAll({ requestId: item.requestId }),
        approvalOpinionApi.getAll({ requestId: item.requestId })
      ]);
      setAffectedServices(servicesRes.data.data);
      setApprovalOpinions(opinionsRes.data.data);
    } catch (error) {
      console.error('加载详情失败:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'gold',
      approved: 'blue',
      processing: 'cyan',
      completed: 'green',
      rolled_back: 'red',
      rejected: 'volcano'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      pending: '待审批',
      approved: '已批准',
      processing: '发布中',
      completed: '已完成',
      rolled_back: '已回滚',
      rejected: '已拒绝'
    };
    return texts[status] || status;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: 'red',
      high: 'orange',
      medium: 'blue',
      low: 'green'
    };
    return colors[priority] || 'default';
  };

  const getPriorityText = (priority: string) => {
    const texts: Record<string, string> = {
      critical: '紧急',
      high: '高',
      medium: '中',
      low: '低'
    };
    return texts[priority] || priority;
  };

  const getTypeText = (type: string) => {
    const texts: Record<string, string> = {
      config: '配置',
      resource: '资源',
      code: '代码',
      database: '数据库'
    };
    return texts[type] || type;
  };

  const columns = [
    {
      title: '申请ID',
      dataIndex: 'requestId',
      key: 'requestId',
      width: 120,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      key: 'applicant',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 120,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => getTypeText(type),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: string) => (
        <Tag color={getPriorityColor(priority)}>{getPriorityText(priority)}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: Date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: ReleaseRequest) => (
        <Space size="small">
          <Button icon={<EyeOutlined />} size="small" onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => handleDelete(record.requestId)}
            okText="确定"
            cancelText="取消"
          >
            <Button icon={<DeleteOutlined />} size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Input
              placeholder="搜索标题、描述"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={() => loadRequests()}
            />
          </Col>
          <Col span={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="状态筛选"
              allowClear
              onChange={(value) => setFilters({ ...filters, status: value })}
            >
              <Option value="pending">待审批</Option>
              <Option value="approved">已批准</Option>
              <Option value="processing">发布中</Option>
              <Option value="completed">已完成</Option>
              <Option value="rolled_back">已回滚</Option>
              <Option value="rejected">已拒绝</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="优先级筛选"
              allowClear
              onChange={(value) => setFilters({ ...filters, priority: value })}
            >
              <Option value="critical">紧急</Option>
              <Option value="high">高</Option>
              <Option value="medium">中</Option>
              <Option value="low">低</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="类型筛选"
              allowClear
              onChange={(value) => setFilters({ ...filters, type: value })}
            >
              <Option value="config">配置</Option>
              <Option value="resource">资源</Option>
              <Option value="code">代码</Option>
              <Option value="database">数据库</Option>
            </Select>
          </Col>
          <Col span={6} style={{ textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新建申请
            </Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={requests}
          rowKey="_id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize: pageSize || 10 }),
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={editingItem ? '编辑发布申请' : '新建发布申请'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入标题" />
          </Form.Item>
          <Form.Item name="description" label="描述" rules={[{ required: true, message: '请输入描述' }]}>
            <Input.TextArea rows={4} placeholder="请输入描述" />
          </Form.Item>
          <Form.Item name="applicant" label="申请人" rules={[{ required: true, message: '请输入申请人' }]}>
            <Input placeholder="请输入申请人" />
          </Form.Item>
          <Form.Item name="department" label="部门" rules={[{ required: true, message: '请输入部门' }]}>
            <Input placeholder="请输入部门" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select placeholder="请选择类型">
              <Option value="config">配置</Option>
              <Option value="resource">资源</Option>
              <Option value="code">代码</Option>
              <Option value="database">数据库</Option>
            </Select>
          </Form.Item>
          <Form.Item name="priority" label="优先级" rules={[{ required: true, message: '请选择优先级' }]}>
            <Select placeholder="请选择优先级">
              <Option value="critical">紧急</Option>
              <Option value="high">高</Option>
              <Option value="medium">中</Option>
              <Option value="low">低</Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
            <Select placeholder="请选择状态">
              <Option value="pending">待审批</Option>
              <Option value="approved">已批准</Option>
              <Option value="processing">发布中</Option>
              <Option value="completed">已完成</Option>
              <Option value="rolled_back">已回滚</Option>
              <Option value="rejected">已拒绝</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="申请详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={900}
      >
        {selectedRequest && (
          <>
            <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="申请ID">{selectedRequest.requestId}</Descriptions.Item>
              <Descriptions.Item label="标题">{selectedRequest.title}</Descriptions.Item>
              <Descriptions.Item label="申请人">{selectedRequest.applicant}</Descriptions.Item>
              <Descriptions.Item label="部门">{selectedRequest.department}</Descriptions.Item>
              <Descriptions.Item label="类型">{getTypeText(selectedRequest.type)}</Descriptions.Item>
              <Descriptions.Item label="优先级">
                <Tag color={getPriorityColor(selectedRequest.priority)}>
                  {getPriorityText(selectedRequest.priority)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={getStatusColor(selectedRequest.status)}>
                  {getStatusText(selectedRequest.status)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(selectedRequest.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>{selectedRequest.description}</Descriptions.Item>
            </Descriptions>

            <Card title="影响服务" size="small" style={{ marginBottom: 16 }}>
              <Table
                dataSource={affectedServices}
                rowKey="_id"
                columns={[
                  { title: '服务名称', dataIndex: 'serviceName', key: 'serviceName' },
                  { title: '环境', dataIndex: 'environment', key: 'environment' },
                  { title: '影响级别', dataIndex: 'impactLevel', key: 'impactLevel' },
                  { title: '预计停机(分钟)', dataIndex: 'expectedDowntime', key: 'expectedDowntime' },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    key: 'status',
                    render: (status: string) => (
                      <Tag color={status === 'completed' ? 'green' : status === 'failed' ? 'red' : 'blue'}>
                        {status}
                      </Tag>
                    ),
                  },
                ]}
                pagination={false}
                size="small"
              />
            </Card>

            <Card title="审批意见" size="small" style={{ marginBottom: 16 }}>
              <Timeline>
                {approvalOpinions.map((opinion) => (
                  <Timeline.Item key={opinion._id}>
                    <p>
                      <strong>{opinion.approver}</strong> ({opinion.approverRole}) -{' '}
                      <Tag color={opinion.opinion === 'approved' ? 'green' : opinion.opinion === 'rejected' ? 'red' : 'orange'}>
                        {opinion.opinion === 'approved' ? '通过' : opinion.opinion === 'rejected' ? '拒绝' : '需要修改'}
                      </Tag>
                    </p>
                    <p>{opinion.comments}</p>
                    <p style={{ fontSize: '12px', color: '#999' }}>
                      {dayjs(opinion.approvalTime).format('YYYY-MM-DD HH:mm:ss')}
                    </p>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>

            {selectedRequest.changeHistory && selectedRequest.changeHistory.length > 0 && (
              <Card title="修改历史" size="small">
                <Timeline>
                  {selectedRequest.changeHistory.map((change, index) => (
                    <Timeline.Item key={index}>
                      <p>
                        <strong>{change.modifiedBy}</strong> 修改了字段: <code>{change.field}</code>
                      </p>
                      <p>
                        原值: <code>{JSON.stringify(change.oldValue)}</code> → 新值: <code>{JSON.stringify(change.newValue)}</code>
                      </p>
                      <p style={{ fontSize: '12px', color: '#999' }}>
                        {dayjs(change.modifiedAt).format('YYYY-MM-DD HH:mm:ss')}
                      </p>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Card>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default ReleaseRequests;
