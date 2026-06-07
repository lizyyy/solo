const { BUCKET_NAMES } = require('./models/types');

const BOUNDARY_RULES = {
  ONE_BUCKET_DIFF: {
    id: 'ONE_BUCKET_DIFF',
    name: '离线和线上分数差了一个桶',
    description: '离线评测结果和线上实验结果的分桶相差1级（例如离线是"良好"，线上是"一般"）',
    triggerCondition: (note) => {
      const offlineIdx = BUCKET_NAMES.indexOf(note.offlineBucket);
      const onlineIdx = BUCKET_NAMES.indexOf(note.onlineBucket);
      if (offlineIdx === -1 || onlineIdx === -1) return false;
      return Math.abs(onlineIdx - offlineIdx) === 1;
    },
    judgment: '需要人工复核，不能自动判定为正常或异常',
    handling: {
      who: '评测运营',
      actions: [
        '查看该条阈值调参笔记详情',
        '核对对应的线上实验桶数据',
        '根据实际情况判定为正常或异常',
        '记录复核意见'
      ]
    },
    modification: {
      ifNormal: '保留当前数据，标记为已复核正常',
      ifAbnormal: '回退到导入步骤，重新导入修正后的数据'
    },
    rollback: {
      allowed: true,
      targetSteps: ['imported'],
      note: '回滚后需要重新走完整的工作流'
    },
    autoMarkNormal: false
  },
  SAME_BUCKET: {
    id: 'SAME_BUCKET',
    name: '离线和线上分桶一致',
    description: '离线评测结果和线上实验结果分桶相同',
    triggerCondition: (note) => {
      const offlineIdx = BUCKET_NAMES.indexOf(note.offlineBucket);
      const onlineIdx = BUCKET_NAMES.indexOf(note.onlineBucket);
      if (offlineIdx === -1 || onlineIdx === -1) return false;
      return offlineIdx === onlineIdx;
    },
    judgment: '正常情况，可自动通过',
    handling: {
      who: '系统自动处理',
      actions: ['标记为正常']
    },
    autoMarkNormal: true
  },
  MORE_THAN_ONE_BUCKET_DIFF: {
    id: 'MORE_THAN_ONE_BUCKET_DIFF',
    name: '离线和线上分桶相差超过1级',
    description: '离线评测结果和线上实验结果分桶相差2级及以上',
    triggerCondition: (note) => {
      const offlineIdx = BUCKET_NAMES.indexOf(note.offlineBucket);
      const onlineIdx = BUCKET_NAMES.indexOf(note.onlineBucket);
      if (offlineIdx === -1 || onlineIdx === -1) return false;
      return Math.abs(onlineIdx - offlineIdx) >= 2;
    },
    judgment: '异常情况，需要重点关注',
    handling: {
      who: '推荐策略 + 评测运营共同复核',
      actions: [
        '检查离线评测流程是否正确',
        '检查线上实验配置是否正确',
        '排查数据一致性问题',
        '决定是否需要重新实验'
      ]
    },
    autoMarkNormal: false
  }
};

function checkBoundaryRules(note) {
  const triggered = [];
  for (const rule of Object.values(BOUNDARY_RULES)) {
    if (rule.triggerCondition(note)) {
      triggered.push({
        ruleId: rule.id,
        ruleName: rule.name,
        description: rule.description,
        judgment: rule.judgment,
        handling: rule.handling,
        autoMarkNormal: rule.autoMarkNormal
      });
    }
  }
  return triggered;
}

function getBoundaryRulesSummary() {
  return Object.values(BOUNDARY_RULES).map(rule => ({
    id: rule.id,
    name: rule.name,
    description: rule.description,
    judgment: rule.judgment,
    autoMarkNormal: rule.autoMarkNormal,
    handler: rule.handling.who
  }));
}

module.exports = {
  BOUNDARY_RULES,
  checkBoundaryRules,
  getBoundaryRulesSummary
};
