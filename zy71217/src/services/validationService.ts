import { Redemption, ValidationResult, ValidationError, ProcessingConclusion } from '../types';

export function detectAnomalies(
  redemption: Redemption,
  allRedemptions: Redemption[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (redemption.currentBalance < 0) {
    errors.push({
      code: 'NEGATIVE_BALANCE',
      message: `余额为负: ${redemption.currentBalance.toFixed(2)}元`,
      severity: 'error',
      field: 'currentBalance',
      ruleExplanation: '兑付余额不能为负数，请核实消费流水和初始余额是否正确',
      calculationProcess: `当前余额计算结果为 ${redemption.currentBalance.toFixed(2)} < 0`
    });
  }

  const duplicates = allRedemptions.filter(
    r => r.cardNumber === redemption.cardNumber && r.id !== redemption.id
  );
  if (duplicates.length > 0) {
    errors.push({
      code: 'DUPLICATE_REGISTRATION',
      message: `该卡号已存在 ${duplicates.length} 条登记记录`,
      severity: 'error',
      field: 'cardNumber',
      ruleExplanation: '同一会员卡不允许重复登记，请合并记录或删除重复项',
      calculationProcess: `卡号 ${redemption.cardNumber} 匹配到 ${duplicates.length} 条已有记录`
    });
  }

  if (redemption.hasDispute && !redemption.isFrozen) {
    warnings.push({
      code: 'DISPUTE_NOT_FROZEN',
      message: '存在争议但未冻结兑付',
      severity: 'warning',
      field: 'isFrozen',
      ruleExplanation: '存在争议的兑付记录应先冻结，待争议解决后再继续处理'
    });
  }

  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(redemption.phone)) {
    warnings.push({
      code: 'INVALID_PHONE',
      message: '手机号格式可能不正确',
      severity: 'warning',
      field: 'phone',
      ruleExplanation: '请确认手机号为11位有效号码'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function generateProcessingConclusion(
  validationResult: ValidationResult
): ProcessingConclusion {
  const { errors, warnings } = validationResult;
  const allIssues = [...errors, ...warnings];

  if (errors.length > 0) {
    return {
      status: 'error',
      title: '存在严重异常，需立即处理',
      description: `检测到 ${errors.length} 个严重问题，${warnings.length} 个警告`,
      suggestions: [
        '优先处理余额为负的异常记录',
        '核实并合并重复登记记录',
        '冻结存在争议的兑付申请',
        '处理完成后重新提交审核'
      ],
      details: allIssues
    };
  }

  if (warnings.length > 0) {
    return {
      status: 'warning',
      title: '存在警告信息，建议关注',
      description: `检测到 ${warnings.length} 个需要注意的问题`,
      suggestions: [
        '核实警告信息的准确性',
        '根据实际情况决定是否需要处理',
        '确认无误后可继续兑付流程'
      ],
      details: warnings
    };
  }

  return {
    status: 'normal',
    title: '数据正常，可以继续',
    description: '未检测到异常问题',
    suggestions: [
      '确认信息无误后可分配批次',
      '按流程进行后续兑付操作'
    ],
    details: []
  };
}

export const VALIDATION_RULES = {
  NEGATIVE_BALANCE: {
    name: '余额为负检测',
    threshold: 0,
    condition: '当前余额 < 0',
    severity: 'error',
    action: '禁止进入兑付流程，需人工审核'
  },
  DUPLICATE_REGISTRATION: {
    name: '重复登记检测',
    threshold: 1,
    condition: '同一卡号登记记录 > 1',
    severity: 'error',
    action: '提示合并或删除重复记录'
  },
  DISPUTE_NOT_FROZEN: {
    name: '争议冻结检测',
    condition: 'hasDispute = true 且 isFrozen = false',
    severity: 'warning',
    action: '建议冻结兑付直到争议解决'
  },
  IDENTITY_DEDUPLICATION: {
    name: '身份去重规则',
    description: '同一身份证号仅允许登记一张主卡，附属卡需单独验证',
    matchFields: ['idNumber']
  }
};
