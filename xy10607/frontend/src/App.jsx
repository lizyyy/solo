import React, { useState, useEffect } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import {
  Layout,
  Menu,
  Table,
  Card,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Switch,
  Space,
  Tag,
  Timeline,
  Descriptions,
  Popconfirm,
  Upload,
  message,
  Row,
  Col,
  Statistic,
  Divider,
  Tooltip,
  Drawer,
  Empty,
  Typography,
  Badge
} from 'antd';
import {
  HomeOutlined,
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  CarOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  ArrowRightOutlined,
  FilterOutlined
} from '@ant-design/icons';

const { Header, Content, Sider } = Layout;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { Title, Text, Paragraph } = Typography;

const STATUS_MAP = {
  pending: { label: '待确认', color: 'orange', className: 'status-pending' },
  confirmed: { label: '已确认', color: 'blue', className: 'status-confirmed' },
  in_progress: { label: '试驾中', color: 'geekblue', className: 'status-in_progress' },
  completed: { label: '已完成', color: 'green', className: 'status-completed' },
  cancelled: { label: '已取消', color: 'default', className: 'status-cancelled' },
  rejected: { label: '已拒绝', color: 'red', className: 'status-rejected' },
  no_show_released: { label: '爽约释放', color: 'gold', className: 'status-no_show_released' }
};

const TIMELINE_TYPE_MAP = {
  validation: { color: 'blue', icon: <SafetyCertificateOutlined /> },
  status_change: { color: 'green', icon: <CheckOutlined /> },
  correction: { color: 'orange', icon: <EditOutlined /> },
  accident: { color: 'red', icon: <WarningOutlined /> }
};

function App() {
  const [activeKey, setActiveKey] = useState('appointments');
  const [appointments, setAppointments] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [accidents, setAccidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [correctModalVisible, setCorrectModalVisible] = useState(false);
  const [accidentModalVisible, setAccidentModalVisible] = useState(false);
  const [processAccidentModalVisible, setProcessAccidentModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [correctForm] = Form.useForm();
  const [accidentForm] = Form.useForm();
  const [processAccidentForm] = Form.useForm();
  const [filterForm] = Form.useForm();
  const [filters, setFilters] = useState({});
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    hasAccident: 0
  });

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (appointments.length > 0) {
      setStats({
        total: appointments.length,
        pending: appointments.filter(a => a.status === 'pending').length,
        inProgress: appointments.filter(a => ['confirmed', 'in_progress'].includes(a.status)).length,
        completed: appointments.filter(a => a.status === 'completed').length,
        hasAccident: appointments.filter(a => a.hasAccident).length
      });
    }
  }, [appointments]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [apptRes, vehicleRes, salesRes, accidentRes] = await Promise.all([
        axios.get('/api/appointments'),
        axios.get('/api/vehicles'),
        axios.get('/api/salespersons'),
        axios.get('/api/accidents')
      ]);
      setAppointments(apptRes.data.data || []);
      setVehicles(vehicleRes.data.data || []);
      setSalespersons(salesRes.data.data || []);
      setAccidents(accidentRes.data.data || []);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAppointment = async (values) => {
    try {
      const res = await axios.post('/api/appointments', {
        ...values,
        startTime: values.timeRange?.[0]?.toISOString(),
        endTime: values.timeRange?.[1]?.toISOString(),
        licenseExpiryDate: values.licenseExpiryDate?.format('YYYY-MM-DD')
      }, {
        headers: { 'x-operator': '管理员' }
      });
      
      if (res.data.success) {
        message.success('预约创建成功');
        setCreateModalVisible(false);
        form.resetFields();
        loadAllData();
      } else {
        message.error(`创建失败: ${res.data.reason}`);
      }
    } catch (error) {
      message.error('创建预约失败');
    }
  };

  const handleAdvance = async (id, action, reason) => {
    try {
      const res = await axios.post(`/api/appointments/${id}/advance`, {
        action,
        operationId: `${action}_${id}_${Date.now()}`
      }, {
        headers: { 'x-operator': '管理员' }
      });
      
      if (res.data.success) {
        if (res.data.isDuplicate) {
          message.warning(res.data.message);
        } else {
          message.success('操作成功');
        }
        loadAllData();
        if (selectedAppointment?.id === id) {
          const detailRes = await axios.get(`/api/appointments/${id}`);
          setSelectedAppointment(detailRes.data.data);
        }
      } else {
        message.error(`操作失败: ${res.data.reason}`);
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleCorrect = async (values) => {
    try {
      const updates = {};
      if (values.licenseExpiryDate) {
        updates.licenseExpiryDate = values.licenseExpiryDate.format('YYYY-MM-DD');
      }
      if (values.vehicleId) {
        updates.vehicleId = values.vehicleId;
      }
      if (values.salespersonId) {
        updates.salespersonId = values.salespersonId;
      }
      
      const res = await axios.post(`/api/appointments/${selectedAppointment.id}/correct`, {
        updates,
        reason: values.reason
      }, {
        headers: { 'x-operator': '管理员' }
      });
      
      if (res.data.success) {
        message.success('修正成功');
        setCorrectModalVisible(false);
        correctForm.resetFields();
        loadAllData();
        const detailRes = await axios.get(`/api/appointments/${selectedAppointment.id}`);
        setSelectedAppointment(detailRes.data.data);
      } else {
        message.error(`修正失败: ${res.data.reason}`);
      }
    } catch (error) {
      message.error('修正失败');
    }
  };

  const handleRegisterAccident = async (values) => {
    try {
      const res = await axios.post(`/api/appointments/${selectedAppointment.id}/accident`, {
        ...values,
        occurredAt: values.occurredAt?.toISOString()
      }, {
        headers: { 'x-operator': '管理员' }
      });
      
      if (res.data.success) {
        message.success('事故登记成功');
        setAccidentModalVisible(false);
        accidentForm.resetFields();
        loadAllData();
        const detailRes = await axios.get(`/api/appointments/${selectedAppointment.id}`);
        setSelectedAppointment(detailRes.data.data);
      } else {
        message.error(`登记失败: ${res.data.reason}`);
      }
    } catch (error) {
      message.error('事故登记失败');
    }
  };

  const handleProcessAccident = async (values) => {
    try {
      const accident = accidents.find(a => a.appointmentId === selectedAppointment.id);
      const res = await axios.post(`/api/accidents/${accident.id}/process`, {
        decision: values.decision,
        notes: values.notes
      }, {
        headers: { 'x-operator': '管理员' }
      });
      
      if (res.data.success) {
        message.success('事故处理成功');
        setProcessAccidentModalVisible(false);
        processAccidentForm.resetFields();
        loadAllData();
        const detailRes = await axios.get(`/api/appointments/${selectedAppointment.id}`);
        setSelectedAppointment(detailRes.data.data);
      } else {
        message.error(`处理失败: ${res.data.reason}`);
      }
    } catch (error) {
      message.error('事故处理失败');
    }
  };

  const handleBatchImport = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await axios.post('/api/appointments/batch-import', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'x-operator': '管理员'
        }
      });
      
      if (res.data.success) {
        const { success, failed } = res.data.importResult;
        message.success(`导入完成：成功 ${success} 条，失败 ${failed} 条`);
        loadAllData();
      } else {
        message.error(`导入失败: ${res.data.reason}`);
      }
    } catch (error) {
      message.error('导入失败');
    }
    return false;
  };

  const handleExportReport = () => {
    const params = new URLSearchParams();
    if (filters.salespersonId) params.append('salespersonId', filters.salespersonId);
    if (filters.processStartTime) params.append('processStartTime', filters.processStartTime);
    if (filters.processEndTime) params.append('processEndTime', filters.processEndTime);
    if (filters.status) params.append('status', filters.status);
    if (filters.hasAccident) params.append('hasAccident', filters.hasAccident);
    
    window.open(`/api/export/report?${params.toString()}`, '_blank');
  };

  const handleExportSingle = (id) => {
    window.open(`/api/export/appointment/${id}`, '_blank');
  };

  const openDetail = async (record) => {
    try {
      const res = await axios.get(`/api/appointments/${record.id}`);
      setSelectedAppointment(res.data.data);
      setDrawerVisible(true);
    } catch (error) {
      message.error('加载详情失败');
    }
  };

  const renderStatus = (status) => {
    const info = STATUS_MAP[status] || { label: status, color: 'default' };
    return <Tag color={info.color}>{info.label}</Tag>;
  };

  const renderActionButtons = (record) => {
    const buttons = [];
    
    if (record.status === 'pending') {
      buttons.push(
        <Button key="confirm" type="primary" size="small" icon={<CheckOutlined />}
          onClick={() => handleAdvance(record.id, 'confirm')}>
          确认
        </Button>
      );
      buttons.push(
        <Popconfirm key="cancel" title="确定要取消这个预约吗？"
          onConfirm={() => handleAdvance(record.id, 'cancel')}>
          <Button size="small" danger icon={<CloseOutlined />}>取消</Button>
        </Popconfirm>
      );
    }
    
    if (record.status === 'confirmed') {
      buttons.push(
        <Button key="checkin" type="primary" size="small" icon={<CheckOutlined />}
          onClick={() => handleAdvance(record.id, 'checkin')}>
          签到
        </Button>
      );
      buttons.push(
        <Popconfirm key="release" title="确定要执行爽约释放吗？"
          description="这将自动释放车辆和销售日程"
          onConfirm={() => handleAdvance(record.id, 'release_no_show')}>
          <Button size="small" warning icon={<ClockCircleOutlined />}>爽约释放</Button>
        </Popconfirm>
      );
      buttons.push(
        <Popconfirm key="cancel" title="确定要取消这个预约吗？"
          onConfirm={() => handleAdvance(record.id, 'cancel')}>
          <Button size="small" danger icon={<CloseOutlined />}>取消</Button>
        </Popconfirm>
      );
    }
    
    if (record.status === 'in_progress') {
      buttons.push(
        <Button key="complete" type="primary" size="small" icon={<CheckOutlined />}
          onClick={() => handleAdvance(record.id, 'complete')}>
          完成
        </Button>
      );
      buttons.push(
        <Button key="accident" size="small" danger icon={<WarningOutlined />}
          onClick={() => {
            setSelectedAppointment(record);
            setAccidentModalVisible(true);
          }}>
          事故登记
        </Button>
      );
    }
    
    if (['pending', 'confirmed', 'in_progress'].includes(record.status)) {
      buttons.push(
        <Button key="correct" size="small" icon={<EditOutlined />}
          onClick={() => {
            setSelectedAppointment(record);
            setCorrectModalVisible(true);
          }}>
          修正
        </Button>
      );
    }
    
    return <Space>{buttons}</Space>;
  };

  const columns = [
    { title: '客户姓名', dataIndex: 'customerName', key: 'customerName', width: 100 },
    { title: '联系电话', dataIndex: 'customerPhone', key: 'customerPhone', width: 120 },
    { 
      title: '驾照状态', 
      key: 'licenseStatus', 
      width: 100,
      render: (_, record) => {
        if (!record.license) return <Tag color="default">未知</Tag>;
        if (!record.license.valid) return <Tag color="red">过期/无效</Tag>;
        if (record.license.warning) {
          return <Tag color={record.license.warningLevel === 'high' ? 'orange' : 'gold'}>
            {record.license.warningLevel === 'high' ? '即将过期' : '即将过期'}
          </Tag>;
        }
        return <Tag color="green">有效</Tag>;
      }
    },
    { 
      title: '试驾车', 
      key: 'vehicle', 
      width: 180,
      render: (_, record) => record.vehicleSnapshot?.model || record.vehicleId
    },
    { 
      title: '销售顾问', 
      key: 'salesperson', 
      width: 100,
      render: (_, record) => record.salespersonSnapshot?.name || record.salespersonId
    },
    { 
      title: '预约时间', 
      key: 'time', 
      width: 250,
      render: (_, record) => (
        <div>
          <div>开始: {dayjs(record.startTime).format('YYYY-MM-DD HH:mm')}</div>
          <div>结束: {dayjs(record.endTime).format('YYYY-MM-DD HH:mm')}</div>
        </div>
      )
    },
    { title: '状态', key: 'status', width: 100, render: (_, record) => renderStatus(record.status) },
    { 
      title: '事故', 
      key: 'accident', 
      width: 60,
      render: (_, record) => record.hasAccident ? <Badge status="error" text="有" /> : <Badge status="success" text="无" />
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
            详情
          </Button>
          {renderActionButtons(record)}
        </Space>
      )
    }
  ];

  const renderDashboard = () => (
    <div>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic title="总预约数" value={stats.total} prefix={<HomeOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待确认" value={stats.pending} valueStyle={{ color: '#fa8c16' }}
              prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="进行中" value={stats.inProgress} valueStyle={{ color: '#1890ff' }}
              prefix={<CarOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已完成" value={stats.completed} valueStyle={{ color: '#52c41a' }}
              prefix={<CheckOutlined />} />
          </Card>
        </Col>
      </Row>
      
      <Divider />
      
      <Title level={4}>近期预约</Title>
      <Table 
        rowKey="id" 
        columns={columns} 
        dataSource={appointments.slice(0, 5)} 
        pagination={false}
        loading={loading}
      />
    </div>
  );

  const renderAppointments = () => (
    <div>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}>
            新建预约
          </Button>
          <Upload beforeUpload={handleBatchImport} showUploadList={false}>
            <Button icon={<UploadOutlined />}>批量导入</Button>
          </Upload>
          <Button icon={<FilterOutlined />} onClick={() => setFilterModalVisible(true)}>
            筛选
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportReport}>
            导出报告
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadAllData}>
            刷新
          </Button>
        </Space>
        
        <Table 
          rowKey="id" 
          columns={columns} 
          dataSource={appointments}
          pagination={{ pageSize: 10 }}
          loading={loading}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );

  const renderAccidentList = () => {
    const accidentColumns = [
      { title: '客户姓名', dataIndex: 'customerName', key: 'customerName', width: 100 },
      { 
        title: '事故类型', 
        dataIndex: 'type', 
        key: 'type', 
        width: 120,
        render: (val) => {
          const map = {
            collision: '碰撞事故',
            scratch: '刮蹭',
            parking: '停车事故',
            other: '其他'
          };
          return map[val] || val;
        }
      },
      { title: '损失金额', dataIndex: 'damageAmount', key: 'damageAmount', width: 100 },
      { 
        title: '责任方', 
        dataIndex: 'responsibleParty', 
        key: 'responsibleParty', 
        width: 100,
        render: (val) => {
          const map = {
            customer: '客户',
            salesperson: '销售顾问',
            third_party: '第三方',
            unclear: '待认定'
          };
          return map[val] || val;
        }
      },
      { 
        title: '状态', 
        key: 'status', 
        width: 100,
        render: (_, record) => {
          const map = {
            pending_review: { color: 'orange', label: '待审核' },
            resolved: { color: 'green', label: '已处理' },
            disputed: { color: 'red', label: '有争议' },
            pending_followup: { color: 'gold', label: '待跟进' }
          };
          const info = map[record.status] || { color: 'default', label: record.status };
          return <Tag color={info.color}>{info.label}</Tag>;
        }
      },
      { title: '登记时间', key: 'createdAt', width: 180,
        render: (_, record) => dayjs(record.createdAt).format('YYYY-MM-DD HH:mm:ss') }
    ];
    
    return (
      <Card>
        <Table 
          rowKey="id" 
          columns={accidentColumns} 
          dataSource={accidents}
          pagination={{ pageSize: 10 }}
          loading={loading}
        />
      </Card>
    );
  };

  const renderTimelineDiff = (entry) => {
    if (!entry.oldValue && !entry.newValue) return null;
    
    return (
      <div className="timeline-diff">
        {entry.oldValue && (
          <div>
            <Text type="secondary">修改前：</Text>
            <pre className="old">{JSON.stringify(entry.oldValue, null, 2)}</pre>
          </div>
        )}
        {entry.newValue && (
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">修改后：</Text>
            <pre className="new">{JSON.stringify(entry.newValue, null, 2)}</pre>
          </div>
        )}
      </div>
    );
  };

  const renderDetailDrawer = () => {
    if (!selectedAppointment) return null;
    
    const appt = selectedAppointment;
    
    return (
      <Drawer
        title={`预约详情 - ${appt.customerName}`}
        placement="right"
        width={720}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        extra={
          <Space>
            <Button icon={<DownloadOutlined />} onClick={() => handleExportSingle(appt.id)}>
              导出报告
            </Button>
            <Button onClick={() => setDrawerVisible(false)}>关闭</Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card title="基本信息" size="small">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="预约ID">{appt.id}</Descriptions.Item>
              <Descriptions.Item label="状态">{renderStatus(appt.status)}</Descriptions.Item>
              <Descriptions.Item label="客户姓名">{appt.customerName}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{appt.customerPhone}</Descriptions.Item>
              <Descriptions.Item label="年龄">{appt.customerAge || '-'}</Descriptions.Item>
              <Descriptions.Item label="事故历史">
                {appt.hasAccidentHistory ? '有' : '无'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
          
          <Card title="驾照信息" size="small">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="驾照号">{appt.license?.number}</Descriptions.Item>
              <Descriptions.Item label="有效期">{appt.license?.expiryDate}</Descriptions.Item>
              <Descriptions.Item label="状态">
                {appt.license?.valid ? (
                  appt.license?.warning ? 
                    <Tag color={appt.license?.warningLevel === 'high' ? 'orange' : 'gold'}>即将过期</Tag> :
                    <Tag color="green">有效</Tag>
                ) : (
                  <Tag color="red">过期/无效</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="检查结果">
                <Text type={appt.licenseCheck?.valid ? 'success' : 'danger'}>
                  {appt.licenseCheck?.reason}
                </Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
          
          <Card title="车辆信息" size="small">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="车型">
                {appt.vehicleSnapshot?.model || appt.vehicleId}
              </Descriptions.Item>
              <Descriptions.Item label="车牌号">
                {appt.vehicleSnapshot?.plateNumber || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="车辆检查">
                <Text type={appt.vehicleCheck?.available ? 'success' : 'danger'}>
                  {appt.vehicleCheck?.reason}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="保险检查">
                <Text type={appt.insuranceCheck?.valid ? 'success' : 'danger'}>
                  {appt.insuranceCheck?.valid ? '通过' : '未通过'}
                  {appt.insuranceCheck?.warnings?.length > 0 && (
                    <Tag color="orange" style={{ marginLeft: 8 }}>
                      {appt.insuranceCheck.warnings.length} 个警告
                    </Tag>
                  )}
                </Text>
              </Descriptions.Item>
              {appt.vehicleSnapshot?.insurance && (
                <>
                  <Descriptions.Item label="保险公司">
                    {appt.vehicleSnapshot.insurance.company}
                  </Descriptions.Item>
                  <Descriptions.Item label="保险到期">
                    {appt.vehicleSnapshot.insurance.expiryDate}
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>
          </Card>
          
          <Card title="销售顾问" size="small">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="姓名">
                {appt.salespersonSnapshot?.name || appt.salespersonId}
              </Descriptions.Item>
              <Descriptions.Item label="部门">
                {appt.salespersonSnapshot?.department || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="联系电话">
                {appt.salespersonSnapshot?.phone || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="日程检查">
                <Text type={appt.salespersonCheck?.available ? 'success' : 'danger'}>
                  {appt.salespersonCheck?.reason}
                </Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
          
          {appt.hasAccident && (
            <Card 
              title="事故信息" 
              size="small"
              extra={
                <Button 
                  type="primary" 
                  size="small"
                  onClick={() => setProcessAccidentModalVisible(true)}
                >
                  人工处理
                </Button>
              }
            >
              {(() => {
                const accident = accidents.find(a => a.id === appt.accidentId);
                if (!accident) return <Empty description="事故记录未找到" />;
                return (
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="事故ID">{accident.id}</Descriptions.Item>
                    <Descriptions.Item label="类型">{accident.type}</Descriptions.Item>
                    <Descriptions.Item label="损失金额">{accident.damageAmount}</Descriptions.Item>
                    <Descriptions.Item label="责任方">{accident.responsibleParty}</Descriptions.Item>
                    <Descriptions.Item label="描述" span={2}>{accident.description}</Descriptions.Item>
                    <Descriptions.Item label="处理状态">
                      {(() => {
                        const map = {
                          pending_review: { color: 'orange', label: '待审核' },
                          resolved: { color: 'green', label: '已处理' },
                          disputed: { color: 'red', label: '有争议' },
                          pending_followup: { color: 'gold', label: '待跟进' }
                        };
                        const info = map[accident.status] || { color: 'default', label: accident.status };
                        return <Tag color={info.color}>{info.label}</Tag>;
                      })()}
                    </Descriptions.Item>
                    <Descriptions.Item label="处理人">{accident.processedBy || '-'}</Descriptions.Item>
                    {accident.processNotes && (
                      <Descriptions.Item label="处理备注" span={2}>
                        {accident.processNotes}
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                );
              })()}
            </Card>
          )}
          
          <Card title="操作按钮" size="small">
            {renderActionButtons(appt)}
          </Card>
          
          <Card 
            title="处理时间线（含修改前后值）" 
            size="small"
            extra={<Text type="secondary">{appt.timeline?.length || 0} 条记录</Text>}
          >
            {appt.timeline && appt.timeline.length > 0 ? (
              <Timeline>
                {[...appt.timeline].reverse().map((entry) => {
                  const typeInfo = TIMELINE_TYPE_MAP[entry.type] || { color: 'gray' };
                  return (
                    <Timeline.Item 
                      key={entry.id}
                      color={typeInfo.color}
                      dot={typeInfo.icon}
                    >
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Space>
                          <Text strong>{entry.action}</Text>
                          <Text type="secondary">
                            操作人：{entry.operator}
                          </Text>
                          <Text type="secondary">
                            {dayjs(entry.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                          </Text>
                        </Space>
                        <Paragraph type="secondary" style={{ margin: 0 }}>
                          <Tag color={typeInfo.color}>
                            {entry.type === 'validation' ? '规则校验' : 
                             entry.type === 'status_change' ? '状态变更' :
                             entry.type === 'correction' ? '人工修正' :
                             entry.type === 'accident' ? '事故处理' : entry.type}
                          </Tag>
                        </Paragraph>
                        <Paragraph style={{ margin: 0 }}>
                          {entry.reason}
                        </Paragraph>
                        {renderTimelineDiff(entry)}
                      </Space>
                    </Timeline.Item>
                  );
                })}
              </Timeline>
            ) : (
              <Empty description="暂无时间线记录" />
            )}
          </Card>
        </Space>
      </Drawer>
    );
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={200}>
        <div style={{ 
          height: 64, 
          margin: 16, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 'bold'
        }}>
          <CarOutlined style={{ marginRight: 8 }} />
          试驾预约风控
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activeKey]}
          onClick={({ key }) => setActiveKey(key)}
          items={[
            { key: 'appointments', icon: <HomeOutlined />, label: '预约管理' },
            { key: 'accidents', icon: <WarningOutlined />, label: '事故管理' }
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ 
          background: '#fff', 
          padding: '0 24px', 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <Title level={4} style={{ margin: 0 }}>
            {activeKey === 'appointments' ? '预约管理' : '事故管理'}
          </Title>
          <Space>
            <UserOutlined />
            <Text>管理员</Text>
          </Space>
        </Header>
        <Content style={{ margin: 24 }}>
          {activeKey === 'appointments' && renderAppointments()}
          {activeKey === 'accidents' && renderAccidentList()}
        </Content>
      </Layout>
      
      {renderDetailDrawer()}
      
      <Modal
        title="新建预约"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => form.submit()}
        width={720}
        maskClosable={false}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateAppointment}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="customerName" label="客户姓名" rules={[{ required: true }]}>
                <Input placeholder="请输入客户姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="customerPhone" label="联系电话" rules={[{ required: true }]}>
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="licenseNumber" label="驾照号" rules={[{ required: true }]}>
                <Input placeholder="请输入驾照号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="licenseExpiryDate" label="驾照有效期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} placeholder="请选择驾照有效期" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="customerAge" label="年龄">
                <InputNumber min={18} max={100} style={{ width: '100%' }} placeholder="请输入年龄" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="vehicleId" label="试驾车" rules={[{ required: true }]}>
                <Select placeholder="请选择试驾车">
                  {vehicles.filter(v => v.status === 'available').map(v => (
                    <Option key={v.id} value={v.id}>{v.model} ({v.plateNumber})</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="salespersonId" label="销售顾问" rules={[{ required: true }]}>
                <Select placeholder="请选择销售顾问">
                  {salespersons.map(s => (
                    <Option key={s.id} value={s.id}>{s.name} - {s.department}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="timeRange" label="预约时间" rules={[{ required: true }]}>
            <RangePicker 
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
              placeholder={['开始时间', '结束时间']}
            />
          </Form.Item>
          <Form.Item name="hasAccidentHistory" label="客户事故历史" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
      
      <Modal
        title="人工修正"
        open={correctModalVisible}
        onCancel={() => setCorrectModalVisible(false)}
        onOk={() => correctForm.submit()}
        width={600}
      >
        <Form form={correctForm} layout="vertical" onFinish={handleCorrect}>
          <Form.Item name="licenseExpiryDate" label="修正驾照有效期">
            <DatePicker style={{ width: '100%' }} placeholder="留空表示不修改" />
          </Form.Item>
          <Form.Item name="vehicleId" label="修正试驾车">
            <Select placeholder="留空表示不修改" allowClear>
              {vehicles.filter(v => v.status === 'available').map(v => (
                <Option key={v.id} value={v.id}>{v.model} ({v.plateNumber})</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="salespersonId" label="修正销售顾问">
            <Select placeholder="留空表示不修改" allowClear>
              {salespersons.map(s => (
                <Option key={s.id} value={s.id}>{s.name} - {s.department}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="reason" label="修正原因" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="请输入修正原因（必填）" />
          </Form.Item>
        </Form>
      </Modal>
      
      <Modal
        title="事故登记"
        open={accidentModalVisible}
        onCancel={() => setAccidentModalVisible(false)}
        onOk={() => accidentForm.submit()}
        width={600}
      >
        <Form form={accidentForm} layout="vertical" onFinish={handleRegisterAccident}>
          <Form.Item name="type" label="事故类型" rules={[{ required: true }]}>
            <Select placeholder="请选择事故类型">
              <Option value="collision">碰撞事故</Option>
              <Option value="scratch">刮蹭</Option>
              <Option value="parking">停车事故</Option>
              <Option value="other">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item name="occurredAt" label="事故发生时间">
            <DatePicker showTime style={{ width: '100%' }} placeholder="请选择事故发生时间" />
          </Form.Item>
          <Form.Item name="damageAmount" label="预估损失金额">
            <InputNumber style={{ width: '100%' }} placeholder="请输入预估损失金额" min={0} />
          </Form.Item>
          <Form.Item name="responsibleParty" label="初步责任判定">
            <Select placeholder="请选择责任方">
              <Option value="customer">客户</Option>
              <Option value="salesperson">销售顾问</Option>
              <Option value="third_party">第三方</Option>
              <Option value="unclear">待认定</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="事故描述" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="请详细描述事故情况" />
          </Form.Item>
        </Form>
      </Modal>
      
      <Modal
        title="事故人工处理"
        open={processAccidentModalVisible}
        onCancel={() => setProcessAccidentModalVisible(false)}
        onOk={() => processAccidentForm.submit()}
        width={500}
      >
        <Form form={processAccidentForm} layout="vertical" onFinish={handleProcessAccident}>
          <Form.Item name="decision" label="处理决策" rules={[{ required: true }]}>
            <Select placeholder="请选择处理方式">
              <Option value="approve">通过（标记为已处理）</Option>
              <Option value="reject">有争议（需进一步核实）</Option>
              <Option value="pending_followup">待跟进</Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="处理备注" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="请输入处理备注（必填）" />
          </Form.Item>
        </Form>
      </Modal>
      
      <Modal
        title="筛选条件（用于导出报告）"
        open={filterModalVisible}
        onCancel={() => setFilterModalVisible(false)}
        onOk={() => {
          filterForm.validateFields().then(values => {
            const newFilters = {};
            if (values.salespersonId) newFilters.salespersonId = values.salespersonId;
            if (values.processTimeRange) {
              newFilters.processStartTime = values.processTimeRange[0]?.format('YYYY-MM-DD');
              newFilters.processEndTime = values.processTimeRange[1]?.format('YYYY-MM-DD');
            }
            if (values.status) newFilters.status = values.status;
            if (values.hasAccident) newFilters.hasAccident = values.hasAccident;
            setFilters(newFilters);
            setFilterModalVisible(false);
            message.success('筛选条件已应用');
          });
        }}
        width={500}
      >
        <Form form={filterForm} layout="vertical">
          <Form.Item name="salespersonId" label="责任人（销售顾问）">
            <Select placeholder="请选择销售顾问" allowClear>
              {salespersons.map(s => (
                <Option key={s.id} value={s.id}>{s.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="processTimeRange" label="处理时间范围">
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="请选择状态" allowClear>
              {Object.entries(STATUS_MAP).map(([key, info]) => (
                <Option key={key} value={key}>{info.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="hasAccident" label="是否有事故">
            <Select placeholder="请选择" allowClear>
              <Option value="true">是</Option>
              <Option value="false">否</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}

export default App;
