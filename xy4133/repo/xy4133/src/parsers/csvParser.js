import { parse } from 'csv-parse/sync';
import { timeToMs, ClipType } from '../types.js';

export function parseClipsCSV(content) {
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  
  const clips = [];
  
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const clip = parseClipRecord(record, i);
    if (clip) {
      clips.push(clip);
    }
  }
  
  return clips;
}

function parseClipRecord(record, index) {
  const startTime = findTimeField(record, ['start', 'startTime', 'start_time', '开始时间', '入点']);
  const endTime = findTimeField(record, ['end', 'endTime', 'end_time', '结束时间', '出点']);
  const duration = findTimeField(record, ['duration', '时长', '长度']);
  const name = findStringField(record, ['name', 'title', '名称', '标题', '片段名']);
  const type = findTypeField(record);
  const order = findOrderField(record, index);
  
  if (startTime === null && endTime === null) {
    return null;
  }
  
  const actualStartTime = startTime !== null ? startTime : endTime - (duration || 0);
  const actualEndTime = endTime !== null ? endTime : actualStartTime + (duration || 0);
  
  return {
    id: `clip_${order}`,
    order,
    name: name || `片段 ${order}`,
    type,
    startTime: actualStartTime,
    endTime: actualEndTime,
    duration: actualEndTime - actualStartTime,
    source: 'csv',
    raw: record
  };
}

function findTimeField(record, possibleKeys) {
  for (const key of possibleKeys) {
    for (const actualKey in record) {
      if (actualKey.toLowerCase() === key.toLowerCase()) {
        const value = record[actualKey];
        if (value === undefined || value === null || value === '') continue;
        if (typeof value === 'string') {
          if (value.includes(':') || value.includes('.')) {
            return timeToMs(value);
          }
          const num = parseFloat(value);
          if (!isNaN(num)) {
            return num * 1000;
          }
        }
        if (typeof value === 'number') {
          return value * 1000;
        }
      }
    }
  }
  return null;
}

function findStringField(record, possibleKeys) {
  for (const key of possibleKeys) {
    for (const actualKey in record) {
      if (actualKey.toLowerCase() === key.toLowerCase()) {
        const value = record[actualKey];
        if (value && typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
    }
  }
  return null;
}

function findTypeField(record) {
  const type = findStringField(record, ['type', '类型', '分类']);
  if (type) {
    const lower = type.toLowerCase();
    if (lower.includes('静音') || lower.includes('silence')) return ClipType.SILENCE;
    if (lower.includes('广告') || lower.includes('ad')) return ClipType.AD;
    if (lower.includes('章节') || lower.includes('chapter')) return ClipType.CHAPTER;
  }
  return ClipType.SEGMENT;
}

function findOrderField(record, defaultIndex) {
  const order = findTimeField(record, ['order', 'index', '序号', '顺序', '编号']);
  if (order !== null) {
    return Math.floor(order / 1000);
  }
  return defaultIndex + 1;
}
