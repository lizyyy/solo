import type { Farm, Round, Transaction, FarmState, Game } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateFarm(farm: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof farm !== 'object' || farm === null) {
    return { valid: false, errors: ['农场数据格式错误'], warnings: [] };
  }

  const f = farm as Record<string, unknown>;

  if (!f.id || typeof f.id !== 'string') {
    errors.push('农场ID不能为空或格式错误');
  }
  if (!f.name || typeof f.name !== 'string') {
    errors.push('农场名称不能为空');
  }
  if (typeof f.initialQuota !== 'number' || f.initialQuota < 0) {
    errors.push('初始碳配额必须为非负数字');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateRound(round: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof round !== 'object' || round === null) {
    return { valid: false, errors: ['回合数据格式错误'], warnings: [] };
  }

  const r = round as Record<string, unknown>;

  if (typeof r.roundNumber !== 'number' || r.roundNumber < 1) {
    errors.push('回合号必须为大于0的数字');
  }
  if (typeof r.carbonPrice !== 'number' || r.carbonPrice <= 0) {
    errors.push('碳价必须为正数');
  }
  if (!r.startTime || typeof r.startTime !== 'string') {
    errors.push('开始时间不能为空');
  }
  if (Math.abs(Number(r.priceFluctuation || 0)) > 20) {
    warnings.push(`价格波动${r.priceFluctuation}%较大，建议人工确认`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateTransaction(tx: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof tx !== 'object' || tx === null) {
    return { valid: false, errors: ['交易数据格式错误'], warnings: [] };
  }

  const t = tx as Record<string, unknown>;

  if (!t.farmId || typeof t.farmId !== 'string') {
    errors.push('交易农场ID不能为空');
  }
  if (typeof t.roundNumber !== 'number') {
    errors.push('交易回合号不能为空');
  }
  if (t.type !== 'buy' && t.type !== 'sell') {
    errors.push('交易类型必须为buy或sell');
  }
  if (typeof t.amount !== 'number' || t.amount <= 0) {
    errors.push('交易数量必须为正数');
  }
  if (typeof t.price !== 'number' || t.price <= 0) {
    errors.push('交易价格必须为正数');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateFarmState(state: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof state !== 'object' || state === null) {
    return { valid: false, errors: ['农场状态数据格式错误'], warnings: [] };
  }

  const s = state as Record<string, unknown>;

  if (!s.farmId || typeof s.farmId !== 'string') {
    errors.push('农场ID不能为空');
  }
  if (typeof s.roundNumber !== 'number') {
    errors.push('回合号不能为空');
  }
  if (typeof s.carbonQuota !== 'number') {
    errors.push('碳配额必须为数字');
  }
  if (s.carbonQuota as number < 0) {
    warnings.push('警告：该农场碳配额为负数，需在下回合补足');
  }
  if (typeof s.landArea !== 'number' || s.landArea < 0) {
    errors.push('土地面积必须为非负数字');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateGameData(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['游戏数据格式错误：不是有效的对象'], warnings: [] };
  }

  const d = data as Record<string, unknown>;

  if (!d.farms || !Array.isArray(d.farms)) {
    errors.push('缺少farms字段或格式错误');
  } else {
    (d.farms as unknown[]).forEach((farm, index) => {
      const result = validateFarm(farm);
      if (!result.valid) {
        errors.push(`农场${index + 1}: ${result.errors.join(', ')}`);
      }
      warnings.push(...result.warnings.map((w) => `农场${index + 1}: ${w}`));
    });
  }

  if (d.rounds && Array.isArray(d.rounds)) {
    (d.rounds as unknown[]).forEach((round, index) => {
      const result = validateRound(round);
      if (!result.valid) {
        errors.push(`回合${index + 1}: ${result.errors.join(', ')}`);
      }
      warnings.push(...result.warnings.map((w) => `回合${index + 1}: ${w}`));
    });
  }

  if (d.transactions && Array.isArray(d.transactions)) {
    (d.transactions as unknown[]).forEach((tx, index) => {
      const result = validateTransaction(tx);
      if (!result.valid) {
        errors.push(`交易${index + 1}: ${result.errors.join(', ')}`);
      }
    });
  }

  if (d.farmStates && Array.isArray(d.farmStates)) {
    (d.farmStates as unknown[]).forEach((state, index) => {
      const result = validateFarmState(state);
      if (!result.valid) {
        errors.push(`农场状态${index + 1}: ${result.errors.join(', ')}`);
      }
      warnings.push(...result.warnings.map((w) => `农场状态${index + 1}: ${w}`));
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function checkPriceFluctuation(
  currentPrice: number,
  previousPrice: number,
  threshold = 10
): { needsReview: boolean; fluctuation: number; reason?: string } {
  if (previousPrice === 0) {
    return { needsReview: false, fluctuation: 0 };
  }

  const fluctuation = ((currentPrice - previousPrice) / previousPrice) * 100;
  const needsReview = Math.abs(fluctuation) > threshold;

  return {
    needsReview,
    fluctuation: Math.round(fluctuation * 10) / 10,
    reason: needsReview
      ? `价格波动${fluctuation > 0 ? '+' : ''}${Math.round(fluctuation * 10) / 10}%超出${threshold}%阈值，需老师确认`
      : undefined,
  };
}
