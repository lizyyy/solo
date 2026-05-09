const TEMPERATURE_THRESHOLDS = {
  '冷冻区': { min: -25, max: -15 },
  '冷藏区': { min: 0, max: 8 },
  '保鲜区': { min: 8, max: 15 },
  '常温区': { min: 15, max: 30 }
};

const DATA_SOURCES = {
  WMS: 'WMS系统',
  TEMPERATURE_LOG: '温度记录仪',
  MANUAL_INVENTORY: '人工盘点'
};

const EXCEPTION_TYPES = {
  LOT_MISMATCH: '批号不匹配',
  TEMPERATURE_BREAK: '温度断点',
  TEMPERATURE_OUT_OF_RANGE: '温度超标',
  QUANTITY_DIFFERENCE: '数量差异',
  MISSING_LOT: '批号缺失',
  DUPLICATE_LOT: '批号重复',
  CROSS_ZONE_MOVEMENT: '跨温区移动'
};

module.exports = {
  TEMPERATURE_THRESHOLDS,
  DATA_SOURCES,
  EXCEPTION_TYPES
};
