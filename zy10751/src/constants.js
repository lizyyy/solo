const LOG_PATTERNS = {
  OVERFLOW: /技能组.*溢出|overflow.*skill|队列.*满|queue.*full/i,
  ABANDON: /访客.*放弃|abandon.*visitor|用户.*离开|user.*leave/i,
  QUEUE_HOLD: /队列占位|queue.*hold|占位.*成功|hold.*success/i,
  VISITOR_REFRESH: /访客刷新|visitor.*refresh|页面刷新|page.*refresh/i,
  SKILL_GROUP_RENAME: /技能组.*改名|skill.*group.*rename|技能组.*更名/i
};

const EVENT_TYPES = {
  OVERFLOW: '溢出',
  ABANDON: '放弃',
  QUEUE_HOLD: '队列占位',
  VISITOR_REFRESH: '访客刷新',
  SKILL_GROUP_RENAME: '技能组改名'
};

module.exports = {
  LOG_PATTERNS,
  EVENT_TYPES
};
