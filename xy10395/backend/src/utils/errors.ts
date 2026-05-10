export class BusinessError extends Error {
  code: string;
  userMessage: string;

  constructor(code: string, message: string, userMessage?: string) {
    super(message);
    this.code = code;
    this.userMessage = userMessage || message;
    this.name = 'BusinessError';
  }
}

export const BusinessErrors = {
  INJURY_RESTRICTION: (exercise: string, bodyPart: string) => 
    new BusinessError(
      'INJURY_RESTRICTION',
      `动作 "${exercise}" 与伤病部位 "${bodyPart}" 冲突`,
      `动作「${exercise}」与会员当前${bodyPart}部位伤病冲突，请更换安全动作或调整方案`
    ),

  INSUFFICIENT_SESSIONS: (remaining: number) => 
    new BusinessError(
      'INSUFFICIENT_SESSIONS',
      `剩余课时不足: ${remaining}`,
      `会员剩余课时不足 (剩余 ${remaining} 节)，请先提醒会员续课`
    ),

  SESSION_ALREADY_DEDUCTED: () => 
    new BusinessError(
      'SESSION_ALREADY_DEDUCTED',
      '课时已扣减',
      '该次训练的课时已扣减，请勿重复操作'
    ),

  MEMBER_NOT_FOUND: () => 
    new BusinessError(
      'MEMBER_NOT_FOUND',
      '会员不存在',
      '未找到该会员，请检查会员信息是否正确'
    ),

  PLAN_NOT_FOUND: () => 
    new BusinessError(
      'PLAN_NOT_FOUND',
      '训练计划不存在',
      '未找到该训练计划，请刷新后重试'
    ),

  PAYMENT_NOT_FOUND: () => 
    new BusinessError(
      'PAYMENT_NOT_FOUND',
      '课时包不存在',
      '未找到可用课时包，请先为会员购买课时'
    ),

  INVALID_INPUT: (field: string, detail: string) => 
    new BusinessError(
      'INVALID_INPUT',
      `${field}: ${detail}`,
      `「${field}」输入有误：${detail}`
    ),
};
