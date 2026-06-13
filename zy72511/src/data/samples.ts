import { AttributionSample, SampleType, AttributionStatus } from '../types';

export const initialSamples: AttributionSample[] = [
  {
    id: 's001',
    sampleNo: 'S001',
    type: SampleType.NORMAL,
    status: AttributionStatus.NORMAL,
    modelVersion: 'V2.3.1',
    originalText: '今天下午三点，我们在会议室A召开产品评审会议，请相关同事准时参加。',
    transcribedText: '今天下午三点，我们在会议是A召开产品评审回忆，请相关同事准时参加。',
    wrongWords: [
      {
        id: 'w001',
        original: '室',
        transcribed: '是',
        errorType: '同音字',
        confidence: 0.92,
        position: 12
      },
      {
        id: 'w002',
        original: '会议',
        transcribed: '回忆',
        errorType: '同音字',
        confidence: 0.87,
        position: 18
      }
    ],
    desensitizationRule: {
      id: 'dr001',
      version: 'V1.2.0',
      importTime: '2026-06-05 10:30:00',
      importedBy: '阿宁',
      remarks: '正常版本，人名地名脱敏规则更新',
      rules: [
        { type: '人名', pattern: '[张李王][\\u4e00-\\u9fa5]{1,2}', replacement: '[人名]' },
        { type: '地名', pattern: '会议室[A-Z]', replacement: '[地点]' }
      ]
    },
    grayBatch: {
      id: 'gb001',
      batchNo: 'GRAY-2026-06-001',
      modelVersion: 'V2.3.1',
      sampleCount: 500,
      startTime: '2026-06-03 00:00:00',
      endTime: '2026-06-05 23:59:59',
      remarks: 'V2.3.1 正式灰度批次',
      dataSource: '线上流量'
    },
    hasConflict: false,
    createdAt: '2026-06-05 14:20:00',
    updatedAt: '2026-06-06 09:15:00',
    currentStep: 3
  },
  {
    id: 's002',
    sampleNo: 'S002',
    type: SampleType.VERSION_CONFLICT,
    status: AttributionStatus.CONFLICT,
    modelVersion: 'V2.3.1',
    originalModelVersion: 'V2.3.0',
    originalText: '王经理请将下季度的销售报表发送给市场部李总监，抄送财务部。',
    transcribedText: '王经理请将下极度的销售报表发送给市场步李总监，超送财务部。',
    wrongWords: [
      {
        id: 'w003',
        original: '季度',
        transcribed: '极度',
        errorType: '同音字',
        confidence: 0.89,
        position: 6
      },
      {
        id: 'w004',
        original: '市场部',
        transcribed: '市场步',
        errorType: '形近字',
        confidence: 0.76,
        position: 17
      },
      {
        id: 'w005',
        original: '抄',
        transcribed: '超',
        errorType: '同音字',
        confidence: 0.91,
        position: 24
      }
    ],
    desensitizationRule: {
      id: 'dr002',
      version: 'V1.1.0',
      importTime: '2026-06-01 16:00:00',
      importedBy: '阿宁',
      remarks: '旧版本脱敏规则，对应 V2.3.0 模型',
      rules: [
        { type: '人名', pattern: '[张李王][\\u4e00-\\u9fa5]{1,2}', replacement: '[人名]' }
      ]
    },
    grayBatch: {
      id: 'gb002',
      batchNo: 'GRAY-2026-06-002',
      modelVersion: 'V2.3.1',
      sampleCount: 800,
      startTime: '2026-06-04 00:00:00',
      endTime: '2026-06-06 23:59:59',
      remarks: 'V2.3.1 增量灰度，样本编号沿用旧批次',
      dataSource: '线上流量'
    },
    hasConflict: true,
    conflictEvidence: {
      desensitizationClaim: '脱敏规则备注显示此样本对应模型版本为 V2.3.0，导入时间为 2026-06-01',
      grayBatchClaim: '灰度批次信息显示此样本属于 V2.3.1 批次 GRAY-2026-06-002，采集时间为 2026-06-04',
      conflictPoints: [
        '模型版本不一致：脱敏规则 V2.3.0 vs 灰度批次 V2.3.1',
        '样本编号 S002 在两个版本中重复使用',
        '时间线冲突：脱敏规则导入时间早于灰度批次开始时间'
      ]
    },
    createdAt: '2026-06-04 11:30:00',
    updatedAt: '2026-06-06 10:00:00',
    currentStep: 2
  },
  {
    id: 's003',
    sampleNo: 'S003',
    type: SampleType.GRAY_BACKFILL,
    status: AttributionStatus.CONFIRMED,
    modelVersion: 'V2.2.5',
    originalText: '本次用户调研结果显示，超过85%的用户对新功能表示满意。',
    transcribedText: '本次用户调研结果显示，超过85%的用户对工功能表示满意。',
    wrongWords: [
      {
        id: 'w006',
        original: '新',
        transcribed: '工',
        errorType: '形近字',
        confidence: 0.72,
        position: 21
      }
    ],
    desensitizationRule: {
      id: 'dr003',
      version: 'V1.2.0',
      importTime: '2026-06-05 10:30:00',
      importedBy: '阿宁',
      remarks: '最新脱敏规则版本',
      rules: [
        { type: '人名', pattern: '[张李王][\\u4e00-\\u9fa5]{1,2}', replacement: '[人名]' },
        { type: '数字', pattern: '\\d+%', replacement: '[比例]' }
      ]
    },
    grayBatch: {
      id: 'gb003',
      batchNo: 'GRAY-2026-05-008',
      modelVersion: 'V2.2.5',
      sampleCount: 1200,
      startTime: '2026-05-20 00:00:00',
      endTime: '2026-05-27 23:59:59',
      remarks: 'V2.2.5 灰度批次，后期补录数据',
      dataSource: '历史数据回扫'
    },
    hasConflict: false,
    createdAt: '2026-05-22 09:00:00',
    updatedAt: '2026-06-06 11:20:00',
    currentStep: 3,
    reviewBy: '运营-张姐',
    reviewTime: '2026-06-06 11:20:00',
    decisionRemark: '确认此为灰度补录的旧口径数据，按 V2.2.5 模型归因'
  }
];
