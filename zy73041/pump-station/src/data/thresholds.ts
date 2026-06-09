import type { ThresholdConfig } from '../types'

export const DEFAULT_THRESHOLD: ThresholdConfig = {
  vibration: { min: 0, max: 8, warningMin: 1, warningMax: 6 },
  temperature: { min: 15, max: 85, warningMin: 25, warningMax: 70 },
  pressure: { min: 0.2, max: 1.2, warningMin: 0.3, warningMax: 1.0 },
  flowRate: { min: 80, max: 300, warningMin: 100, warningMax: 260 },
  current: { min: 20, max: 95, warningMin: 30, warningMax: 80 },
}

export const THRESHOLD_VERSION = 'v2.3.1'

export const METRIC_LABELS: Record<string, string> = {
  vibration: '振动 (mm/s)',
  temperature: '温度 (℃)',
  pressure: '压力 (MPa)',
  flowRate: '流量 (m³/h)',
  current: '电流 (A)',
}

export const METRIC_UNITS: Record<string, string> = {
  vibration: 'mm/s',
  temperature: '℃',
  pressure: 'MPa',
  flowRate: 'm³/h',
  current: 'A',
}

export const CALC_FORMULA_NOTES = `
计算口径（${THRESHOLD_VERSION}）：
1. 振动：按ISO 10816-3标准，取水平+垂直两个方向均值
2. 温度：轴承端盖处红外测温，取连续3次读数均值
3. 压力：泵出口压力表读数，环境温度修正
4. 流量：电磁流量计瞬时值，每5s采样取均值
5. 电流：三相电流均值，不平衡度>10%触发次级预警
`
