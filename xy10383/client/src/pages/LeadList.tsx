import React, { useEffect, useState } from 'react';
import { 
  Table, 
  Card, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
  Tag, 
  Space,
  Row,
  Col,
  InputNumber,
  Switch,
  message,
  Popconfirm,
  Divider,
  Descriptions,
  Timeline,
  Badge,
  Tooltip,
  Tabs,
  Alert,
  Upload,
  Progress
} from 'antd';
import { 
  ImportOutlined, 
  ExportOutlined, 
  EyeOutlined, 
  UserOutlined,
  MergeOutlined,
  HistoryOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import dayjs from 'dayjs';
import { leadApi, salesApi, exportApi } from '../services/api';
import { 
  ILead, 
  ISalesPerson, 
  IFollowUpRecord, 
  LeadStatus, 
  CustomerLevel,
  AssignmentReason
} from '../types';
import { 
  STATUS_LABELS, 
  LEVEL_LABELS, 
  REGION_OPTIONS, 
  PRODUCT_OPTIONS,
  FOLLOW_UP_STATUS_OPTIONS
} from '../utils/constants';

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

const LeadList: React.FC = () => {
  const [leads, setLeads] = useState<ILead[]>([]);
  const [salesPeople, setSalesPeople] = useState<ISalesPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<any>({});
  
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedLead, setSelectedLead] = useState<ILead | null>(null);
  const [followUpRecords, setFollowUpRecords] = useState<IFollowUpRecord[]>([]);
  
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignForm] = Form.useForm();
  
  const [followUpModalVisible, setFollowUpModalVisible] = useState(false);
  const [followUpForm] = Form.useForm();
  
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importForm] = Form.useForm();
  
  const [mergeModalVisible, setMergeModalVisible] = useState(false);

  useEffect(() => {
    loadData();
    loadSalesPeople();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await leadApi.getLeads(filters);
      setLeads(response.data.data);
    } catch (error) {
      message.error('加载线索列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadSalesPeople = async () => {
    try {
      const response = await salesApi.getAll();
      setSalesPeople(response.data.data);
    } catch (error) {
      message.error('加载销售人员失败');
    }
  };

  const getSalesPersonName = (salesId?: string) => {
    if (!salesId) return '未分配';
    const sales = salesPeople.find(s => s.id === salesId);
    return sales ? sales.name : salesId;
  };

  const handleViewDetail = async (lead: ILead) => {
    try {
      const response = await leadApi.getLeadById(lead.id);
      setSelectedLead(response.data.data.lead);
      setFollowUpRecords(response.data.data.followUpRecords);
      setDetailModalVisible(true);
    } catch (error) {
      message.error('加载线索详情失败');
    }
  };

  const handleAssign = (lead: ILead) => {
    setSelectedLead(lead);
    assignForm.setFieldsValue({ salesId: lead.assignedTo });
    setAssignModalVisible(true);
  };

  const handleAssignSubmit = async () => {
    try {
      const values = await assignForm.validateFields();
      if (selectedLead) {
        await leadApi.assign(selectedLead.id, values.salesId);
        message.success('分配成功');
        setAssignModalVisible(false);
        loadData();
      }
    } catch (error) {
      message.error('分配失败');
    }
  };

  const handleUpdateStatus = async (leadId: string, newStatus: string, notes?: string) => {
    try {
      await leadApi.updateStatus(leadId, newStatus, notes);
      message.success('状态更新成功');
      loadData();
      if (detailModalVisible) {
        handleViewDetail(leads.find(l => l.id === leadId)!);
      }
    } catch (error) {
      message.error('状态更新失败');
    }
  };

  const handleFollowUp = (lead: ILead) => {
    setSelectedLead(lead);
    followUpForm.resetFields();
    setFollowUpModalVisible(true);
  };

  const handleFollowUpSubmit = async () => {
    try {
      const values = await followUpForm.validateFields();
      if (selectedLead) {
        await leadApi.addFollowUp(selectedLead.id, {
          salesId: selectedLead.assignedTo || values.salesId,
          status: values.status,
          notes: values.notes,
          nextFollowUpDate: values.nextFollowUpDate
        });
        message.success('跟进记录添加成功');
        setFollowUpModalVisible(false);
        handleViewDetail(selectedLead);
      }
    } catch (error) {
      message.error('添加跟进记录失败');
    }
  };

  const handleMerge = (lead: ILead) => {
    setSelectedLead(lead);
    setMergeModalVisible(true);
  };

  const handleMergeSubmit = async (targetLeadId: string) => {
    try {
      if (selectedLead) {
        await leadApi.merge(selectedLead.id, targetLeadId);
        message.success('合并成功');
        setMergeModalVisible(false);
        loadData();
      }
    } catch (error) {
      message.error('合并失败');
    }
  };

  const handleExport = () => {
    exportApi.exportLeads(filters);
    message.success('导出中，请稍候...');
  };

  const handleImport = async () => {
    try {
      const values = await importForm.validateFields();
      
      const newLead: Partial<ILead> = {
        name: values.name,
        phone: values.phone,
        email: values.email,
        company: values.company,
        position: values.position,
        region: values.region,
        productInterest: values.productInterest || [],
        customerLevel: values.customerLevel || CustomerLevel.MEDIUM,
        source: values.source || '线上展会'
      };

      const response = await leadApi.importLeads([newLead]);
      const result = response.data.data;
      
      if (result.created > 0) {
        message.success(`导入成功：${result.created}条新线索`);
      }
      if (result.duplicates > 0) {
        message.warning(`发现重复线索：${result.duplicates}条`);
      }
      if (result.needsReview > 0) {
        message.info(`需要复核：${result.needsReview}条`);
      }
      
      setImportModalVisible(false);
      importForm.resetFields();
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.error || '导入失败');
    }
  };

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
      render: (text: string, record: ILead) => (
        <span>
          {text}
          {record.isDuplicate && (
            <Tag color="purple" style={{ marginLeft: 4 }}>重复</Tag>
          )}
        </span>
      )
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 130
    },
    {
      title: '公司',
      dataIndex: 'company',
      key: 'company',
      width: 150,
      ellipsis: true
    },
    {
      title: '地区',
      dataIndex: 'region',
      key: 'region',
      width: 80,
      render: (text: string) => text || <Tag color="warning">未知</Tag>
    },
    {
      title: '产品兴趣',
      dataIndex: 'productInterest',
      key: 'productInterest',
      width: 180,
      render: (products: string[]) => (
        <Space wrap size={[4, 4]}>
          {products.slice(0, 2).map(p => (
            <Tag key={p}>{p}</Tag>
          ))}
          {products.length > 2 && <Tag>+{products.length - 2}</Tag>}
        </Space>
      )
    },
    {
      title: '客户等级',
      dataIndex: 'customerLevel',
      key: 'customerLevel',
      width: 90,
      render: (level: string) => {
        const config = LEVEL_LABELS[level];
        return <Tag color={config?.color}>{config?.label}</Tag>;
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const config = STATUS_LABELS[status];
        return <Tag color={config?.color}>{config?.label}</Tag>;
      }
    },
    {
      title: '负责人',
      dataIndex: 'assignedTo',
      key: 'assignedTo',
      width: 100,
      render: (salesId?: string) => {
        const sales = salesPeople.find(s => s.id === salesId);
        if (!sales) return <span style={{ color: '#999' }}>未分配</span>;
        return (
          <Tooltip title={`负责地区：${sales.regions.join('、')}\n负载：${sales.currentLoad}/${sales.maxLoad}`}>
            <span>{sales.name}</span>
          </Tooltip>
        );
      }
    },
    {
      title: '分配原因',
      dataIndex: 'assignmentReason',
      key: 'assignmentReason',
      width: 120,
      render: (reason?: string) => reason || <span style={{ color: '#999' }}>-</span>
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      fixed: 'right' as const,
      render: (_: any, record: ILead) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Button 
            type="link" 
            size="small" 
            icon={<UserOutlined />}
            onClick={() => handleAssign(record)}
          >
            分配
          </Button>
          {record.isDuplicate && (
            <Button 
              type="link" 
              size="small" 
              icon={<MergeOutlined />}
              onClick={() => handleMerge(record)}
            >
              合并
            </Button>
          )}
          {record.status !== LeadStatus.CONVERTED && 
           record.status !== LeadStatus.REJECTED && (
            <Button 
              type="link" 
              size="small"
              onClick={() => handleFollowUp(record)}
            >
              跟进
            </Button>
          )}
        </Space>
      )
    }
  ];

  const statusOptions = Object.entries(STATUS_LABELS).map(([key, val]) => (
    <Option key={key} value={key}>{val.label}</Option>
  ));

  const levelOptions = Object.entries(LEVEL_LABELS).map(([key, val]) => (
    <Option key={key} value={key}>{val.label}</Option>
  ));

  return (
    <div>
      <Card>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col>
            <Space>
              <Input
                placeholder="搜索姓名/电话/公司"
                style={{ width: 250 }}
                allowClear
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                onPressEnter={() => loadData()}
              />
              <Select
                placeholder="状态筛选"
                style={{ width: 150 }}
                allowClear
                onChange={(value) => setFilters({ ...filters, status: value })}
              >
                {statusOptions}
              </Select>
              <Select
                placeholder="客户等级"
                style={{ width: 120 }}
                allowClear
                onChange={(value) => setFilters({ ...filters, customerLevel: value })}
              >
                {levelOptions}
              </Select>
              <Select
                placeholder="负责人"
                style={{ width: 150 }}
                allowClear
                onChange={(value) => setFilters({ ...filters, assignedTo: value })}
              >
                {salesPeople.map(s => (
                  <Option key={s.id} value={s.id}>{s.name}</Option>
                ))}
              </Select>
            </Space>
          </Col>
          <Col flex="auto">
            <Space style={{ float: 'right' }}>
              <Button 
                icon={<ImportOutlined />}
                onClick={() => setImportModalVisible(true)}
              >
                导入线索
              </Button>
              <Button 
                icon={<ExportOutlined />}
                onClick={handleExport}
              >
                导出数据
              </Button>
            </Space>
          </Col>
        </Row>

        {leads.some(l => l.status === LeadStatus.NEEDS_REVIEW) && (
          <Alert
            message="有待处理的线索"
            description={`${leads.filter(l => l.status === LeadStatus.NEEDS_REVIEW).length}条线索需要复核（地区未知或销售超负载）`}
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Table
          columns={columns}
          dataSource={leads}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1500 }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`
          }}
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="线索详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={900}
        footer={null}
      >
        {selectedLead && (
          <Tabs defaultActiveKey="basic">
            <TabPane tab="基本信息" key="basic">
              <Descriptions bordered column={2}>
                <Descriptions.Item label="姓名">{selectedLead.name}</Descriptions.Item>
                <Descriptions.Item label="手机号">{selectedLead.phone}</Descriptions.Item>
                <Descriptions.Item label="邮箱">{selectedLead.email || '-'}</Descriptions.Item>
                <Descriptions.Item label="公司">{selectedLead.company || '-'}</Descriptions.Item>
                <Descriptions.Item label="职位">{selectedLead.position || '-'}</Descriptions.Item>
                <Descriptions.Item label="地区">
                  {selectedLead.region || <Tag color="warning">未知</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="产品兴趣">
                  {selectedLead.productInterest.length > 0 
                    ? selectedLead.productInterest.join('、')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="客户等级">
                  <Tag color={LEVEL_LABELS[selectedLead.customerLevel]?.color}>
                    {LEVEL_LABELS[selectedLead.customerLevel]?.label}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="来源">{selectedLead.source}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={STATUS_LABELS[selectedLead.status]?.color}>
                    {STATUS_LABELS[selectedLead.status]?.label}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>

              <Divider orientation="left">分配信息</Divider>
              
              <Descriptions bordered column={1}>
                <Descriptions.Item label="当前负责人">
                  {getSalesPersonName(selectedLead.assignedTo)}
                </Descriptions.Item>
                <Descriptions.Item label="分配原因">
                  <Badge count={selectedLead.assignmentReason} style={{ backgroundColor: '#1890ff' }} />
                </Descriptions.Item>
                <Descriptions.Item label="分配详情">
                  {selectedLead.assignmentDetails || '-'}
                </Descriptions.Item>
              </Descriptions>

              <Divider orientation="left">状态更新</Divider>
              
              <Space>
                {selectedLead.status === LeadStatus.ASSIGNED && (
                  <Button type="primary" onClick={() => handleUpdateStatus(selectedLead.id, LeadStatus.FOLLOWING)}>
                    开始跟进
                  </Button>
                )}
                {selectedLead.status === LeadStatus.FOLLOWING && (
                  <>
                    <Popconfirm
                      title="确认已转化？"
                      onConfirm={() => handleUpdateStatus(selectedLead.id, LeadStatus.CONVERTED)}
                      okText="确认"
                      cancelText="取消"
                    >
                      <Button type="primary">标记已转化</Button>
                    </Popconfirm>
                    <Popconfirm
                      title="确认拒绝？"
                      onConfirm={() => handleUpdateStatus(selectedLead.id, LeadStatus.REJECTED)}
                      okText="确认"
                      cancelText="取消"
                    >
                      <Button danger>标记已拒绝</Button>
                    </Popconfirm>
                  </>
                )}
              </Space>
            </TabPane>

            <TabPane tab="分配历史" key="history" icon={<HistoryOutlined />}>
              {selectedLead.assignmentHistory.length > 0 ? (
                <Timeline>
                  {selectedLead.assignmentHistory.map((record, index) => (
                    <Timeline.Item 
                      key={index}
                      color={record.isReassignment ? 'orange' : 'blue'}
                    >
                      <div className={`assignment-history-item ${record.isReassignment ? 'reassigned' : ''}`}>
                        <Space direction="vertical" size="small">
                          <div>
                            <strong>{record.salesName}</strong>
                            {record.isReassignment && <Tag color="orange" style={{ marginLeft: 8 }}>重新分配</Tag>}
                          </div>
                          <div>
                            <span className="reason-badge">{record.reason}</span>
                          </div>
                          <div style={{ color: '#666' }}>{record.details}</div>
                          <div style={{ color: '#999', fontSize: 12 }}>
                            {dayjs(record.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                          </div>
                        </Space>
                      </div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              ) : (
                <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>
                  暂无分配历史
                </div>
              )}
            </TabPane>

            <TabPane tab="跟进记录" key="followup" icon={<FileTextOutlined />}>
              {followUpRecords.length > 0 ? (
                <Timeline>
                  {followUpRecords.map((record, index) => (
                    <Timeline.Item key={index}>
                      <Card size="small" style={{ marginBottom: 8 }}>
                        <Row justify="space-between">
                          <Col>
                            <Space>
                              <strong>{record.salesName}</strong>
                              <Tag>{record.status}</Tag>
                            </Space>
                          </Col>
                          <Col style={{ color: '#999' }}>
                            {dayjs(record.followUpDate).format('YYYY-MM-DD HH:mm')}
                          </Col>
                        </Row>
                        <p style={{ marginTop: 8 }}>{record.notes}</p>
                        {record.nextFollowUpDate && (
                          <p style={{ color: '#fa8c16' }}>
                            下次跟进：{dayjs(record.nextFollowUpDate).format('YYYY-MM-DD')}
                          </p>
                        )}
                      </Card>
                    </Timeline.Item>
                  ))}
                </Timeline>
              ) : (
                <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>
                  暂无跟进记录
                </div>
              )}
            </TabPane>
          </Tabs>
        )}
      </Modal>

      {/* 分配弹窗 */}
      <Modal
        title="分配负责人"
        open={assignModalVisible}
        onOk={handleAssignSubmit}
        onCancel={() => setAssignModalVisible(false)}
      >
        <Form form={assignForm} layout="vertical">
          <Form.Item
            name="salesId"
            label="选择销售人员"
            rules={[{ required: true, message: '请选择销售人员' }]}
          >
            <Select placeholder="请选择销售人员">
              {salesPeople
                .filter(s => !s.isOnVacation)
                .map(s => (
                  <Option key={s.id} value={s.id}>
                    {s.name} (负载: {s.currentLoad}/{s.maxLoad})
                  </Option>
                ))}
            </Select>
          </Form.Item>
          <Alert
            message="分配说明"
            description={
              <div>
                <p>• 灰色显示的销售正在休假中，无法分配</p>
                <p>• 建议优先选择负载较低的销售</p>
                <p>• 重新分配会保留历史记录</p>
              </div>
            }
            type="info"
            showIcon
          />
        </Form>
      </Modal>

      {/* 跟进弹窗 */}
      <Modal
        title="添加跟进记录"
        open={followUpModalVisible}
        onOk={handleFollowUpSubmit}
        onCancel={() => setFollowUpModalVisible(false)}
      >
        <Form form={followUpForm} layout="vertical">
          <Form.Item
            name="status"
            label="跟进状态"
            rules={[{ required: true, message: '请选择跟进状态' }]}
          >
            <Select placeholder="请选择跟进状态">
              {FOLLOW_UP_STATUS_OPTIONS.map(status => (
                <Option key={status} value={status}>{status}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="notes"
            label="跟进内容"
            rules={[{ required: true, message: '请填写跟进内容' }]}
          >
            <TextArea rows={4} placeholder="请详细记录跟进内容..." />
          </Form.Item>
          <Form.Item name="nextFollowUpDate" label="下次跟进时间">
            <Input type="date" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 导入弹窗 */}
      <Modal
        title="导入线索"
        open={importModalVisible}
        onOk={handleImport}
        onCancel={() => setImportModalVisible(false)}
        width={700}
      >
        <Form form={importForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="姓名"
                rules={[{ required: true, message: '请输入姓名' }]}
              >
                <Input placeholder="请输入联系人姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="手机号"
                rules={[{ required: true, message: '请输入手机号' }]}
              >
                <Input placeholder="用于重复检测" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="邮箱">
                <Input placeholder="用于重复检测（可选）" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="company" label="公司">
                <Input placeholder="请输入公司名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="position" label="职位">
                <Input placeholder="请输入职位" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="region" label="地区">
                <Select placeholder="请选择地区" style={{ width: '100%' }}>
                  {REGION_OPTIONS.map(region => (
                    <Option key={region} value={region}>{region}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="productInterest" label="产品兴趣">
                <Select
                  mode="multiple"
                  placeholder="请选择感兴趣的产品"
                  style={{ width: '100%' }}
                >
                  {PRODUCT_OPTIONS.map(product => (
                    <Option key={product} value={product}>{product}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="customerLevel" label="客户等级">
                <Select 
                  placeholder="请选择客户等级" 
                  style={{ width: '100%' }}
                  defaultValue={CustomerLevel.MEDIUM}
                >
                  {levelOptions}
                </Select>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="source" label="来源">
                <Input placeholder="如：线上展会-北京站" defaultValue="线上展会" />
              </Form.Item>
            </Col>
          </Row>

          <Alert
            message="导入规则说明"
            description={
              <div>
                <p>• <strong>重复检测</strong>：手机号或邮箱已存在的线索会被标记为重复</p>
                <p>• <strong>自动分配</strong>：系统根据地区、产品兴趣、销售负载自动分配负责人</p>
                <p>• <strong>地区未知</strong>：未选择地区的线索需要人工复核</p>
              </div>
            }
            type="info"
            showIcon
          />
        </Form>
      </Modal>

      {/* 合并弹窗 */}
      <Modal
        title="合并重复线索"
        open={mergeModalVisible}
        onCancel={() => setMergeModalVisible(false)}
        footer={null}
      >
        <p style={{ marginBottom: 16 }}>
          选择要合并到的目标线索（当前线索将被标记为重复并关联到目标线索）
        </p>
        <Select
          placeholder="请选择目标线索"
          style={{ width: '100%' }}
          onChange={(value) => handleMergeSubmit(value)}
          showSearch
          optionFilterProp="children"
        >
          {leads
            .filter(l => !l.isDuplicate && l.id !== selectedLead?.id)
            .map(l => (
              <Option key={l.id} value={l.id}>
                {l.name} - {l.phone} - {l.company || '未知公司'}
              </Option>
            ))}
        </Select>
      </Modal>
    </div>
  );
};

export default LeadList;
