import type { TidalRecord, TideUnit, ReviewStatus, AnomalyType } from '../types';

function generateTidalData(stationId: string, startDate: string, hours: number): TidalRecord[] {
  const records: TidalRecord[] = [];
  const start = new Date(startDate);
  
  for (let i = 0; i < hours; i++) {
    const time = new Date(start.getTime() + i * 60 * 60 * 1000);
    const hour = i;
    const tidePhase = Math.sin((hour / 6.2) * Math.PI) * 0.8 + Math.sin((hour / 12.4) * Math.PI) * 1.2;
    const baseLevel = 1.5;
    const noise = (Math.random() - 0.5) * 0.15;
    let waterLevel = baseLevel + tidePhase + noise;
    
    let unit: TideUnit = 'm';
    let originalUnit: TideUnit = 'm';
    let bottleId = `BOT-${stationId.slice(-3)}-${String(Math.floor(hour / 3) + 1).padStart(3, '0')}`;
    let bottleVersion: 'current' | 'old' = 'current';
    let isAnomaly = false;
    let anomalyType: AnomalyType = 'none';
    let anomalyReason = '';
    let status: ReviewStatus = 'confirmed';
    let oldBottleId: string | undefined;
    let conclusion = '';
    
    if (i === 8) {
      waterLevel = 3.95;
      isAnomaly = true;
      anomalyType = 'outlier';
      anomalyReason = '突增潮位疑似仪器故障';
      status = 'pending';
      conclusion = '待现场复核采样瓶数据';
    }
    if (i === 15) {
      waterLevel = 285;
      unit = 'cm';
      originalUnit = 'cm';
      isAnomaly = true;
      anomalyType = 'unit_mismatch';
      anomalyReason = '单位混写：原始记录为厘米';
      status = 'returned';
      conclusion = '需统一为米制单位后重新入库';
    }
    if (i === 22) {
      bottleId = `BOT-OLD-017`;
      bottleVersion = 'old';
      oldBottleId = `BOT-OLD-017`;
      isAnomaly = true;
      anomalyType = 'bottle_mismatch';
      anomalyReason = '采样瓶编号为旧版编号';
      status = 'pending';
      conclusion = '待确认新版编号对应关系';
    }
    if (i === 30) {
      waterLevel = 1.25;
      isAnomaly = true;
      anomalyType = 'manual_change';
      anomalyReason = '人工改判：原2.15米判为仪器漂移';
      status = 'confirmed';
      conclusion = '已确认人工改判，附现场照片佐证';
    }
    if (i === 40) {
      waterLevel = 4.1;
      isAnomaly = true;
      anomalyType = 'outlier';
      anomalyReason = '风暴潮期间异常高潮位';
      status = 'confirmed';
      conclusion = '已确认为风暴潮自然现象，数据有效';
    }
    
    records.push({
      id: `rec-${stationId}-${String(i).padStart(4, '0')}`,
      stationId,
      timestamp: time.toISOString(),
      waterLevel: Math.round(waterLevel * 1000) / 1000,
      unit,
      originalUnit,
      bottleId,
      bottleVersion,
      ...(oldBottleId && { oldBottleId }),
      status,
      isAnomaly,
      anomalyType,
      anomalyReason,
      conclusion,
    });
  }
  
  return records;
}

export const allRecords: TidalRecord[] = [
  ...generateTidalData('st-001', '2026-06-16T00:00:00', 48),
  ...generateTidalData('st-002', '2026-06-16T00:00:00', 48),
  ...generateTidalData('st-003', '2026-06-16T00:00:00', 48),
];
