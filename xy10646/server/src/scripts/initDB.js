const { sequelize, SamplingPoint, SampleBottle, SampleRecord, TestItem, FlowRecord } = require('../models');

async function initDatabase() {
  try {
    await sequelize.sync({ force: true });
    console.log('数据库表创建成功');

    await SamplingPoint.bulkCreate([
      { code: 'SP001', name: '东河取水口', location: '东河路123号', description: '城市供水主要取水口' },
      { code: 'SP002', name: '西湖监测点', location: '西湖公园中心', description: '景观用水监测' },
      { code: 'SP003', name: '南排污口', location: '工业园区南部', description: '污水处理厂排放口' },
      { code: 'SP004', name: '北山水库', location: '北山风景区', description: '饮用水源地' }
    ]);

    await SampleBottle.bulkCreate([
      { bottleNumber: 'BOT001', preservative: '硝酸', volume: 500, material: '玻璃', status: 'available' },
      { bottleNumber: 'BOT002', preservative: '硫酸', volume: 500, material: '玻璃', status: 'available' },
      { bottleNumber: 'BOT003', preservative: '无', volume: 1000, material: '塑料', status: 'available' },
      { bottleNumber: 'BOT004', preservative: '硝酸', volume: 250, material: '塑料', status: 'available' },
      { bottleNumber: 'BOT005', preservative: '氢氧化钠', volume: 500, material: '塑料', status: 'available' }
    ]);

    await SampleRecord.bulkCreate([
      {
        sampleCode: 'SAMP20240115001',
        samplingPointId: 1,
        bottleId: 1,
        preservative: '硝酸',
        samplingTime: new Date('2024-01-15T08:30:00'),
        sampler: '张三',
        status: 'received',
        temperature: 15.5,
        weather: '晴',
        remarks: '正常采样'
      },
      {
        sampleCode: 'SAMP20240115002',
        samplingPointId: 2,
        bottleId: 3,
        preservative: '无',
        samplingTime: new Date('2024-01-15T10:15:00'),
        sampler: '李四',
        status: 'testing',
        temperature: 18.2,
        weather: '多云',
        remarks: ''
      },
      {
        sampleCode: 'SAMP20240115003',
        samplingPointId: 3,
        bottleId: 2,
        preservative: '硫酸',
        samplingTime: new Date('2024-01-14T14:00:00'),
        sampler: '王五',
        status: 'rejected',
        temperature: 22.1,
        weather: '阴',
        remarks: '超时接收'
      }
    ]);

    await TestItem.bulkCreate([
      { sampleRecordId: 1, itemName: 'pH值', itemCode: 'PH001', expectedValue: '6.5-8.5', actualValue: '7.2', unit: '', tester: '赵六', testTime: new Date('2024-01-15T14:00:00'), isAbnormal: false },
      { sampleRecordId: 1, itemName: 'COD', itemCode: 'COD001', expectedValue: '<=50', actualValue: '45', unit: 'mg/L', tester: '赵六', testTime: new Date('2024-01-15T15:30:00'), isAbnormal: false },
      { sampleRecordId: 1, itemName: '氨氮', itemCode: 'NH3N001', expectedValue: '<=1.0', actualValue: '0.8', unit: 'mg/L', tester: '赵六', testTime: new Date('2024-01-15T16:45:00'), isAbnormal: false },
      { sampleRecordId: 2, itemName: 'pH值', itemCode: 'PH001', expectedValue: '6.5-8.5', actualValue: '', unit: '', tester: null, testTime: null, isAbnormal: false },
      { sampleRecordId: 2, itemName: '浊度', itemCode: 'TUR001', expectedValue: '<=3', actualValue: '', unit: 'NTU', tester: null, testTime: null, isAbnormal: false },
      { sampleRecordId: 3, itemName: 'pH值', itemCode: 'PH001', expectedValue: '6.5-8.5', actualValue: '9.2', unit: '', tester: '钱七', testTime: new Date('2024-01-15T09:00:00'), isAbnormal: true }
    ]);

    await FlowRecord.bulkCreate([
      { sampleRecordId: 1, flowType: 'sample', operator: '张三', operationTime: new Date('2024-01-15T08:30:00'), fromLocation: '东河取水口', toLocation: '采样车', remarks: '完成采样' },
      { sampleRecordId: 1, flowType: 'transport', operator: '张三', operationTime: new Date('2024-01-15T09:15:00'), fromLocation: '采样车', toLocation: '实验室', remarks: '冷链运输' },
      { sampleRecordId: 1, flowType: 'receive', operator: '赵六', operationTime: new Date('2024-01-15T10:00:00'), fromLocation: '', toLocation: '实验室接样台', remarks: '' },
      { sampleRecordId: 2, flowType: 'sample', operator: '李四', operationTime: new Date('2024-01-15T10:15:00'), fromLocation: '西湖监测点', toLocation: '采样车', remarks: '' },
      { sampleRecordId: 2, flowType: 'transport', operator: '李四', operationTime: new Date('2024-01-15T11:00:00'), fromLocation: '采样车', toLocation: '实验室', remarks: '' },
      { sampleRecordId: 2, flowType: 'receive', operator: '赵六', operationTime: new Date('2024-01-15T11:45:00'), fromLocation: '', toLocation: '实验室接样台', remarks: '' },
      { sampleRecordId: 3, flowType: 'sample', operator: '王五', operationTime: new Date('2024-01-14T14:00:00'), fromLocation: '南排污口', toLocation: '采样车', remarks: '' },
      { sampleRecordId: 3, flowType: 'transport', operator: '王五', operationTime: new Date('2024-01-14T15:30:00'), fromLocation: '采样车', toLocation: '实验室', remarks: '交通拥堵延误' },
      { sampleRecordId: 3, flowType: 'receive', operator: '钱七', operationTime: new Date('2024-01-15T08:00:00'), fromLocation: '', toLocation: '实验室接样台', isTimeout: true, timeoutReason: '超过24小时接收时限' }
    ]);

    console.log('样例数据插入成功');
    process.exit(0);
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

initDatabase();
