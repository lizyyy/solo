import type { Station, Sample, Anomaly, DriftEvent, LogbookEntry } from '@/types';

export const stations: Station[] = [
  { id: 'st-01', name: '站位A-07', lat: 31.2314, lon: 122.3456, depth: 1280 },
  { id: 'st-02', name: '站位B-12', lat: 30.8741, lon: 123.1098, depth: 2150 },
  { id: 'st-03', name: '站位C-04', lat: 31.5523, lon: 121.8876, depth: 860 },
  { id: 'st-04', name: '站位D-09', lat: 30.4188, lon: 122.6732, depth: 3420 },
];

function generateTimeSeries(baseHour: number, count: number, stationId: string): Sample[] {
  const samples: Sample[] = [];
  const baseDate = new Date('2026-06-17T00:00:00Z');
  baseDate.setUTCHours(baseHour);

  const tempBase = stationId === 'st-01' ? 4.2 : stationId === 'st-02' ? 3.1 : stationId === 'st-03' ? 5.8 : 2.4;
  const salBase = stationId === 'st-01' ? 34.5 : stationId === 'st-02' ? 34.8 : stationId === 'st-03' ? 34.2 : 34.9;
  const doBase = stationId === 'st-01' ? 6.1 : stationId === 'st-02' ? 5.4 : stationId === 'st-03' ? 6.8 : 4.2;
  const pressBase = stationId === 'st-01' ? 128 : stationId === 'st-02' ? 215 : stationId === 'st-03' ? 86 : 342;

  for (let i = 0; i < count; i++) {
    const t = new Date(baseDate.getTime() + i * 15 * 60 * 1000);
    let temp = tempBase + (Math.random() - 0.5) * 0.3;
    let sal = salBase + (Math.random() - 0.5) * 0.15;
    let dO = doBase + (Math.random() - 0.5) * 0.4;
    let press = pressBase + (Math.random() - 0.5) * 2;

    let status: Sample['status'] = 'processed';
    let isWithdrawn = false;
    let withdrawReason: string | undefined;
    let withdrawLogbookId: string | undefined;

    if (stationId === 'st-02' && i >= 8 && i <= 16) {
      temp += 0.6 + Math.random() * 0.3;
      if (i === 12) {
        isWithdrawn = true;
        withdrawReason = 'CTD探头发现生物附着，数据异常偏高';
        withdrawLogbookId = 'lb-014';
      }
    }
    if (stationId === 'st-04' && i >= 20 && i <= 28) {
      dO -= 1.2 + Math.random() * 0.5;
      if (i === 24) status = 'blocked';
      if (i === 25) status = 'pending';
      if (i === 26) status = 'pending';
    }
    if (stationId === 'st-01' && i === 5) {
      temp = tempBase - 1.8;
      status = 'blocked';
    }
    if (stationId === 'st-03' && i >= 14 && i <= 18) {
      sal += 0.8 + Math.random() * 0.4;
      status = i === 16 ? 'pending' : 'processed';
    }

    samples.push({
      id: `s-${stationId}-${i.toString().padStart(3, '0')}`,
      stationId,
      timestamp: t.toISOString(),
      temperature: Number(temp.toFixed(3)),
      salinity: Number(sal.toFixed(3)),
      dissolvedOxygen: Number(dO.toFixed(3)),
      pressure: Number(press.toFixed(1)),
      status,
      isWithdrawn,
      withdrawReason,
      withdrawLogbookId,
    });
  }
  return samples;
}

export const samples: Sample[] = [
  ...generateTimeSeries(6, 32, 'st-01'),
  ...generateTimeSeries(8, 32, 'st-02'),
  ...generateTimeSeries(10, 32, 'st-03'),
  ...generateTimeSeries(14, 32, 'st-04'),
];

export const anomalies: Anomaly[] = [
  {
    id: 'an-001',
    sampleId: 's-st-01-005',
    stationId: 'st-01',
    type: 'threshold',
    description: '站位A-07 温度骤降1.8°C，疑似温跃层穿越异常或传感器卡滞',
    sourceLogbookId: 'lb-006',
    evidenceStatus: 'partial',
    value: 2.412,
    metric: 'temperature',
    threshold: 3.5,
    handler: '老何',
    nextAction: '需对照CTD原始剖面数据复核',
  },
  {
    id: 'an-002',
    sampleId: 's-st-02-012',
    stationId: 'st-02',
    type: 'drift',
    description: '站位B-12 第8-16条温度连续偏高0.6°C以上，已确认传感器漂移',
    sourceLogbookId: 'lb-014',
    evidenceStatus: 'complete',
    value: 4.123,
    metric: 'temperature',
    threshold: 3.8,
    handler: '老何',
    nextAction: '已撤回该段数据，待实验室校准后补采',
  },
  {
    id: 'an-003',
    sampleId: 's-st-04-024',
    stationId: 'st-04',
    type: 'threshold',
    description: '站位D-09 溶解氧断崖式下跌至2.8mg/L，低于阈值',
    sourceLogbookId: 'lb-027',
    evidenceStatus: 'none',
    value: 2.811,
    metric: 'dissolvedOxygen',
    threshold: 3.5,
    nextAction: '卡在等待船载ADCP流速数据交叉验证',
  },
  {
    id: 'an-004',
    sampleId: 's-st-04-025',
    stationId: 'st-04',
    type: 'threshold',
    description: '站位D-09 溶解氧持续偏低，需判断是否为低氧区真实信号',
    sourceLogbookId: 'lb-028',
    evidenceStatus: 'partial',
    value: 2.987,
    metric: 'dissolvedOxygen',
    threshold: 3.5,
    nextAction: '待补证据：化学滴定氧样瓶标签照片',
  },
  {
    id: 'an-005',
    sampleId: 's-st-03-016',
    stationId: 'st-03',
    type: 'drift',
    description: '站位C-04 盐度段偏高0.8psu，电导率池疑似污染',
    sourceLogbookId: 'lb-021',
    evidenceStatus: 'complete',
    value: 35.102,
    metric: 'salinity',
    threshold: 34.8,
    handler: '老何',
    nextAction: '已用实验室瓶样校准修正，数据可恢复',
  },
  {
    id: 'an-006',
    sampleId: 's-st-04-026',
    stationId: 'st-04',
    type: 'other',
    description: '站位D-09 压力传感器波动异常，与深度计读数偏差>5dbar',
    sourceLogbookId: 'lb-029',
    evidenceStatus: 'none',
    value: 348.2,
    metric: 'pressure',
    threshold: 5,
    nextAction: '卡着：等待船载深度记录仪原始数据导出',
  },
];

export const driftEvents: DriftEvent[] = [
  {
    id: 'dr-001',
    sensorType: 'temperature',
    startTimestamp: '2026-06-17T10:00:00.000Z',
    endTimestamp: '2026-06-17T12:00:00.000Z',
    affectedStationIds: ['st-02'],
    sourceLogbookId: 'lb-014',
    rootCause: 'CTD温度探头生物附着，回收后发现表面有硅藻附着层',
    impact: '影响站位B-12连续9个采样点，温度整体偏高0.6-0.9°C',
    driftMagnitude: 0.75,
    corrected: true,
  },
  {
    id: 'dr-002',
    sensorType: 'salinity',
    startTimestamp: '2026-06-17T13:30:00.000Z',
    endTimestamp: '2026-06-17T14:30:00.000Z',
    affectedStationIds: ['st-03'],
    sourceLogbookId: 'lb-021',
    rootCause: '电导率池进水口有微塑料纤维堵塞，冲洗后读数恢复',
    impact: '站位C-04 第14-18条盐度偏高0.6-1.0psu',
    driftMagnitude: 0.8,
    corrected: true,
  },
  {
    id: 'dr-003',
    sensorType: 'dissolvedOxygen',
    startTimestamp: '2026-06-17T19:00:00.000Z',
    endTimestamp: '2026-06-17T21:00:00.000Z',
    affectedStationIds: ['st-04'],
    sourceLogbookId: 'lb-027',
    rootCause: '氧膜表面发现油污沾染，来源待查（怀疑甲板液压系统滴漏）',
    impact: '站位D-09 第20-28条溶解氧系统偏低1.0-1.5mg/L，影响范围待确认',
    driftMagnitude: -1.25,
    corrected: false,
  },
];

export const logbookEntries: LogbookEntry[] = [
  { id: 'lb-001', page: 'P.12', lineNumber: 1, content: '06:00 起航，海况3级，CTD #3 下水检查通过', recorder: '老何', timestamp: '2026-06-17T06:00:00Z', recordType: 'normal' },
  { id: 'lb-002', page: 'P.12', lineNumber: 2, content: '06:15 站位A-07 开始采水，深度1280m', recorder: '老何', timestamp: '2026-06-17T06:15:00Z', recordType: 'normal' },
  { id: 'lb-003', page: 'P.12', lineNumber: 3, content: '06:45 站位A-07 采水完成，水样 #001-#012 已存冷库', recorder: '老何', timestamp: '2026-06-17T06:45:00Z', recordType: 'normal' },
  { id: 'lb-004', page: 'P.12', lineNumber: 4, content: '07:00 站位A-07 第3条 温度突跳0.5°C，已在旁记录', recorder: '老何', timestamp: '2026-06-17T07:00:00Z', recordType: 'note' },
  { id: 'lb-005', page: 'P.12', lineNumber: 5, content: '07:15 站位A-07 第4条 正常，温度回落到基线', recorder: '老何', timestamp: '2026-06-17T07:15:00Z', recordType: 'normal' },
  { id: 'lb-006', page: 'P.12', lineNumber: 6, content: '07:30 站位A-07 第5条 温度骤降1.8°C，异常！剖面仪到达深度后读数跳变，疑似传感器卡滞。已标记，待回港后对照CTD原始剖面复核', recorder: '老何', timestamp: '2026-06-17T07:30:00Z', recordType: 'note', linkedAnomalyId: 'an-001', linkedSampleId: 's-st-01-005' },
  { id: 'lb-007', page: 'P.13', lineNumber: 1, content: '08:00 转场至站位B-12，预计航程45分钟', recorder: '老王', timestamp: '2026-06-17T08:00:00Z', recordType: 'normal' },
  { id: 'lb-008', page: 'P.13', lineNumber: 2, content: '08:45 站位B-12 采水开始，深度2150m', recorder: '老王', timestamp: '2026-06-17T08:45:00Z', recordType: 'normal' },
  { id: 'lb-009', page: 'P.13', lineNumber: 3, content: '09:30 站位B-12 第5条 正常', recorder: '老王', timestamp: '2026-06-17T09:30:00Z', recordType: 'normal' },
  { id: 'lb-010', page: 'P.13', lineNumber: 4, content: '09:45 站位B-12 第7条 正常', recorder: '老王', timestamp: '2026-06-17T09:45:00Z', recordType: 'normal' },
  { id: 'lb-011', page: 'P.13', lineNumber: 5, content: '10:00 站位B-12 第8条 温度偏高0.6°C，开始注意观察', recorder: '老王', timestamp: '2026-06-17T10:00:00Z', recordType: 'note' },
  { id: 'lb-012', page: 'P.13', lineNumber: 6, content: '10:15 站位B-12 第9-11条 持续偏高，趋势未回落', recorder: '老王', timestamp: '2026-06-17T10:15:00Z', recordType: 'note' },
  { id: 'lb-013', page: 'P.13', lineNumber: 7, content: '10:30 站位B-12 第12条 温度已偏离基线0.9°C，决定标记可疑', recorder: '老王', timestamp: '2026-06-17T10:30:00Z', recordType: 'note' },
  { id: 'lb-014', page: 'P.13', lineNumber: 8, content: '【撤回记录】10:45 站位B-12 第8-16条全部撤回。原因：回收CTD后发现温度探头表面有明显硅藻附着层，厚度约1mm，确认读数偏高。已登记撤回，待回港实验室校准后重新处理。受影响采样点：s-st-02-008 至 s-st-02-016 共9条', recorder: '老何', timestamp: '2026-06-17T10:45:00Z', recordType: 'withdraw', linkedAnomalyId: 'an-002', linkedDriftId: 'dr-001' },
  { id: 'lb-015', page: 'P.13', lineNumber: 9, content: '11:00 站位B-12 继续采水，更换备用温度探头通道', recorder: '老何', timestamp: '2026-06-17T11:00:00Z', recordType: 'normal' },
  { id: 'lb-016', page: 'P.14', lineNumber: 1, content: '12:00 转场站位C-04', recorder: '老何', timestamp: '2026-06-17T12:00:00Z', recordType: 'normal' },
  { id: 'lb-017', page: 'P.14', lineNumber: 2, content: '12:30 站位C-04 采水开始，深度860m', recorder: '老何', timestamp: '2026-06-17T12:30:00Z', recordType: 'normal' },
  { id: 'lb-018', page: 'P.14', lineNumber: 3, content: '13:00 站位C-04 第8条 正常', recorder: '老何', timestamp: '2026-06-17T13:00:00Z', recordType: 'normal' },
  { id: 'lb-019', page: 'P.14', lineNumber: 4, content: '13:15 站位C-04 第10条 正常', recorder: '老何', timestamp: '2026-06-17T13:15:00Z', recordType: 'normal' },
  { id: 'lb-020', page: 'P.14', lineNumber: 5, content: '13:30 站位C-04 第14条 盐度开始偏高0.6psu', recorder: '老何', timestamp: '2026-06-17T13:30:00Z', recordType: 'note' },
  { id: 'lb-021', page: 'P.14', lineNumber: 6, content: '14:00 站位C-04 盐度段偏差扩大至1.0psu，中止采水冲洗电导率池。发现进水口有蓝色微塑料纤维，镊子取出后读数恢复正常。已用瓶样盐度计校准修正。来源：dr-002', recorder: '老何', timestamp: '2026-06-17T14:00:00Z', recordType: 'note', linkedAnomalyId: 'an-005', linkedDriftId: 'dr-002' },
  { id: 'lb-022', page: 'P.14', lineNumber: 7, content: '14:30 站位C-04 恢复采水', recorder: '老何', timestamp: '2026-06-17T14:30:00Z', recordType: 'normal' },
  { id: 'lb-023', page: 'P.15', lineNumber: 1, content: '15:00 转场站位D-09，深度3420m，预计采水3小时', recorder: '老王', timestamp: '2026-06-17T15:00:00Z', recordType: 'normal' },
  { id: 'lb-024', page: 'P.15', lineNumber: 2, content: '16:00 站位D-09 第0-8条 正常', recorder: '老王', timestamp: '2026-06-17T16:00:00Z', recordType: 'normal' },
  { id: 'lb-025', page: 'P.15', lineNumber: 3, content: '17:30 站位D-09 第16条 正常', recorder: '老王', timestamp: '2026-06-17T17:30:00Z', recordType: 'normal' },
  { id: 'lb-026', page: 'P.15', lineNumber: 4, content: '18:30 站位D-09 第19条 正常', recorder: '老王', timestamp: '2026-06-17T18:30:00Z', recordType: 'normal' },
  { id: 'lb-027', page: 'P.15', lineNumber: 5, content: '19:00 站位D-09 第20条 溶解氧突然下跌1.2mg/L，持续下降趋势。疑为氧膜污染，观察发现膜表面有油膜样反光。来源：dr-003', recorder: '老王', timestamp: '2026-06-17T19:00:00Z', recordType: 'note', linkedAnomalyId: 'an-003', linkedDriftId: 'dr-003' },
  { id: 'lb-028', page: 'P.15', lineNumber: 6, content: '19:30 站位D-09 第25条 溶解氧仅2.8mg/L，化学滴定样已留取（瓶号#087-#089），但标签照片缺失，无法与数字记录对应', recorder: '老王', timestamp: '2026-06-17T19:30:00Z', recordType: 'note', linkedAnomalyId: 'an-004' },
  { id: 'lb-029', page: 'P.15', lineNumber: 7, content: '20:00 站位D-09 第26条 压力传感器波动异常，与船载深度记录仪偏差>5dbar。原始深度记录仪数据仍在导出中，暂无法确认。卡着处理', recorder: '老王', timestamp: '2026-06-17T20:00:00Z', recordType: 'note', linkedAnomalyId: 'an-006' },
  { id: 'lb-030', page: 'P.15', lineNumber: 8, content: '21:00 站位D-09 采水任务结束，异常项已登记，待回港处理', recorder: '老何', timestamp: '2026-06-17T21:00:00Z', recordType: 'normal' },
];
