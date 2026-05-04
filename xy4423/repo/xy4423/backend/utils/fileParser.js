const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const { v4: uuidv4 } = require('uuid');

const { ObservationType, createObservationData, extractTimestampFromObservation } = require('../models/dataModels');

// 解析文件
async function parseFile(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  
  let parsedData;
  
  if (ext === '.csv') {
    parsedData = await parseCSVFile(filePath);
  } else if (ext === '.json') {
    parsedData = await parseJSONFile(filePath);
  } else {
    throw new Error(`不支持的文件格式: ${ext}`);
  }
  
  // 推断数据类型
  const dataType = inferDataType(parsedData, originalName);
  
  // 处理数据
  const observations = [];
  
  if (Array.isArray(parsedData)) {
    // 多条记录
    for (const item of parsedData) {
      const obs = createObservationData(dataType, originalName, item);
      obs.id = uuidv4();
      obs.timestamp = extractTimestampFromObservation(obs);
      observations.push(obs);
    }
  } else {
    // 单条记录
    const obs = createObservationData(dataType, originalName, parsedData);
    obs.id = uuidv4();
    obs.timestamp = extractTimestampFromObservation(obs);
    observations.push(obs);
  }
  
  return {
    fileName: originalName,
    fileType: ext,
    dataType,
    recordCount: observations.length,
    observations
  };
}

// 解析 CSV 文件
async function parseCSVFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

// 解析 JSON 文件
async function parseJSONFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

// 推断数据类型
function inferDataType(data, fileName) {
  const fileNameLower = fileName.toLowerCase();
  
  // 基于文件名推断
  if (fileNameLower.includes('camera') || fileNameLower.includes('trigger') || fileNameLower.includes('相机')) {
    return ObservationType.CAMERA_TRIGGER;
  }
  
  if (fileNameLower.includes('visual') || fileNameLower.includes('目视') || fileNameLower.includes('记录')) {
    return ObservationType.VISUAL_RECORD;
  }
  
  if (fileNameLower.includes('weather') || fileNameLower.includes('cloud') || fileNameLower.includes('天气') || fileNameLower.includes('云量')) {
    return ObservationType.WEATHER_DATA;
  }
  
  if (fileNameLower.includes('battery') || fileNameLower.includes('power') || fileNameLower.includes('电池') || fileNameLower.includes('电量')) {
    return ObservationType.BATTERY_DATA;
  }
  
  // 基于数据内容推断
  if (Array.isArray(data) && data.length > 0) {
    const sample = data[0];
    return inferDataTypeFromSample(sample);
  } else if (data && typeof data === 'object') {
    return inferDataTypeFromSample(data);
  }
  
  // 默认返回相机触发类型
  return ObservationType.CAMERA_TRIGGER;
}

// 从样本数据推断类型
function inferDataTypeFromSample(sample) {
  const keys = Object.keys(sample).map(k => k.toLowerCase());
  
  // 检查是否是天气数据
  if (keys.some(k => k.includes('cloud') || k.includes('云量') || k.includes('weather') || k.includes('天气'))) {
    return ObservationType.WEATHER_DATA;
  }
  
  // 检查是否是电池数据
  if (keys.some(k => k.includes('battery') || k.includes('电池') || k.includes('power') || k.includes('电量') || k.includes('voltage') || k.includes('电压'))) {
    return ObservationType.BATTERY_DATA;
  }
  
  // 检查是否是目视记录
  if (keys.some(k => k.includes('observer') || k.includes('观测者') || k.includes('magnitude') || k.includes('星等') || k.includes('comment') || k.includes('备注'))) {
    return ObservationType.VISUAL_RECORD;
  }
  
  // 默认返回相机触发类型
  return ObservationType.CAMERA_TRIGGER;
}

module.exports = {
  parseFile,
  parseCSVFile,
  parseJSONFile,
  inferDataType
};
