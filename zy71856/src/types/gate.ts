import type { TimelineEvent } from './timeline';

export type JudgmentResult = 'pass' | 'fail' | 'pending';
export type GateStepStatus = 'completed' | 'in_progress' | 'pending' | 'skipped' | 'error';

export interface GateStandardStep {
  id: string;
  order: number;
  name: string;
  description: string;
  expectedDuration: number;
  criteria: string[];
  maxScore: number;
}

export interface GateStudentOperation {
  id?: string;
  stepId: string;
  timestamp: number;
  duration: number;
  parameters: Record<string, number>;
  rawData: any;
}

export interface JudgmentReason {
  id: string;
  description: string;
  evidenceRef: string;
  confidence: number;
  parameterName?: string;
  expectedValue?: number;
  actualValue?: number;
}

export interface GateJudgment {
  id: string;
  eventId: string;
  stepId: string;
  result: JudgmentResult;
  score: number;
  maxScore: number;
  teachingReason: string;
  nextStep: string;
  rawReason: string;
  reasons: JudgmentReason[];
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  isFinal: boolean;
}

export interface GateStepResult {
  step: GateStandardStep;
  operation?: GateStudentOperation;
  judgment?: GateJudgment;
  status: GateStepStatus;
  events: TimelineEvent[];
}

export interface GateSession {
  id: string;
  studentName: string;
  startTime: number;
  endTime?: number;
  steps: GateStepResult[];
  totalScore: number;
  maxScore: number;
  isTeachingView: boolean;
  abnormalCount: number;
  pendingCount: number;
}

export interface GateJudgmentConfig {
  passThreshold: number;
  warningThreshold: number;
  parameterTolerances: Record<string, number>;
}

export const JUDGMENT_RESULT_LABELS: Record<JudgmentResult, string> = {
  pass: '通过',
  fail: '未通过',
  pending: '待确认'
};

export const GATE_STEP_STATUS_LABELS: Record<GateStepStatus, string> = {
  completed: '已完成',
  in_progress: '进行中',
  pending: '待执行',
  skipped: '已跳过',
  error: '异常'
};

export const DEFAULT_JUDGMENT_CONFIG: GateJudgmentConfig = {
  passThreshold: 60,
  warningThreshold: 80,
  parameterTolerances: {
    opening: 5,
    speed: 10,
    duration: 15
  }
};

export const GATE_STANDARD_STEPS: GateStandardStep[] = [
  {
    id: 'step-1',
    order: 1,
    name: '开机检查',
    description: '检查闸门控制系统电源、指示灯、通讯状态',
    expectedDuration: 60,
    criteria: ['电源指示灯亮', '通讯正常', '无告警信息'],
    maxScore: 10
  },
  {
    id: 'step-2',
    order: 2,
    name: '参数设置',
    description: '设置闸门开启高度、运行速度等参数',
    expectedDuration: 90,
    criteria: ['开启高度正确', '运行速度合理', '参数确认无误'],
    maxScore: 15
  },
  {
    id: 'step-3',
    order: 3,
    name: '手动操作',
    description: '通过手动控制方式操作闸门升降',
    expectedDuration: 120,
    criteria: ['操作顺序正确', '运行平稳', '到位准确'],
    maxScore: 25
  },
  {
    id: 'step-4',
    order: 4,
    name: '自动运行',
    description: '切换至自动模式，观察闸门自动运行过程',
    expectedDuration: 180,
    criteria: ['模式切换正确', '自动逻辑正常', '保护功能有效'],
    maxScore: 25
  },
  {
    id: 'step-5',
    order: 5,
    name: '故障处理',
    description: '模拟故障场景，考核应急处理能力',
    expectedDuration: 120,
    criteria: ['故障识别准确', '处理流程正确', '恢复时间合理'],
    maxScore: 15
  },
  {
    id: 'step-6',
    order: 6,
    name: '关机整理',
    description: '规范关机，整理现场，填写记录',
    expectedDuration: 60,
    criteria: ['关机顺序正确', '现场整洁', '记录完整'],
    maxScore: 10
  }
];
