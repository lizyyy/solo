import type { SensorData } from '../types';

export function parseCSV(content: string): SensorData[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  
  const data: SensorData[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    if (values.length < headers.length) continue;

    const row: Record<string, number> = {};
    headers.forEach((header, index) => {
      row[header] = parseFloat(values[index]) || 0;
    });

    const timestamp = row['timestamp'] || row['time'] || Date.now() + (i - 1) * 1000;
    
    data.push({
      timestamp: timestamp < 10000000000 ? timestamp * 1000 : timestamp,
      velocity: row['velocity'] || row['speed'] || 0,
      acceleration: row['acceleration'] || row['accel'] || 0,
      temperature: row['temperature'] || row['temp'] || 0,
      vibration: row['vibration'] || row['vibrate'] || 0,
      pressure: row['pressure'] || row['press'] || 101.3,
    });
  }

  return data;
}

export function parseJSON(content: string): SensorData[] {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.map((item, index) => ({
        timestamp: item.timestamp || item.time || Date.now() + index * 1000,
        velocity: item.velocity || item.speed || 0,
        acceleration: item.acceleration || item.accel || 0,
        temperature: item.temperature || item.temp || 0,
        vibration: item.vibration || item.vibrate || 0,
        pressure: item.pressure || item.press || 101.3,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

export function parseFile(file: File): Promise<SensorData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) {
        reject(new Error('文件内容为空'));
        return;
      }

      if (file.name.endsWith('.csv')) {
        resolve(parseCSV(content));
      } else if (file.name.endsWith('.json')) {
        resolve(parseJSON(content));
      } else {
        reject(new Error('不支持的文件格式'));
      }
    };

    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

export function generateSampleCSV(): string {
  const headers = ['timestamp', 'velocity', 'acceleration', 'temperature', 'vibration', 'pressure'];
  const rows: string[] = [headers.join(',')];
  
  const startTime = Date.now() - 3600000;
  for (let i = 0; i < 100; i++) {
    const t = i / 100;
    rows.push([
      startTime + i * 1000,
      (15 + Math.sin(t * Math.PI * 4) * 8).toFixed(2),
      (Math.cos(t * Math.PI * 4) * 3).toFixed(3),
      (45 + Math.sin(t * Math.PI * 2) * 10).toFixed(1),
      (2.5 + Math.sin(t * Math.PI * 6) * 1.5).toFixed(2),
      (101.3 + Math.sin(t * Math.PI * 3) * 5).toFixed(1),
    ].join(','));
  }
  
  return rows.join('\n');
}
