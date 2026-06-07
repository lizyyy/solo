import { OperationLog, OperationType } from '../types';

export const initialOperations: OperationLog[] = [
  {
    id: 'op001',
    sampleId: 's001',
    operationType: OperationType.IMPORT,
    operator: '阿宁',
    operatorRole: 'AI产品经理',
    operationTime: '2026-06-05 10:30:00',
    description: '导入脱敏规则 V1.2.0',
    reason: '新版本脱敏规则上线，包含人名地名脱敏优化',
    beforeState: { currentStep: 0, status: 'pending' },
    afterState: { currentStep: 1, status: 'pending', desensitizationRule: { version: 'V1.2.0' } },
    affectedSamples: ['s001', 's003']
  },
  {
    id: 'op002',
    sampleId: 's001',
    operationType: OperationType.REVIEW,
    operator: '阿宁',
    operatorRole: 'AI产品经理',
    operationTime: '2026-06-05 14:00:00',
    description: '补看灰度批次信息',
    reason: '完成脱敏规则导入后，核对灰度批次信息',
    beforeState: { currentStep: 1 },
    afterState: { currentStep: 2, grayBatch: { batchNo: 'GRAY-2026-06-001', modelVersion: 'V2.3.1' } },
    affectedSamples: ['s001']
  },
  {
    id: 'op003',
    sampleId: 's001',
    operationType: OperationType.UPDATE,
    operator: '系统',
    operatorRole: '系统',
    operationTime: '2026-06-06 09:15:00',
    description: '产品复盘页更新，样本S001归因完成',
    reason: '无冲突，自动完成归因',
    beforeState: { currentStep: 2, status: 'pending' },
    afterState: { currentStep: 3, status: 'normal' },
    affectedSamples: ['s001']
  },
  {
    id: 'op004',
    sampleId: 's002',
    operationType: OperationType.IMPORT,
    operator: '阿宁',
    operatorRole: 'AI产品经理',
    operationTime: '2026-06-01 16:00:00',
    description: '导入脱敏规则 V1.1.0',
    reason: '旧版本脱敏规则导入',
    beforeState: { currentStep: 0, status: 'pending' },
    afterState: { currentStep: 1, status: 'pending', modelVersion: 'V2.3.0' },
    affectedSamples: ['s002']
  },
  {
    id: 'op005',
    sampleId: 's002',
    operationType: OperationType.REVIEW,
    operator: '阿宁',
    operatorRole: 'AI产品经理',
    operationTime: '2026-06-06 10:00:00',
    description: '补看灰度批次信息，发现版本冲突',
    reason: '灰度批次显示样本属于V2.3.1，但脱敏规则对应V2.3.0',
    beforeState: { currentStep: 1, modelVersion: 'V2.3.0' },
    afterState: { 
      currentStep: 2, 
      status: 'conflict',
      hasConflict: true,
      modelVersion: 'V2.3.1',
      originalModelVersion: 'V2.3.0'
    },
    affectedSamples: ['s002']
  },
  {
    id: 'op006',
    sampleId: 's002',
    operationType: OperationType.SUBMIT_REVIEW,
    operator: '阿宁',
    operatorRole: 'AI产品经理',
    operationTime: '2026-06-06 15:45:00',
    description: '提交运营复核',
    reason: '模型版本冲突，无法自动判定，提交运营复核确认',
    beforeState: { status: 'conflict' },
    afterState: { status: 'pending_review' },
    affectedSamples: ['s002']
  },
  {
    id: 'op007',
    sampleId: 's003',
    operationType: OperationType.IMPORT,
    operator: '阿宁',
    operatorRole: 'AI产品经理',
    operationTime: '2026-06-05 10:30:00',
    description: '导入脱敏规则 V1.2.0',
    reason: '新版本脱敏规则同步到历史样本',
    beforeState: { currentStep: 0, status: 'pending' },
    afterState: { currentStep: 1, status: 'pending' },
    affectedSamples: ['s003']
  },
  {
    id: 'op008',
    sampleId: 's003',
    operationType: OperationType.REVIEW,
    operator: '阿宁',
    operatorRole: 'AI产品经理',
    operationTime: '2026-06-06 10:30:00',
    description: '补看灰度批次信息，确认为灰度补录数据',
    reason: '此样本为5月份灰度批次数据，后期补录',
    beforeState: { currentStep: 1 },
    afterState: { 
      currentStep: 2, 
      grayBatch: { 
        batchNo: 'GRAY-2026-05-008', 
        modelVersion: 'V2.2.5',
        dataSource: '历史数据回扫'
      } 
    },
    affectedSamples: ['s003']
  },
  {
    id: 'op009',
    sampleId: 's003',
    operationType: OperationType.CONFIRM,
    operator: '运营-张姐',
    operatorRole: '运营复核人',
    operationTime: '2026-06-06 11:20:00',
    description: '确认样本S003归因结果',
    reason: '确认为灰度补录的旧口径数据，按V2.2.5模型归因',
    beforeState: { currentStep: 2, status: 'pending' },
    afterState: { 
      currentStep: 3, 
      status: 'confirmed',
      reviewBy: '运营-张姐',
      reviewTime: '2026-06-06 11:20:00',
      decisionRemark: '确认此为灰度补录的旧口径数据，按 V2.2.5 模型归因'
    },
    affectedSamples: ['s003']
  }
];
