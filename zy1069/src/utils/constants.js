export const AGE_GROUP = {
  INFANT: 'infant',
  CHILD: 'child',
  TEEN: 'teen',
  ADULT: 'adult',
  ELDERLY: 'elderly'
}

export const AGE_GROUP_LABELS = {
  [AGE_GROUP.INFANT]: '婴幼儿 (0-3岁)',
  [AGE_GROUP.CHILD]: '儿童 (4-12岁)',
  [AGE_GROUP.TEEN]: '青少年 (13-17岁)',
  [AGE_GROUP.ADULT]: '成年人 (18-64岁)',
  [AGE_GROUP.ELDERLY]: '老年人 (65岁以上)'
}

export const AGE_GROUP_RANGES = {
  [AGE_GROUP.INFANT]: { min: 0, max: 3 },
  [AGE_GROUP.CHILD]: { min: 4, max: 12 },
  [AGE_GROUP.TEEN]: { min: 13, max: 17 },
  [AGE_GROUP.ADULT]: { min: 18, max: 64 },
  [AGE_GROUP.ELDERLY]: { min: 65, max: 150 }
}

export const MEAL_TIMING = {
  BEFORE: 'before',
  AFTER: 'after',
  ANY: 'any'
}

export const MEAL_TIMING_LABELS = {
  [MEAL_TIMING.BEFORE]: '饭前',
  [MEAL_TIMING.AFTER]: '饭后',
  [MEAL_TIMING.ANY]: '不限'
}

export const DOSE_STATUS = {
  PENDING: 'pending',
  TAKEN: 'taken',
  MISSED: 'missed',
  SKIPPED: 'skipped'
}

export const DOSE_STATUS_LABELS = {
  [DOSE_STATUS.PENDING]: '待服用',
  [DOSE_STATUS.TAKEN]: '已服用',
  [DOSE_STATUS.MISSED]: '漏服',
  [DOSE_STATUS.SKIPPED]: '已跳过'
}

export const RISK_LEVEL = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
}

export const RISK_LEVEL_LABELS = {
  [RISK_LEVEL.HIGH]: '高风险',
  [RISK_LEVEL.MEDIUM]: '中风险',
  [RISK_LEVEL.LOW]: '低风险'
}

export const APPLICABLE_POPULATION = {
  ALL: 'all',
  INFANT: 'infant',
  CHILD: 'child',
  TEEN: 'teen',
  ADULT: 'adult',
  ELDERLY: 'elderly'
}

export const APPLICABLE_POPULATION_LABELS = {
  [APPLICABLE_POPULATION.ALL]: '所有人群',
  [APPLICABLE_POPULATION.INFANT]: '婴幼儿',
  [APPLICABLE_POPULATION.CHILD]: '儿童',
  [APPLICABLE_POPULATION.TEEN]: '青少年',
  [APPLICABLE_POPULATION.ADULT]: '成年人',
  [APPLICABLE_POPULATION.ELDERLY]: '老年人'
}

export const STORAGE_KEYS = {
  FAMILY_MEMBERS: 'family_members',
  MEDICINES: 'medicines',
  MEDICATION_PLANS: 'medication_plans',
  DOSE_HISTORY: 'dose_history',
  INITIALIZED: 'app_initialized'
}
