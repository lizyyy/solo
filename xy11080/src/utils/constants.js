const STATUS_FLOW = {
  pending: ['confirmed', 'manual_review', 'cancelled'],
  manual_review: ['confirmed', 'cancelled', 'compensating'],
  confirmed: ['compensating', 'cancelled'],
  compensating: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

const STATUS_LABELS = {
  pending: '待审核',
  manual_review: '待人工处理',
  confirmed: '已确认',
  compensating: '补偿中',
  completed: '已完成',
  cancelled: '已取消'
};

const POOL_TYPES = ['婴儿池', '幼儿池', '亲子池', '儿童池', '成人池'];

const COMPENSATION_TYPES = ['课时补偿', '现金补偿', '礼品补偿', '积分补偿'];

const TIME_SLOTS = ['上午', '下午', '晚上'];

const COMPENSATION_TABLE_VERSIONS = ['v1.0', 'v1.1', 'v2.0'];

const STANDARD_TEMPS = {
  '婴儿池': { min: 34, max: 36 },
  '幼儿池': { min: 32, max: 34 },
  '亲子池': { min: 31, max: 33 },
  '儿童池': { min: 30, max: 32 },
  '成人池': { min: 27, max: 29 }
};

const ERROR_SUGGESTIONS = {
  MISSING_REQUIRED: '请补充必填字段后重新导入',
  INVALID_TEMP_RANGE: '请检查水温范围是否合理（20-40℃）',
  INVALID_DATE: '请使用正确的日期格式（YYYY-MM-DD）',
  DUPLICATE_RECORD_NO: '记录编号已存在，请检查后重新导入',
  INVALID_POOL_TYPE: `泳池类型必须是：${POOL_TYPES.join('、')}`,
  INVALID_TIME_SLOT: `时段必须是：${TIME_SLOTS.join('、')}`,
  INVALID_COUNT: '人数必须是正整数',
  TEMP_CONSISTENCY_ISSUE: '水温不达标但补偿表一致，需人工确认后继续'
};

module.exports = {
  STATUS_FLOW,
  STATUS_LABELS,
  POOL_TYPES,
  COMPENSATION_TYPES,
  TIME_SLOTS,
  COMPENSATION_TABLE_VERSIONS,
  STANDARD_TEMPS,
  ERROR_SUGGESTIONS
};