import type { ClaimRecord } from '../types/claim';

export const mockRecords: ClaimRecord[] = [
  {
    id: 'REC-001',
    userId: 'U10086',
    userName: '张三',
    materialType: '医疗费用理赔',
    submitTime: '2026-06-01 09:30:00',
    status: 'completed',
    resultType: 'success',
    finalConclusion: '理赔材料完整，同意赔付金额 12,500 元',

    manualJudgment: {
      importedAt: '2026-06-02 10:00:00',
      operator: '李审核',
      conclusion: '材料齐全，金额核对无误，同意赔付',
      evidences: [
        {
          id: 'E-M-001',
          source: 'manual_judgment',
          field: '材料完整性',
          value: '完整（发票、诊断证明、费用清单均齐全）',
          timestamp: '2026-06-02 10:05:00',
          operator: '李审核',
          remark: '纸质材料扫描件已核验',
        },
        {
          id: 'E-M-002',
          source: 'manual_judgment',
          field: '理赔金额',
          value: '12,500 元',
          timestamp: '2026-06-02 10:08:00',
          operator: '李审核',
          remark: '社保报销后自付部分',
        },
        {
          id: 'E-M-003',
          source: 'manual_judgment',
          field: '保险责任',
          value: '在保障范围内',
          timestamp: '2026-06-02 10:10:00',
          operator: '李审核',
        },
      ],
    },

    promptVersion: {
      reviewedAt: '2026-06-03 14:00:00',
      operator: '小孟',
      version: 'v2.3.1',
      conclusion: '材料齐全，金额核对无误，同意赔付',
      isOldCriteria: false,
      evidences: [
        {
          id: 'E-P-001',
          source: 'prompt_version',
          field: '材料完整性',
          value: '完整（发票、诊断证明、费用清单均齐全）',
          timestamp: '2026-06-03 14:05:00',
          operator: '小孟',
          remark: '现场说法提取结果与人工一致',
        },
        {
          id: 'E-P-002',
          source: 'prompt_version',
          field: '理赔金额',
          value: '12,500 元',
          timestamp: '2026-06-03 14:07:00',
          operator: '小孟',
        },
        {
          id: 'E-P-003',
          source: 'prompt_version',
          field: '保险责任',
          value: '在保障范围内',
          timestamp: '2026-06-03 14:09:00',
          operator: '小孟',
        },
      ],
    },

    timeline: [
      {
        id: 'T-001',
        timestamp: '2026-06-01 09:30:00',
        operator: '系统',
        action: '用户提交材料',
        description: '张三提交医疗费用理赔申请',
      },
      {
        id: 'T-002',
        timestamp: '2026-06-02 10:00:00',
        operator: '李审核',
        action: '导入人工改判表',
        description: '完成人工审核，录入改判结果',
        source: 'manual_judgment',
      },
      {
        id: 'T-003',
        timestamp: '2026-06-03 14:00:00',
        operator: '小孟',
        action: '补看提示词版本号',
        description: '现场说法提取结果核对完成',
        source: 'prompt_version',
      },
      {
        id: 'T-004',
        timestamp: '2026-06-03 14:10:00',
        operator: '系统',
        action: '证据回放更新',
        description: '两边证据一致，自动标记为顺利通过',
      },
    ],
  },

  {
    id: 'REC-002',
    userId: 'U10099',
    userName: '李四',
    materialType: '意外医疗理赔',
    submitTime: '2026-06-02 11:20:00',
    status: 'pending_verify',
    resultType: 'duplicate',
    isDuplicateUser: true,
    duplicateRecordIds: ['REC-002-DUP'],

    manualJudgment: {
      importedAt: '2026-06-03 09:30:00',
      operator: '王审核',
      conclusion: '材料完整，同意赔付 3,200 元',
      evidences: [
        {
          id: 'E-M-004',
          source: 'manual_judgment',
          field: '材料完整性',
          value: '完整',
          timestamp: '2026-06-03 09:35:00',
          operator: '王审核',
        },
        {
          id: 'E-M-005',
          source: 'manual_judgment',
          field: '理赔金额',
          value: '3,200 元',
          timestamp: '2026-06-03 09:38:00',
          operator: '王审核',
        },
      ],
    },

    promptVersion: {
      reviewedAt: '2026-06-04 10:00:00',
      operator: '小孟',
      version: 'v2.3.1',
      conclusion: '检测到同一用户可能重复提交',
      isOldCriteria: false,
      evidences: [
        {
          id: 'E-P-004',
          source: 'prompt_version',
          field: '重复提交检测',
          value: '发现同用户同事故2次提交记录',
          timestamp: '2026-06-04 10:05:00',
          operator: '小孟',
          remark: 'REC-002 和 REC-002-DUP 事故描述高度相似',
        },
        {
          id: 'E-P-005',
          source: 'prompt_version',
          field: '事故发生时间',
          value: '2026-05-28（两条记录一致）',
          timestamp: '2026-06-04 10:08:00',
          operator: '小孟',
        },
      ],
    },

    timeline: [
      {
        id: 'T-005',
        timestamp: '2026-06-02 11:20:00',
        operator: '系统',
        action: '用户提交材料',
        description: '李四提交意外医疗理赔申请',
      },
      {
        id: 'T-006',
        timestamp: '2026-06-03 09:30:00',
        operator: '王审核',
        action: '导入人工改判表',
        description: '人工审核通过，同意赔付',
        source: 'manual_judgment',
      },
      {
        id: 'T-007',
        timestamp: '2026-06-04 10:00:00',
        operator: '小孟',
        action: '补看提示词版本号',
        description: '发现同一用户疑似重复提交',
        source: 'prompt_version',
      },
      {
        id: 'T-008',
        timestamp: '2026-06-04 10:10:00',
        operator: '系统',
        action: '标记待复核',
        description: '检测到重复计入风险，转标注负责人复核',
      },
    ],
  },

  {
    id: 'REC-003',
    userId: 'U10156',
    userName: '王五',
    materialType: '重疾理赔',
    submitTime: '2026-05-28 16:45:00',
    status: 'conflict',
    resultType: 'old_criteria',

    manualJudgment: {
      importedAt: '2026-06-01 14:00:00',
      operator: '赵审核',
      conclusion: '符合重疾定义，同意全额赔付 50 万元',
      evidences: [
        {
          id: 'E-M-006',
          source: 'manual_judgment',
          field: '重疾认定标准',
          value: '新口径（2026版）：恶性肿瘤-重度',
          timestamp: '2026-06-01 14:10:00',
          operator: '赵审核',
          remark: '按最新重疾险疾病定义规范',
        },
        {
          id: 'E-M-007',
          source: 'manual_judgment',
          field: '赔付金额',
          value: '500,000 元（基本保额全额）',
          timestamp: '2026-06-01 14:15:00',
          operator: '赵审核',
        },
        {
          id: 'E-M-008',
          source: 'manual_judgment',
          field: '病理报告',
          value: '已提交，确认为恶性肿瘤',
          timestamp: '2026-06-01 14:20:00',
          operator: '赵审核',
        },
      ],
    },

    promptVersion: {
      reviewedAt: '2026-06-05 11:00:00',
      operator: '小孟',
      version: 'v1.8.0',
      conclusion: '旧口径下仅符合轻度重疾，按 20% 赔付',
      isOldCriteria: true,
      evidences: [
        {
          id: 'E-P-006',
          source: 'prompt_version',
          field: '重疾认定标准',
          value: '旧口径（2020版）：恶性肿瘤-轻度',
          timestamp: '2026-06-05 11:10:00',
          operator: '小孟',
          remark: '该记录使用旧提示词版本提取',
        },
        {
          id: 'E-P-007',
          source: 'prompt_version',
          field: '赔付金额',
          value: '100,000 元（保额的 20%）',
          timestamp: '2026-06-05 11:15:00',
          operator: '小孟',
        },
        {
          id: 'E-P-008',
          source: 'prompt_version',
          field: '版本说明',
          value: 'v1.8.0 为历史版本，未更新新口径',
          timestamp: '2026-06-05 11:20:00',
          operator: '小孟',
        },
      ],
    },

    conflicts: [
      {
        id: 'C-001',
        field: '重疾认定标准',
        manualValue: '新口径：恶性肿瘤-重度',
        promptValue: '旧口径：恶性肿瘤-轻度',
      },
      {
        id: 'C-002',
        field: '赔付金额',
        manualValue: '500,000 元（全额）',
        promptValue: '100,000 元（20%）',
      },
    ],

    timeline: [
      {
        id: 'T-009',
        timestamp: '2026-05-28 16:45:00',
        operator: '系统',
        action: '用户提交材料',
        description: '王五提交重疾理赔申请',
      },
      {
        id: 'T-010',
        timestamp: '2026-06-01 14:00:00',
        operator: '赵审核',
        action: '导入人工改判表',
        description: '按新口径认定为重疾，同意全额赔付',
        source: 'manual_judgment',
      },
      {
        id: 'T-011',
        timestamp: '2026-06-05 11:00:00',
        operator: '小孟',
        action: '补看提示词版本号',
        description: '补录旧口径数据，发现口径不一致',
        source: 'prompt_version',
      },
      {
        id: 'T-012',
        timestamp: '2026-06-05 11:30:00',
        operator: '系统',
        action: '标记冲突',
        description: '新旧口径存在差异，需小孟确认',
      },
    ],
  },

  {
    id: 'REC-004',
    userId: 'U10200',
    userName: '赵六',
    materialType: '住院津贴理赔',
    submitTime: '2026-06-05 08:30:00',
    status: 'pending_review',

    manualJudgment: {
      importedAt: '2026-06-06 09:00:00',
      operator: '孙审核',
      conclusion: '住院 5 天，津贴 1,500 元',
      evidences: [
        {
          id: 'E-M-009',
          source: 'manual_judgment',
          field: '住院天数',
          value: '5 天',
          timestamp: '2026-06-06 09:05:00',
          operator: '孙审核',
        },
        {
          id: 'E-M-010',
          source: 'manual_judgment',
          field: '津贴标准',
          value: '300 元/天',
          timestamp: '2026-06-06 09:08:00',
          operator: '孙审核',
        },
      ],
    },

    timeline: [
      {
        id: 'T-013',
        timestamp: '2026-06-05 08:30:00',
        operator: '系统',
        action: '用户提交材料',
        description: '赵六提交住院津贴理赔申请',
      },
      {
        id: 'T-014',
        timestamp: '2026-06-06 09:00:00',
        operator: '孙审核',
        action: '导入人工改判表',
        description: '人工审核完成，待补看提示词版本号',
        source: 'manual_judgment',
      },
    ],
  },

  {
    id: 'REC-005',
    userId: 'U10233',
    userName: '钱七',
    materialType: '门诊费用理赔',
    submitTime: '2026-06-06 14:00:00',
    status: 'pending_import',

    timeline: [
      {
        id: 'T-015',
        timestamp: '2026-06-06 14:00:00',
        operator: '系统',
        action: '用户提交材料',
        description: '钱七提交门诊费用理赔申请，待导入人工改判表',
      },
    ],
  },
];
