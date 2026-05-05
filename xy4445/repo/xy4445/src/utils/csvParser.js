import { QUEEN_STATUS } from '../models';

export const parseCSV = (csvText) => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      data.push(row);
    }
  }
  
  return data;
};

export const parseHiveLedger = (csvText) => {
  const data = parseCSV(csvText);
  return data.map(row => ({
    id: row['蜂箱id'] || row['hiveid'] || row['id'],
    x: parseFloat(row['x坐标'] || row['x'] || 0),
    y: parseFloat(row['y坐标'] || row['y'] || 0),
    queenStatus: parseQueenStatus(row['蜂王状态'] || row['queenstatus']),
    colonyCount: parseInt(row['蜂群数量'] || row['colonycount'] || 0),
    establishedDate: row['建立日期'] || row['establisheddate'] || null,
    notes: row['备注'] || row['notes'] || ''
  })).filter(hive => hive.id);
};

export const parseSensorData = (csvText) => {
  const data = parseCSV(csvText);
  return data.map(row => ({
    hiveId: row['蜂箱id'] || row['hiveid'] || row['id'],
    temperature: parseFloat(row['温度'] || row['temperature'] || 0),
    humidity: parseFloat(row['湿度'] || row['humidity'] || 0),
    timestamp: row['时间戳'] || row['timestamp'] || new Date().toISOString()
  })).filter(sensor => sensor.hiveId);
};

export const parseInspectionRecords = (csvText) => {
  const data = parseCSV(csvText);
  return data.map(row => ({
    hiveId: row['蜂箱id'] || row['hiveid'] || row['id'],
    inspectionDate: row['检查日期'] || row['inspectiondate'] || new Date().toISOString(),
    queenObserved: (row['蜂王观察'] || row['queenobserved'] || 'false').toLowerCase() === 'true',
    broodPattern: row['子脾模式'] || row['broodpattern'] || 'normal',
    honeyStores: row['储蜜情况'] || row['honeystores'] || 'normal',
    pestsDiseases: row['病虫害'] || row['pestsdiseases'] || 'none',
    notes: row['检查备注'] || row['inspectionnotes'] || ''
  })).filter(record => record.hiveId);
};

export const parseWateringShadingSchedule = (csvText) => {
  const data = parseCSV(csvText);
  return data.map(row => ({
    hiveId: row['蜂箱id'] || row['hiveid'] || row['id'],
    lastWatering: row['上次补水日期'] || row['lastwatering'] || null,
    nextWatering: row['下次补水日期'] || row['nextwatering'] || null,
    shadingEnabled: (row['遮阴状态'] || row['shadingenabled'] || 'false').toLowerCase() === 'true',
    shadingNotes: row['遮阴备注'] || row['shadingnotes'] || ''
  })).filter(schedule => schedule.hiveId);
};

const parseQueenStatus = (status) => {
  if (!status) return QUEEN_STATUS.NORMAL;
  
  const statusLower = status.toLowerCase();
  if (statusLower === '正常' || statusLower === 'normal') return QUEEN_STATUS.NORMAL;
  if (statusLower === '产卵' || statusLower === 'laying') return QUEEN_STATUS.LAYING;
  if (statusLower === '未见' || statusLower === 'unseen') return QUEEN_STATUS.UNSEEN;
  if (statusLower === '异常' || statusLower === 'abnormal') return QUEEN_STATUS.ABNORMAL;
  
  return QUEEN_STATUS.NORMAL;
};
