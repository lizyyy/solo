import { Threshold, VibrationData, FaultJudgment } from '../types';

interface JudgmentInput {
  thresholds: Threshold[];
  vibrationData: VibrationData[];
  warningCreatedAt: string;
}

export function generateFaultJudgment(input: JudgmentInput): FaultJudgment {
  const { thresholds, vibrationData, warningCreatedAt } = input;
  const basis: string[] = [];
  let isAbnormal = false;
  const reproductionOrderSteps: string[] = [];

  const earliestVibration = vibrationData.length > 0
    ? new Date(Math.min(...vibrationData.map(d => new Date(d.timestamp).getTime())))
    : null;

  const latestThresholdSubmitted = thresholds.length > 0
    ? new Date(Math.max(...thresholds.map(t => new Date(t.submittedAt).getTime())))
    : null;

  if (earliestVibration && latestThresholdSubmitted) {
    if (latestThresholdSubmitted < earliestVibration) {
      basis.push(`阈值表提交时间(${formatDate(latestThresholdSubmitted)})早于振动数据最早时间(${formatDate(earliestVibration)})，存在阈值表早到补材料情况`);
      reproductionOrderSteps.push(`1. ${formatDate(latestThresholdSubmitted)} 提交阈值表`);
      reproductionOrderSteps.push(`2. ${formatDate(earliestVibration)} 产生振动数据`);
    } else {
      reproductionOrderSteps.push(`1. ${formatDate(earliestVibration)} 产生振动数据`);
      reproductionOrderSteps.push(`2. ${formatDate(latestThresholdSubmitted)} 提交阈值表`);
    }
  }

  const backfilledThresholds = thresholds.filter(t => t.isBackfilled);
  if (backfilledThresholds.length > 0) {
    basis.push(`发现 ${backfilledThresholds.length} 条阈值记录为补材料（isBackfilled=true），不影响故障结论判断`);
  }

  const manuallyModified = vibrationData.filter(v => v.isManuallyModified);
  if (manuallyModified.length > 0) {
    basis.push(`发现 ${manuallyModified.length} 条振动数据被手工改动，可能影响故障结论判断`);
    isAbnormal = true;
    manuallyModified.forEach(v => {
      if (v.modifiedAt && v.modifiedBy) {
        reproductionOrderSteps.push(`3. ${formatDate(new Date(v.modifiedAt))} ${v.modifiedBy} 手工修改振动数据`);
      }
    });
  }

  const warningTime = new Date(warningCreatedAt);
  const lateRepairs = thresholds.filter(t => {
    const submitted = new Date(t.submittedAt);
    const expected = new Date(t.expectedAt);
    return submitted > expected && submitted > warningTime;
  });

  if (lateRepairs.length > 0) {
    basis.push(`发现 ${lateRepairs.length} 条维修记录补填时间晚于故障发生时间，属于维修单晚补`);
  }

  const outOfRange = thresholds.filter(t =>
    t.actualValue < t.minValue || t.actualValue > t.maxValue
  );

  if (outOfRange.length > 0) {
    const metricNames = outOfRange.map(t => t.metric).join('、');
    basis.push(`以下指标超出阈值范围：${metricNames}`);
    isAbnormal = true;
  }

  const maxVibration = vibrationData.length > 0
    ? Math.max(...vibrationData.map(v => v.value))
    : 0;

  if (maxVibration > 8.0) {
    basis.push(`最大振动值 ${maxVibration.toFixed(2)} mm/s 超过安全阈值 8.0 mm/s`);
    isAbnormal = true;
  }

  let judgmentReason = '';
  if (isAbnormal) {
    judgmentReason = `故障复现顺序存在异常。${basis[basis.length - 1]}。建议重新核对原始数据，排除手工改动影响后再做结论。`;
  } else {
    judgmentReason = `故障复现顺序正常。数据提交时序完整，阈值表与振动数据时间线一致，未发现影响结论的手工改动。`;
  }

  return {
    id: `judgment_${Date.now()}`,
    warningId: '',
    isAbnormal,
    reproductionOrder: reproductionOrderSteps.join(' → '),
    judgmentReason,
    basis,
    judgedAt: new Date().toISOString(),
  };
}

export function generatePlainReason(judgment: FaultJudgment, deviceName: string): string {
  if (judgment.isAbnormal) {
    return `${deviceName} 设备故障判断存在疑问。主要原因是振动曲线数据有手工修改记录，可能会影响最终的故障结论。建议在确认原始数据无误后，再安排维修工作。`;
  }
  return `${deviceName} 设备运行数据正常，故障复现顺序无误。虽然存在一些补材料的记录（如阈值表提前提交、维修单后补），但这些都只是手续问题，不影响设备本身的故障判断结论。`;
}

export function generateNextSteps(judgment: FaultJudgment, deviceName: string) {
  if (judgment.isAbnormal) {
    return [
      {
        id: 'step_1',
        order: 1,
        description: `核对 ${deviceName} 振动曲线原始数据，确认手工改动的原因`,
        completed: false,
      },
      {
        id: 'step_2',
        order: 2,
        description: '联系当班维修工，了解数据修改时的现场情况',
        completed: false,
      },
      {
        id: 'step_3',
        order: 3,
        description: '重新进行故障复现测试，按标准顺序记录数据',
        completed: false,
      },
      {
        id: 'step_4',
        order: 4,
        description: '根据重新测试结果，更新故障判断结论',
        completed: false,
      },
    ];
  }
  return [
    {
      id: 'step_1',
      order: 1,
      description: `确认 ${deviceName} 设备停运，挂牌上锁`,
      completed: false,
    },
    {
      id: 'step_2',
      order: 2,
      description: '检查压缩机轴承，测量磨损情况',
      completed: false,
    },
    {
      id: 'step_3',
      order: 3,
      description: '如磨损超标，更换轴承；如正常，检查基础紧固',
      completed: false,
    },
    {
      id: 'step_4',
      order: 4,
      description: '维修完成后，空载试运行 30 分钟，记录振动数据',
      completed: false,
    },
    {
      id: 'step_5',
      order: 5,
      description: '试运行正常后，恢复设备运行',
      completed: false,
    },
  ];
}

function formatDate(date: Date): string {
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
