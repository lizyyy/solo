import type {
  BearingSchedule,
  SensorLog,
  Material,
  ProcessRecord,
  HistoryVersion,
} from '@/types';

const pad = (n: number, len = 2) => String(n).padStart(len, '0');
const d = (dayOffset: number, hour: number, minute = 0) => {
  const base = new Date('2026-06-08T00:00:00');
  base.setDate(base.getDate() + dayOffset);
  base.setHours(hour, minute, 0, 0);
  return base.toISOString();
};

const genLogsForSchedule = (
  scheduleId: string,
  bearingCode: string,
  opts: {
    day: number;
    anomalies: { hour: number; min?: number; value: number; type: any; desc: string }[];
    gaps: { hour: number; min?: number; desc: string }[];
    materialBatchNo?: string;
  }
): SensorLog[] => {
  const logs: SensorLog[] = [];
  let logIdx = 0;
  const baseVals = [2.1, 2.3, 2.0, 2.2, 2.4, 2.1, 2.3, 2.0, 2.2, 2.5, 2.1, 2.0];
  for (let h = 8; h <= 19; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (logIdx >= 24) break;
      const anomaly = opts.anomalies.find((a) => a.hour === h && (a.min ?? 0) === m);
      const gap = opts.gaps.find((g) => g.hour === h && (g.min ?? 0) === m);
      const id = `${scheduleId}-L${pad(logIdx + 1)}`;
      if (gap) {
        logs.push({
          id,
          scheduleId,
          timestamp: d(opts.day, h, m),
          sensorId: `SN-${bearingCode}-01`,
          bearingCode,
          rawValue: -1,
          status: 'gap',
          anomalyType: 'sensor_offline',
          rawDescription: gap.desc,
          materialBatchNo: opts.materialBatchNo,
          createdAt: d(opts.day, h, m),
        });
      } else if (anomaly) {
        logs.push({
          id,
          scheduleId,
          timestamp: d(opts.day, h, m),
          sensorId: `SN-${bearingCode}-01`,
          bearingCode,
          rawValue: anomaly.value,
          status: 'anomaly',
          anomalyType: anomaly.type,
          rawDescription: anomaly.desc,
          materialBatchNo: opts.materialBatchNo,
          createdAt: d(opts.day, h, m),
        });
      } else {
        const base = baseVals[logIdx % baseVals.length] + (Math.random() - 0.5) * 0.08;
        logs.push({
          id,
          scheduleId,
          timestamp: d(opts.day, h, m),
          sensorId: `SN-${bearingCode}-01`,
          bearingCode,
          rawValue: Math.round(base * 100) / 100,
          status: 'normal',
          rawDescription: `数值波动在标准区间 2.0mm±0.5mm，采集正常 SNR=38dB`,
          materialBatchNo: opts.materialBatchNo,
          createdAt: d(opts.day, h, m),
        });
      }
      logIdx++;
    }
  }
  return logs;
};

const schedAId = 'sch-001';
const schedBId = 'sch-002';
const matBatchA = 'QZ-2000-B20260512';

export const seedSchedules: BearingSchedule[] = [
  {
    id: schedAId,
    scheduleNo: 'BR-2026-06-001',
    bridgeName: '青岩大桥',
    bearingCode: 'ZZ-QZ-3R',
    position: '3#墩右幅上游',
    conclusion: 'rejudged_normal',
    status: 'handoff_ready',
    handoff: 'releasable',
    primaryRemark:
      '6月8日上午出现两次压力超限，经现场调度小宋补录核实，为传感器零点漂移，已校准后数据恢复正常，可放行。',
    logIds: [],
    materialBatchNos: [matBatchA],
    versionCount: 2,
    createdAt: d(0, 8, 0),
    updatedAt: d(1, 15, 40),
  },
  {
    id: schedBId,
    scheduleNo: 'BR-2026-06-002',
    bridgeName: '青岩大桥',
    bearingCode: 'ZZ-QZ-5L',
    position: '5#墩左幅下游',
    conclusion: 'anomaly',
    status: 'reviewing',
    handoff: 'missing_material',
    primaryRemark:
      '6月8日下午检测到4次竖向位移尖峰，叠加两次传感器离线断档，尚未补录说明，且对应支座备件批次未到货，暂不可放行。',
    logIds: [],
    materialBatchNos: [],
    versionCount: 1,
    createdAt: d(0, 14, 0),
    updatedAt: d(1, 9, 20),
  },
];

const logsA = genLogsForSchedule(schedAId, 'ZZ-QZ-3R', {
  day: 0,
  anomalies: [
    {
      hour: 10,
      min: 30,
      value: 4.82,
      type: 'over_threshold',
      desc: '压力传感器读数 4.82MPa 超过阈值 3.5MPa，告警级别橙色，持续 12 秒后回落',
    },
    {
      hour: 11,
      min: 0,
      value: 5.14,
      type: 'drift',
      desc: '读数缓慢爬升 5.14MPa，疑似传感器零点漂移，支座本体未观测到异响',
    },
  ],
  gaps: [
    {
      hour: 13,
      min: 0,
      desc: '采集终端 GPRS 信号中断 28 分钟，未见原始采样数据，已记录断档编号 GAP-20260608-01',
    },
    {
      hour: 16,
      min: 30,
      desc: '传感器自检失败，离线时长 14 分钟，现场巡视人员已确认线缆松动并复紧',
    },
  ],
  materialBatchNo: matBatchA,
});

const logsB = genLogsForSchedule(schedBId, 'ZZ-QZ-5L', {
  day: 0,
  anomalies: [
    {
      hour: 14,
      min: 30,
      value: 6.21,
      type: 'spike',
      desc: '竖向位移尖峰 6.21mm，超限阈值 4.0mm，波形呈陡峭 V 型，持续 1.8 秒',
    },
    {
      hour: 15,
      min: 0,
      value: 5.88,
      type: 'spike',
      desc: '竖向位移尖峰 5.88mm，波形与上一次一致，疑似重型车辆紧急制动引起',
    },
    {
      hour: 17,
      min: 30,
      value: 7.04,
      type: 'spike',
      desc: '竖向位移尖峰 7.04mm，告警级别红色，同步采集到横向加速度 0.32g',
    },
    {
      hour: 18,
      min: 0,
      value: 5.53,
      type: 'over_threshold',
      desc: '持续 6 分钟读数在 5.3~5.6mm 区间波动，偏离正常区间 2.0mm±0.5mm',
    },
  ],
  gaps: [
    {
      hour: 16,
      min: 0,
      desc: '采样模块供电异常，断档 31 分钟，系统日志 E-103：欠压保护触发',
    },
    {
      hour: 19,
      min: 0,
      desc: '数据网关重启导致断档 18 分钟，重启后缓存数据未成功回补',
    },
  ],
});

seedSchedules[0].logIds = logsA.map((l) => l.id);
seedSchedules[1].logIds = logsB.map((l) => l.id);

export const seedSensorLogs: SensorLog[] = [...logsA, ...logsB];

export const seedMaterials: Material[] = [
  {
    id: 'mat-001',
    batchNo: matBatchA,
    name: '球形支座 QZ-2000-GD',
    spec: '承载力 2000kN / 固定型 / 耐候钢',
    qty: 4,
    inboundNo: 'RK-2026-0512-007',
    supplier: '衡橡科技股份有限公司',
    scheduleIds: [schedAId],
    receivedAt: d(-26, 10, 0),
    remark: '小包材料：含 4 件套支座、配套不锈钢板、硅脂润滑脂 1 管',
  },
];

export const seedProcessRecords: ProcessRecord[] = [
  {
    id: 'pr-001',
    scheduleId: schedAId,
    type: 'note',
    operator: '现场调度-小宋',
    content:
      '已到 3#墩右幅上游现场核对：支座表面无开裂、无异响，上下钢板密贴度良好。对照同时间段 3#墩左幅数据正常，判断 10:30 与 11:00 两笔异常为传感器端问题。',
    timestamp: d(1, 10, 20),
  },
  {
    id: 'pr-002',
    scheduleId: schedAId,
    type: 'supplement',
    operator: '现场调度-小宋',
    content:
      '补充断档说明：13:00 断档 GAP-20260608-01 已由通信组查明为移动基站割接所致；16:30 断档已现场复紧 M12 航空插头并做防水处理。',
    timestamp: d(1, 11, 45),
  },
  {
    id: 'pr-003',
    scheduleId: schedAId,
    type: 'rejudge',
    operator: '运营主管-王工',
    content: '改判：从 anomaly 改为 rejudged_normal',
    oldConclusion: 'anomaly',
    newConclusion: 'rejudged_normal',
    rejudgeReason:
      '两条压力超限异常经现场比对为传感器零点漂移（偏移 +2.4MPa），已用标准砝码二次校准；支座本体经敲击法与目视检查均无异常；同桥位左幅支座同期数据对比正常。综合判定数据异常由传感器引起，非支座本身问题。',
    affectedLogIds: [logsA[5].id, logsA[6].id, logsA[10].id, logsA[17].id],
    timestamp: d(1, 15, 40),
  },
];

export const seedHistoryVersions: HistoryVersion[] = [
  {
    id: 'hv-001',
    scheduleId: schedAId,
    versionNo: 1,
    snapshot: {
      conclusion: 'anomaly',
      remark: '6月8日上午出现两次压力超限，待现场核实。',
      materialBatchNos: [matBatchA],
      status: 'reviewing',
    },
    changeSummary: '初始创建，自动判为异常',
    operator: '系统自动采集',
    createdAt: d(0, 11, 10),
  },
  {
    id: 'hv-002',
    scheduleId: schedAId,
    versionNo: 2,
    snapshot: {
      conclusion: 'rejudged_normal',
      remark:
        '6月8日上午出现两次压力超限，经现场调度小宋补录核实，为传感器零点漂移，已校准后数据恢复正常，可放行。',
      materialBatchNos: [matBatchA],
      status: 'handoff_ready',
    },
    changeSummary: '运营主管王工改判：anomaly→rejudged_normal',
    operator: '运营主管-王工',
    createdAt: d(1, 15, 40),
  },
  {
    id: 'hv-003',
    scheduleId: schedBId,
    versionNo: 1,
    snapshot: {
      conclusion: 'anomaly',
      remark: '6月8日下午多次尖峰+断档，待处理，且缺对应支座备件。',
      materialBatchNos: [],
      status: 'reviewing',
    },
    changeSummary: '初始创建，自动判为异常+缺材料',
    operator: '系统自动采集',
    createdAt: d(0, 18, 10),
  },
];
