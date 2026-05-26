import type { ScoreRule, GameErrorType } from '@/types';

export const scoreRules: ScoreRule[] = [
  {
    action: 'correct_dispensing',
    points: 100,
    description: '正确配药（无错误）',
    type: 'bonus'
  },
  {
    action: 'dosage_check_correct',
    points: 20,
    description: '剂量核对正确',
    type: 'bonus'
  },
  {
    action: 'contraindication_check_correct',
    points: 20,
    description: '禁忌核对正确',
    type: 'bonus'
  },
  {
    action: 'batch_check_correct',
    points: 20,
    description: '批号核对正确',
    type: 'bonus'
  },
  {
    action: 'early_completion',
    points: 5,
    description: '提前完成处方（每秒）',
    type: 'bonus'
  },
  {
    action: 'dosage_unit_error',
    points: -15,
    description: '剂量单位错误',
    type: 'penalty'
  },
  {
    action: 'dosage_amount_error',
    points: -20,
    description: '剂量数值错误',
    type: 'penalty'
  },
  {
    action: 'contraindication_missed',
    points: -30,
    description: '未拦截禁忌',
    type: 'penalty'
  },
  {
    action: 'drug_interaction_missed',
    points: -25,
    description: '未发现药物相互作用',
    type: 'penalty'
  },
  {
    action: 'batch_expired_missed',
    points: -30,
    description: '批号过期未发现',
    type: 'penalty'
  },
  {
    action: 'wrong_medicine',
    points: -40,
    description: '选错药品',
    type: 'penalty'
  },
  {
    action: 'prescription_timeout',
    points: -50,
    description: '单张处方超时',
    type: 'penalty'
  },
  {
    action: 'total_timeout',
    points: -100,
    description: '总超时',
    type: 'penalty'
  },
  {
    action: 'repeated_operation',
    points: -5,
    description: '重复操作（来回拖拽）',
    type: 'penalty'
  },
  {
    action: 'unchecked_confirm',
    points: -50,
    description: '未核对就确认',
    type: 'penalty'
  },
  {
    action: 'correct_reject_bonus',
    points: 80,
    description: '正确拦截问题处方',
    type: 'bonus'
  },
  {
    action: 'wrong_reject_penalty',
    points: -30,
    description: '误判正常处方为问题处方',
    type: 'penalty'
  },
  {
    action: 'unintercepted_error',
    points: -40,
    description: '未拦截问题处方',
    type: 'penalty'
  }
];

export const errorTypeToRule: Record<GameErrorType, string> = {
  dosage_unit: 'dosage_unit_error',
  dosage_amount: 'dosage_amount_error',
  contraindication: 'unintercepted_error',
  drug_interaction: 'drug_interaction_missed',
  batch_expired: 'batch_expired_missed',
  wrong_medicine: 'wrong_medicine',
  timeout: 'prescription_timeout',
  unchecked_confirm: 'unchecked_confirm',
  repeated_operation: 'repeated_operation',
  dosage: 'dosage_amount_error',
  batch: 'batch_expired_missed',
  correct_reject: 'correct_reject_bonus',
  wrong_reject: 'wrong_reject_penalty'
};

export const getPointsByErrorType = (errorType: GameErrorType): number => {
  const ruleKey = errorTypeToRule[errorType];
  const rule = scoreRules.find(r => r.action === ruleKey);
  return rule?.points || 0;
};

export const getErrorDescription = (errorType: GameErrorType): string => {
  const ruleKey = errorTypeToRule[errorType];
  const rule = scoreRules.find(r => r.action === ruleKey);
  return rule?.description || '未知错误';
};

export const calculateStarRating = (score: number, maxScore: number): number => {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 90) return 3;
  if (percentage >= 75) return 2;
  if (percentage >= 60) return 1;
  return 0;
};

export const getBonusPoints = (action: string): number => {
  const rule = scoreRules.find(r => r.action === action && r.type === 'bonus');
  return rule?.points || 0;
};

export const getPenaltyPoints = (action: string): number => {
  const rule = scoreRules.find(r => r.action === action && r.type === 'penalty');
  return rule?.points || 0;
};
