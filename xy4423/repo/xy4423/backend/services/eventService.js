const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { EventStatus, ObservationType, createEvent } = require('../models/dataModels');

// 数据存储路径
const DATA_FILE = path.join(__dirname, '../data/events.json');

// 时间窗口配置（毫秒）
const TIME_WINDOW_CONFIG = {
  // 同一事件的时间窗口（默认 5 秒）
  EVENT_TIME_WINDOW: 5000,
  // 重复观测的时间窗口（默认 10 秒）
  DUPLICATE_TIME_WINDOW: 10000,
  // 云层遮挡的时间窗口（默认 30 秒）
  CLOUD_WINDOW: 30000,
  // 设备掉电的时间窗口（默认 60 秒）
  POWER_LOSS_WINDOW: 60000
};

// 云量阈值（百分比）
const CLOUD_COVERAGE_THRESHOLD = 70;

// 电池掉电阈值（电压或百分比）
const BATTERY_LOW_THRESHOLD = 20; // 百分比

// 内存中的事件存储
let events = [];

// 初始化数据存储
function initDataStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      events = JSON.parse(content);
      console.log(`已加载 ${events.length} 个事件`);
    }
  } catch (error) {
    console.error('加载数据失败:', error);
    events = [];
  }
}

// 保存数据到文件
function saveDataToFile() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(events, null, 2), 'utf-8');
  } catch (error) {
    console.error('保存数据失败:', error);
  }
}

// 处理导入的数据
async function processImportedData(importResults) {
  // 收集所有观测数据
  let allObservations = [];
  
  for (const result of importResults) {
    if (result.observations && Array.isArray(result.observations)) {
      allObservations = allObservations.concat(result.observations);
    }
  }
  
  // 按时间排序
  allObservations.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  // 分离不同类型的数据
  const cameraObservations = allObservations.filter(o => o.type === ObservationType.CAMERA_TRIGGER);
  const visualObservations = allObservations.filter(o => o.type === ObservationType.VISUAL_RECORD);
  const weatherObservations = allObservations.filter(o => o.type === ObservationType.WEATHER_DATA);
  const batteryObservations = allObservations.filter(o => o.type === ObservationType.BATTERY_DATA);
  
  // 第一步：基于相机触发和目视记录创建初始事件
  let newEvents = [];
  
  // 处理相机触发数据
  for (const obs of cameraObservations) {
    const event = findOrCreateEvent(obs, newEvents);
    if (!event.observations.find(o => o.id === obs.id)) {
      event.observations.push(obs);
    }
  }
  
  // 处理目视记录数据
  for (const obs of visualObservations) {
    const event = findOrCreateEvent(obs, newEvents);
    if (!event.observations.find(o => o.id === obs.id)) {
      event.observations.push(obs);
    }
  }
  
  // 第二步：分析每个事件
  for (const event of newEvents) {
    // 计算事件时间范围
    const timestamps = event.observations.map(o => new Date(o.timestamp).getTime());
    event.startTime = new Date(Math.min(...timestamps)).toISOString();
    event.endTime = new Date(Math.max(...timestamps)).toISOString();
    
    // 计算置信度
    event.confidence = calculateConfidence(event);
    
    // 检查重复观测
    checkDuplicateObservations(event, newEvents);
    
    // 检查云层遮挡
    checkCloudObscuration(event, weatherObservations);
    
    // 检查设备掉电
    checkPowerLoss(event, batteryObservations);
    
    // 确定状态
    determineEventStatus(event);
    
    // 生成系统备注
    generateSystemNotes(event);
    
    // 分配 ID
    if (!event.id) {
      event.id = uuidv4();
    }
  }
  
  // 合并到现有事件
  events = events.concat(newEvents);
  
  // 保存数据
  saveDataToFile();
  
  return newEvents;
}

// 查找或创建事件
function findOrCreateEvent(observation, existingEvents) {
  const obsTime = new Date(observation.timestamp).getTime();
  
  // 查找是否有时间相近的事件
  for (const event of existingEvents) {
    const eventStartTime = new Date(event.startTime || event.observations[0].timestamp).getTime();
    const eventEndTime = new Date(event.endTime || event.observations[event.observations.length - 1].timestamp).getTime();
    
    // 检查是否在时间窗口内
    if (obsTime >= eventStartTime - TIME_WINDOW_CONFIG.EVENT_TIME_WINDOW &&
        obsTime <= eventEndTime + TIME_WINDOW_CONFIG.EVENT_TIME_WINDOW) {
      return event;
    }
  }
  
  // 创建新事件
  const newEvent = createEvent();
  existingEvents.push(newEvent);
  return newEvent;
}

// 计算置信度
function calculateConfidence(event) {
  let confidence = 50; // 基础置信度
  
  const cameraCount = event.observations.filter(o => o.type === ObservationType.CAMERA_TRIGGER).length;
  const visualCount = event.observations.filter(o => o.type === ObservationType.VISUAL_RECORD).length;
  
  // 多数据源确认增加置信度
  if (cameraCount > 0 && visualCount > 0) {
    confidence += 30;
  }
  
  // 多个相机触发增加置信度
  if (cameraCount > 1) {
    confidence += 10;
  }
  
  // 多个目视记录增加置信度
  if (visualCount > 1) {
    confidence += 10;
  }
  
  // 限制在 0-100 范围内
  return Math.min(100, Math.max(0, confidence));
}

// 检查重复观测
function checkDuplicateObservations(event, allEvents) {
  const eventTime = new Date(event.startTime).getTime();
  
  for (const otherEvent of allEvents) {
    if (otherEvent.id === event.id || !otherEvent.id) continue;
    
    const otherTime = new Date(otherEvent.startTime).getTime();
    const timeDiff = Math.abs(eventTime - otherTime);
    
    // 如果时间非常接近，可能是重复观测
    if (timeDiff < TIME_WINDOW_CONFIG.DUPLICATE_TIME_WINDOW) {
      // 检查观测数据的相似性
      const sameSource = event.observations.some(o1 => 
        otherEvent.observations.some(o2 => 
          o1.sourceFile === o2.sourceFile && 
          Math.abs(new Date(o1.timestamp).getTime() - new Date(o2.timestamp).getTime()) < 1000
        )
      );
      
      if (sameSource || (timeDiff < 2000)) {
        event.analysis.isDuplicate = true;
        event.analysis.duplicateOf = otherEvent.id;
        break;
      }
    }
  }
}

// 检查云层遮挡
function checkCloudObscuration(event, weatherObservations) {
  if (weatherObservations.length === 0) return;
  
  const eventStartTime = new Date(event.startTime).getTime();
  const eventEndTime = new Date(event.endTime).getTime();
  
  // 查找事件时间附近的天气数据
  const relevantWeather = weatherObservations.filter(weather => {
    const weatherTime = new Date(weather.timestamp).getTime();
    return weatherTime >= eventStartTime - TIME_WINDOW_CONFIG.CLOUD_WINDOW &&
           weatherTime <= eventEndTime + TIME_WINDOW_CONFIG.CLOUD_WINDOW;
  });
  
  if (relevantWeather.length > 0) {
    // 计算平均云量
    let totalCloudCoverage = 0;
    let validReadings = 0;
    
    for (const weather of relevantWeather) {
      const cloudCoverage = parseCloudCoverage(weather.rawData);
      if (cloudCoverage !== null) {
        totalCloudCoverage += cloudCoverage;
        validReadings++;
      }
    }
    
    if (validReadings > 0) {
      const avgCloudCoverage = totalCloudCoverage / validReadings;
      event.analysis.cloudCoverage = avgCloudCoverage;
      
      if (avgCloudCoverage >= CLOUD_COVERAGE_THRESHOLD) {
        event.analysis.isCloudObscured = true;
      }
    }
  }
}

// 解析云量数据
function parseCloudCoverage(rawData) {
  // 尝试从常见字段提取云量
  const cloudFields = ['cloud_coverage', 'cloud_cover', 'clouds', '云量', 'cloud_percent'];
  
  for (const field of cloudFields) {
    if (rawData[field] !== undefined && rawData[field] !== null) {
      const value = parseFloat(rawData[field]);
      if (!isNaN(value)) {
        // 如果是 0-1 的小数，转换为百分比
        if (value <= 1) {
          return value * 100;
        }
        return value;
      }
    }
  }
  
  return null;
}

// 检查设备掉电
function checkPowerLoss(event, batteryObservations) {
  if (batteryObservations.length === 0) return;
  
  const eventStartTime = new Date(event.startTime).getTime();
  const eventEndTime = new Date(event.endTime).getTime();
  
  // 查找事件时间附近的电池数据
  const relevantBattery = batteryObservations.filter(battery => {
    const batteryTime = new Date(battery.timestamp).getTime();
    return batteryTime >= eventStartTime - TIME_WINDOW_CONFIG.POWER_LOSS_WINDOW &&
           batteryTime <= eventEndTime + TIME_WINDOW_CONFIG.POWER_LOSS_WINDOW;
  });
  
  if (relevantBattery.length > 0) {
    // 检查是否有低电量或掉电事件
    const powerLossEvents = [];
    
    for (const battery of relevantBattery) {
      const batteryLevel = parseBatteryLevel(battery.rawData);
      
      if (batteryLevel !== null && batteryLevel <= BATTERY_LOW_THRESHOLD) {
        powerLossEvents.push({
          id: battery.id,
          timestamp: battery.timestamp,
          batteryLevel,
          sourceFile: battery.sourceFile
        });
      }
      
      // 检查是否有明确的掉电标记
      if (battery.rawData.power_loss === true || 
          battery.rawData.power_loss === 'true' ||
          battery.rawData['掉电'] === true ||
          battery.rawData['掉电'] === 'true') {
        powerLossEvents.push({
          id: battery.id,
          timestamp: battery.timestamp,
          isPowerLoss: true,
          sourceFile: battery.sourceFile
        });
      }
    }
    
    if (powerLossEvents.length > 0) {
      event.analysis.hasPowerLoss = true;
      event.analysis.powerLossEvents = powerLossEvents;
    }
  }
}

// 解析电池电量
function parseBatteryLevel(rawData) {
  // 尝试从常见字段提取电池电量
  const batteryFields = ['battery', 'battery_level', 'power', '电量', 'voltage', '电压'];
  
  for (const field of batteryFields) {
    if (rawData[field] !== undefined && rawData[field] !== null) {
      const value = parseFloat(rawData[field]);
      if (!isNaN(value)) {
        return value;
      }
    }
  }
  
  return null;
}

// 确定事件状态
function determineEventStatus(event) {
  // 优先级：掉电 > 云层遮挡 > 重复 > 需要复核 > 待处理
  
  if (event.analysis.hasPowerLoss) {
    event.status = EventStatus.POWER_LOSS;
    return;
  }
  
  if (event.analysis.isCloudObscured) {
    event.status = EventStatus.CLOUD_OBSCURED;
    return;
  }
  
  if (event.analysis.isDuplicate) {
    event.status = EventStatus.DUPLICATE;
    return;
  }
  
  // 检查是否需要人工复核
  if (shouldNeedReview(event)) {
    event.status = EventStatus.NEEDS_REVIEW;
    event.analysis.needsManualReview = true;
    return;
  }
  
  // 默认待处理
  event.status = EventStatus.PENDING;
}

// 判断是否需要人工复核
function shouldNeedReview(event) {
  // 低置信度需要复核
  if (event.confidence < 60) {
    return true;
  }
  
  // 只有单一数据源需要复核
  const cameraCount = event.observations.filter(o => o.type === ObservationType.CAMERA_TRIGGER).length;
  const visualCount = event.observations.filter(o => o.type === ObservationType.VISUAL_RECORD).length;
  
  if ((cameraCount === 0 && visualCount > 0) || (cameraCount > 0 && visualCount === 0)) {
    return true;
  }
  
  return false;
}

// 生成系统备注
function generateSystemNotes(event) {
  const notes = [];
  
  const cameraCount = event.observations.filter(o => o.type === ObservationType.CAMERA_TRIGGER).length;
  const visualCount = event.observations.filter(o => o.type === ObservationType.VISUAL_RECORD).length;
  
  notes.push(`事件包含 ${cameraCount} 个相机触发记录和 ${visualCount} 个目视记录。`);
  notes.push(`系统置信度: ${event.confidence}%`);
  
  if (event.analysis.isDuplicate) {
    notes.push(`⚠️ 可能是重复观测，参考事件 ID: ${event.analysis.duplicateOf}`);
  }
  
  if (event.analysis.isCloudObscured) {
    notes.push(`☁️ 观测期间云量较高 (${event.analysis.cloudCoverage.toFixed(1)}%)，可能影响观测质量`);
  }
  
  if (event.analysis.hasPowerLoss) {
    notes.push(`⚡ 观测期间检测到 ${event.analysis.powerLossEvents.length} 个低电量/掉电事件`);
  }
  
  if (event.analysis.needsManualReview) {
    notes.push(`👁️ 建议人工复核此事件`);
  }
  
  event.notes = notes.join('\n');
}

// 获取所有事件
async function getAllEvents() {
  // 按时间排序
  return events.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
}

// 获取单个事件
async function getEventById(id) {
  return events.find(e => e.id === id);
}

// 更新事件
async function updateEvent(id, updates) {
  const eventIndex = events.findIndex(e => e.id === id);
  if (eventIndex === -1) return null;
  
  // 合并更新
  events[eventIndex] = {
    ...events[eventIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  saveDataToFile();
  return events[eventIndex];
}

// 批量更新事件
async function batchUpdateEvents(eventIds, updates) {
  let updatedCount = 0;
  const updatedEvents = [];
  
  for (const id of eventIds) {
    const eventIndex = events.findIndex(e => e.id === id);
    if (eventIndex !== -1) {
      events[eventIndex] = {
        ...events[eventIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      updatedEvents.push(events[eventIndex]);
      updatedCount++;
    }
  }
  
  saveDataToFile();
  
  return {
    updatedCount,
    updatedEvents
  };
}

// 清除所有数据
async function clearAllData() {
  events = [];
  saveDataToFile();
  return true;
}

// 初始化数据存储
initDataStore();

module.exports = {
  processImportedData,
  getAllEvents,
  getEventById,
  updateEvent,
  batchUpdateEvents,
  clearAllData
};
