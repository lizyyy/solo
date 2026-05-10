import React, { useState } from 'react';
import {
  Layout,
  Card,
  Form,
  Input,
  Select,
  Button,
  Table,
  Tag,
  Alert,
  Modal,
  message,
  Space,
  Row,
  Col,
  Descriptions,
  Tabs,
  Timeline,
  DatePicker,
  Empty,
  Typography,
  Divider,
  Popconfirm
} from 'antd';
import {
  SearchOutlined,
  PrinterOutlined,
  FileTextOutlined,
  UserOutlined,
  HistoryOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  searchRecords,
  checkEligibility,
  verifyIdentity,
  submitPrintRequest,
  confirmReceive,
  getAuditLogs,
  exportAuditLogs
} from './api';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const STATUS_MAP = {
  pending: { text: '待完成', color: 'orange' },
  completed: { text: '已完成', color: 'green' },
  recheck_pending: { text: '复检待处理', color: 'red' }
};

const ITEM_STATUS_MAP = {
  pending: { text: '未完成', color: 'orange' },
  completed: { text: '已完成', color: 'green' }
};

const App = () => {
  const [searchType, setSearchType] = useState('idCard');
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [currentOperator, setCurrentOperator] = useState('前台护士');
  const [activeTab, setActiveTab] = useState('search');
  
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [identityModalVisible, setIdentityModalVisible] = useState(false);
  const [printRequestResult, setPrintRequestResult] = useState(null);
  
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditDateRange, setAuditDateRange] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const [identityForm] = Form.useForm();
  const [printForm] = Form.useForm();

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      message.warning('请输入查询内容');
      return;
    }

    setLoading(true);
    try {
      const res = await searchRecords(searchType, searchValue.trim());
      if (res.data.success) {
        setRecords(res.data.records);
        if (res.data.count === 0) {
          message.info('未找到相关记录');
        } else {
          message.success(`找到 ${res.data.count} 条记录`);
        }
      }
    } catch (err) {
      message.error(err.response?.data?.message || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRecord = async (record) => {
    setSelectedRecord(record);
    try {
      const res = await checkEligibility(record.id);
      setEligibility(res.data);
    } catch (err) {
      message.error('检查补打资格失败');
    }
  };

  const handleOpenPrintModal = () => {
    if (!selectedRecord) return;
    
    if (!eligibility?.canPrint) {
      message.error('不符合补打条件，请先处理未完成项目');
      return;
    }

    printForm.resetFields();
    setPrintRequestResult(null);
    
    if (selectedRecord.hasReceivedBefore) {
      printForm.setFieldsValue({ requestType: 'reprint' });
    } else {
      printForm.setFieldsValue({ requestType: 'first' });
    }
    
    setPrintModalVisible(true);
  };

  const handleSubmitPrintRequest = async () => {
    try {
      const values = await printForm.validateFields();
      const res = await submitPrintRequest(
        selectedRecord.id,
        values.requestType,
        values.reason,
        currentOperator
      );

      setPrintRequestResult(res.data);
      
      if (res.data.isReprint) {
        message.info('这是重复补打，已记录补打原因');
      }
      
      if (res.data.warnings && res.data.warnings.length > 0) {
        Modal.warning({
          title: '注意事项',
          content: res.data.warnings.map(w => (
            <div key={w.type} style={{ marginBottom: 8 }}>
              <WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />
              {w.message}
            </div>
          )),
          onOk: () => {
            setPrintModalVisible(false);
            setIdentityModalVisible(true);
            identityForm.resetFields();
          }
        });
      } else {
        setPrintModalVisible(false);
        setIdentityModalVisible(true);
        identityForm.resetFields();
      }
    } catch (err) {
      if (err.errorFields) {
        return;
      }
      message.error(err.response?.data?.message || '提交打印申请失败');
    }
  };

  const handleVerifyIdentity = async () => {
    try {
      const values = await identityForm.validateFields();
      const res = await verifyIdentity(
        selectedRecord.id,
        values.receiverName,
        values.receiverIdCard
      );

      if (!res.data.valid) {
        Modal.error({
          title: '身份核验失败',
          content: (
            <div>
              <p>{res.data.message}</p>
              {res.data.detail && <p style={{ color: '#999' }}>{res.data.detail}</p>}
            </div>
          )
        });
        return;
      }

      if (res.data.warning) {
        Modal.confirm({
          title: '代领确认',
          content: `${res.data.message}，是否继续？`,
          okText: '确认继续',
          cancelText: '取消',
          onOk: async () => {
            await doConfirmReceive(values, res.data.relation);
          }
        });
      } else {
        await doConfirmReceive(values, res.data.relation);
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error('身份核验失败');
    }
  };

  const doConfirmReceive = async (values, relation) => {
    try {
      await confirmReceive({
        recordId: selectedRecord.id,
        requestId: printRequestResult?.requestId,
        receiverName: values.receiverName,
        receiverIdCard: values.receiverIdCard,
        relation,
        operator: currentOperator
      });

      setIdentityModalVisible(false);
      message.success('领取确认成功！报告已打印并交付');
      
      handleSearch();
      setSelectedRecord(null);
      setEligibility(null);
    } catch (err) {
      message.error(err.response?.data?.message || '领取确认失败');
    }
  };

  const handleLoadAuditLogs = async () => {
    setAuditLoading(true);
    try {
      let startDate, endDate;
      if (auditDateRange && auditDateRange.length === 2) {
        startDate = auditDateRange[0].format('YYYY-MM-DD');
        endDate = auditDateRange[1].format('YYYY-MM-DD');
      }
      
      const res = await getAuditLogs(startDate, endDate);
      setAuditLogs(res.data.logs);
    } catch (err) {
      message.error('加载审计日志失败');
    } finally {
      setAuditLoading(false);
    }
  };

  const handleExportAudit = () => {
    let startDate, endDate;
    if (auditDateRange && auditDateRange.length === 2) {
      startDate = auditDateRange[0].format('YYYY-MM-DD');
      endDate = auditDateRange[1].format('YYYY-MM-DD');
    }
    exportAuditLogs(startDate, endDate);
    message.success('审计日志导出中...');
  };

  const columns = [
    {
      title: '档案编号',
      dataIndex: 'record_no',
      key: 'record_no',
      render: (text, record) => (
        <a onClick={() => handleSelectRecord(record)}>{text}</a>
      )
    },
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name'
    },
    {
      title: '体检套餐',
      dataIndex: 'package_name',
      key: 'package_name'
    },
    {
      title: '体检日期',
      dataIndex: 'check_date',
      key: 'check_date'
    },
    {
      title: '报告状态',
      dataIndex: 'report_status',
      key: 'report_status',
      render: (status) => {
        const info = STATUS_MAP[status] || STATUS_MAP.pending;
        return <Tag color={info.color}>{info.text}</Tag>;
      }
    },
    {
      title: '领取次数',
      dataIndex: 'receiveCount',
      key: 'receiveCount',
      render: (count) => (
        <Tag color={count > 0 ? 'blue' : 'default'}>
          {count > 0 ? `已领取 ${count} 次` : '未领取'}
        </Tag>
      )
    }
  ];

  const itemColumns = [
    {
      title: '项目名称',
      dataIndex: 'item_name',
      key: 'item_name'
    },
    {
      title: '科室',
      dataIndex: 'department',
      key: 'department'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        if (record.need_recheck === 1 && record.recheck_status === 'pending') {
          return <Tag color="red">复检待处理</Tag>;
        }
        const info = ITEM_STATUS_MAP[status] || ITEM_STATUS_MAP.pending;
        return <Tag color={info.color}>{info.text}</Tag>;
      }
    },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      render: (text, record) => {
        if (record.abnormal_flag === 1) {
          return <span style={{ color: '#ff4d4f' }}>{text} ★</span>;
        }
        return text || '-';
      }
    },
    {
      title: '异常说明',
      dataIndex: 'abnormal_desc',
      key: 'abnormal_desc',
      render: (text) => text || '-'
    }
  ];

  const auditColumns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180
    },
    {
      title: '档案编号',
      dataIndex: 'record_no',
      key: 'record_no'
    },
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name'
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      render: (text) => <Tag>{text}</Tag>
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details'
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator'
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
        padding: '0 32px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={3} style={{ color: 'white', margin: 0, lineHeight: '64px' }}>
              <PrinterOutlined style={{ marginRight: 12 }} />
              体检中心报告补打台
            </Title>
          </div>
          <div style={{ color: 'white' }}>
            <UserOutlined style={{ marginRight: 8 }} />
            当前操作人：
            <Input
              value={currentOperator}
              onChange={(e) => setCurrentOperator(e.target.value)}
              style={{ width: 120, marginLeft: 8 }}
              size="small"
            />
          </div>
        </div>
      </Header>
      
      <Content style={{ padding: 24 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'search',
              label: <span><SearchOutlined /> 客户查询与补打</span>,
              children: (
                <>
                  <Card className="search-section" title="客户查询">
                    <Form layout="inline">
                      <Form.Item label="查询方式">
                        <Select
                          value={searchType}
                          onChange={setSearchType}
                          style={{ width: 150 }}
                        >
                          <Option value="idCard">身份证号</Option>
                          <Option value="recordNo">档案编号</Option>
                        </Select>
                      </Form.Item>
                      <Form.Item>
                        <Input
                          placeholder={searchType === 'idCard' ? '请输入身份证号' : '请输入档案编号'}
                          value={searchValue}
                          onChange={(e) => setSearchValue(e.target.value)}
                          style={{ width: 300 }}
                          onPressEnter={handleSearch}
                        />
                      </Form.Item>
                      <Form.Item>
                        <Button
                          type="primary"
                          icon={<SearchOutlined />}
                          onClick={handleSearch}
                          loading={loading}
                        >
                          查询
                        </Button>
                      </Form.Item>
                    </Form>
                    
                    <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                      <Text type="secondary">
                        <strong>测试数据：</strong>
                        <br />• 张三（正常补打）：身份证 110101199001011234
                        <br />• 李四（未完成项目）：身份证 110101199002022345
                        <br />• 王五（复检未完成）：身份证 110101199003033456
                        <br />• 赵六（重复补打）：身份证 110101199004044567
                      </Text>
                    </div>
                  </Card>

                  {records.length > 0 && (
                    <Card 
                      title="查询结果" 
                      className="record-card"
                      style={{ marginBottom: 24 }}
                    >
                      <Table
                        dataSource={records}
                        columns={columns}
                        rowKey="id"
                        pagination={false}
                        rowSelection={{
                          type: 'radio',
                          selectedRowKeys: selectedRecord ? [selectedRecord.id] : [],
                          onChange: (keys, rows) => rows[0] && handleSelectRecord(rows[0])
                        }}
                      />
                    </Card>
                  )}

                  {selectedRecord && (
                    <Card 
                      title="档案详情" 
                      className="record-card"
                      extra={
                        <Space>
                          <Button
                            icon={<ReloadOutlined />}
                            onClick={() => handleSearch()}
                          >
                            刷新
                          </Button>
                          <Button
                            type="primary"
                            icon={<PrinterOutlined />}
                            onClick={handleOpenPrintModal}
                            disabled={!eligibility?.canPrint}
                          >
                            申请补打
                          </Button>
                        </Space>
                      }
                    >
                      {eligibility && eligibility.issues.length > 0 && (
                        <div className="alert-box">
                          {eligibility.issues.map((issue, idx) => (
                            <Alert
                              key={idx}
                              message={issue.message}
                              type={issue.warning ? 'warning' : 'error'}
                              showIcon
                              style={{ marginBottom: 8 }}
                            />
                          ))}
                        </div>
                      )}

                      <Descriptions bordered column={3}>
                        <Descriptions.Item label="档案编号">{selectedRecord.record_no}</Descriptions.Item>
                        <Descriptions.Item label="客户姓名">{selectedRecord.customer_name}</Descriptions.Item>
                        <Descriptions.Item label="性别">{selectedRecord.gender}</Descriptions.Item>
                        <Descriptions.Item label="出生日期">{selectedRecord.birthday}</Descriptions.Item>
                        <Descriptions.Item label="联系电话">{selectedRecord.phone}</Descriptions.Item>
                        <Descriptions.Item label="体检日期">{selectedRecord.check_date}</Descriptions.Item>
                        <Descriptions.Item label="体检套餐">{selectedRecord.package_name}</Descriptions.Item>
                        <Descriptions.Item label="报告状态">
                          <Tag color={STATUS_MAP[selectedRecord.report_status]?.color || 'default'}>
                            {STATUS_MAP[selectedRecord.report_status]?.text || '未知'}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="领取情况">
                          <Tag color={selectedRecord.receiveCount > 0 ? 'blue' : 'default'}>
                            {selectedRecord.receiveCount > 0 
                              ? `已领取 ${selectedRecord.receiveCount} 次` 
                              : '未领取'}
                          </Tag>
                        </Descriptions.Item>
                      </Descriptions>

                      <Divider />

                      <Tabs
                        items={[
                          {
                            key: 'items',
                            label: '项目完成情况',
                            children: (
                              <div className="tab-content">
                                <div style={{ marginBottom: 16 }}>
                                  <Text strong>项目进度：</Text>
                                  <Text style={{ marginLeft: 8 }}>
                                    {eligibility?.completedItems || 0} / {eligibility?.totalItems || 0}
                                  </Text>
                                </div>
                                <Table
                                  dataSource={selectedRecord.items}
                                  columns={itemColumns}
                                  rowKey="id"
                                  pagination={false}
                                  size="small"
                                />
                              </div>
                            )
                          },
                          {
                            key: 'history',
                            label: '领取历史',
                            children: (
                              <div className="tab-content">
                                {selectedRecord.receiveHistory && selectedRecord.receiveHistory.length > 0 ? (
                                  <Timeline className="history-timeline">
                                    {selectedRecord.receiveHistory.map((h, idx) => (
                                      <Timeline.Item key={idx}>
                                        <p>
                                          <Text strong>{h.receive_time}</Text>
                                          <Tag style={{ marginLeft: 8 }}>{h.relation}</Tag>
                                        </p>
                                        <p>
                                          领取人：{h.receiver_name}
                                          {h.print_reason && (
                                            <Text type="secondary" style={{ marginLeft: 16 }}>
                                              补打原因：{h.print_reason}
                                            </Text>
                                          )}
                                        </p>
                                        <p style={{ color: '#999' }}>操作人：{h.operator}</p>
                                      </Timeline.Item>
                                    ))}
                                  </Timeline>
                                ) : (
                                  <Empty description="暂无领取记录" />
                                )}
                              </div>
                            )
                          }
                        ]}
                      />
                    </Card>
                  )}
                </>
              )
            },
            {
              key: 'audit',
              label: <span><FileTextOutlined /> 审计日志</span>,
              children: (
                <Card>
                  <div style={{ marginBottom: 16 }}>
                    <Space>
                      <RangePicker
                        value={auditDateRange}
                        onChange={setAuditDateRange}
                      />
                      <Button
                        type="primary"
                        icon={<SearchOutlined />}
                        onClick={handleLoadAuditLogs}
                        loading={auditLoading}
                      >
                        查询
                      </Button>
                      <Button
                        icon={<DownloadOutlined />}
                        onClick={handleExportAudit}
                      >
                        导出审计表
                      </Button>
                    </Space>
                  </div>
                  
                  <Table
                    dataSource={auditLogs}
                    columns={auditColumns}
                    rowKey="id"
                    loading={auditLoading}
                    pagination={{ pageSize: 10 }}
                  />
                </Card>
              )
            }
          ]}
        />
      </Content>

      <Modal
        title="补打申请"
        open={printModalVisible}
        onCancel={() => setPrintModalVisible(false)}
        onOk={handleSubmitPrintRequest}
        okText="确认申请"
        cancelText="取消"
      >
        <Form form={printForm} layout="vertical">
          <Form.Item
            name="requestType"
            label="申请类型"
            rules={[{ required: true, message: '请选择申请类型' }]}
          >
            <Select disabled={selectedRecord?.hasReceivedBefore}>
              <Option value="first">首次领取</Option>
              <Option value="reprint">重复补打</Option>
            </Select>
          </Form.Item>
          
          {selectedRecord?.hasReceivedBefore && (
            <Alert
              message="该报告已领取过"
              description="重复补打必须填写原因，以便审计追溯"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          
          <Form.Item
            name="reason"
            label="补打原因"
            rules={[
              { required: selectedRecord?.hasReceivedBefore, message: '请填写补打原因' }
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder={selectedRecord?.hasReceivedBefore 
                ? '请详细描述补打原因，如：报告丢失、损坏等' 
                : '可选：填写备注信息'}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="身份核验与领取确认"
        open={identityModalVisible}
        onCancel={() => setIdentityModalVisible(false)}
        onOk={handleVerifyIdentity}
        okText="核验并确认领取"
        cancelText="取消"
      >
        <Alert
          message="重要提示"
          description="请核验领取人身份证原件，确保身份信息准确无误。代领需同时核验代领人身份证。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Form form={identityForm} layout="vertical">
          <Form.Item
            name="receiverName"
            label="领取人姓名"
            rules={[{ required: true, message: '请输入领取人姓名' }]}
          >
            <Input placeholder="请输入领取人姓名" />
          </Form.Item>
          
          <Form.Item
            name="receiverIdCard"
            label="领取人身份证号"
            rules={[
              { required: true, message: '请输入身份证号' },
              { 
                pattern: /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/,
                message: '请输入有效的18位身份证号'
              }
            ]}
          >
            <Input placeholder="请输入18位身份证号" maxLength={18} />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default App;
