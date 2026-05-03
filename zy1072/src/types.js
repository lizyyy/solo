export const GUEST_REQUIRED_FIELDS = [
  '姓名',
  '分组',
  '关系标签'
];

export const GUEST_OPTIONAL_FIELDS = [
  '同行人',
  '忌口/过敏',
  '行动不便',
  '儿童',
  '是否需要安静区',
  '优先同桌',
  '避免同桌',
  'VIP',
  '桌号'
];

export const TABLE_REQUIRED_FIELDS = [
  '桌号',
  '容量'
];

export const TABLE_OPTIONAL_FIELDS = [
  '区域',
  '离舞台距离',
  '离音箱距离',
  '离出口距离',
  '是否儿童友好',
  '是否安静区'
];

export const CONFLICT_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

export const CONFLICT_TYPES = {
  FIELD_MISSING: 'field_missing',
  DUPLICATE_NAME: 'duplicate_name',
  TABLE_OVER_CAPACITY: 'table_over_capacity',
  COMPANIONS_SEPARATED: 'companions_separated',
  AVOID_CONFLICT: 'avoid_conflict',
  ACCESSIBILITY_ISSUE: 'accessibility_issue',
  CHILDREN_WITHOUT_ADULT: 'children_without_adult',
  DIET_NOT_SUMMARIZED: 'diet_not_summarized',
  VIP_BAD_SEAT: 'vip_bad_seat',
  TABLE_NOT_EXIST: 'table_not_exist',
  GUEST_NOT_SEATED: 'guest_not_seated'
};
