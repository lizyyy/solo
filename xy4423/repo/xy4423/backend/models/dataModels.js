// 事件状态枚举
const EventStatus = {
  PENDING: 'pending', // 待处理
  CONFIRMED: 'confirmed', // 确认是流星
  REJECTED: 'rejected', // 不是流星（噪点、飞机等）
  NEEDS_REVIEW: 'needs_review', // 需要人工复核
  DUPLICATE: 'duplicate', // 重复观测
  CLOUD_OBSCURED: 'cloud_obscured', // 云层遮挡
  POWER_LOSS: 'power_loss' // 设备掉电
};

// 观测数据类型
const ObservationType = {
  CAMERA_TRIGGER: 'camera_trigger', // 相机触发日志
  VISUAL_RECORD: 'visual_record', // 目视记录表
  WEATHER_DATA: 'weather_data', // 天气云量数据
  BATTERY_DATA: 'battery_data' // 设备电池记录
};

// 创建一个基础观测数据对象
function createObservationData(type, sourceFile, rawData) {
  return {
    id: null, // 将在处理时分配
    type,
    sourceFile,
    rawData,
    timestamp: null, // 从原始数据中提取
    processed: false,
    createdAt: new Date().toISOString()
  };
}

// 创建一个事件对象
function createEvent(observations = []) {
  return {
    id: null, // 将在处理时分配
    status: EventStatus.PENDING,
    observations: [...observations],
    startTime: null, // 最早的观测时间
    endTime: null, // 最晚的观测时间
    confidence: 0, // 置信度（0-100）
    tags: [], // 标签（如：火球、火流星、群内流星等）
    notes: '', // 系统生成的备注
    adminComment: '', // 管理员的备注
    analysis: {
      isDuplicate: false,
      isCloudObscured: false,
      hasPowerLoss: false,
      needsManualReview: false,
      duplicateOf: null, // 如果是重复，指向原事件ID
      cloudCoverage: 0, // 云量百分比
      powerLossEvents: [] // 相关的掉电事件
    },
    createdAt: new Date().toISOString(),
    updatedAt: null
  };
}

// 从观测数据提取时间戳（根据不同类型）
function extractTimestampFromObservation(observation) {
  const { type, rawData } = observation;
  
  // 尝试从常见字段提取时间戳
  const timestampFields = ['timestamp', 'time', 'date', 'datetime', 'start_time', 'event_time'];
  
  for (const field of timestampFields) {
    if (rawData[field]) {
      const ts = rawData[field];
      // 尝试解析为时间戳
      try {
        if (typeof ts === 'number') {
          return new Date(ts * 1000).toISOString();
        }
        return new Date(ts).toISOString();
      } catch (e) {
        // 继续尝试其他字段
      }
    }
  }
  
  // 如果没有找到时间戳，返回当前时间（应该在前端提示用户）
  return new Date().toISOString();
}

// 导出
module.exports = {
  EventStatus,
  ObservationType,
  createObservationData,
  createEvent,
  extractTimestampFromObservation
};
