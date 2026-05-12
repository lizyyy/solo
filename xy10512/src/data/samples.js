const TODAY = new Date();
const ISO = (offsetHours = 0, offsetMinutes = 0) => {
  const d = new Date(TODAY);
  d.setHours(d.getHours() + offsetHours, d.getMinutes() + offsetMinutes, 0, 0);
  return d.toISOString();
};

const generateReadings = (baseTemp, count, startTime, intervalMin, variation = 0.5) => {
  const readings = [];
  const start = new Date(startTime).getTime();
  for (let i = 0; i < count; i++) {
    const time = new Date(start + i * intervalMin * 60 * 1000);
    const temp = baseTemp + (Math.random() * 2 - 1) * variation;
    readings.push({
      timestamp: time.toISOString(),
      temperature: Math.round(temp * 10) / 10
    });
  }
  return readings;
};

const generateAlertReadings = (startTemp, endTemp, count, startTime, intervalMin) => {
  const readings = [];
  const start = new Date(startTime).getTime();
  const step = (endTemp - startTemp) / Math.max(count - 1, 1);
  for (let i = 0; i < count; i++) {
    const time = new Date(start + i * intervalMin * 60 * 1000);
    const temp = startTemp + step * i + (Math.random() * 0.4 - 0.2);
    readings.push({
      timestamp: time.toISOString(),
      temperature: Math.round(temp * 10) / 10
    });
  }
  return readings;
};

const SAMPLES = {
  batches: [
    {
      id: 'BATCH-001',
      productName: '速冻水饺',
      quantity: 500,
      unit: 'kg',
      warehouseId: 'WH-01',
      inTime: ISO(-48),
      outTime: null,
      requiredTemperature: -18,
      supplier: '供应商A'
    },
    {
      id: 'BATCH-002',
      productName: '冰淇淋',
      quantity: 200,
      unit: '箱',
      warehouseId: 'WH-01',
      inTime: ISO(-24),
      outTime: null,
      requiredTemperature: -22,
      supplier: '供应商B'
    },
    {
      id: 'BATCH-003',
      productName: '冷冻海鲜',
      quantity: 800,
      unit: 'kg',
      warehouseId: 'WH-01',
      inTime: ISO(-72),
      outTime: ISO(-6),
      requiredTemperature: -20,
      supplier: '供应商C'
    },
    {
      id: 'BATCH-004',
      productName: '速冻蔬菜',
      quantity: 300,
      unit: '箱',
      warehouseId: 'WH-02',
      inTime: ISO(-36),
      outTime: null,
      requiredTemperature: -15,
      supplier: '供应商D'
    }
  ],
  
  maintenance: [
    {
      id: 'MAINT-001',
      warehouseId: 'WH-01',
      description: '设备常规检修',
      startTime: ISO(-6, -30),
      endTime: ISO(-6),
      type: 'PLANNED'
    },
    {
      id: 'MAINT-002',
      warehouseId: 'WH-01',
      description: '压缩机维护',
      startTime: ISO(-48),
      endTime: ISO(-47),
      type: 'PLANNED'
    }
  ],
  
  door: [
    {
      id: 'DOOR-001',
      warehouseId: 'WH-01',
      doorId: 'D01',
      openTime: ISO(-12),
      closeTime: ISO(-11, 45),
      operator: '张师傅',
      reason: '货物出库'
    },
    {
      id: 'DOOR-002',
      warehouseId: 'WH-01',
      doorId: 'D01',
      openTime: ISO(-6, -15),
      closeTime: ISO(-6, 5),
      operator: '李师傅',
      reason: '设备检修'
    },
    {
      id: 'DOOR-003',
      warehouseId: 'WH-02',
      doorId: 'D01',
      openTime: ISO(-24),
      closeTime: ISO(-23, 30),
      operator: '王师傅',
      reason: '货物入库'
    }
  ],
  
  temperature: [
    {
      id: 'TEMP-NORMAL',
      warehouseId: 'WH-01',
      sensorId: 'SENSOR-01',
      description: '正常波动样例 - 轻微波动在阈值内',
      startTime: ISO(-1),
      endTime: ISO(),
      readings: generateReadings(-18, 12, ISO(-1), 5, 1.5)
    },
    {
      id: 'TEMP-DOOR',
      warehouseId: 'WH-01',
      sensorId: 'SENSOR-01',
      description: '开门升温样例 - 与 DOOR-001 记录匹配',
      startTime: ISO(-12, 10),
      endTime: ISO(-11, 30),
      readings: [
        ...generateAlertReadings(-18, -8, 4, ISO(-12, 10), 5),
        ...generateAlertReadings(-8, -17, 4, ISO(-11, 50), 5)
      ]
    },
    {
      id: 'TEMP-MAINT',
      warehouseId: 'WH-01',
      sensorId: 'SENSOR-01',
      description: '维护窗口样例 - 与 MAINT-001 记录匹配',
      startTime: ISO(-6, -25),
      endTime: ISO(-6, 5),
      readings: [
        ...generateAlertReadings(-18, -5, 3, ISO(-6, -25), 5),
        ...generateReadings(-5, 3, ISO(-6, -10), 5, 1),
        ...generateAlertReadings(-5, -18, 3, ISO(-6, 0), 5)
      ]
    },
    {
      id: 'TEMP-REAL',
      warehouseId: 'WH-01',
      sensorId: 'SENSOR-01',
      description: '真正超温样例 - 长时间超温无保护因素',
      startTime: ISO(-3),
      endTime: ISO(-1),
      readings: [
        ...generateAlertReadings(-18, -7, 6, ISO(-3), 10),
        ...generateReadings(-6, 6, ISO(-2, 10), 10, 1),
        ...generateAlertReadings(-6, -12, 3, ISO(-1, 30), 10)
      ]
    },
    {
      id: 'TEMP-GAP',
      warehouseId: 'WH-01',
      sensorId: 'SENSOR-02',
      description: '断点样例 - 存在超过30分钟的数据缺口',
      startTime: ISO(-8),
      endTime: ISO(-7),
      readings: [
        { timestamp: ISO(-8), temperature: -18 },
        { timestamp: ISO(-7, 30), temperature: -17.5 },
        { timestamp: ISO(-7, 35), temperature: -18.2 }
      ]
    }
  ],
  
  alerts: [
    {
      id: 'ALERT-NORMAL',
      temperatureId: 'TEMP-NORMAL',
      warehouseId: 'WH-01',
      type: 'TEMPERATURE',
      triggeredAt: ISO(),
      originalMessage: '温度监测报告',
      status: 'PENDING'
    },
    {
      id: 'ALERT-DOOR',
      temperatureId: 'TEMP-DOOR',
      warehouseId: 'WH-01',
      type: 'TEMPERATURE',
      triggeredAt: ISO(-11, 50),
      originalMessage: '温度高于阈值 -10°C',
      status: 'PENDING'
    },
    {
      id: 'ALERT-MAINT',
      temperatureId: 'TEMP-MAINT',
      warehouseId: 'WH-01',
      type: 'TEMPERATURE',
      triggeredAt: ISO(-6, -15),
      originalMessage: '温度异常升高',
      status: 'PENDING'
    },
    {
      id: 'ALERT-REAL',
      temperatureId: 'TEMP-REAL',
      warehouseId: 'WH-01',
      type: 'TEMPERATURE',
      triggeredAt: ISO(-2),
      originalMessage: '温度持续高于阈值超过2小时',
      status: 'PENDING'
    },
    {
      id: 'ALERT-GAP',
      temperatureId: 'TEMP-GAP',
      warehouseId: 'WH-01',
      type: 'TEMPERATURE',
      triggeredAt: ISO(-7),
      originalMessage: '温度记录存在断点',
      status: 'PENDING'
    }
  ]
};

module.exports = SAMPLES;
