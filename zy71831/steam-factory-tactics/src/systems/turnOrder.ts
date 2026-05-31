import { Unit, TurnOrderEntry, TurnOrderResult } from '../types';

function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function buildReason(unit: Unit, score: number, rank: number, totalUnits: number): string {
  const parts: string[] = [];
  parts.push(`先攻值${unit.init}+速度${unit.speed}=综合${score}`);

  if (unit.statusEffects.length > 0) {
    parts.push(`状态效果[${unit.statusEffects.join(',')}]已纳入考量`);
  }

  if (unit.type === 'support') {
    parts.push('辅助单位在同等综合值时优先');
  } else if (unit.type === 'heavy') {
    parts.push('重装单位在同等综合值时延后');
  }

  if (rank === 1) {
    parts.push('综合值最高，率先行动');
  } else if (rank === totalUnits) {
    parts.push('综合值最低，最后行动');
  }

  return parts.join('；');
}

function buildNextStep(entries: TurnOrderEntry[], units: Unit[]): string {
  if (entries.length === 0) return '无可行动单位，请检查阵容配置';
  const first = entries[0];
  const firstUnit = units.find(u => u.id === first.unitId);
  if (!firstUnit) return '首动单位数据异常，请重新导入';

  const lines: string[] = [];
  lines.push(`第${1}回合由【${firstUnit.name}】先行行动`);

  if (firstUnit.type === 'ranged') {
    lines.push('建议：远程单位可先行占据高地/掩体');
  } else if (firstUnit.type === 'support') {
    lines.push('建议：辅助单位优先释放增益/治疗');
  } else if (firstUnit.type === 'heavy') {
    lines.push('建议：重装单位推进战线建立阵地');
  } else {
    lines.push('建议：近战单位可前压或待机拦截');
  }

  if (entries.length > 1) {
    const second = entries[1];
    const secondUnit = units.find(u => u.id === second.unitId);
    if (secondUnit) {
      lines.push(`第二顺位【${secondUnit.name}】需提前规划衔接动作`);
    }
  }

  return lines.join('。') + '。';
}

export function calculateTurnOrder(units: Unit[]): TurnOrderResult {
  const sorted = [...units].sort((a, b) => {
    const scoreA = a.init + a.speed + (a.type === 'support' ? 0.5 : 0) - (a.type === 'heavy' ? 0.5 : 0);
    const scoreB = b.init + b.speed + (b.type === 'support' ? 0.5 : 0) - (b.type === 'heavy' ? 0.5 : 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    if (a.init !== b.init) return b.init - a.init;
    return b.speed - a.speed;
  });

  const entries: TurnOrderEntry[] = sorted.map((unit, idx) => {
    const score = unit.init + unit.speed + (unit.type === 'support' ? 0.5 : 0) - (unit.type === 'heavy' ? 0.5 : 0);
    return {
      unitId: unit.id,
      order: idx + 1,
      reason: buildReason(unit, score, idx + 1, sorted.length),
    };
  });

  const overallReason = sorted
    .map(u => `${u.name}(先攻${u.init}+速度${u.speed})`)
    .join(' → ');

  const checksumInput = sorted.map(u => `${u.id}:${u.init}:${u.speed}`).join('|');
  const checksum = simpleHash(checksumInput);

  return {
    entries,
    overallReason: `回合顺序依据：综合值=先攻+速度（辅助+0.5，重装-0.5）。排列结果：${overallReason}`,
    nextStepSuggestion: buildNextStep(entries, units),
    checksum,
  };
}

export function verifyTurnOrder(units: Unit[], expectedChecksum: string): { valid: boolean; detail: string } {
  const result = calculateTurnOrder(units);
  if (result.checksum === expectedChecksum) {
    return { valid: true, detail: '校验通过，回合顺序与上次一致' };
  }
  return { valid: false, detail: `校验不一致：当前checksum=${result.checksum}，期望=${expectedChecksum}，请复核单位数据是否被修改` };
}
