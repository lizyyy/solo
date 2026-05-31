import {
  PayloadPlan,
  FaultRecord,
  OrbitElement,
  Anomaly,
  AnomalyReason,
  AnomalyType,
  AnomalySeverity,
  TimeSystem
} from '../types';
import { generateId } from './hash';
import { parseTimeWithSystem, formatTimeWithSystem, isSameDay } from './timeConverter';
import { calculateDailyBudget } from './budgetCalculator';

interface DetectionContext {
  payloadPlans: PayloadPlan[];
  faultRecords: FaultRecord[];
  orbitElements: OrbitElement[];
  date: string;
}

function detectTimeConflicts(ctx: DetectionContext): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const allRecords = [
    ...ctx.payloadPlans.map(p => ({ type: 'payload' as const, id: p.id, time: p.startTime, timeSystem: p.timeSystem, name: p.name })),
    ...ctx.faultRecords.map(f => ({ type: 'fault' as const, id: f.id, time: f.faultTime, timeSystem: f.timeSystem, name: f.description })),
    ...ctx.orbitElements.map(o => ({ type: 'orbit' as const, id: o.id, time: o.effectiveTime, timeSystem: o.timeSystem, name: o.parameterName }))
  ];
  
  if (allRecords.length < 2) return anomalies;
  
  const targetDate = new Date(ctx.date);
  
  for (let i = 0; i < allRecords.length - 1; i++) {
    const current = allRecords[i];
    const next = allRecords[i + 1];
    
    const currentDate = parseTimeWithSystem(current.time, current.timeSystem);
    const nextDate = parseTimeWithSystem(next.time, next.timeSystem);
    
    if (!isSameDay(currentDate, targetDate) && !isSameDay(nextDate, targetDate)) continue;
    
    const timeDiffHours = Math.abs(nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60);
    
    if (timeDiffHours < 2 && current.timeSystem !== next.timeSystem) {
      const reason: AnomalyReason = {
        formula: 'Δt = |t2 - t1| < 2h 且 时间制不同',
        rawData: [
          {
            source: `${current.type}:${current.name}`,
            value: current.time,
            time: current.time,
            timeSystem: current.timeSystem
          },
          {
            source: `${next.type}:${next.name}`,
            value: next.time,
            time: next.time,
            timeSystem: next.timeSystem
          }
        ],
        criteria: '相邻记录时间差小于2小时且使用不同时间制，可能导致计算误差',
        calculationSteps: [
          `记录1时间: ${formatTimeWithSystem(currentDate, 'UTC')} UTC (原: ${current.timeSystem})`,
          `记录2时间: ${formatTimeWithSystem(nextDate, 'UTC')} UTC (原: ${next.timeSystem})`,
          `时间差: ${timeDiffHours.toFixed(2)} 小时`,
          `阈值: 2 小时`,
          `判定: ${timeDiffHours < 2 ? '时间差 < 阈值，触发告警' : '正常'}`
        ],
        conclusion: `相邻记录时间差仅${timeDiffHours.toFixed(2)}小时，但使用了不同时间制(${current.timeSystem} vs ${next.timeSystem})，建议统一时间制或确认转换关系`
      };
      
      anomalies.push({
        id: generateId(),
        type: 'TIME_CONFLICT',
        severity: 'WARNING',
        description: `时间制混用风险: ${current.name}(${current.timeSystem}) 与 ${next.name}(${next.timeSystem}) 时间接近`,
        reason: JSON.stringify(reason),
        relatedRecordIds: [current.id, next.id],
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });
    }
  }
  
  return anomalies;
}

function detectDataInconsistencies(ctx: DetectionContext): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const targetDate = new Date(ctx.date);
  
  const dayPlans = ctx.payloadPlans.filter(p => {
    const d = parseTimeWithSystem(p.startTime, p.timeSystem);
    return isSameDay(d, targetDate);
  });
  
  for (let i = 0; i < dayPlans.length; i++) {
    for (let j = i + 1; j < dayPlans.length; j++) {
      const plan1 = dayPlans[i];
      const plan2 = dayPlans[j];
      
      const start1 = parseTimeWithSystem(plan1.startTime, plan1.timeSystem);
      const end1 = parseTimeWithSystem(plan1.endTime, plan1.timeSystem);
      const start2 = parseTimeWithSystem(plan2.startTime, plan2.timeSystem);
      const end2 = parseTimeWithSystem(plan2.endTime, plan2.timeSystem);
      
      const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
      const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));
      
      if (overlapEnd > overlapStart) {
        const overlapHours = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
        
        const reason: AnomalyReason = {
          formula: '时段重叠检测: max(start1, start2) < min(end1, end2)',
          rawData: [
            {
              source: `载荷: ${plan1.name}`,
              value: `${plan1.startTime} - ${plan1.endTime}`,
              time: plan1.startTime,
              timeSystem: plan1.timeSystem
            },
            {
              source: `载荷: ${plan2.name}`,
              value: `${plan2.startTime} - ${plan2.endTime}`,
              time: plan2.startTime,
              timeSystem: plan2.timeSystem
            }
          ],
          criteria: '同一时段不应安排两个并行载荷，除非确认电源裕度足够',
          calculationSteps: [
            `计划1: ${formatTimeWithSystem(start1, 'UTC')} - ${formatTimeWithSystem(end1, 'UTC')} UTC`,
            `计划2: ${formatTimeWithSystem(start2, 'UTC')} - ${formatTimeWithSystem(end2, 'UTC')} UTC`,
            `重叠时段: ${formatTimeWithSystem(overlapStart, 'UTC')} - ${formatTimeWithSystem(overlapEnd, 'UTC')} UTC`,
            `重叠时长: ${overlapHours.toFixed(2)} 小时`,
            `判定: 存在时间重叠，需确认是否可并行执行`
          ],
          conclusion: `载荷「${plan1.name}」与「${plan2.name}」存在${overlapHours.toFixed(2)}小时的执行时间重叠，需确认是否同时供电或调整计划`
        };
        
        anomalies.push({
          id: generateId(),
          type: 'DATA_INCONSISTENCY',
          severity: 'WARNING',
          description: `数据不一致: ${plan1.name} 与 ${plan2.name} 执行时间重叠`,
          reason: JSON.stringify(reason),
          relatedRecordIds: [plan1.id, plan2.id],
          status: 'PENDING',
          createdAt: new Date().toISOString()
        });
      }
    }
  }
  
  return anomalies;
}

function detectBudgetOverruns(ctx: DetectionContext): Anomaly[] {
  const anomalies: Anomaly[] = [];
  
  const budget = calculateDailyBudget(
    ctx.date,
    ctx.payloadPlans,
    ctx.faultRecords,
    ctx.orbitElements,
    []
  );
  
  if (budget.margin < 0) {
    const reason: AnomalyReason = {
      formula: '余量 = 日预算 - 实际消耗',
      rawData: [
        { source: '日预算阈值', value: budget.totalBudget, time: ctx.date, timeSystem: 'UTC' },
        { source: '实际消耗', value: budget.actualConsumption, time: ctx.date, timeSystem: 'UTC' },
        { source: '计算余量', value: budget.margin, time: ctx.date, timeSystem: 'UTC' }
      ],
      criteria: '余量 >= 0 为正常，余量 < 0 为越界',
      calculationSteps: [
        `日预算: ${budget.totalBudget} Wh`,
        `实际消耗: ${budget.actualConsumption} Wh`,
        `余量 = ${budget.totalBudget} - ${budget.actualConsumption} = ${budget.margin} Wh`,
        `判定: 余量 < 0，触发预算越界告警`
      ],
      conclusion: `当日电源预算越界，实际消耗(${budget.actualConsumption}Wh)超过日预算(${budget.totalBudget}Wh)，缺口为${Math.abs(budget.margin)}Wh，需调整载荷计划或故障处理策略`
    };
    
    anomalies.push({
      id: generateId(),
      type: 'BUDGET_OVERRUN',
      severity: 'ERROR',
      description: `预算越界: ${ctx.date} 电源缺口 ${Math.abs(budget.margin).toFixed(1)} Wh`,
      reason: JSON.stringify(reason),
      relatedRecordIds: [],
      status: 'PENDING',
      createdAt: new Date().toISOString()
    });
  } else if (budget.margin < 400) {
    const reason: AnomalyReason = {
      formula: '余量 = 日预算 - 实际消耗',
      rawData: [
        { source: '日预算阈值', value: budget.totalBudget, time: ctx.date, timeSystem: 'UTC' },
        { source: '实际消耗', value: budget.actualConsumption, time: ctx.date, timeSystem: 'UTC' },
        { source: '计算余量', value: budget.margin, time: ctx.date, timeSystem: 'UTC' }
      ],
      criteria: '余量 < 400Wh 为警告，需关注后续计划调整',
      calculationSteps: [
        `日预算: ${budget.totalBudget} Wh`,
        `实际消耗: ${budget.actualConsumption} Wh`,
        `余量 = ${budget.totalBudget} - ${budget.actualConsumption} = ${budget.margin} Wh`,
        `判定: 余量 < 400Wh 警告阈值`
      ],
      conclusion: `当日电源余量不足(${budget.margin.toFixed(1)}Wh)，已接近警戒值，建议关注后续载荷计划调整，避免出现预算越界`
    };
    
    anomalies.push({
      id: generateId(),
      type: 'BUDGET_OVERRUN',
      severity: 'WARNING',
      description: `预算警告: ${ctx.date} 电源余量 ${budget.margin.toFixed(1)} Wh，接近阈值`,
      reason: JSON.stringify(reason),
      relatedRecordIds: [],
      status: 'PENDING',
      createdAt: new Date().toISOString()
    });
  }
  
  return anomalies;
}

export function runAnomalyDetection(
  date: string,
  payloadPlans: PayloadPlan[],
  faultRecords: FaultRecord[],
  orbitElements: OrbitElement[]
): Anomaly[] {
  const ctx: DetectionContext = {
    payloadPlans,
    faultRecords,
    orbitElements,
    date
  };
  
  const timeConflicts = detectTimeConflicts(ctx);
  const dataInconsistencies = detectDataInconsistencies(ctx);
  const budgetOverruns = detectBudgetOverruns(ctx);
  
  return [...timeConflicts, ...dataInconsistencies, ...budgetOverruns];
}

export function parseAnomalyReason(reasonJson: string): AnomalyReason | null {
  try {
    return JSON.parse(reasonJson);
  } catch {
    return null;
  }
}

export function getAnomalyTypeLabel(type: AnomalyType): string {
  switch (type) {
    case 'TIME_CONFLICT': return '时间制冲突';
    case 'DATA_INCONSISTENCY': return '数据不一致';
    case 'BUDGET_OVERRUN': return '预算越界';
    default: return type;
  }
}

export function getAnomalySeverityLabel(severity: AnomalySeverity): string {
  switch (severity) {
    case 'WARNING': return '警告';
    case 'ERROR': return '错误';
    default: return severity;
  }
}
