import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  Steps,
  Button,
  Tag,
  Space,
  Upload,
  Tabs,
  Table,
  Input,
  Select,
  Form,
  message,
  Modal,
  Typography,
  Statistic,
  Row,
  Col,
  Alert,
  Spin,
  Divider,
  InputNumber,
} from 'antd';
import {
  UploadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  RollbackOutlined,
  ReloadOutlined,
  SearchOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { batchApi } from '../services/api';
import {
  STEPS,
  BATCH_STATUS_TEXT,
  ACTION_TEXT,
  ERROR_TYPE_TEXT,
} from '../utils/constants';

const { Step } = Steps;
const { TextArea } = Input;
const { Text, Title } = Typography;
const { TabPane } = Tabs;

function BatchDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [batchDetail, setBatchDetail] = useState(null);
  const [targetFields, setTargetFields] = useState([]);
  const [sourceColumns, setSourceColumns] = useState([]);
  const [mappingConfig, setMappingConfig] = useState({});
  const [previewRows, setPreviewRows] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [pastedContent, setPastedContent] = useState('');
  const [pastedModalVisible, setPastedModalVisible] = useState(false);
  const [fixModalVisible, setFixModalVisible] = useState(false);
  const [fixingError, setFixingError] = useState(null);
  const [fixValue, setFixValue] = useState('');
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');
  const [activeTab, setActiveTab] = useState('errors');
  const fileInputRef = useRef(null);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const detail = await batchApi.getDetail(id);
      setBatchDetail(detail);
      
      if (detail.batch.batchType) {
        const fields = await batchApi.getFields(detail.batch.batchType);
        setTargetFields(fields);
      }
      
      const status = detail.batch.status;
      const stepIndex = STEPS.findIndex(step => 
        step.validStatuses.includes(status)
      );
      setCurrentStep(stepIndex >= 0 ? stepIndex : 0);
      
      if (detail.batch.mappingConfig) {
        setMappingConfig(JSON.parse(detail.batch.mappingConfig));
      }
      
      if (detail.batch.rawData) {
        const rawData = JSON.parse(detail.batch.rawData);
        setSourceColumns(rawData.headers || []);
        setPreviewRows(rawData.rows.slice(0, 10));
      }
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadDetail();
    }
  }, [id]);

  const handleFileUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      setLoading(true);
      const result = await batchApi.upload(id, formData);
      setSourceColumns(result.sourceColumns);
      setPreviewRows(result.previewRows);
      message.success('文件上传成功');
      loadDetail();
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
    return false;
  };

  const handlePastedUpload = async () => {
    if (!pastedContent.trim()) {
      message.warning('请输入要粘贴的内容');
      return;
    }
    
    try {
      setLoading(true);
      const result = await batchApi.uploadPasted(id, pastedContent);
      setSourceColumns(result.sourceColumns);
      setPreviewRows(result.previewRows);
      setPastedModalVisible(false);
      setPastedContent('');
      message.success('数据粘贴成功');
      loadDetail();
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (targetField, sourceColumn) => {
    const newConfig = { ...mappingConfig };
    if (sourceColumn) {
      newConfig[targetField] = sourceColumn;
    } else {
      delete newConfig[targetField];
    }
    setMappingConfig(newConfig);
  };

  const handleSaveMapping = async () => {
    try {
      setLoading(true);
      await batchApi.configureMapping(id, mappingConfig);
      message.success('字段映射保存成功');
      loadDetail();
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrecheck = async () => {
    try {
      setLoading(true);
      const result = await batchApi.precheck(id);
      if (result.precheckResult.success) {
        message.success('预检通过');
      } else {
        message.warning(`预检发现 ${result.precheckResult.errors.length} 个错误`);
      }
      loadDetail();
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFixError = () => {
    if (!fixingError) return;
    setFixModalVisible(true);
    setFixValue(fixingError.rawValue || '');
  };

  const submitFixError = async () => {
    if (!fixingError) return;
    try {
      setLoading(true);
      await batchApi.fixError(id, fixingError.id, fixValue);
      message.success('修正成功，建议重新执行预检');
      setFixModalVisible(false);
      setFixingError(null);
      setFixValue('');
      loadDetail();
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTrialImport = async () => {
    Modal.confirm({
      title: '执行试导入',
      content: '试导入不会真正落库，只会预览即将导入的数据。继续吗？',
      onOk: async () => {
        try {
          setLoading(true);
          const result = await batchApi.trialImport(id);
          message.success(`试导入完成，预计导入 ${result.trialReport.willImportRows} 条记录`);
          loadDetail();
        } catch (error) {
          message.error(error.message);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleConfirmImport = async () => {
    Modal.confirm({
      title: '确认导入',
      content: '确认后数据将正式落库。已确认的批次可以回滚，但回滚只会生成补偿记录，不会直接删除历史数据。是否继续？',
      okText: '确认导入',
      okType: 'danger',
      onOk: async () => {
        try {
          setLoading(true);
          const result = await batchApi.confirm(id);
          message.success(`导入完成，成功 ${result.finalReport.successRows} 条，失败 ${result.finalReport.failedRows} 条`);
          loadDetail();
        } catch (error) {
          message.error(error.message);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleRollback = async () => {
    if (!rollbackReason.trim()) {
      message.warning('请输入回滚原因');
      return;
    }
    
    try {
      setLoading(true);
      const result = await batchApi.rollback(id, rollbackReason);
      message.success(`回滚完成，生成 ${result.compensationCount} 条补偿记录`);
      setRollbackModalVisible(false);
      setRollbackReason('');
      loadDetail();
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStepStatus = (index) => {
    if (index < currentStep) return 'finish';
    if (index === currentStep) return 'process';
    return 'wait';
  };

  const canProceedTo = (stepIndex) => {
    return currentStep >= stepIndex;
  };

  if (loading && !batchDetail) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!batchDetail) {
    return (
      <Card>
        <Alert type="error" message="批次不存在" />
      </Card>
    );
  }

  const { batch, timelines, errors, importedRecords, compensationRecords } = batchDetail;

  const precheckErrors = errors.filter(e => e.stage === 'precheck');
  const unfixedErrors = precheckErrors.filter(e => !e.isFixed);

  const precheckReport = batch.precheckReport ? JSON.parse(batch.precheckReport) : null;
  const trialReport = batch.trialImportReport ? JSON.parse(batch.trialImportReport) : null;
  const finalReport = batch.finalReport ? JSON.parse(batch.finalReport) : null;

  const errorColumns = [
    {
      title: '行号',
      dataIndex: 'rowIndex',
      key: 'rowIndex',
      width: 80,
    },
    {
      title: '错误类型',
      dataIndex: 'errorType',
      key: 'errorType',
      width: 120,
      render: (type) => (
        <Tag color="red">{ERROR_TYPE_TEXT[type] || type}</Tag>
      ),
    },
    {
      title: '字段',
      dataIndex: 'fieldName',
      key: 'fieldName',
      width: 120,
      render: (field) => field || '-',
    },
    {
      title: '错误信息',
      dataIndex: 'errorMessage',
      key: 'errorMessage',
    },
    {
      title: '原始值',
      dataIndex: 'rawValue',
      key: 'rawValue',
      width: 150,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'isFixed',
      key: 'isFixed',
      width: 80,
      render: (fixed) => (
        <Tag color={fixed ? 'green' : 'red'}>
          {fixed ? '已修正' : '待修正'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        !record.isFixed && batch.status === 'precheck_failed' ? (
          <Button
            type="link"
            size="small"
            onClick={() => {
              setFixingError(record);
              handleFixError();
            }}
          >
            修正
          </Button>
        ) : null
      ),
    },
  ];

  const timelineItems = timelines.map((tl, idx) => (
    <div
      key={idx}
      className={`timeline-item ${tl.status}`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Text strong>{ACTION_TEXT[tl.action] || tl.action}</Text>
          <Tag color={tl.status === 'success' ? 'green' : tl.status === 'failed' ? 'red' : 'gold'}>
            {tl.status === 'success' ? '成功' : tl.status === 'failed' ? '失败' : '部分成功'}
          </Tag>
        </Space>
        <Text type="secondary">{dayjs(tl.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Text>
      </div>
      <div style={{ marginTop: 4 }}>
        <Text type="secondary">{tl.remark}</Text>
      </div>
      <div style={{ marginTop: 4 }}>
        <Space size="middle">
          <Text>处理: {tl.processedCount}</Text>
          <Text style={{ color: '#52c41a' }}>成功: {tl.successCount}</Text>
          <Text style={{ color: '#ff4d4f' }}>失败: {tl.errorCount}</Text>
          {tl.operator && <Text>操作人: {tl.operator}</Text>}
        </Space>
      </div>
    </div>
  ));

  return (
    <div>
      <Card className="steps-card" loading={loading}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            {batch.batchName}
          </Title>
          <Tag className={`step-status status-${batch.status}`} color={
            batch.status === 'confirmed' ? 'success' :
            batch.status === 'precheck_passed' ? 'green' :
            batch.status === 'precheck_failed' ? 'red' :
            batch.status === 'rolled_back' ? 'orange' :
            'blue'
          }>
            {BATCH_STATUS_TEXT[batch.status]}
          </Tag>
        </div>
        
        <Steps current={currentStep}>
          {STEPS.map((step, index) => (
            <Step
              key={step.key}
              title={step.title}
              description={step.description}
              status={getStepStatus(index)}
            />
          ))}
        </Steps>
      </Card>

      <Row gutter={16}>
        <Col span={18}>
          <Card title="导入流程" style={{ marginBottom: 16 }}>
            <Tabs activeKey={String(currentStep)} onChange={(k) => {}}>
              <TabPane tab="1. 上传数据" key="0">
                {canProceedTo(0) && (
                  <div>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Upload
                          customRequest={({ file }) => handleFileUpload(file)}
                          showUploadList={false}
                          accept=".csv,.json"
                        >
                          <div className="upload-zone">
                            <UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
                            <div style={{ marginTop: 16 }}>
                              <Text strong>点击上传或拖拽文件到此处</Text>
                            </div>
                            <div style={{ marginTop: 8 }}>
                              <Text type="secondary">支持 CSV 和 JSON 格式</Text>
                            </div>
                          </div>
                        </Upload>
                      </Col>
                      <Col span={12}>
                        <div
                          className="upload-zone"
                          onClick={() => setPastedModalVisible(true)}
                        >
                          <FileTextOutlined style={{ fontSize: 48, color: '#1890ff' }} />
                          <div style={{ marginTop: 16 }}>
                            <Text strong>粘贴数据</Text>
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <Text type="secondary">从 Excel/CSV 复制粘贴内容</Text>
                          </div>
                        </div>
                      </Col>
                    </Row>

                    {sourceColumns.length > 0 && (
                      <div style={{ marginTop: 24 }}>
                        <Title level={5}>数据预览（前10行）</Title>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th style={{ padding: 8, border: '1px solid #ddd', background: '#fafafa' }}>#</th>
                                {sourceColumns.map(col => (
                                  <th key={col} style={{ padding: 8, border: '1px solid #ddd', background: '#fafafa' }}>
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {previewRows.map((row, idx) => (
                                <tr key={idx}>
                                  <td style={{ padding: 8, border: '1px solid #ddd' }}>{idx + 1}</td>
                                  {sourceColumns.map(col => (
                                    <td key={col} style={{ padding: 8, border: '1px solid #ddd' }}>
                                      {row[col]}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabPane>

              <TabPane tab="2. 字段映射" key="1">
                {canProceedTo(1) && (
                  <div>
                    <div className="stats-row">
                      <div className="stat-item">
                        <span className="label">源列数:</span>
                        <span className="value">{sourceColumns.length}</span>
                      </div>
                      <div className="stat-item">
                        <span className="label">目标字段数:</span>
                        <span className="value">{targetFields.length}</span>
                      </div>
                      <div className="stat-item">
                        <span className="label">已配置映射:</span>
                        <span className="value" style={{ color: '#1890ff' }}>
                          {Object.keys(mappingConfig).length}
                        </span>
                      </div>
                    </div>

                    <Divider />

                    <div>
                      {targetFields.map(field => (
                        <div key={field.key} className="mapping-row">
                          <div className="mapping-label">
                            <Space>
                              {field.required && <Tag color="red">必填</Tag>}
                              {field.isUniqueKey && <Tag color="blue">唯一键</Tag>}
                              <Text>{field.label}</Text>
                            </Space>
                          </div>
                          <div className="mapping-select">
                            <Select
                              placeholder={`选择源列映射到"${field.label}"`}
                              style={{ width: 300 }}
                              allowClear
                              value={mappingConfig[field.key] || undefined}
                              onChange={(value) => handleMappingChange(field.key, value)}
                              disabled={['precheck_passed', 'precheck_failed', 'trial_imported', 'confirmed', 'rolled_back'].includes(batch.status)}
                            >
                              {sourceColumns.map(col => (
                                <Select.Option key={col} value={col}>
                                  {col}
                                </Select.Option>
                              ))}
                            </Select>
                            {field.description && (
                              <Text type="secondary" style={{ marginLeft: 16 }}>
                                ({field.description})
                              </Text>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <Divider />

                    {['uploaded', 'mapping_configured'].includes(batch.status) && (
                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        onClick={handleSaveMapping}
                        loading={loading}
                      >
                        保存映射配置
                      </Button>
                    )}
                  </div>
                )}
              </TabPane>

              <TabPane tab="3. 数据预检" key="2">
                {canProceedTo(2) && (
                  <div>
                    {precheckReport && (
                      <div className="report-section">
                        <div className="report-title">预检报告</div>
                        <Row gutter={16}>
                          <Col span={6}>
                            <Statistic
                              title="总行数"
                              value={precheckReport.totalRows}
                            />
                          </Col>
                          <Col span={6}>
                            <Statistic
                              title="有效行数"
                              value={precheckReport.validRows}
                              valueStyle={{ color: '#52c41a' }}
                            />
                          </Col>
                          <Col span={6}>
                            <Statistic
                              title="错误行数"
                              value={precheckReport.errorRows}
                              valueStyle={{ color: '#ff4d4f' }}
                            />
                          </Col>
                          <Col span={6}>
                            <Statistic
                              title="错误总数"
                              value={precheckReport.errors ? precheckReport.errors.length : 0}
                              valueStyle={{ color: '#faad14' }}
                            />
                          </Col>
                        </Row>
                      </div>
                    )}

                    {precheckErrors.length > 0 && (
                      <div>
                        <Title level={5}>错误详情</Title>
                        <Table
                          rowKey="id"
                          columns={errorColumns}
                          dataSource={precheckErrors}
                          pagination={{ pageSize: 10 }}
                          size="small"
                          className="error-table"
                        />
                      </div>
                    )}

                    {batch.status === 'mapping_configured' && (
                      <Button
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        onClick={handlePrecheck}
                        loading={loading}
                      >
                        执行预检
                      </Button>
                    )}

                    {batch.status === 'precheck_failed' && (
                      <Space>
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={handlePrecheck}
                          loading={loading}
                        >
                          重新预检
                        </Button>
                        <Text type="secondary">
                          修正错误后建议重新执行预检
                        </Text>
                      </Space>
                    )}
                  </div>
                )}
              </TabPane>

              <TabPane tab="4. 试导入" key="3">
                {canProceedTo(3) && (
                  <div>
                    {trialReport && (
                      <div className="report-section">
                        <div className="report-title">试导入报告</div>
                        <Row gutter={16}>
                          <Col span={6}>
                            <Statistic
                              title="总行数"
                              value={trialReport.totalRows}
                            />
                          </Col>
                          <Col span={6}>
                            <Statistic
                              title="预计导入"
                              value={trialReport.willImportRows}
                              valueStyle={{ color: '#1890ff' }}
                            />
                          </Col>
                          <Col span={6}>
                            <Statistic
                              title="新增记录"
                              value={trialReport.estimate.newRecords}
                              valueStyle={{ color: '#52c41a' }}
                            />
                          </Col>
                          <Col span={6}>
                            <Statistic
                              title="跳过记录"
                              value={trialReport.estimate.skippedRecords}
                              valueStyle={{ color: '#faad14' }}
                            />
                          </Col>
                        </Row>

                        <Divider />

                        <div>
                          <Title level={5}>预览数据（前10条）</Title>
                          {trialReport.sampleRecords && (
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr>
                                    <th style={{ padding: 8, border: '1px solid #ddd', background: '#fafafa' }}>行号</th>
                                    {targetFields.map(f => (
                                      <th key={f.key} style={{ padding: 8, border: '1px solid #ddd', background: '#fafafa' }}>
                                        {f.label}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {trialReport.sampleRecords.map((record, idx) => (
                                    <tr key={idx}>
                                      <td style={{ padding: 8, border: '1px solid #ddd' }}>
                                        {record.rowIndex}
                                      </td>
                                      {targetFields.map(f => (
                                        <td key={f.key} style={{ padding: 8, border: '1px solid #ddd' }}>
                                          {record.data[f.key]}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {batch.status === 'precheck_passed' && (
                      <Button
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        onClick={handleTrialImport}
                        loading={loading}
                      >
                        执行试导入
                      </Button>
                    )}
                  </div>
                )}
              </TabPane>

              <TabPane tab="5. 确认导入" key="4">
                {canProceedTo(4) && (
                  <div>
                    {finalReport && (
                      <div className="report-section">
                        <div className="report-title">最终导入报告</div>
                        <Row gutter={16}>
                          <Col span={6}>
                            <Statistic
                              title="总行数"
                              value={finalReport.totalRows}
                            />
                          </Col>
                          <Col span={6}>
                            <Statistic
                              title="成功导入"
                              value={finalReport.successRows}
                              valueStyle={{ color: '#52c41a' }}
                            />
                          </Col>
                          <Col span={6}>
                            <Statistic
                              title="导入失败"
                              value={finalReport.failedRows}
                              valueStyle={{ color: '#ff4d4f' }}
                            />
                          </Col>
                          <Col span={6}>
                            <Statistic
                              title="确认人"
                              value={finalReport.operator}
                            />
                          </Col>
                        </Row>

                        <Divider />

                        <div>
                          <Text>导入时间: {dayjs(finalReport.timestamp).format('YYYY-MM-DD HH:mm:ss')}</Text>
                        </div>
                      </div>
                    )}

                    {batch.status === 'trial_imported' && (
                      <Button
                        type="primary"
                        danger
                        icon={<CheckCircleOutlined />}
                        onClick={handleConfirmImport}
                        loading={loading}
                      >
                        确认导入（正式落库）
                      </Button>
                    )}

                    {batch.status === 'confirmed' && (
                      <Button
                        danger
                        icon={<RollbackOutlined />}
                        onClick={() => setRollbackModalVisible(true)}
                      >
                        回滚批次
                      </Button>
                    )}

                    {batch.status === 'rolled_back' && (
                      <Alert
                        type="warning"
                        message={`批次已回滚，回滚原因: ${batch.rollbackReason || '未说明'}`}
                        description={`回滚人: ${batch.rolledBackBy}，回滚时间: ${dayjs(batch.rolledBackAt).format('YYYY-MM-DD HH:mm:ss')}`}
                      />
                    )}
                  </div>
                )}
              </TabPane>
            </Tabs>
          </Card>
        </Col>

        <Col span={6}>
          <Card title="批次信息" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text type="secondary">批次ID:</Text>
                <div style={{ wordBreak: 'break-all' }}>
                  <Text copyable>{batch.id}</Text>
                </div>
              </div>
              <div>
                <Text type="secondary">导入类型:</Text>
                <div>
                  <Tag color={batch.batchType === 'customer' ? 'blue' : 'green'}>
                    {batch.batchType === 'customer' ? '客户导入' : '商品导入'}
                  </Tag>
                </div>
              </div>
              <div>
                <Text type="secondary">当前状态:</Text>
                <div>
                  <Tag className={`step-status status-${batch.status}`}>
                    {BATCH_STATUS_TEXT[batch.status]}
                  </Tag>
                </div>
              </div>
              <div>
                <Text type="secondary">源文件:</Text>
                <div>
                  <Text>{batch.sourceFileName || '-'}</Text>
                </div>
              </div>
              <div>
                <Text type="secondary">上传人:</Text>
                <div>
                  <Text>{batch.uploadedBy || '-'}</Text>
                </div>
              </div>
              <div>
                <Text type="secondary">创建时间:</Text>
                <div>
                  <Text>{dayjs(batch.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Text>
                </div>
              </div>
            </Space>
          </Card>

          <Card title="处理时间线" style={{ marginBottom: 16 }}>
            {timelineItems.length > 0 ? (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {timelineItems}
              </div>
            ) : (
              <Text type="secondary">暂无处理记录</Text>
            )}
          </Card>

          {compensationRecords.length > 0 && (
            <Card title="补偿记录">
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {compensationRecords.map((cr, idx) => (
                  <div key={cr.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
                    <div>
                      <Text strong>补偿类型:</Text>
                      <Tag color="orange" style={{ marginLeft: 8 }}>
                        {cr.compensationType === 'status_change' ? '状态变更' : cr.compensationType}
                      </Tag>
                    </div>
                    <div>
                      <Text type="secondary">原始ID:</Text>
                      <Text style={{ marginLeft: 8 }}>{cr.originalInternalId}</Text>
                    </div>
                    <div>
                      <Text type="secondary">操作人:</Text>
                      <Text style={{ marginLeft: 8 }}>{cr.operator}</Text>
                    </div>
                    <div>
                      <Text type="secondary">原因:</Text>
                      <Text style={{ marginLeft: 8 }}>{cr.reason}</Text>
                    </div>
                    <div>
                      <Text type="secondary">时间:</Text>
                      <Text style={{ marginLeft: 8 }}>{dayjs(cr.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Text>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title="粘贴数据"
        open={pastedModalVisible}
        onCancel={() => setPastedModalVisible(false)}
        onOk={handlePastedUpload}
        okText="上传"
        width={800}
      >
        <div style={{ marginBottom: 16 }}>
          <Alert
            type="info"
            message="支持格式"
            description="粘贴 CSV 格式内容（包含表头）或 JSON 数组格式"
            showIcon
          />
        </div>
        <TextArea
          rows={15}
          placeholder="粘贴数据内容..."
          value={pastedContent}
          onChange={(e) => setPastedContent(e.target.value)}
        />
      </Modal>

      <Modal
        title="修正错误"
        open={fixModalVisible}
        onCancel={() => setFixModalVisible(false)}
        onOk={submitFixError}
        okText="保存修正"
      >
        {fixingError && (
          <div className="fix-modal-content">
            <div style={{ marginBottom: 16 }}>
              <Alert
                type="error"
                message={fixingError.errorMessage}
                description={`行号: ${fixingError.rowIndex}，字段: ${fixingError.fieldName || '-'}`}
                showIcon
              />
            </div>
            
            <Form layout="vertical">
              <Form.Item label="原始值">
                <Input value={fixingError.rawValue || ''} readOnly />
              </Form.Item>
              <Form.Item label="修正后的值" required>
                <Input
                  value={fixValue}
                  onChange={(e) => setFixValue(e.target.value)}
                  placeholder="请输入修正后的值"
                />
              </Form.Item>
            </Form>
            
            <Alert
              type="warning"
              message="修正后需要重新执行预检"
              showIcon
            />
          </div>
        )}
      </Modal>

      <Modal
        title="回滚批次"
        open={rollbackModalVisible}
        onCancel={() => setRollbackModalVisible(false)}
        onOk={handleRollback}
        okText="确认回滚"
        okType="danger"
      >
        <Alert
          type="warning"
          message="回滚说明"
          description="回滚不会直接删除已导入的数据，而是生成补偿记录并将记录状态标记为已归档。历史数据将被保留以便追溯。"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form layout="vertical">
          <Form.Item label="回滚原因" required>
            <TextArea
              rows={4}
              value={rollbackReason}
              onChange={(e) => setRollbackReason(e.target.value)}
              placeholder="请输入回滚原因..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BatchDetail;
