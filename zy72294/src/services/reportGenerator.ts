import type * as T from '@/types';

const SAFE_DISTANCE = 1.2;

export function generateReason(
  record: T.RangefinderRecord,
  estimation: T.VolumeEstimation,
  review?: T.AlarmReview
): string {
  if (record.distance < SAFE_DISTANCE) {
    return `实测距离仅${record.distance}米，小于安全距离标准${SAFE_DISTANCE}米，需保留此告警。`;
  }
  if (review?.reviewStatus === 'abnormal') {
    return `施工经理复核判定为异常：${review.reviewComment || '未填写复核意见'}`;
  }
  if (review?.reviewStatus === 'onsite') {
    return `需现场复核确认：${review.reviewComment || '未填写复核意见'}`;
  }
  if (estimation.volume > 100) {
    return `堆垛体积约${estimation.volume.toFixed(2)}立方米，体量较大需保留观察。`;
  }
  return '距离符合安全标准，但因障碍物类型特殊需保留观察。';
}

export function determineMissingMaterials(
  record: T.RangefinderRecord,
  estimation: T.VolumeEstimation
): string[] {
  const materials: string[] = [];
  const distance = record.distance;

  if (distance < 1.2) {
    materials.push('隔离桩3根');
    materials.push('警示牌2块');
  } else if (distance < 3) {
    materials.push('隔离桩2根');
    materials.push('警示牌1块');
  } else if (distance < 5) {
    materials.push('警示牌1块');
  }

  if (estimation.volume > 50) {
    materials.push('警戒线1卷');
  }

  if (record.alarmOccluded) {
    materials.push('告警标签更换');
  }

  return materials;
}

export function determineNextStep(review?: T.AlarmReview): {
  nextStep: string;
  nextOwner: T.SafetyReport['nextOwner'];
} {
  if (!review) {
    return {
      nextStep: '园区运维现场核实障碍物情况，补充备注信息',
      nextOwner: 'operator',
    };
  }

  switch (review.reviewStatus) {
    case 'pending':
      return {
        nextStep: '请施工经理尽快复核告警遮挡项，给出明确结论',
        nextOwner: 'manager',
      };
    case 'normal':
      return {
        nextStep: '定期巡检，持续观察堆垛状态变化',
        nextOwner: 'operator',
      };
    case 'abnormal':
      return {
        nextStep: '立即协调施工队进行整改，3日内反馈整改结果',
        nextOwner: 'manager',
      };
    case 'onsite':
      return {
        nextStep: '安排施工经理现场复核，24小时内给出最终结论',
        nextOwner: 'manager',
      };
    default:
      return {
        nextStep: '园区运维现场核实障碍物情况，补充备注信息',
        nextOwner: 'operator',
      };
  }
}
