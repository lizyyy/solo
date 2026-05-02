import Papa from 'papaparse';
import type { Floor, Sensor, SensorReading, WorkOrder, Thresholds } from '../types';

export function parseFloorJson(jsonData: string): Floor[] {
  try {
    const data = JSON.parse(jsonData);
    
    if (Array.isArray(data)) {
      return data as Floor[];
    }
    
    if (data.floors && Array.isArray(data.floors)) {
      return data.floors as Floor[];
    }
    
    return [data as Floor];
  } catch (error) {
    console.error('解析楼层JSON失败:', error);
    throw new Error('楼层JSON格式无效');
  }
}

export function parseSensorCsv(csvData: string): { sensors: Sensor[]; readings: SensorReading[] } {
  const result = Papa.parse(csvData, {
    header: true,
    skipEmptyLines: true,
  });

  const sensorMap = new Map<string, Sensor>();
  const allReadings: SensorReading[] = [];

  result.data.forEach((row: Record<string, string>) => {
    const sensorId = row.sensorId || row['传感器ID'] || row.id;
    if (!sensorId) return;

    const floorId = row.floorId || row['楼层ID'] || '';
    const zoneId = row.zoneId || row['区域ID'] || '';
    const sensorName = row.name || row['名称'] || sensorId;
    const x = parseFloat(row.x || row['X坐标'] || '0');
    const y = parseFloat(row.y || row['Y坐标'] || '0');

    if (!sensorMap.has(sensorId)) {
      sensorMap.set(sensorId, {
        id: sensorId,
        name: sensorName,
        floorId,
        zoneId,
        x,
        y,
        readings: [],
      });
    }

    const temperature = parseFloat(row.temperature || row['温度']);
    const humidity = parseFloat(row.humidity || row['湿度']);
    const timestampStr = row.timestamp || row['时间戳'];
    
    if (!isNaN(temperature) && !isNaN(humidity) && timestampStr) {
      let timestamp: number;
      if (!isNaN(parseInt(timestampStr))) {
        timestamp = parseInt(timestampStr);
      } else {
        timestamp = new Date(timestampStr).getTime();
      }

      const isOnline = (row.isOnline || row['在线状态'] || 'true').toLowerCase() !== 'false';

      const reading: SensorReading = {
        sensorId,
        timestamp,
        temperature,
        humidity,
        isOnline: isOnline !== false,
      };

      allReadings.push(reading);
    }
  });

  const sensors: Sensor[] = [];
  sensorMap.forEach((sensor) => {
    const sensorReadings = allReadings
      .filter((r) => r.sensorId === sensor.id)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    sensor.readings = sensorReadings;
    sensors.push(sensor);
  });

  return { sensors, readings: allReadings };
}

export function parseWorkOrderJson(jsonData: string): WorkOrder[] {
  try {
    const data = JSON.parse(jsonData);
    
    let orders: WorkOrder[] = [];
    
    if (Array.isArray(data)) {
      orders = data as WorkOrder[];
    } else if (data.orders && Array.isArray(data.orders)) {
      orders = data.orders as WorkOrder[];
    } else {
      orders = [data as WorkOrder];
    }

    return orders.map((order) => ({
      ...order,
      status: order.status as WorkOrder['status'],
      priority: order.priority as WorkOrder['priority'],
    }));
  } catch (error) {
    console.error('解析工单JSON失败:', error);
    throw new Error('工单JSON格式无效');
  }
}

export function parseThresholdsJson(jsonData: string): Thresholds {
  try {
    const data = JSON.parse(jsonData);
    
    return {
      temperatureMin: data.temperatureMin ?? data['温度下限'] ?? 18,
      temperatureMax: data.temperatureMax ?? data['温度上限'] ?? 26,
      humidityMin: data.humidityMin ?? data['湿度下限'] ?? 30,
      humidityMax: data.humidityMax ?? data['湿度上限'] ?? 70,
    };
  } catch (error) {
    console.error('解析阈值JSON失败:', error);
    return {
      temperatureMin: 18,
      temperatureMax: 26,
      humidityMin: 30,
      humidityMax: 70,
    };
  }
}

export function getTimestampFromString(dateStr: string): number {
  if (/^\d{13}$/.test(dateStr)) {
    return parseInt(dateStr);
  }
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return Date.now();
  }
  return date.getTime();
}

export function formatTimestamp(timestamp: number, format: 'datetime' | 'date' | 'time' = 'datetime'): string {
  const date = new Date(timestamp);
  
  switch (format) {
    case 'date':
      return date.toLocaleDateString('zh-CN');
    case 'time':
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    case 'datetime':
    default:
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
  }
}
