const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const { v4: uuidv4 } = require('uuid');
const _ = require('lodash');
const dayjs = require('dayjs');

const app = express();
const PORT = 3001;

// 数据目录
const DATA_DIR = path.join(__dirname, 'data');
const AREAS_FILE = path.join(DATA_DIR, 'areas.json');
const ICE_RESURFACING_FILE = path.join(DATA_DIR, 'ice_resurfacing.json');
const TEMPERATURE_FILE = path.join(DATA_DIR, 'temperature.json');
const ALARMS_FILE = path.join(DATA_DIR, 'alarms.json');
const SCHEDULE_FILE = path.join(DATA_DIR, 'schedule.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化数据文件
const initDataFile = (filePath, defaultData) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
};

initDataFile(AREAS_FILE, []);
initDataFile(ICE_RESURFACING_FILE, []);
initDataFile(TEMPERATURE_FILE, []);
initDataFile(ALARMS_FILE, []);
initDataFile(SCHEDULE_FILE, []);
initDataFile(SETTINGS_FILE, {
  idealIceTemperature: -5.5,
  softIceThreshold: -3.0,
  maxResurfacingInterval: 120,
  minResurfacingInterval: 45,
  morningActivityStartHour: 6,
  temperatureWarningDelta: 1.5,
});

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// 读取数据
const readData = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`读取文件失败: ${filePath}`, error);
    return [];
  }
};

// 写入数据
const writeData = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`写入文件失败: ${filePath}`, error);
    return false;
  }
};

// 解析浇冰车作业记录 CSV
const parseResurfacingCSV = (csvContent) => {
  return new Promise((resolve, reject) => {
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const records = results.data.map((row, index) => {
          const getValue = (keys) => {
            for (const key of keys) {
              if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
                return row[key];
              }
            }
            return null;
          };

          const area = getValue(['Area', '区域', '冰面区域', 'Zone', '区域编号']);
          const startTime = getValue(['StartTime', '开始时间', '作业开始', '开始']);
          const endTime = getValue(['EndTime', '结束时间', '作业结束', '结束']);
          const operator = getValue(['Operator', '操作员', '司机', '操作人员']);
          const waterTemp = parseFloat(getValue(['WaterTemp', '水温', '水温度']) || 0);
          const iceThickness = parseFloat(getValue(['IceThickness', '冰厚', '冰面厚度']) || 0);
          const notes = getValue(['Notes', '备注', '说明']) || '';

          return {
            id: uuidv4(),
            area: String(area || `区域_${index + 1}`).trim(),
            startTime: startTime || new Date().toISOString(),
            endTime: endTime || new Date().toISOString(),
            operator: String(operator || '').trim(),
            waterTemp: waterTemp,
            iceThickness: iceThickness,
            notes: String(notes).trim(),
            importedAt: new Date().toISOString(),
          };
        });

        resolve(records);
      },
      error: (error) => reject(error),
    });
  });
};

// 解析温度传感器 CSV
const parseTemperatureCSV = (csvContent) => {
  return new Promise((resolve, reject) => {
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const records = results.data.map((row, index) => {
          const getValue = (keys) => {
            for (const key of keys) {
              if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
                return row[key];
              }
            }
            return null;
          };

          const area = getValue(['Area', '区域', '冰面区域', 'Zone', '区域编号']);
          const sensorId = getValue(['SensorID', '传感器编号', 'Sensor', '传感器']);
          const timestamp = getValue(['Timestamp', '时间', 'DateTime', '日期时间', '测量时间']);
          const temperature = parseFloat(getValue(['Temperature', '温度', 'Temp', '冰温']) || 0);
          const sensorType = getValue(['Type', '类型', '传感器类型']) || 'surface';

          return {
            id: uuidv4(),
            area: String(area || `区域_${index + 1}`).trim(),
            sensorId: String(sensorId || `S_${index + 1}`).trim(),
            timestamp: timestamp || new Date().toISOString(),
            temperature: temperature,
            sensorType: String(sensorType).trim(),
            importedAt: new Date().toISOString(),
          };
        });

        resolve(records.filter(r => r.temperature !== null && !isNaN(r.temperature)));
      },
      error: (error) => reject(error),
    });
  });
};

// 解析压缩机告警 CSV
const parseAlarmsCSV = (csvContent) => {
  return new Promise((resolve, reject) => {
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const records = results.data.map((row, index) => {
          const getValue = (keys) => {
            for (const key of keys) {
              if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
                return row[key];
              }
            }
            return null;
          };

          const equipment = getValue(['Equipment', '设备', '压缩机', 'Compressor']);
          const alarmCode = getValue(['AlarmCode', '告警代码', '故障代码', 'Code']);
          const alarmType = getValue(['AlarmType', '告警类型', '类型', 'Type']);
          const severity = getValue(['Severity', '严重程度', '级别', 'Level']) || 'warning';
          const startTime = getValue(['StartTime', '开始时间', '发生时间', 'Time']);
          const endTime = getValue(['EndTime', '结束时间', '恢复时间']);
          const description = getValue(['Description', '描述', '告警描述', '详情']);
          const resolved = getValue(['Resolved', '是否处理', '已解决', '处理状态']) === 'true' || 
                          getValue(['Resolved', '是否处理', '已解决', '处理状态']) === '是';

          return {
            id: uuidv4(),
            equipment: String(equipment || `设备_${index + 1}`).trim(),
            alarmCode: String(alarmCode || '').trim(),
            alarmType: String(alarmType || '').trim(),
            severity: String(severity).trim(),
            startTime: startTime || new Date().toISOString(),
            endTime: endTime || null,
            description: String(description || '').trim(),
            resolved: resolved,
            importedAt: new Date().toISOString(),
          };
        });

        resolve(records);
      },
      error: (error) => reject(error),
    });
  });
};

// 解析活动排期 CSV
const parseScheduleCSV = (csvContent) => {
  return new Promise((resolve, reject) => {
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const records = results.data.map((row, index) => {
          const getValue = (keys) => {
            for (const key of keys) {
              if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
                return row[key];
              }
            }
            return null;
          };

          const area = getValue(['Area', '区域', '冰面区域', 'Zone']);
          const date = getValue(['Date', '日期', '活动日期']);
          const startTime = getValue(['StartTime', '开始时间', '活动开始']);
          const endTime = getValue(['EndTime', '结束时间', '活动结束']);
          const activityType = getValue(['ActivityType', '活动类型', '类型', '活动']);
          const organizer = getValue(['Organizer', '组织者', '主办方']);
          const importance = parseInt(getValue(['Importance', '重要程度', '优先级']) || 1);
          const notes = getValue(['Notes', '备注', '说明']) || '';

          return {
            id: uuidv4(),
            area: String(area || '全部区域').trim(),
            date: date || new Date().toISOString().split('T')[0],
            startTime: startTime || '00:00',
            endTime: endTime || '23:59',
            activityType: String(activityType || '训练').trim(),
            organizer: String(organizer || '').trim(),
            importance: importance,
            notes: String(notes).trim(),
            importedAt: new Date().toISOString(),
          };
        });

        resolve(records);
      },
      error: (error) => reject(error),
    });
  });
};

// 识别冰场风险
const identifyIceRinkRisks = (area, resurfacingRecords, temperatureRecords, alarms, schedule, settings) => {
  const risks = [];

  // 获取该区域的相关数据
  const areaResurfacing = resurfacingRecords.filter(r => r.area === area.area || area.area === '全部区域');
  const areaTemperature = temperatureRecords.filter(t => t.area === area.area || area.area === '全部区域');
  const areaAlarms = alarms.filter(a => !a.resolved);

  // 1. 冰面偏软风险（温度过高）
  if (areaTemperature.length > 0) {
    // 计算平均温度和最高温度
    const temps = areaTemperature.map(t => t.temperature);
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
    const maxTemp = Math.max(...temps);

    if (maxTemp > settings.softIceThreshold) {
      risks.push({
        type: 'soft_ice',
        severity: 'high',
        message: `冰面温度最高 ${maxTemp.toFixed(1)}°C，超过软冰阈值 ${settings.softIceThreshold}°C，冰面可能偏软`,
        temperature: maxTemp,
        threshold: settings.softIceThreshold,
      });
    } else if (maxTemp > settings.idealIceTemperature + settings.temperatureWarningDelta) {
      risks.push({
        type: 'temperature_warning',
        severity: 'medium',
        message: `冰面温度 ${maxTemp.toFixed(1)}°C 偏离理想温度 ${settings.idealIceTemperature}°C`,
        temperature: maxTemp,
        ideal: settings.idealIceTemperature,
      });
    }
  }

  // 2. 浇冰间隔不合理风险
  if (areaResurfacing.length >= 2) {
    // 按时间排序
    const sorted = [...areaResurfacing].sort((a, b) => 
      new Date(a.startTime) - new Date(b.startTime)
    );

    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = new Date(sorted[i - 1].endTime);
      const currStart = new Date(sorted[i].startTime);
      const intervalMinutes = (currStart - prevEnd) / (1000 * 60);

      if (intervalMinutes > settings.maxResurfacingInterval) {
        risks.push({
          type: 'resurfacing_interval_too_long',
          severity: 'high',
          message: `浇冰间隔 ${Math.round(intervalMinutes)} 分钟，超过最大间隔 ${settings.maxResurfacingInterval} 分钟`,
          interval: intervalMinutes,
          maxInterval: settings.maxResurfacingInterval,
        });
      } else if (intervalMinutes < settings.minResurfacingInterval) {
        risks.push({
          type: 'resurfacing_interval_too_short',
          severity: 'medium',
          message: `浇冰间隔 ${Math.round(intervalMinutes)} 分钟，短于最小间隔 ${settings.minResurfacingInterval} 分钟，可能影响冰面质量`,
          interval: intervalMinutes,
          minInterval: settings.minResurfacingInterval,
        });
      }
    }
  } else if (areaResurfacing.length === 0) {
    risks.push({
      type: 'no_resurfacing',
      severity: 'high',
      message: '该区域暂无浇冰记录',
    });
  }

  // 3. 设备告警影响早场训练风险
  // 获取明天的早场活动
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
  const tomorrowMorningActivities = schedule.filter(s => {
    const activityDate = s.date;
    const startHour = parseInt(s.startTime.split(':')[0]);
    return activityDate === tomorrow && startHour >= settings.morningActivityStartHour && startHour < 12;
  });

  if (tomorrowMorningActivities.length > 0 && areaAlarms.length > 0) {
    const criticalAlarms = areaAlarms.filter(a => a.severity === 'critical' || a.severity === 'high');
    if (criticalAlarms.length > 0) {
      risks.push({
        type: 'alarm_affects_morning_activity',
        severity: 'high',
        message: `存在 ${criticalAlarms.length} 个严重告警未处理，可能影响明日早场 ${tomorrowMorningActivities.length} 个活动`,
        alarmCount: criticalAlarms.length,
        activityCount: tomorrowMorningActivities.length,
      });
    }
  }

  // 4. 未处理告警风险
  if (areaAlarms.length > 0) {
    risks.push({
      type: 'unresolved_alarms',
      severity: areaAlarms.some(a => a.severity === 'high' || a.severity === 'critical') ? 'high' : 'medium',
      message: `存在 ${areaAlarms.length} 个未处理的设备告警`,
      alarmCount: areaAlarms.length,
    });
  }

  // 5. 活动前准备风险 - 检查早场活动前是否有足够的准备时间
  if (tomorrowMorningActivities.length > 0) {
    const earliestActivity = tomorrowMorningActivities.reduce((earliest, current) => {
      return current.startTime < earliest.startTime ? current : earliest;
    });

    // 检查最新的浇冰记录时间
    if (areaResurfacing.length > 0) {
      const latestResurfacing = areaResurfacing.reduce((latest, current) => {
        return new Date(current.endTime) > new Date(latest.endTime) ? current : latest;
      });

      const latestTime = dayjs(latestResurfacing.endTime);
      const activityTime = dayjs(`${tomorrow} ${earliestActivity.startTime}`);
      const hoursSinceResurfacing = activityTime.diff(latestTime, 'hour', true);

      if (hoursSinceResurfacing > 8) {
        risks.push({
          type: 'resurfacing_before_activity',
          severity: 'medium',
          message: `明日最早活动 ${earliestActivity.activityType} (${earliestActivity.startTime}) 距离上次浇冰已超过 8 小时，建议赛前重新浇冰`,
          hoursSinceResurfacing: hoursSinceResurfacing,
          activity: earliestActivity,
        });
      }
    }
  }

  return risks;
};

// API 路由

// 获取设置
app.get('/api/settings', (req, res) => {
  const settings = readData(SETTINGS_FILE);
  res.json(settings);
});

// 更新设置
app.put('/api/settings', (req, res) => {
  const currentSettings = readData(SETTINGS_FILE);
  const newSettings = { ...currentSettings, ...req.body };
  writeData(SETTINGS_FILE, newSettings);
  res.json(newSettings);
});

// 获取所有冰场区域
app.get('/api/areas', (req, res) => {
  const areas = readData(AREAS_FILE);
  const resurfacing = readData(ICE_RESURFACING_FILE);
  const temperature = readData(TEMPERATURE_FILE);
  const alarms = readData(ALARMS_FILE);
  const schedule = readData(SCHEDULE_FILE);
  const settings = readData(SETTINGS_FILE);

  // 如果没有定义区域，自动从数据中提取
  let allAreas = areas;
  if (allAreas.length === 0) {
    const areaNames = new Set();
    resurfacing.forEach(r => areaNames.add(r.area));
    temperature.forEach(t => areaNames.add(t.area));
    schedule.forEach(s => areaNames.add(s.area));

    allAreas = Array.from(areaNames).map(area => ({
      id: uuidv4(),
      area: area,
      name: area,
      status: 'pending',
      verdict: '未复核',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    if (allAreas.length > 0) {
      writeData(AREAS_FILE, allAreas);
    }
  }

  const areasWithDetails = allAreas.map(area => {
    const areaResurfacing = resurfacing.filter(r => r.area === area.area);
    const areaTemperature = temperature.filter(t => t.area === area.area);
    const risks = identifyIceRinkRisks(area, resurfacing, temperature, alarms, schedule, settings);

    // 计算温度统计
    let avgTemp = null;
    let maxTemp = null;
    if (areaTemperature.length > 0) {
      const temps = areaTemperature.map(t => t.temperature);
      avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
      maxTemp = Math.max(...temps);
    }

    // 最新浇冰时间
    let lastResurfacing = null;
    if (areaResurfacing.length > 0) {
      const sorted = [...areaResurfacing].sort((a, b) => 
        new Date(b.endTime) - new Date(a.endTime)
      );
      lastResurfacing = sorted[0].endTime;
    }

    return {
      ...area,
      resurfacingCount: areaResurfacing.length,
      temperatureCount: areaTemperature.length,
      avgTemperature: avgTemp,
      maxTemperature: maxTemp,
      lastResurfacing: lastResurfacing,
      risks: risks,
      riskLevel: risks.length === 0 ? 'low' :
        risks.some(r => r.severity === 'high') ? 'high' : 'medium',
    };
  });

  res.json(areasWithDetails);
});

// 获取单个区域详情
app.get('/api/areas/:id', (req, res) => {
  const { id } = req.params;
  const areas = readData(AREAS_FILE);
  const resurfacing = readData(ICE_RESURFACING_FILE);
  const temperature = readData(TEMPERATURE_FILE);
  const alarms = readData(ALARMS_FILE);
  const schedule = readData(SCHEDULE_FILE);
  const settings = readData(SETTINGS_FILE);

  const area = areas.find(a => a.id === id || a.area === id);
  if (!area) {
    return res.status(404).json({ success: false, message: '区域不存在' });
  }

  const areaResurfacing = resurfacing.filter(r => r.area === area.area);
  const areaTemperature = temperature.filter(t => t.area === area.area);
  const areaAlarms = alarms.filter(a => !a.resolved);
  const areaSchedule = schedule.filter(s => s.area === area.area || s.area === '全部区域');
  const risks = identifyIceRinkRisks(area, resurfacing, temperature, alarms, schedule, settings);

  // 按时间排序的浇冰记录
  const sortedResurfacing = [...areaResurfacing].sort((a, b) => 
    new Date(b.startTime) - new Date(a.startTime)
  );

  // 按时间排序的温度记录
  const sortedTemperature = [...areaTemperature].sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  res.json({
    ...area,
    resurfacing: sortedResurfacing,
    temperature: sortedTemperature,
    alarms: areaAlarms,
    schedule: areaSchedule,
    risks: risks,
    settings: settings,
  });
});

// 更新区域（备注、改判）
app.put('/api/areas/:id', (req, res) => {
  const { id } = req.params;
  const { notes, verdict, status } = req.body;

  const areas = readData(AREAS_FILE);
  const index = areas.findIndex(a => a.id === id || a.area === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: '区域不存在' });
  }

  areas[index] = {
    ...areas[index],
    notes: notes !== undefined ? notes : areas[index].notes,
    verdict: verdict !== undefined ? verdict : areas[index].verdict,
    status: status !== undefined ? status : areas[index].status,
    updatedAt: new Date().toISOString(),
  };

  writeData(AREAS_FILE, areas);
  res.json({ success: true, area: areas[index] });
});

// 导入浇冰车作业记录 CSV
app.post('/api/import/resurfacing', async (req, res) => {
  try {
    const { csvContent } = req.body;
    const records = await parseResurfacingCSV(csvContent);

    const existingRecords = readData(ICE_RESURFACING_FILE);
    const existingAreas = readData(AREAS_FILE);

    // 处理区域
    const areaNames = new Set(records.map(r => r.area));
    const newAreas = [];
    areaNames.forEach(areaName => {
      const existing = existingAreas.find(a => a.area === areaName);
      if (!existing) {
        newAreas.push({
          id: uuidv4(),
          area: areaName,
          name: areaName,
          status: 'pending',
          verdict: '未复核',
          notes: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    const allAreas = [...existingAreas, ...newAreas];
    const mergedRecords = [...existingRecords, ...records];

    writeData(ICE_RESURFACING_FILE, mergedRecords);
    writeData(AREAS_FILE, allAreas);

    res.json({
      success: true,
      message: `成功导入 ${records.length} 条浇冰车作业记录`,
      recordsImported: records.length,
      areasCreated: newAreas.length,
    });
  } catch (error) {
    console.error('导入浇冰记录失败:', error);
    res.status(500).json({ success: false, message: '导入失败: ' + error.message });
  }
});

// 导入温度传感器 CSV
app.post('/api/import/temperature', async (req, res) => {
  try {
    const { csvContent } = req.body;
    const records = await parseTemperatureCSV(csvContent);

    const existingRecords = readData(TEMPERATURE_FILE);
    const existingAreas = readData(AREAS_FILE);

    // 处理区域
    const areaNames = new Set(records.map(r => r.area));
    const newAreas = [];
    areaNames.forEach(areaName => {
      const existing = existingAreas.find(a => a.area === areaName);
      if (!existing) {
        newAreas.push({
          id: uuidv4(),
          area: areaName,
          name: areaName,
          status: 'pending',
          verdict: '未复核',
          notes: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    const allAreas = [...existingAreas, ...newAreas];
    const mergedRecords = [...existingRecords, ...records];

    writeData(TEMPERATURE_FILE, mergedRecords);
    writeData(AREAS_FILE, allAreas);

    res.json({
      success: true,
      message: `成功导入 ${records.length} 条温度记录`,
      recordsImported: records.length,
      areasCreated: newAreas.length,
    });
  } catch (error) {
    console.error('导入温度记录失败:', error);
    res.status(500).json({ success: false, message: '导入失败: ' + error.message });
  }
});

// 导入压缩机告警 CSV
app.post('/api/import/alarms', async (req, res) => {
  try {
    const { csvContent } = req.body;
    const records = await parseAlarmsCSV(csvContent);

    const existingRecords = readData(ALARMS_FILE);
    const mergedRecords = [...existingRecords, ...records];

    writeData(ALARMS_FILE, mergedRecords);

    res.json({
      success: true,
      message: `成功导入 ${records.length} 条告警记录`,
      recordsImported: records.length,
    });
  } catch (error) {
    console.error('导入告警记录失败:', error);
    res.status(500).json({ success: false, message: '导入失败: ' + error.message });
  }
});

// 导入活动排期 CSV
app.post('/api/import/schedule', async (req, res) => {
  try {
    const { csvContent } = req.body;
    const records = await parseScheduleCSV(csvContent);

    const existingRecords = readData(SCHEDULE_FILE);
    const existingAreas = readData(AREAS_FILE);

    // 处理区域
    const areaNames = new Set(records.filter(r => r.area !== '全部区域').map(r => r.area));
    const newAreas = [];
    areaNames.forEach(areaName => {
      const existing = existingAreas.find(a => a.area === areaName);
      if (!existing) {
        newAreas.push({
          id: uuidv4(),
          area: areaName,
          name: areaName,
          status: 'pending',
          verdict: '未复核',
          notes: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    const allAreas = [...existingAreas, ...newAreas];
    const mergedRecords = [...existingRecords, ...records];

    writeData(SCHEDULE_FILE, mergedRecords);
    writeData(AREAS_FILE, allAreas);

    res.json({
      success: true,
      message: `成功导入 ${records.length} 条活动排期记录`,
      recordsImported: records.length,
      areasCreated: newAreas.length,
    });
  } catch (error) {
    console.error('导入排期记录失败:', error);
    res.status(500).json({ success: false, message: '导入失败: ' + error.message });
  }
});

// 获取统计信息
app.get('/api/statistics', (req, res) => {
  const areas = readData(AREAS_FILE);
  const resurfacing = readData(ICE_RESURFACING_FILE);
  const temperature = readData(TEMPERATURE_FILE);
  const alarms = readData(ALARMS_FILE);
  const schedule = readData(SCHEDULE_FILE);
  const settings = readData(SETTINGS_FILE);

  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let lowRiskCount = 0;
  let pendingReview = 0;
  let reviewed = 0;
  const unresolvedAlarms = alarms.filter(a => !a.resolved).length;

  areas.forEach(area => {
    const risks = identifyIceRinkRisks(area, resurfacing, temperature, alarms, schedule, settings);
    const hasHighRisk = risks.some(r => r.severity === 'high');
    const hasMediumRisk = risks.some(r => r.severity === 'medium');

    if (hasHighRisk) highRiskCount++;
    else if (hasMediumRisk) mediumRiskCount++;
    else lowRiskCount++;

    if (area.status === 'reviewed' || area.verdict !== '未复核') {
      reviewed++;
    } else {
      pendingReview++;
    }
  });

  // 明天的活动
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
  const tomorrowActivities = schedule.filter(s => s.date === tomorrow);
  const tomorrowMorningActivities = tomorrowActivities.filter(s => {
    const startHour = parseInt(s.startTime.split(':')[0]);
    return startHour >= settings.morningActivityStartHour && startHour < 12;
  });

  res.json({
    totalAreas: areas.length,
    totalResurfacing: resurfacing.length,
    totalTemperature: temperature.length,
    totalAlarms: alarms.length,
    totalSchedule: schedule.length,
    unresolvedAlarms: unresolvedAlarms,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    pendingReview,
    reviewed,
    tomorrowActivities: tomorrowActivities.length,
    tomorrowMorningActivities: tomorrowMorningActivities.length,
    settings,
  });
});

// 导出 Markdown 交班单
app.get('/api/export/markdown', (req, res) => {
  const areas = readData(AREAS_FILE);
  const resurfacing = readData(ICE_RESURFACING_FILE);
  const temperature = readData(TEMPERATURE_FILE);
  const alarms = readData(ALARMS_FILE);
  const schedule = readData(SCHEDULE_FILE);
  const settings = readData(SETTINGS_FILE);

  const now = dayjs();
  const tomorrow = now.add(1, 'day');

  // 生成 Markdown
  let md = `# 冰场运维交班单\n\n`;
  md += `## 交班信息\n\n`;
  md += `- **交班日期**: ${now.format('YYYY年MM月DD日')}\n`;
  md += `- **交班时间**: ${now.format('HH:mm')}\n`;
  md += `- **数据状态**: 包含 ${areas.length} 个区域数据\n\n`;

  // 风险概览
  const allRisks = [];
  areas.forEach(area => {
    const risks = identifyIceRinkRisks(area, resurfacing, temperature, alarms, schedule, settings);
    risks.forEach(risk => allRisks.push({ ...risk, area: area.area }));
  });

  if (allRisks.length > 0) {
    md += `## 风险概览\n\n`;
    
    const highRisks = allRisks.filter(r => r.severity === 'high');
    const mediumRisks = allRisks.filter(r => r.severity === 'medium');

    if (highRisks.length > 0) {
      md += `### 🔴 高风险 (${highRisks.length})\n\n`;
      highRisks.forEach((risk, index) => {
        md += `${index + 1}. **[${risk.area}]** ${risk.message}\n`;
      });
      md += `\n`;
    }

    if (mediumRisks.length > 0) {
      md += `### 🟡 中风险 (${mediumRisks.length})\n\n`;
      mediumRisks.forEach((risk, index) => {
        md += `${index + 1}. **[${risk.area}]** ${risk.message}\n`;
      });
      md += `\n`;
    }
  }

  // 未处理告警
  const unresolvedAlarms = alarms.filter(a => !a.resolved);
  if (unresolvedAlarms.length > 0) {
    md += `## ⚠️ 未处理告警\n\n`;
    md += `| 设备 | 告警代码 | 类型 | 严重程度 | 开始时间 | 描述 |\n`;
    md += `|------|---------|------|---------|---------|------|\n`;
    unresolvedAlarms.forEach(alarm => {
      const severityText = alarm.severity === 'high' || alarm.severity === 'critical' ? '高' : '中';
      md += `| ${alarm.equipment} | ${alarm.alarmCode} | ${alarm.alarmType} | ${severityText} | ${alarm.startTime} | ${alarm.description} |\n`;
    });
    md += `\n`;
  }

  // 明日活动排期
  const tomorrowStr = tomorrow.format('YYYY-MM-DD');
  const tomorrowActivities = schedule.filter(s => s.date === tomorrowStr);
  if (tomorrowActivities.length > 0) {
    md += `## 📅 明日活动排期 (${tomorrow.format('MM月DD日')})\n\n`;
    md += `| 区域 | 活动类型 | 开始时间 | 结束时间 | 组织者 | 重要程度 |\n`;
    md += `|------|---------|---------|---------|--------|---------|\n`;
    tomorrowActivities.sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach(activity => {
      const importance = activity.importance >= 3 ? '高' : activity.importance >= 2 ? '中' : '低';
      md += `| ${activity.area} | ${activity.activityType} | ${activity.startTime} | ${activity.endTime} | ${activity.organizer} | ${importance} |\n`;
    });
    md += `\n`;
  }

  // 各区域详情
  md += `## 各区域详情\n\n`;
  areas.forEach(area => {
    const areaResurfacing = resurfacing.filter(r => r.area === area.area);
    const areaTemperature = temperature.filter(t => t.area === area.area);
    const risks = identifyIceRinkRisks(area, resurfacing, temperature, alarms, schedule, settings);

    md += `### ${area.area}\n\n`;
    md += `- **状态**: ${area.verdict || '未复核'}\n`;
    if (area.notes) {
      md += `- **复核备注**: ${area.notes}\n`;
    }

    // 温度统计
    if (areaTemperature.length > 0) {
      const temps = areaTemperature.map(t => t.temperature);
      const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
      const maxTemp = Math.max(...temps);
      md += `- **平均温度**: ${avgTemp.toFixed(1)}°C\n`;
      md += `- **最高温度**: ${maxTemp.toFixed(1)}°C\n`;
    }

    // 最新浇冰
    if (areaResurfacing.length > 0) {
      const sorted = [...areaResurfacing].sort((a, b) => 
        new Date(b.endTime) - new Date(a.endTime)
      );
      const latest = sorted[0];
      md += `- **最新浇冰**: ${latest.endTime} (操作员: ${latest.operator || '未记录'})\n`;
      if (latest.iceThickness > 0) {
        md += `- **冰面厚度**: ${latest.iceThickness}mm\n`;
      }
    }

    // 风险
    if (risks.length > 0) {
      md += `- **风险**: \n`;
      risks.forEach(risk => {
        const emoji = risk.severity === 'high' ? '🔴' : '🟡';
        md += `  - ${emoji} ${risk.message}\n`;
      });
    }

    md += `\n`;
  });

  md += `---\n`;
  md += `*交班单生成时间: ${now.format('YYYY-MM-DD HH:mm:ss')}*\n`;

  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename=handover-${now.format('YYYYMMDD')}.md`);
  res.send(md);
});

// 导出 CSV 风险清单
app.get('/api/export/risk-csv', (req, res) => {
  const areas = readData(AREAS_FILE);
  const resurfacing = readData(ICE_RESURFACING_FILE);
  const temperature = readData(TEMPERATURE_FILE);
  const alarms = readData(ALARMS_FILE);
  const schedule = readData(SCHEDULE_FILE);
  const settings = readData(SETTINGS_FILE);

  const riskRows = [];

  areas.forEach(area => {
    const risks = identifyIceRinkRisks(area, resurfacing, temperature, alarms, schedule, settings);

    risks.forEach(risk => {
      riskRows.push({
        区域: area.area,
        风险类型: risk.type,
        严重程度: risk.severity === 'high' ? '高' : '中',
        风险描述: risk.message,
        区域状态: area.status || '待复核',
        判定结果: area.verdict || '未复核',
        备注: area.notes || '',
      });
    });
  });

  // 如果没有风险，添加提示
  if (riskRows.length === 0) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=risk-list.csv');
    res.send('区域,风险类型,严重程度,风险描述,区域状态,判定结果,备注\n暂无风险数据');
    return;
  }

  const csv = Papa.unparse(riskRows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=risk-list.csv');
  res.send(csv);
});

// 导出 JSON 审计包
app.get('/api/export/audit-json', (req, res) => {
  const areas = readData(AREAS_FILE);
  const resurfacing = readData(ICE_RESURFACING_FILE);
  const temperature = readData(TEMPERATURE_FILE);
  const alarms = readData(ALARMS_FILE);
  const schedule = readData(SCHEDULE_FILE);
  const settings = readData(SETTINGS_FILE);

  const auditPackage = {
    exportTime: new Date().toISOString(),
    version: '1.0.0',
    settings: settings,
    statistics: {
      totalAreas: areas.length,
      totalResurfacing: resurfacing.length,
      totalTemperature: temperature.length,
      totalAlarms: alarms.length,
      totalSchedule: schedule.length,
      unresolvedAlarms: alarms.filter(a => !a.resolved).length,
    },
    areas: areas.map(area => {
      const areaResurfacing = resurfacing.filter(r => r.area === area.area);
      const areaTemperature = temperature.filter(t => t.area === area.area);
      const areaSchedule = schedule.filter(s => s.area === area.area || s.area === '全部区域');
      const risks = identifyIceRinkRisks(area, resurfacing, temperature, alarms, schedule, settings);

      return {
        ...area,
        resurfacing: areaResurfacing,
        temperature: areaTemperature,
        schedule: areaSchedule,
        risks: risks,
      };
    }),
    allAlarms: alarms,
    allSchedule: schedule,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=audit-package.json');
  res.send(JSON.stringify(auditPackage, null, 2));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`冰场运维工具后端服务器运行在 http://localhost:${PORT}`);
});

module.exports = app;
