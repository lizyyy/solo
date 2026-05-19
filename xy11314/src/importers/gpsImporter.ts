import fs from 'fs';
import { dao } from '../database/dao';
import { generateBatchId } from '../database/init';
import { GPSRecord, BadRecord, ImportResult } from '../types';

interface GPSDataRow {
  deviceId: string;
  driverId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  speed: number;
  accuracy: number;
}

export async function importGPSJSON(filePath: string): Promise<ImportResult> {
  const batchId = generateBatchId();
  const badRecords: BadRecord[] = [];
  let successCount = 0;

  const rawData = fs.readFileSync(filePath, 'utf-8');
  let gpsData: GPSDataRow[];

  try {
    const parsed = JSON.parse(rawData);
    gpsData = Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    const badRecord: BadRecord = {
      importBatchId: batchId,
      sourceType: 'gps_json',
      rawData: rawData.substring(0, 500),
      failureReason: 'JSON 解析失败',
      suggestedFix: '请检查 JSON 格式是否正确，确保是一个数组'
    };
    await dao.insertBadRecord(badRecord);
    return {
      batchId,
      successCount: 0,
      failureCount: 1,
      badRecords: [badRecord]
    };
  }

  for (let i = 0; i < gpsData.length; i++) {
    const row = gpsData[i];
    const validation = validateGPSRow(row, i + 1);

    if (!validation.valid) {
      const badRecord: BadRecord = {
        importBatchId: batchId,
        sourceType: 'gps_json',
        rawData: JSON.stringify(row),
        rowNumber: i + 1,
        failureReason: validation.reason!,
        suggestedFix: validation.suggestedFix!
      };
      await dao.insertBadRecord(badRecord);
      badRecords.push(badRecord);
      continue;
    }

    const gpsRecord: GPSRecord = {
      deviceId: String(row.deviceId).trim(),
      driverId: String(row.driverId).trim(),
      timestamp: String(row.timestamp).trim(),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      speed: Number(row.speed),
      accuracy: Number(row.accuracy),
      importBatchId: batchId
    };

    const id = await dao.insertGPSRecord(gpsRecord);
    if (id > 0) successCount++;
  }

  return {
    batchId,
    successCount,
    failureCount: badRecords.length,
    badRecords
  };
}

function validateGPSRow(
  row: GPSDataRow,
  rowNumber: number
): { valid: boolean; reason?: string; suggestedFix?: string } {
  if (!row.deviceId || String(row.deviceId).trim() === '') {
    return {
      valid: false,
      reason: `第 ${rowNumber} 条: deviceId 不能为空`,
      suggestedFix: '请填写设备ID，例如：GPS001'
    };
  }

  if (!row.driverId || String(row.driverId).trim() === '') {
    return {
      valid: false,
      reason: `第 ${rowNumber} 条: driverId 不能为空`,
      suggestedFix: '请填写司机ID，例如：DRIVER001'
    };
  }

  if (!row.timestamp || String(row.timestamp).trim() === '') {
    return {
      valid: false,
      reason: `第 ${rowNumber} 条: timestamp 不能为空`,
      suggestedFix: '请填写时间戳，格式：YYYY-MM-DD HH:mm:ss'
    };
  }

  const timeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  if (!timeRegex.test(String(row.timestamp).trim())) {
    return {
      valid: false,
      reason: `第 ${rowNumber} 条: timestamp 格式错误`,
      suggestedFix: '请使用正确的时间格式：YYYY-MM-DD HH:mm:ss'
    };
  }

  const lat = Number(row.latitude);
  if (isNaN(lat) || lat < -90 || lat > 90) {
    return {
      valid: false,
      reason: `第 ${rowNumber} 条: latitude 无效`,
      suggestedFix: '纬度应在 -90 到 90 之间，例如：39.9042'
    };
  }

  const lng = Number(row.longitude);
  if (isNaN(lng) || lng < -180 || lng > 180) {
    return {
      valid: false,
      reason: `第 ${rowNumber} 条: longitude 无效`,
      suggestedFix: '经度应在 -180 到 180 之间，例如：116.4074'
    };
  }

  const speed = Number(row.speed);
  if (isNaN(speed) || speed < 0 || speed > 200) {
    return {
      valid: false,
      reason: `第 ${rowNumber} 条: speed 无效`,
      suggestedFix: '速度应在 0 到 200 km/h 之间'
    };
  }

  const accuracy = Number(row.accuracy);
  if (isNaN(accuracy) || accuracy < 0) {
    return {
      valid: false,
      reason: `第 ${rowNumber} 条: accuracy 无效`,
      suggestedFix: '精度应为非负数，单位为米'
    };
  }

  return { valid: true };
}
