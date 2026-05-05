import type { SeedlingTray, MoistureSensorData, NozzleCalibration, ImportResult } from '../types';

export const parseCSV = (csvText: string): string[][] => {
  const lines = csvText.trim().split('\n');
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
};

export const parseSeedlingTrayCSV = (csvText: string): ImportResult => {
  try {
    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      return { success: false, message: 'CSV 文件为空或格式不正确' };
    }

    const headers = rows[0].map(h => h.toLowerCase());
    const data: SeedlingTray[] = [];
    const errors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 0 || row.every(cell => cell.trim() === '')) continue;

      const getValue = (header: string) => {
        const index = headers.indexOf(header.toLowerCase());
        return index >= 0 ? row[index] || '' : '';
      };

      try {
        const tray: SeedlingTray = {
          trayId: getValue('trayId') || getValue('苗盘编号') || `T${i}`,
          bedId: getValue('bedId') || getValue('苗床编号') || '',
          seedlingType: getValue('seedlingType') || getValue('种苗类型') || '',
          quantity: parseInt(getValue('quantity') || getValue('数量') || '0', 10),
          plantingDate: getValue('plantingDate') || getValue('种植日期') || '',
          currentStage: getValue('currentStage') || getValue('当前阶段') || '',
          targetMoisture: parseFloat(getValue('targetMoisture') || getValue('目标湿度') || '60'),
          targetEc: parseFloat(getValue('targetEc') || getValue('目标EC') || '1.5'),
          nozzles: (getValue('nozzles') || getValue('喷头编号') || '').split(/[,，]/).filter(n => n.trim())
        };

        if (!tray.bedId) {
          errors.push(`第 ${i} 行: 缺少苗床编号`);
          continue;
        }

        data.push(tray);
      } catch (e) {
        errors.push(`第 ${i} 行: 解析错误 - ${(e as Error).message}`);
      }
    }

    return {
      success: data.length > 0,
      message: data.length > 0 ? `成功解析 ${data.length} 条苗盘记录` : '未能解析任何数据',
      data,
      errors
    };
  } catch (e) {
    return {
      success: false,
      message: `解析失败: ${(e as Error).message}`,
      errors: [(e as Error).message]
    };
  }
};

export const parseMoistureSensorCSV = (csvText: string): ImportResult => {
  try {
    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      return { success: false, message: 'CSV 文件为空或格式不正确' };
    }

    const headers = rows[0].map(h => h.toLowerCase());
    const data: MoistureSensorData[] = [];
    const errors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 0 || row.every(cell => cell.trim() === '')) continue;

      const getValue = (header: string) => {
        const index = headers.indexOf(header.toLowerCase());
        return index >= 0 ? row[index] || '' : '';
      };

      try {
        const sensorData: MoistureSensorData = {
          sensorId: getValue('sensorId') || getValue('传感器编号') || `S${i}`,
          bedId: getValue('bedId') || getValue('苗床编号') || '',
          timestamp: getValue('timestamp') || getValue('时间戳') || new Date().toISOString(),
          moisture: parseFloat(getValue('moisture') || getValue('湿度') || '0'),
          ec: parseFloat(getValue('ec') || getValue('EC值') || '0'),
          temperature: parseFloat(getValue('temperature') || getValue('温度') || '25')
        };

        if (!sensorData.bedId) {
          errors.push(`第 ${i} 行: 缺少苗床编号`);
          continue;
        }

        data.push(sensorData);
      } catch (e) {
        errors.push(`第 ${i} 行: 解析错误 - ${(e as Error).message}`);
      }
    }

    return {
      success: data.length > 0,
      message: data.length > 0 ? `成功解析 ${data.length} 条传感器记录` : '未能解析任何数据',
      data,
      errors
    };
  } catch (e) {
    return {
      success: false,
      message: `解析失败: ${(e as Error).message}`,
      errors: [(e as Error).message]
    };
  }
};

export const parseNozzleCalibrationCSV = (csvText: string): ImportResult => {
  try {
    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      return { success: false, message: 'CSV 文件为空或格式不正确' };
    }

    const headers = rows[0].map(h => h.toLowerCase());
    const data: NozzleCalibration[] = [];
    const errors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 0 || row.every(cell => cell.trim() === '')) continue;

      const getValue = (header: string) => {
        const index = headers.indexOf(header.toLowerCase());
        return index >= 0 ? row[index] || '' : '';
      };

      try {
        const statusStr = (getValue('status') || getValue('状态') || 'normal').toLowerCase();
        let status: 'normal' | 'clogged' | 'leaking' = 'normal';
        if (statusStr === '堵塞' || statusStr === 'clogged') status = 'clogged';
        else if (statusStr === '漏水' || statusStr === 'leaking') status = 'leaking';

        const calibration: NozzleCalibration = {
          nozzleId: getValue('nozzleId') || getValue('喷头编号') || `N${i}`,
          bedId: getValue('bedId') || getValue('苗床编号') || '',
          flowRate: parseFloat(getValue('flowRate') || getValue('流量') || '0'),
          lastCalibrationDate: getValue('lastCalibrationDate') || getValue('上次标定日期') || new Date().toISOString().split('T')[0],
          status,
          deviationPercentage: parseFloat(getValue('deviationPercentage') || getValue('偏差百分比') || '0')
        };

        if (!calibration.bedId || !calibration.nozzleId) {
          errors.push(`第 ${i} 行: 缺少必要字段`);
          continue;
        }

        data.push(calibration);
      } catch (e) {
        errors.push(`第 ${i} 行: 解析错误 - ${(e as Error).message}`);
      }
    }

    return {
      success: data.length > 0,
      message: data.length > 0 ? `成功解析 ${data.length} 条喷头标定记录` : '未能解析任何数据',
      data,
      errors
    };
  } catch (e) {
    return {
      success: false,
      message: `解析失败: ${(e as Error).message}`,
      errors: [(e as Error).message]
    };
  }
};
