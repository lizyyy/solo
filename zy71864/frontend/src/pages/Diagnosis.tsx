import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  Typography,
  Row,
  Col,
  Statistic,
  Progress,
  Steps,
  Empty,
  Alert,
  Divider,
  Popconfirm,
} from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  DownloadOutlined,
  ReloadOutlined,
  HistoryOutlined,
  ClockCircleOutlined,
  ArrowLeftOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { diagnosisApi, evaluationApi, filterApi } from '@/api';
import type {
  DiagnosisBatch,
  DiagnosisResult,
  DiagnosisRequest,
  EvaluationRecord,
  FilterCondition,
  DiagnosisType,
} from '@/types';
import {
  formatDate,
  getDiagnosisTypeLabel,
  getDiagnosisTypeColor,
  getStatusLabel,
  getStatusColor,
  downloadFile,
  getErrorTypeName,
} from '@/utils';
import { useAppStore } from '@/store';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;
const { Option } = Select;

const Diagnosis: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const batchIdFromUrl = searchParams.get('batchId');

  const {
    showError,
    showNotification,
    selectedRecords,
    currentFilter,
    setCurrentFilter,
    currentUser,
    currentBatch,
    setCurrentBatch,
    currentResults,
    setCurrentResults,
    currentSummary,
    setCurrentSummary,
    isReusedBatch,
    setIsReusedBatch,
    resetDiagnosis,
  } = useAppStore();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<DiagnosisBatch[]>([]);
  const [availableRecords, setAvailableRecords] = useState<EvaluationRecord[]>([]);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [selectedFilterId, setSelectedFilterId] = useState<number | undefined>();
  const [batchName, setBatchName] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedResult, setSelectedResult] = useState<DiagnosisResult | null>(null);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    loadBatches();
    loadRecords();
    loadFilters();
  }, []);

  useEffect(() => {
    if (batchIdFromUrl) {
      const batch = batches.find((b) => b.id === Number(batchIdFromUrl));
      if (batch) {
        viewBatchResults(batch);
      }
    }
  }, [batches, batchIdFromUrl]);

  useEffect(() => {
    if (currentFilter) {
      setSelectedFilterId(currentFilter.id);
    }
  }, [currentFilter]);

  const loadBatches = async () => {
    try {
      const response = await diagnosisApi.listBatches({ limit: 50 });
      setBatches(response.data);
    } catch (error: any) {
      showError(error);
    }
  };

  const loadRecords = async () => {
    try {
      const response = await evaluationApi.list({ limit: 200 });
      setAvailableRecords(response.data);
    } catch (error: any) {
      showError(error);
    }
  };

  const loadFilters = async () => {
    try {
      const response = await filterApi.list(currentUser.id);
      setFilters(response.data);
      const current = response.data.find((f) => f.is_current);
      if (current) {
        setCurrentFilter(current);
        setSelectedFilterId(current.id);
      }
    } catch (error: any) {
      showError(error);
    }
  };

  const handleRunDiagnosis = async () => {
    if (selectedRecords.length === 0) {
      showNotification({
        type: 'warning',
        message: '请先选择要诊断的讲评记录',
        suggestion: '请在「讲评记录」页面选择需要诊断的记录',
      });
      return;
    }

    if (!batchName.trim()) {
      showNotification({
        type: 'warning',
        message: '请输入批次名称',
        suggestion: '批次名称用于后续追溯，请填写有意义的名称',
      });
      return;
    }

    setLoading(true);
    try {
      const request: DiagnosisRequest = {
        batch_name: batchName,
        evaluation_record_ids: selectedRecords.map((r) => r.id),
        filter_condition_id: selectedFilterId,
      };

      const response = await diagnosisApi.run(request);

      setCurrentBatch(response.data.batch);
      setCurrentResults(response.data.results);
      setCurrentSummary(response.data.summary);
      setIsReusedBatch(response.data.batch.is_reused || false);
      setStep(2);

      if (response.data.batch.is_reused) {
        showNotification({
          type: 'warning',
          message: '该批材料已诊断过，返回历史记录',
          suggestion: '如需重新诊断，请修改批次名称或使用不同的材料组合',
          contact: '系统管理员',
        });
      } else {
        showNotification({
          type: 'success',
          message: `诊断完成，共处理 ${response.data.summary.total_records} 条记录`,
        });
      }

      loadBatches();
    } catch (error: any) {
      if (error.error_code === 'EMPTY_SET_DETECTED') {
        showError(error);
      } else {
        showError(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const viewBatchResults = async (batch: DiagnosisBatch) => {
    try {
      setLoading(true);
      const [batchRes, resultsRes] = await Promise.all([
        diagnosisApi.getBatch(batch.id),
        diagnosisApi.getBatchResults(batch.id),
      ]);

      setCurrentBatch(batchRes.data);
      setCurrentResults(resultsRes.data);
      setIsReusedBatch(false);

      const summary = calculateSummary(resultsRes.data);
      setCurrentSummary(summary);

      if (batch.filter_condition_id) {
        const filterRes = await filterApi.get(batch.filter_condition_id);
        setCurrentFilter(filterRes.data);
        setSelectedFilterId(filterRes.data.id);
      }

      setStep(2);
    } catch (error: any) {
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (results: DiagnosisResult[]) => {
    const total = results.length;
    const correct = results.filter((r) => r.is_correct).length;
    const equivalent = results.filter((r) => r.is_equivalent).length;
    const incorrect = total - correct;

    const errorTypes: Record<string, number> = {};
    results.forEach((r) => {
      if (!r.is_correct && r.error_type) {
        const name = getErrorTypeName(r.error_type);
        errorTypes[name] = (errorTypes[name] || 0) + 1;
      }
    });

    return {
      total_records: total,
      successfully_diagnosed: total,
      diagnostic_errors: 0,
      correct_count: correct,
      equivalent_count: equivalent,
      incorrect_count: incorrect,
      accuracy_rate: total > 0 ? Math.round((correct / total) * 10000) / 100 : 0,
      error_type_distribution: errorTypes,
      errors: [],
    };
  };

  const handleExport = async () => {
    if (!currentBatch) return;

    try {
      setLoading(true);
      const response = await diagnosisApi.export({
        batch_id: currentBatch.id,
        filter_condition_id: selectedFilterId,
        format: 'xlsx',
      });

      const filename = `诊断结果_${currentBatch.batch_name}_${formatDate(
        new Date(),
        'YYYYMMDDHHmmss'
      )}.xlsx`;
      downloadFile(response.data, filename);

      showNotification({
        type: 'success',
        message: '讲评稿导出成功',
        suggestion: `已使用${selectedFilterId ? '当前' : '默认'}筛选条件导出`,
      });
    } catch (error: any) {
      if (error.error_code === 'FILTER_CONDITION_MISMATCH') {
        showError(error);
      } else {
        showError(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const viewDetail = (result: DiagnosisResult) => {
    setSelectedResult(result);
    setDetailVisible(true);
  };

  const handleBack = () => {
    resetDiagnosis();
    setStep(0);
    setBatchName('');
    setExpandedRowKeys([]);
  };

  const batchColumns = [
    {
      title: '批次名称',
      dataIndex: 'batch_name',
      key: 'batch_name',
      render: (text: string) => <span className="font-medium">{text}</span>,
    },
    {
      title: '诊断数量',
      dataIndex: 'material_count',
      key: 'material_count',
      width: 100,
      render: (count: number) => <span className="font-mono">{count} 条</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
      ),
    },
    {
      title: '正确率',
      key: 'accuracy',
      width: 150,
      render: (_: any, record: DiagnosisBatch) => {
        const batchResults = currentBatch?.id === record.id ? currentResults : [];
        const correct = batchResults.filter((r) => r.is_correct).length;
        const rate = batchResults.length > 0 ? (correct / batchResults.length) * 100 : 0;
        return <Progress percent={Math.round(rate)} size="small" />;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date: string) => formatDate(date, 'YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: DiagnosisBatch) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            disabled={record.status !== 'completed'}
            onClick={() => viewBatchResults(record)}
          >
            查看结果
          </Button>
        </Space>
      ),
    },
  ];

  const resultColumns = [
    {
      title: '学生姓名',
      dataIndex: ['evaluation_record', 'student_name'],
      key: 'student_name',
      width: 100,
    },
    {
      title: '学号',
      dataIndex: ['evaluation_record', 'student_id'],
      key: 'student_id',
      width: 100,
      render: (text: string) => <span className="font-mono">{text}</span>,
    },
    {
      title: '题目编号',
      dataIndex: ['evaluation_record', 'question_no'],
      key: 'question_no',
      width: 100,
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '诊断结果',
      dataIndex: 'diagnosis_type',
      key: 'diagnosis_type',
      width: 120,
      render: (type: DiagnosisType, record: DiagnosisResult) => {
        const color = getDiagnosisTypeColor(type);
        const label = getDiagnosisTypeLabel(type);
        if (record.is_equivalent) {
          return (
            <Tag color="orange">
              <CheckCircleOutlined /> 等价正确
            </Tag>
          );
        }
        return (
          <Tag color={color}>
            {record.is_correct ? (
              <CheckCircleOutlined />
            ) : (
              <CloseCircleOutlined />
            )}{' '}
            {label}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: DiagnosisResult) => (
        <Button type="link" size="small" onClick={() => viewDetail(record)}>
          查看详情
        </Button>
      ),
    },
  ];

  const expandedRowRender = (record: DiagnosisResult) => {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <Row gutter={16}>
          <Col span={12}>
            <div className="mb-2">
              <Text type="secondary">学生答案：</Text>
              <code className="bg-white px-2 py-1 rounded ml-2">
                {record.evaluation_record?.student_answer}
              </code>
            </div>
            <div>
              <Text type="secondary">标准答案：</Text>
              <code className="bg-white px-2 py-1 rounded ml-2">
                {record.question?.standard_answer}
              </code>
            </div>
          </Col>
          <Col span={12}>
            {record.human_readable_error && (
              <Alert
                type="error"
                showIcon
                message={record.human_readable_error}
                description={
                  <div>
                    {record.suggestion && <p className="mb-1">{record.suggestion}</p>}
                    {record.next_action && (
                      <p className="text-gray-600 text-sm">
                        <strong>下一步：</strong>
                        {record.next_action}
                      </p>
                    )}
                    {record.contact_person && (
                      <p className="text-gray-500 text-sm mt-1">
                        联系人：{record.contact_person}
                      </p>
                    )}
                  </div>
                }
              />
            )}
            {record.is_equivalent && (
              <Alert
                type="warning"
                showIcon
                message="匹配到等价答案"
                description={
                  <p>
                    该学生答案与标准答案在数学上等价，系统已自动识别为正确。
                    {record.matched_equivalent && (
                      <span className="block mt-1">
                        匹配规则：
                        <code className="bg-white px-2 py-1 rounded ml-1">
                          {record.matched_equivalent.answer_expression}
                        </code>
                      </span>
                    )}
                  </p>
                }
              />
            )}
          </Col>
        </Row>
      </div>
    );
  };

  return (
    <div className="animate-fadeIn">
      <div className="flex justify-between items-center mb-6">
        <div>
          {step > 0 ? (
            <Button type="link" className="!pl-0" icon={<ArrowLeftOutlined />} onClick={handleBack}>
              返回诊断列表
            </Button>
          ) : null}
          <Title level={3} className="!m-0 !text-primary-900">
            诊断中心
          </Title>
          <Text type="secondary">选择讲评记录进行智能诊断，分析学生答题情况</Text>
        </div>
        {step === 2 && currentBatch && (
          <Space>
            {isReusedBatch && (
              <Tag color="orange" icon={<HistoryOutlined />}>
                复用历史诊断记录
              </Tag>
            )}
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
              loading={loading}
            >
              导讲评稿
            </Button>
          </Space>
        )}
      </div>

      {step === 0 && (
        <>
          <Card className="mb-6">
            <Steps current={step} size="small" className="mb-6">
              <Step title="选择记录" description="在讲评记录页选择要诊断的材料" />
              <Step title="发起诊断" description="命名批次并开始诊断" />
              <Step title="查看结果" description="查看诊断详情和导出讲评稿" />
            </Steps>

            <Row gutter={16} align="middle">
              <Col span={12}>
                <Alert
                  type="info"
                  showIcon
                  message={`已选择 ${selectedRecords.length} 条讲评记录`}
                  description={
                    selectedRecords.length > 0 ? (
                      <div>
                        {selectedRecords.slice(0, 3).map((r) => (
                          <Tag key={r.id}>{r.student_name} - {r.question_no}</Tag>
                        ))}
                        {selectedRecords.length > 3 && (
                          <span className="text-gray-500">等 {selectedRecords.length} 条</span>
                        )}
                      </div>
                    ) : (
                      <span>请先前往「讲评记录」页面选择需要诊断的记录</span>
                    )
                  }
                  action={
                    <Button size="small" onClick={() => navigate('/evaluation-records')}>
                      去选择
                    </Button>
                  }
                />
              </Col>
              <Col span={6}>
                <Input
                  placeholder="输入批次名称"
                  prefix={<ClockCircleOutlined />}
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                />
              </Col>
              <Col span={6}>
                <Button
                  type="primary"
                  size="large"
                  icon={<PlayCircleOutlined />}
                  onClick={handleRunDiagnosis}
                  loading={loading}
                  disabled={selectedRecords.length === 0}
                  block
                >
                  开始诊断
                </Button>
              </Col>
            </Row>

            {currentFilter && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <FilterOutlined className="text-blue-500 mr-2" />
                <span className="text-sm">
                  当前筛选条件：<strong>{currentFilter.condition_name}</strong>
                </span>
              </div>
            )}
          </Card>

          <Card
            title="历史诊断批次"
            className="card-hover"
            extra={<Button icon={<ReloadOutlined />} size="small" onClick={loadBatches}>刷新</Button>}
          >
            <Table
              columns={batchColumns}
              dataSource={batches}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              size="middle"
            />
          </Card>
        </>
      )}

      {step === 2 && currentBatch && currentSummary && (
        <>
          {isReusedBatch && (
            <Alert
              type="warning"
              showIcon
              icon={<HistoryOutlined />}
              message="该批材料已诊断过，系统返回了历史记录"
              description="如果您需要重新诊断，请修改批次名称或使用不同的材料组合。如果是误操作，可以直接使用当前历史记录导出讲评稿。"
              className="mb-4"
              closable
            />
          )}

          <Row gutter={[16, 16]} className="mb-6">
            <Col xs={12} lg={6}>
              <Card className="gradient-card">
                <Statistic
                  title="总记录数"
                  value={currentSummary.total_records}
                  suffix="条"
                  valueStyle={{ color: '#1e3a5f' }}
                />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card className="gradient-card">
                <Statistic
                  title="正确数量"
                  value={currentSummary.correct_count}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#10b981' }}
                />
                <Progress
                  percent={currentSummary.accuracy_rate}
                  strokeColor="#10b981"
                  size="small"
                  showInfo={false}
                  className="mt-2"
                />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card className="gradient-card">
                <Statistic
                  title="等价答案"
                  value={currentSummary.equivalent_count}
                  prefix={<WarningOutlined />}
                  valueStyle={{ color: '#f59e0b' }}
                />
                <Text type="secondary" className="text-xs">
                  自动识别为正确的等价答案
                </Text>
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card className="gradient-card">
                <Statistic
                  title="错误数量"
                  value={currentSummary.incorrect_count}
                  prefix={<CloseCircleOutlined />}
                  valueStyle={{ color: '#ef4444' }}
                />
                <Progress
                  percent={100 - currentSummary.accuracy_rate}
                  strokeColor="#ef4444"
                  size="small"
                  showInfo={false}
                  className="mt-2"
                />
              </Card>
            </Col>
          </Row>

          {Object.keys(currentSummary.error_type_distribution).length > 0 && (
            <Card title="错误类型分布" className="mb-6">
              <Row gutter={[16, 16]}>
                {Object.entries(currentSummary.error_type_distribution).map(([type, count]) => (
                  <Col xs={12} sm={8} md={6} lg={4} key={type}>
                    <div className="p-3 bg-red-50 rounded-lg border border-red-100 text-center">
                      <div className="text-2xl font-bold text-red-600">{count}</div>
                      <div className="text-sm text-gray-600">{type}</div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          )}

          <Card
            title="诊断结果详情"
            className="card-hover"
            extra={
              <Space>
                <Button
                  size="small"
                  onClick={() => setExpandedRowKeys(expandedRowKeys.length > 0 ? [] : currentResults.map((r) => r.id))}
                >
                  {expandedRowKeys.length > 0 ? '收起全部' : '展开全部'}
                </Button>
              </Space>
            }
          >
            <Table
              columns={resultColumns}
              dataSource={currentResults}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              size="middle"
              expandable={{
                expandedRowRender,
                expandedRowKeys,
                onExpandedRowsChange: (keys) => setExpandedRowKeys(keys),
              }}
            />
          </Card>
        </>
      )}

      <Modal
        title="诊断详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {selectedResult && (
          <div>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <Row gutter={16}>
                <Col span={12}>
                  <Text type="secondary" className="block mb-1">学生</Text>
                  <Text strong className="text-lg">
                    {selectedResult.evaluation_record?.student_name}
                  </Text>
                  <Text type="secondary" className="ml-2 font-mono">
                    ({selectedResult.evaluation_record?.student_id})
                  </Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary" className="block mb-1">题目</Text>
                  <Tag color="blue" className="text-base">
                    {selectedResult.evaluation_record?.question_no}
                  </Tag>
                </Col>
              </Row>
            </div>

            <Divider orientation="left">答案对比</Divider>

            <div className="space-y-4 mb-4">
              <div className="flex items-start">
                <span className="w-24 text-gray-500 flex-shrink-0">学生答案：</span>
                <code className="flex-1 bg-blue-50 px-3 py-2 rounded text-sm">
                  {selectedResult.evaluation_record?.student_answer}
                </code>
              </div>
              <div className="flex items-start">
                <span className="w-24 text-gray-500 flex-shrink-0">标准答案：</span>
                <code className="flex-1 bg-green-50 px-3 py-2 rounded text-sm">
                  {selectedResult.question?.standard_answer}
                </code>
              </div>
            </div>

            <Divider orientation="left">诊断结果</Divider>

            {selectedResult.is_correct ? (
              <Alert
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
                message={
                  selectedResult.is_equivalent ? '答案正确（等价答案）' : '答案正确'
                }
                description={
                  selectedResult.is_equivalent &&
                  selectedResult.matched_equivalent ? (
                    <p>
                      匹配到等价答案规则：
                      <code className="bg-white px-2 py-1 rounded ml-1">
                        {selectedResult.matched_equivalent.answer_expression}
                      </code>
                    </p>
                  ) : null
                }
              />
            ) : (
              <Alert
                type="error"
                showIcon
                icon={<CloseCircleOutlined />}
                message={getDiagnosisTypeLabel(selectedResult.diagnosis_type)}
                description={
                  <div className="space-y-2">
                    {selectedResult.human_readable_error && (
                      <p>{selectedResult.human_readable_error}</p>
                    )}
                    {selectedResult.suggestion && (
                      <p className="text-gray-600">
                        <strong>改进建议：</strong>
                        {selectedResult.suggestion}
                      </p>
                    )}
                    {selectedResult.next_action && (
                      <p className="text-gray-600">
                        <strong>下一步操作：</strong>
                        {selectedResult.next_action}
                      </p>
                    )}
                    {selectedResult.contact_person && (
                      <p className="text-gray-500 text-sm">
                        <strong>联系人：</strong>
                        {selectedResult.contact_person}
                      </p>
                    )}
                  </div>
                }
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Diagnosis;
