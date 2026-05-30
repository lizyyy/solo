import React, { useState } from 'react';
import { Card, Table, Tag, Space, Button, Modal, Form, Input, InputNumber, Select, message, Typography, Progress, List } from 'antd';
import {
  Calculator,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowRight,
  Plus,
  Upload,
  FileText,
  Clock,
  Edit3,
} from 'lucide-react';
import { useContractStore, useValidationStore } from '@/store';
import StatusBadge from '@/components/common/StatusBadge';
import ValidationPanel from '@/components/common/ValidationPanel';
import { CalculationStep, RolloverApplication, ForwardContract } from '@/types';
import { formatRate, formatPoints } from '@/utils/formatters';
import { INTEREST_RATES, POINTS_DEVIATION_TOLERANCE } from '@/utils/constants';

const { Title, Text, Paragraph } = Typography;

const PointsCalc: React.FC = () => {
  const { contracts, rolloverApps, supplementApplication, loading } = useContractStore();
  const { pointsValidation, getErrorsByType, loading: validationLoading } = useValidationStore();

  const [supplementModalVisible, setSupplementModalVisible] = useState(false);
  const [selectedApp, setSelectedApp] = useState<RolloverApplication | null>(null);
  const [form] = Form.useForm();

  const pointsErrors = getErrorsByType('points');

  const getOriginalContract = (app: RolloverApplication): ForwardContract | undefined => {
    return contracts.find((c) => c.id === app.originalContractId);
  };

  const getNewContract = (app: RolloverApplication): ForwardContract | undefined => {
    return app.newContractId ? contracts.find((c) => c.id === app.newContractId) : undefined;
  };

  const getValidationResult = (appId: string) => {
    return pointsValidation.find((r) => r.applicationId === appId);
  };

  const handleSupplement = (app: RolloverApplication) => {
    setSelectedApp(app);
    form.setFieldsValue({
      spotRate: app.spotRate,
      swapPoints: app.swapPoints,
      spotRateMaterial: app.spotRateMaterial,
    });
    setSupplementModalVisible(true);
  };

  const handleSupplementSubmit = async (values: Record<string, any>) => {
    if (!selectedApp) return;

    try {
      await supplementApplication(
        selectedApp.id,
        {
          spotRate: values.spotRate,
          swapPoints: values.swapPoints,
          spotRateMaterial: values.spotRateMaterial,
          hasSupplementalData: true,
        },
        '补录即期汇率和掉期点数',
        '管理员'
      );
      message.success('补录成功，已记录操作历史');
      setSupplementModalVisible(false);
    } catch (error) {
      message.error('补录失败：' + (error as Error).message);
    }
  };

  const renderCalculationSteps = (steps: CalculationStep[]) => {
    return (
      <div className="space-y-3">
        {steps.map((step) => (
          <div
            key={step.stepNo}
            className={`p-4 rounded-lg border transition-all ${
              step.isError
                ? 'bg-red-50 border-red-200'
                : 'bg-gray-50 border-gray-200 hover:border-primary-300'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step.isError
                      ? 'bg-error text-white'
                      : 'bg-primary-100 text-primary-700'
                  }`}
                >
                  {step.stepNo}
                </div>
                <span className="font-medium text-gray-700">{step.description}</span>
              </div>
              <div className="flex items-center gap-2">
                <Tag color={step.isError ? 'error' : 'blue'} className="m-0">
                  影响 {step.impact}%
                </Tag>
                {step.isError ? (
                  <XCircle size={16} className="text-error" />
                ) : (
                  <CheckCircle size={16} className="text-success" />
                )}
              </div>
            </div>

            <div className="bg-white rounded p-3 mb-2 border border-dashed border-gray-300">
              <Text type="secondary" className="text-xs">
                计算公式：
              </Text>
              <Text code className="ml-2 font-mono text-sm">
                {step.formula}
              </Text>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Text type="secondary">输入：</Text>
                <Text className="ml-1 font-mono">
                  {typeof step.input === 'object'
                    ? JSON.stringify(step.input)
                    : String(step.input)}
                </Text>
              </div>
              <div>
                <Text type="secondary">输出：</Text>
                <Text
                  className={`ml-1 font-mono font-bold ${
                    step.isError ? 'text-error' : 'text-success'
                  }`}
                >
                  {step.output.toFixed(6)}
                </Text>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const expandedRowRender = (record: RolloverApplication) => {
    const validation = getValidationResult(record.id);
    const originalContract = getOriginalContract(record);
    const newContract = getNewContract(record);

    return (
      <div className="bg-gray-50 -mx-4 -my-4 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <Title level={5} className="mb-4">
              <Calculator size={16} className="inline mr-2" />
              计算过程拆解
            </Title>
            {validation?.calculationSteps && validation.calculationSteps.length > 0 ? (
              renderCalculationSteps(validation.calculationSteps)
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Calculator size={48} className="mx-auto mb-3 opacity-30" />
                <p>即期汇率尚未补录，无法进行完整计算</p>
                <Button
                  type="primary"
                  size="small"
                  className="mt-3"
                  icon={<Plus size={14} />}
                  onClick={() => handleSupplement(record)}
                >
                  补录数据
                </Button>
              </div>
            )}

            {validation && (
              <div className="mt-4 p-4 bg-white rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">点数方向校验</span>
                  <StatusBadge
                    status={validation.directionCorrect ? 'pass' : 'error'}
                  />
                </div>
                {!validation.directionCorrect && (
                  <Paragraph className="text-sm text-error mb-0">
                    <AlertTriangle size={12} className="inline mr-1" />
                    点数方向错误，请根据利率平价理论核实
                  </Paragraph>
                )}
                <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                  {originalContract &&
                    originalContract.currencyPair.split('/').map((currency) => (
                      <div key={currency}>
                        <Text type="secondary">{currency}利率：</Text>
                        <Text className="font-mono">
                          {(INTEREST_RATES[currency] * 100).toFixed(2)}%
                        </Text>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <Title level={5} className="mb-4">
              <ArrowRight size={16} className="inline mr-2" />
              影响分析
            </Title>

            <div className="space-y-4">
              <div className="p-4 bg-white rounded-lg border">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">计算值</span>
                  <span className="text-xl font-mono font-bold text-primary-700">
                    {validation ? formatPoints(validation.calculatedPoints) : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">申报值</span>
                  <span className="text-xl font-mono font-bold text-gray-700">
                    {formatPoints(record.rolloverPoints)}
                  </span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">偏差</span>
                    <span
                      className={`text-lg font-mono font-bold ${
                        validation && validation.deviation > POINTS_DEVIATION_TOLERANCE
                          ? 'text-error'
                          : 'text-success'
                      }`}
                    >
                      {validation ? `${validation.deviation.toFixed(0)}bp` : '-'}
                    </span>
                  </div>
                  <Progress
                    percent={
                      validation
                        ? Math.min(100, (validation.deviation / POINTS_DEVIATION_TOLERANCE) * 100)
                        : 0
                    }
                    size="small"
                    strokeColor={
                      validation && validation.deviation > POINTS_DEVIATION_TOLERANCE
                        ? '#DC2626'
                        : '#059669'
                    }
                    showInfo={false}
                    className="mt-2"
                  />
                  <Text type="secondary" className="text-xs">
                    容差 ±{POINTS_DEVIATION_TOLERANCE}bp
                  </Text>
                </div>
              </div>

              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  本计算对最终结果的影响权重
                </div>
                <div className="text-3xl font-bold text-primary-700 mb-1">
                  35%
                </div>
                <div className="text-xs text-gray-500">
                  点数方向正确性 20% + 点数计算准确性 15%
                </div>
              </div>

              {originalContract && newContract && (
                <div className="p-4 bg-white rounded-lg border">
                  <Title level={5} className="text-sm mb-3">
                    合约信息对比
                  </Title>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-gray-50 rounded">
                      <Text type="secondary" className="text-xs block mb-1">
                        原合约
                      </Text>
                      <Text strong className="block font-mono">
                        {originalContract.contractNo}
                      </Text>
                      <Text className="text-xs block">
                        {formatRate(originalContract.forwardRate)}
                      </Text>
                    </div>
                    <div className="flex items-center justify-center">
                      <ArrowRight size={20} className="text-gray-400" />
                    </div>
                    <div className="p-2 bg-primary-50 rounded">
                      <Text type="secondary" className="text-xs block mb-1">
                        新合约
                      </Text>
                      <Text strong className="block font-mono">
                        {newContract.contractNo}
                      </Text>
                      <Text className="text-xs block">
                        {formatRate(newContract.forwardRate)}
                      </Text>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-white rounded-lg border">
                <Title level={5} className="text-sm mb-3">
                  <FileText size={14} className="inline mr-1" />
                  材料清单
                </Title>
                <List
                  size="small"
                  dataSource={[
                    { name: '展期申请单', value: record.applicationMaterial },
                    {
                      name: '即期汇率证明',
                      value: record.spotRateMaterial || '待补录',
                      missing: !record.spotRateMaterial,
                    },
                  ]}
                  renderItem={(item) => (
                    <List.Item className="px-0">
                      <Space>
                        {item.missing ? (
                          <Clock size={14} className="text-warning" />
                        ) : (
                          <CheckCircle size={14} className="text-success" />
                        )}
                        <Text type="secondary">{item.name}：</Text>
                        <Text className={item.missing ? 'text-warning' : ''}>
                          {item.value}
                        </Text>
                      </Space>
                    </List.Item>
                  )}
                />
                {!record.hasSupplementalData && (
                  <Button
                    type="primary"
                    size="small"
                    block
                    className="mt-3"
                    icon={<Upload size={14} />}
                    onClick={() => handleSupplement(record)}
                  >
                    补录材料
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const tableColumns = [
    {
      title: '申请编号',
      dataIndex: 'applicationNo',
      key: 'applicationNo',
      width: 180,
      render: (text: string) => (
        <span className="font-mono font-medium text-primary-700">{text}</span>
      ),
    },
    {
      title: '原合约',
      key: 'originalContract',
      width: 180,
      render: (_: any, record: RolloverApplication) => {
        const contract = getOriginalContract(record);
        return contract ? (
          <span className="font-mono text-sm">{contract.contractNo}</span>
        ) : (
          <Tag color="error">合约不存在</Tag>
        );
      },
    },
    {
      title: '新合约',
      key: 'newContract',
      width: 180,
      render: (_: any, record: RolloverApplication) => {
        const contract = getNewContract(record);
        return contract ? (
          <span className="font-mono text-sm">{contract.contractNo}</span>
        ) : (
          <Tag color="warning">待创建</Tag>
        );
      },
    },
    {
      title: '币种对',
      key: 'currencyPair',
      width: 100,
      render: (_: any, record: RolloverApplication) => {
        const contract = getOriginalContract(record);
        return contract?.currencyPair || '-';
      },
    },
    {
      title: '即期汇率',
      dataIndex: 'spotRate',
      key: 'spotRate',
      width: 120,
      align: 'right' as const,
      render: (value: number) =>
        value > 0 ? (
          <span className="font-mono">{formatRate(value)}</span>
        ) : (
          <Tag color="orange">待补录</Tag>
        ),
    },
    {
      title: '展期点数',
      dataIndex: 'rolloverPoints',
      key: 'rolloverPoints',
      width: 120,
      align: 'right' as const,
      render: (value: number, record: RolloverApplication) => (
        <span
          className={`font-mono font-medium ${
            record.pointsDirection === 'premium' ? 'text-success' : 'text-warning'
          }`}
        >
          {formatPoints(value)}
        </span>
      ),
    },
    {
      title: '方向',
      dataIndex: 'pointsDirection',
      key: 'pointsDirection',
      width: 80,
      render: (value: string) => (
        <Tag color={value === 'premium' ? 'green' : 'orange'} className="m-0">
          {value === 'premium' ? '升水' : '贴水'}
        </Tag>
      ),
    },
    {
      title: '校验结果',
      key: 'validation',
      width: 100,
      render: (_: any, record: RolloverApplication) => {
        const result = getValidationResult(record.id);
        if (!result) return <Tag>待校验</Tag>;
        if (result.errors.some((e) => e.severity === 'error')) {
          return (
            <Space>
              <XCircle size={14} className="text-error" />
              <span className="text-error text-sm">错误</span>
            </Space>
          );
        }
        if (result.errors.some((e) => e.severity === 'warning')) {
          return (
            <Space>
              <AlertTriangle size={14} className="text-warning" />
              <span className="text-warning text-sm">警告</span>
            </Space>
          );
        }
        return (
          <Space>
            <CheckCircle size={14} className="text-success" />
            <span className="text-success text-sm">通过</span>
          </Space>
        );
      },
    },
    {
      title: '材料状态',
      key: 'materialStatus',
      width: 100,
      render: (_: any, record: RolloverApplication) => (
        <Tag color={record.hasSupplementalData ? 'green' : 'orange'} className="m-0">
          {record.hasSupplementalData ? '齐全' : '待补录'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: RolloverApplication) => (
        <Button
          type="link"
          size="small"
          icon={<Edit3 size={14} />}
          onClick={() => handleSupplement(record)}
        >
          补录
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card
        title={
          <div className="flex items-center gap-3">
            <Calculator size={20} className="text-primary-700" />
            <span className="font-semibold">点数计算校验</span>
            <Tag color="blue">对结果影响权重 35%</Tag>
          </div>
        }
        className="shadow-sm"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-primary-700">{rolloverApps.length}</div>
            <div className="text-sm text-gray-600">展期申请数</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-success">
              {pointsValidation.filter((r) => r.directionCorrect).length}
            </div>
            <div className="text-sm text-gray-600">方向正确</div>
          </div>
          <div className="p-4 bg-red-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-error">
              {pointsErrors.filter((e) => e.severity === 'error').length}
            </div>
            <div className="text-sm text-gray-600">计算错误</div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-warning">
              {rolloverApps.filter((a) => !a.hasSupplementalData).length}
            </div>
            <div className="text-sm text-gray-600">待补录</div>
          </div>
        </div>

        <Table
          columns={tableColumns}
          dataSource={rolloverApps}
          rowKey="id"
          loading={loading}
          expandable={{ expandedRowRender }}
          scroll={{ x: 1300 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      <ValidationPanel errors={pointsErrors} loading={validationLoading} />

      <Modal
        title={
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-primary-600" />
            补录展期点数数据
          </div>
        }
        open={supplementModalVisible}
        onCancel={() => setSupplementModalVisible(false)}
        footer={null}
        width={500}
      >
        {selectedApp && (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSupplementSubmit}
          >
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <Clock size={14} className="inline mr-1" />
              补录数据将与原有判断合并，不会覆盖历史校验结果
            </div>

            <div className="mb-4">
              <Text type="secondary">展期申请：</Text>
              <Text strong className="ml-2 font-mono">
                {selectedApp.applicationNo}
              </Text>
            </div>

            <Form.Item
              label="即期汇率"
              name="spotRate"
              rules={[{ required: true, message: '请输入即期汇率' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                step={0.0001}
                precision={4}
                placeholder="请输入即期汇率，如 7.2000"
              />
            </Form.Item>

            <Form.Item
              label="掉期点数"
              name="swapPoints"
              rules={[{ required: true, message: '请输入掉期点数' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                step={0.0001}
                precision={4}
                placeholder="请输入掉期点数，如 0.0100"
              />
            </Form.Item>

            <Form.Item
              label="点数方向"
              name="pointsDirection"
              initialValue={selectedApp.pointsDirection}
            >
              <Select>
                <Select.Option value="premium">升水</Select.Option>
                <Select.Option value="discount">贴水</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="即期汇率证明材料"
              name="spotRateMaterial"
              rules={[{ required: true, message: '请上传即期汇率证明材料' }]}
            >
              <Input placeholder="请输入材料文件名，如 外汇牌价-20260410.pdf" />
            </Form.Item>

            <Form.Item className="mb-0">
              <Space className="w-full" style={{ justifyContent: 'flex-end' }}>
                <Button onClick={() => setSupplementModalVisible(false)}>取消</Button>
                <Button type="primary" htmlType="submit">
                  确认补录
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default PointsCalc;
