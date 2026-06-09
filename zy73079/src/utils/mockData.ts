import type {
  InspectionRecord,
  Remark,
  AnomalyAttribution,
  PartReplacement,
  CalculationCriterion,
  ReportSection,
  JudgementImpact,
} from '../types';
import { generateId } from '../utils';

const now = Date.now();
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

export const DEVICE_ID = 'DP-Z03-刀盘A';

export const MOCK_CRITERION: CalculationCriterion = {
  version: 'v1.2.0',
  updatedAt: now - 5 * DAY,
  updatedBy: '维保-李工',
  temperatureThreshold: 75,
  vibrationThreshold: 4.5,
  wearThreshold: 18,
  formulaDescription:
    '异常判定公式：\n- 温度异常 T ≥ 75℃，预警 60℃ ≤ T < 75℃\n- 振动异常 V ≥ 4.5mm/s，预警 3.6mm/s ≤ V < 4.5mm/s\n- 磨损超限 W ≥ 18mm，预警 14.4mm ≤ W < 18mm\n- 综合异常：任意2项同时触发预警',
  isActive: true,
};

export function buildMockInspections(): InspectionRecord[] {
  const base = [
    {
      offsetH: -6,
      temp: 58,
      vib: 2.8,
      rpm: 1.2,
      wear: 11.2,
      alarm: false,
      alarmType: null as null,
      inspector: '巡检-王师傅',
    },
    {
      offsetH: -4,
      temp: 72,
      vib: 4.1,
      rpm: 1.1,
      wear: 14.8,
      alarm: true,
      alarmType: 'temperature' as const,
      inspector: '巡检-王师傅',
    },
    {
      offsetH: -2,
      temp: 82,
      vib: 5.3,
      rpm: 0.9,
      wear: 16.4,
      alarm: true,
      alarmType: 'vibration' as const,
      inspector: '巡检-刘师傅',
    },
    {
      offsetH: -0.5,
      temp: 64,
      vib: 3.2,
      rpm: 1.15,
      wear: 15.1,
      alarm: false,
      alarmType: null as null,
      inspector: '巡检-刘师傅',
    },
  ];
  return base.map((b) => {
    const t = now + b.offsetH * HOUR;
    return {
      id: generateId(),
      deviceId: DEVICE_ID,
      inspectionTime: t,
      inspector: b.inspector,
      temperature: b.temp,
      vibration: b.vib,
      rotationSpeed: b.rpm,
      cutterWear: b.wear,
      isAlarm: b.alarm,
      alarmType: b.alarmType,
      createdAt: t,
      updatedAt: t,
    } as InspectionRecord;
  });
}

export function buildMockRemarks(inspections: InspectionRecord[]): Remark[] {
  const imp1: JudgementImpact = {
    id: generateId(),
    metric: 'temperature',
    beforeStatus: 'anomaly',
    afterStatus: 'warning',
    reason: '刚完成环片注浆同步，瞬时升温属工艺波动',
  };
  const imp2: JudgementImpact = {
    id: generateId(),
    metric: 'overall',
    beforeStatus: 'anomaly',
    afterStatus: 'warning',
    reason: '综合判定降级为预警，建议加强观察',
  };
  return [
    {
      id: generateId(),
      inspectionId: inspections[1].id,
      content: '换班前临时补录：14:00 检测到刀盘瞬时升温，但现场同步注浆作业未中断，排除密封失效，观察30分钟温度已回落至68℃。',
      author: '维保主管-阿敏',
      createdAt: now - 3 * HOUR,
      isSupplementary: true,
      supplementaryTime: now - 3 * HOUR,
      judgementImpacts: [imp1, imp2],
      reportAnchorId: 'sec-grount-heat',
    },
    {
      id: generateId(),
      inspectionId: inspections[2].id,
      content: '振动超标复核：刀盘主轴承润滑油取样金属颗粒含量正常，初步判定为掌子面孤石撞击，已通知地质组确认。',
      author: '巡检-刘师傅',
      createdAt: now - 1.5 * HOUR,
      isSupplementary: false,
      judgementImpacts: [],
      reportAnchorId: 'sec-vibration',
    },
  ];
}

export function buildMockAttributions(
  inspections: InspectionRecord[],
  remarks: Remark[]
): AnomalyAttribution[] {
  return [
    {
      id: generateId(),
      inspectionId: inspections[1].id,
      anomalyType: '温度异常',
      rootCause: '同步注浆工艺瞬时升温（已补录备注澄清，降级为预警）',
      confidence: 88,
      relatedMetric: 'temperature',
      calculationVersion: MOCK_CRITERION.version,
      status: 'clarified',
      clarifiedRemarkId: remarks[0].id,
      confirmedBy: '维保主管-阿敏',
      confirmedAt: now - 2.5 * HOUR,
    },
    {
      id: generateId(),
      inspectionId: inspections[2].id,
      anomalyType: '振动超标',
      rootCause: '疑似掌子面孤石撞击，待地质组复核确认，暂列待确认',
      confidence: 65,
      relatedMetric: 'vibration',
      calculationVersion: MOCK_CRITERION.version,
      status: 'pending',
    },
  ];
}

export function buildMockReplacements(
  inspections: InspectionRecord[]
): PartReplacement[] {
  return [
    {
      id: generateId(),
      time: now - 3.2 * HOUR,
      deviceId: DEVICE_ID,
      partName: '主驱动密封圈',
      oldModel: 'NOK-DKB-180×210×12',
      newModel: 'NOK-DKB-180×210×15',
      quantity: 1,
      operator: '机修-张工',
      reason: '现场库存12mm缺货，临时换用同外径加厚15mm型号',
      dataImpactNote: '加厚型号摩擦阻力略增，后续温度读数可能偏高2-4℃，已在备注中记录，不视为密封故障。',
      relatedInspectionIds: [inspections[1].id, inspections[2].id, inspections[3].id],
    },
  ];
}

export function buildMockReportSections(): ReportSection[] {
  return [
    {
      id: 'sec-grount-heat',
      title: '§3.2 刀盘瞬时升温事件澄清',
      content: `### §3.2 刀盘瞬时升温事件澄清

**时间**：2026-06-10 14:00~14:30  
**设备**：DP-Z03-刀盘A  
**值班人员**：维保主管-阿敏、巡检-王师傅

#### 结论
本次升温属**同步注浆工艺波动**，非密封失效。建议后续注浆前提前10分钟降低推进速度，避免瞬时热量累积。

#### 证据链
1. 报警时刻温度曲线呈尖峰形态（15分钟内从62℃升至72℃再回落至68℃）
2. 同期注浆压力曲线同步峰值（由现场PLC记录佐证）
3. 回油温度差 < 3℃，排除摩擦发热
4. 振动值未同步升高，排除机械故障

#### 后续动作
- [ ] 调整注浆联动参数（交与中控室陈工）
- [x] 已在巡检表补录备注并标记影响判断
- [x] 已通知下一班排班同事关注`,
      createdAt: now - 2 * HOUR,
    },
    {
      id: 'sec-vibration',
      title: '§4.1 刀盘振动超标待确认项',
      content: `### §4.1 刀盘振动超标待确认项

**时间**：2026-06-10 16:00  
**置信度**：65%（待地质组复核）

#### 初步假设
掌子面前方 ~1.2m 处存在孤石（φ40~60cm），刀盘切削时产生瞬时冲击振动。

#### 待办
1. 地质组雷达扫描确认（17:30前回复）
2. 若确认孤石：减速通过 + 泡沫改良渣土
3. 若排除：拆机检查主轴承游隙`,
      createdAt: now - 1 * HOUR,
    },
  ];
}

export function buildAllMock() {
  const inspections = buildMockInspections();
  const remarks = buildMockRemarks(inspections);
  const attributions = buildMockAttributions(inspections, remarks);
  const replacements = buildMockReplacements(inspections);
  const sections = buildMockReportSections();
  return { inspections, remarks, attributions, replacements, sections };
}
