import { Redemption, Identification, ValidationResult, ValidationError, ValidationWarning, ProcessingConclusion } from '../types';

export function detectAnomalies(
  redemption: Redemption,
  allRedemptions: Redemption[],
  allIdentifications: Identification[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

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

  const currentId = allIdentifications.find(id => id.id === redemption.identityId);
  if (currentId && currentId.idType === 'id_card' && currentId.idNumber) {
    const sameIdRedemptions = allRedemptions.filter(r => {
      if (r.id === redemption.id) return false;
      const id = allIdentifications.find(ident => ident.id === r.identityId);
      return id && id.idType === 'id_card' && id.idNumber === currentId.idNumber;
    });

    if (sameIdRedemptions.length > 0) {
      const duplicateCardNumbers = sameIdRedemptions.map(r => r.cardNumber).join('、');
      errors.push({
        code: 'DUPLICATE_IDENTITY',
        message: `该身份证已登记 ${sameIdRedemptions.length} 张卡: ${duplicateCardNumbers}`,
        severity: 'error',
        field: 'identityId',
        ruleExplanation: '同一身份证号仅允许登记一张主卡，附属卡需单独验证并标注',
        calculationProcess: `身份证号 ${currentId.idNumber} 匹配到 ${sameIdRedemptions.length} 条已有登记记录`
      });
    }
  }

  if (currentId && currentId.verificationStatus === 'rejected') {
    warnings.push({
      code: 'IDENTITY_REJECTED',
      message: '身份验证未通过，需重新提交有效证件',
      severity: 'warning',
      field: 'identityId',
      ruleExplanation: '身份验证失败的记录应暂停兑付流程，待重新验证通过后继续'
    });
  }

  if (currentId && currentId.verificationStatus === 'pending') {
    warnings.push({
      code: 'IDENTITY_PENDING',
      message: '身份验证待完成，建议先完成验证再进行兑付',
      severity: 'info',
      field: 'identityId',
      ruleExplanation: '未完成身份验证的记录存在合规风险，建议优先完成验证'
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
  const errorCodes = errors.map(e => e.code);
  const warningCodes = warnings.map(w => w.code);

  const suggestions: string[] = [];

  if (errorCodes.includes('NEGATIVE_BALANCE')) {
    suggestions.push('优先处理余额为负的异常记录，核实消费流水和初始余额');
  }
  if (errorCodes.includes('DUPLICATE_REGISTRATION')) {
    suggestions.push('核实并合并同卡号重复登记记录');
  }
  if (errorCodes.includes('DUPLICATE_IDENTITY')) {
    suggestions.push('立即处理同一身份证多卡登记问题，确认主卡并合并或标注附属卡');
  }
  if (errorCodes.includes('DISPUTE_NOT_FROZEN') || warningCodes.includes('DISPUTE_NOT_FROZEN')) {
    suggestions.push('冻结存在争议的兑付申请，待争议解决后再处理');
  }
  if (warningCodes.includes('IDENTITY_REJECTED')) {
    suggestions.push('联系客户重新提交有效身份证件，完成身份验证');
  }
  if (warningCodes.includes('IDENTITY_PENDING')) {
    suggestions.push('尽快完成身份验证，避免影响兑付进度');
  }
  if (warningCodes.includes('INVALID_PHONE')) {
    suggestions.push('核实并更正联系电话，确保后续可正常联络');
  }

  if (errors.length > 0) {
    if (suggestions.length === 0) {
      suggestions.push('优先处理余额为负的异常记录', '核实并合并重复登记记录', '冻结存在争议的兑付申请', '处理完成后重新提交审核');
    } else {
      suggestions.push('所有问题处理完成后重新提交审核');
    }
    return {
      status: 'error',
      title: '存在严重异常，需立即处理',
      description: `检测到 ${errors.length} 个严重问题，${warnings.length} 个警告`,
      suggestions,
      details: allIssues
    };
  }

  if (warnings.length > 0) {
    if (suggestions.length === 0) {
      suggestions.push('核实警告信息的准确性', '根据实际情况决定是否需要处理', '确认无误后可继续兑付流程');
    }
    return {
      status: 'warning',
      title: '存在警告信息，建议关注',
      description: `检测到 ${warnings.length} 个需要注意的问题`,
      suggestions,
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
    name: '卡号重复登记检测',
    threshold: 1,
    condition: '同一卡号登记记录 > 1',
    severity: 'error',
    action: '提示合并或删除重复记录'
  },
  DUPLICATE_IDENTITY: {
    name: '身份去重检测',
    threshold: 1,
    condition: '同一身份证号登记主卡 > 1张',
    matchFields: ['idNumber'],
    excludeTypes: ['passport', 'other'],
    severity: 'error',
    action: '立即拦截，确认主卡后合并或标注附属卡'
  },
  DISPUTE_NOT_FROZEN: {
    name: '争议冻结检测',
    condition: 'hasDispute = true 且 isFrozen = false',
    severity: 'warning',
    action: '建议冻结兑付直到争议解决'
  },
  IDENTITY_REJECTED: {
    name: '身份验证失败检测',
    condition: 'verificationStatus = rejected',
    severity: 'warning',
    action: '暂停兑付，要求重新提交有效证件'
  },
  IDENTITY_PENDING: {
    name: '身份待验证提示',
    condition: 'verificationStatus = pending',
    severity: 'info',
    action: '提醒尽快完成身份验证'
  },
  INVALID_PHONE: {
    name: '手机号格式校验',
    pattern: '^1[3-9]\\d{9}$',
    severity: 'warning',
    action: '建议核实手机号准确性'
  },
  IDENTITY_DEDUPLICATION: {
    name: '身份去重规则说明',
    description: '同一身份证号仅允许登记一张主卡，附属卡需单独验证并明确标注；护照及其他证件类型暂不执行去重',
    matchFields: ['idNumber'],
    idTypes: ['id_card']
  }
};
