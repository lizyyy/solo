import type { OffsetRiskLevel } from '@/types';

export const OFFSET_THRESHOLD_LOW = 10;
export const OFFSET_THRESHOLD_HIGH = 20;

export function assessOffsetRisk(offsetMm: number): OffsetRiskLevel {
  if (offsetMm <= 0) return 'none';
  if (offsetMm < OFFSET_THRESHOLD_LOW) return 'none';
  if (offsetMm < OFFSET_THRESHOLD_HIGH) return 'low';
  return 'high';
}

export function isOffsetBlocker(offsetMm: number): boolean {
  return offsetMm >= OFFSET_THRESHOLD_HIGH;
}

export function formatOffset(offsetMm: number): string {
  if (offsetMm === 0) return '0 mm（正常）';
  return `${offsetMm} mm`;
}

export function buildBlockerReason(offsetMm: number, fireZone: string): string {
  const lines: string[] = [];
  lines.push(`• 模型坐标偏移量：${offsetMm} mm，超过阈值 ${OFFSET_THRESHOLD_HIGH} mm`);
  lines.push(`• 影响区域：${fireZone} 消防分区构件安装定位`);
  lines.push('• 风险等级：高（可能导致防火封堵不严、卷帘门无法闭合）');
  lines.push('• 建议：暂停该条交底确认，先联系BIM团队复核模型坐标');
  return lines.join('\n');
}

export const DEFAULT_CONTACT_INFO = {
  nextContact: '李明',
  nextContactRole: 'BIM工程师',
  nextContactPhone: '138-0000-1234',
};

export function getContactInfoForZone(_fireZone: string) {
  return DEFAULT_CONTACT_INFO;
}
