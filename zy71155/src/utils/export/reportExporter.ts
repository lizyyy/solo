import type { HistoryRecord, SettlementResult, PlacedItem } from '../../types/game';
import { getCommodityById } from '../../data/commodities';
import { getLevelById } from '../../data/levels';
import { getBoxTypeById } from '../../data/boxTypes';

export const exportToJSON = (record: HistoryRecord): string => {
  return JSON.stringify(record, null, 2);
};

export const exportToText = (record: HistoryRecord): string => {
  const level = getLevelById(record.levelId);
  const boxType = level ? getBoxTypeById(level.boxTypeId) : null;
  
  const lines: string[] = [];
  
  lines.push('========================================');
  lines.push('       仓库装箱培训报告');
  lines.push('========================================');
  lines.push('');
  
  lines.push(`报告编号: ${record.id}`);
  lines.push(`生成时间: ${record.createdAt}`);
  lines.push('');
  
  lines.push('--- 关卡信息 ---');
  lines.push(`关卡名称: ${record.levelName}`);
  lines.push(`关卡难度: ${level ? '★'.repeat(level.difficulty) : '未知'}`);
  if (level) {
    lines.push(`关卡描述: ${level.description}`);
    lines.push(`特殊规则: ${level.specialRule || '无'}`);
  }
  lines.push('');
  
  lines.push('--- 结算结果 ---');
  lines.push(`最终得分: ${record.score} 分`);
  lines.push(`评级: ${record.grade}`);
  lines.push(`是否通过: ${record.settlementResult.isPassed ? '是' : '否'}`);
  lines.push(`用时: ${Math.floor(record.timeUsed / 60)}分${record.timeUsed % 60}秒`);
  if (level && level.timeLimit > 0) {
    lines.push(`限时: ${Math.floor(level.timeLimit / 60)}分${level.timeLimit % 60}秒`);
  }
  lines.push('');
  
  lines.push('--- 装箱指标 ---');
  lines.push(`空间利用率: ${(record.settlementResult.spaceUtilization * 100).toFixed(1)}%`);
  lines.push(`总重量: ${record.settlementResult.totalWeight.toFixed(1)} kg`);
  if (boxType) {
    lines.push(`箱型承重: ${boxType.maxWeight} kg`);
  }
  lines.push(`重心位置: X=${record.settlementResult.centerOfGravity.x.toFixed(2)}, Y=${record.settlementResult.centerOfGravity.y.toFixed(2)}`);
  lines.push('');
  
  lines.push('--- 装箱明细 ---');
  lines.push(`商品总数: ${level?.commodityIds.length || 0} 件`);
  lines.push(`已装箱数: ${record.placements.length} 件`);
  lines.push('');
  
  record.placements.forEach((placement, index) => {
    const commodity = getCommodityById(placement.commodityId);
    if (commodity) {
      lines.push(`${index + 1}. ${commodity.name}`);
      lines.push(`   重量: ${commodity.weight}kg | 等级: ${commodity.weightLevel}`);
      lines.push(`   易碎: ${commodity.fragileLevel} | 时效: ${commodity.timeLevel}`);
      lines.push(`   位置: (${placement.x}, ${placement.y}) 层级: ${placement.layer}`);
      lines.push('');
    }
  });
  
  lines.push('--- 违规记录 ---');
  if (record.violations.length === 0) {
    lines.push('无违规记录，操作规范！');
  } else {
    record.violations.forEach((violation, index) => {
      lines.push(`${index + 1}. [${violation.isFatal ? '致命' : '普通'}] ${violation.description}`);
      lines.push(`   扣分: ${violation.penalty} 分`);
      lines.push('');
    });
  }
  
  if (record.settlementResult.fatalViolation) {
    lines.push('--- 失败原因 ---');
    lines.push(record.settlementResult.fatalViolation.description);
    lines.push('');
  }
  
  lines.push('--- 培训建议 ---');
  const suggestions = generateSuggestions(record.settlementResult);
  suggestions.forEach((s, i) => {
    lines.push(`${i + 1}. ${s}`);
  });
  lines.push('');
  
  lines.push('========================================');
  lines.push('       报告结束');
  lines.push('========================================');
  
  return lines.join('\n');
};

const generateSuggestions = (result: SettlementResult): string[] => {
  const suggestions: string[] = [];
  
  const hasHeavyOnFragile = result.violations.some(v => v.type === 'heavy_on_fragile');
  const hasFragileUnder = result.violations.some(v => v.type === 'fragile_under');
  const hasTimePosition = result.violations.some(v => v.type === 'time_position');
  const hasSpaceWaste = result.violations.some(v => v.type === 'space_waste');
  const hasUnstable = result.violations.some(v => v.type === 'unstable');
  const hasOverweight = result.violations.some(v => v.type === 'overweight');
  
  if (hasHeavyOnFragile || hasFragileUnder) {
    suggestions.push('加强易碎品识别能力，注意查看商品标签，重物应放在底部，易碎品放在最上层。');
  }
  
  if (hasTimePosition) {
    suggestions.push('注意时效件的优先处理，特快件、当日达件应放在最上层或靠近箱门的易取位置。');
  }
  
  if (hasSpaceWaste) {
    suggestions.push('提高空间规划能力，先放大件商品，再用小件填充空隙，目标利用率达到70%以上。');
  }
  
  if (hasUnstable) {
    suggestions.push('注意重心平衡，重物应均匀分布在箱子底部，避免重心偏移过多导致运输中倾倒。');
  }
  
  if (hasOverweight) {
    suggestions.push('注意箱型的承重限制，超重可能导致箱子破损，需要选择更大的箱型或分箱。');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('操作规范，继续保持！可以尝试挑战更高难度关卡。');
    if (result.spaceUtilization < 0.9) {
      suggestions.push('可以进一步优化空间布局，目标达到90%以上的空间利用率。');
    }
  }
  
  return suggestions;
};

export const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
