const path = require('path');
process.env.DB_PATH = path.join(__dirname, '../../data/test.db');

const fs = require('fs');
const db = require('../db');

const TankModel = require('../models/tank');
const BatchModel = require('../models/batch');
const WaterQualityModel = require('../models/waterQuality');
const AlertModel = require('../models/alert');
const DeathLossModel = require('../models/deathLoss');
const OperationLogModel = require('../models/operationLog');

const ThresholdService = require('../services/thresholdService');
const AttributionService = require('../services/attributionService');

beforeAll(() => {
  TankModel.init();
  BatchModel.init();
  WaterQualityModel.init();
  AlertModel.init();
  DeathLossModel.init();
  OperationLogModel.init();
});

afterAll(() => {
  db.close();
  try {
    fs.unlinkSync(process.env.DB_PATH);
  } catch (e) {}
});

describe('阈值检查服务', () => {
  let tank, batch;
  
  beforeEach(() => {
    db.prepare('DELETE FROM alerts').run();
    db.prepare('DELETE FROM water_quality').run();
    db.prepare('DELETE FROM batches').run();
    db.prepare('DELETE FROM tanks').run();
    
    tank = TankModel.create({
      name: '测试虾池',
      capacity: 1000,
      temperature_min: 18,
      temperature_max: 26,
      salinity_min: 28,
      salinity_max: 34,
      oxygen_min: 6,
      oxygen_max: 10
    });
    
    batch = BatchModel.create({
      batch_number: 'TEST001',
      species: '基围虾',
      quantity: 100,
      entry_date: new Date().toISOString()
    });
    
    BatchModel.bindToTank(batch.id, tank.id);
  });
  
  test('正常水质数据不触发报警', () => {
    const result = ThresholdService.importWaterQuality({
      tank_id: tank.id,
      temperature: 22,
      salinity: 30,
      oxygen: 8
    });
    
    expect(result.success).toBe(true);
    expect(result.checkResult.tankStatus).toBe('normal');
    expect(result.checkResult.alertsGenerated).toBe(0);
  });
  
  test('温度过高触发报警', () => {
    const result = ThresholdService.importWaterQuality({
      tank_id: tank.id,
      temperature: 28,
      salinity: 30,
      oxygen: 8
    });
    
    expect(result.success).toBe(true);
    expect(result.checkResult.tankStatus).toBe('alert');
    expect(result.checkResult.alertsGenerated).toBeGreaterThan(0);
    
    const alerts = AlertModel.getByTankId(tank.id);
    const tempAlerts = alerts.filter(a => a.alert_type === 'temperature_high');
    expect(tempAlerts.length).toBeGreaterThan(0);
  });
  
  test('温度过低触发报警', () => {
    const result = ThresholdService.importWaterQuality({
      tank_id: tank.id,
      temperature: 15,
      salinity: 30,
      oxygen: 8
    });
    
    expect(result.checkResult.tankStatus).toBe('alert');
    
    const alerts = AlertModel.getByTankId(tank.id);
    expect(alerts.some(a => a.alert_type === 'temperature_low')).toBe(true);
  });
  
  test('盐度异常触发报警', () => {
    const result = ThresholdService.importWaterQuality({
      tank_id: tank.id,
      temperature: 22,
      salinity: 25,
      oxygen: 8
    });
    
    const alerts = AlertModel.getByTankId(tank.id);
    expect(alerts.some(a => a.alert_type === 'salinity_low')).toBe(true);
  });
  
  test('溶氧过低触发报警', () => {
    const result = ThresholdService.importWaterQuality({
      tank_id: tank.id,
      temperature: 22,
      salinity: 30,
      oxygen: 4
    });
    
    expect(result.checkResult.tankStatus).toBe('alert');
    
    const alerts = AlertModel.getByTankId(tank.id);
    expect(alerts.some(a => a.alert_type === 'oxygen_low')).toBe(true);
  });
  
  test('多种异常同时触发多条报警', () => {
    const result = ThresholdService.importWaterQuality({
      tank_id: tank.id,
      temperature: 28,
      salinity: 25,
      oxygen: 4
    });
    
    expect(result.checkResult.alertsGenerated).toBeGreaterThanOrEqual(3);
    
    const alerts = AlertModel.getByTankId(tank.id);
    expect(alerts.some(a => a.alert_type === 'temperature_high')).toBe(true);
    expect(alerts.some(a => a.alert_type === 'salinity_low')).toBe(true);
    expect(alerts.some(a => a.alert_type === 'oxygen_low')).toBe(true);
  });
  
  test('报警关联到活跃批次', () => {
    ThresholdService.importWaterQuality({
      tank_id: tank.id,
      temperature: 28,
      salinity: 30,
      oxygen: 8
    });
    
    const alerts = AlertModel.getByTankId(tank.id);
    expect(alerts.every(a => a.batch_id === batch.id)).toBe(true);
  });
  
  test('暂养池状态根据异常类型变化', () => {
    let result = ThresholdService.importWaterQuality({
      tank_id: tank.id,
      temperature: 22,
      salinity: 25,
      oxygen: 8
    });
    expect(result.checkResult.tankStatus).toBe('warning');
    
    db.prepare('DELETE FROM alerts').run();
    
    result = ThresholdService.importWaterQuality({
      tank_id: tank.id,
      temperature: 28,
      salinity: 30,
      oxygen: 8
    });
    expect(result.checkResult.tankStatus).toBe('alert');
  });
  
  test('不存在的暂养池返回错误', () => {
    const result = ThresholdService.importWaterQuality({
      tank_id: 'non-existent',
      temperature: 22,
      salinity: 30,
      oxygen: 8
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('死耗归因分析', () => {
  let tank, batch, deathLoss;
  
  beforeEach(() => {
    db.prepare('DELETE FROM alerts').run();
    db.prepare('DELETE FROM water_quality').run();
    db.prepare('DELETE FROM batches').run();
    db.prepare('DELETE FROM tanks').run();
    db.prepare('DELETE FROM death_loss').run();
    db.prepare('DELETE FROM operation_logs').run();
    
    tank = TankModel.create({
      name: '测试鱼池',
      capacity: 2000,
      temperature_min: 14,
      temperature_max: 22,
      salinity_min: 20,
      salinity_max: 28,
      oxygen_min: 5,
      oxygen_max: 9
    });
    
    batch = BatchModel.create({
      batch_number: 'TEST002',
      species: '鲈鱼',
      quantity: 200,
      entry_date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    });
    
    BatchModel.bindToTank(batch.id, tank.id);
  });
  
  test('分析不存在的死耗返回错误', () => {
    const result = AttributionService.analyzeDeathCause('non-existent');
    expect(result.success).toBe(false);
  });
  
  test('分析时更新死耗状态', () => {
    const now = new Date();
    deathLoss = DeathLossModel.create({
      batch_id: batch.id,
      tank_id: tank.id,
      quantity: 10,
      discovered_at: now.toISOString(),
      reported_by: '测试员'
    });
    
    expect(deathLoss.attribution_status).toBe('pending');
    
    const result = AttributionService.analyzeDeathCause(deathLoss.id);
    
    const updated = DeathLossModel.getById(deathLoss.id);
    expect(updated.attribution_status).toBe('analyzing');
  });
  
  test('有异常水质时分析返回影响因素', () => {
    const now = new Date();
    
    ThresholdService.importWaterQuality({
      tank_id: tank.id,
      temperature: 25,
      salinity: 24,
      oxygen: 8,
      recorded_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
    });
    
    ThresholdService.importWaterQuality({
      tank_id: tank.id,
      temperature: 26,
      salinity: 24,
      oxygen: 7,
      recorded_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString()
    });
    
    deathLoss = DeathLossModel.create({
      batch_id: batch.id,
      tank_id: tank.id,
      quantity: 10,
      discovered_at: now.toISOString(),
      reported_by: '测试员'
    });
    
    const result = AttributionService.analyzeDeathCause(deathLoss.id);
    
    expect(result.success).toBe(true);
    expect(result.analysis).toBeDefined();
    expect(result.analysis.factors.length).toBeGreaterThan(0);
    expect(result.analysis.primaryCause).toBe('temperature');
    expect(result.analysis.confidence).toBeGreaterThan(0.5);
    expect(result.analysis.recommendations.length).toBeGreaterThan(0);
  });
  
  test('有活跃报警时影响归因', () => {
    const now = new Date();
    
    ThresholdService.importWaterQuality({
      tank_id: tank.id,
      temperature: 18,
      salinity: 24,
      oxygen: 3,
      recorded_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString()
    });
    
    deathLoss = DeathLossModel.create({
      batch_id: batch.id,
      tank_id: tank.id,
      quantity: 15,
      discovered_at: now.toISOString(),
      reported_by: '测试员'
    });
    
    const result = AttributionService.analyzeDeathCause(deathLoss.id);
    
    expect(result.analysis.factors.some(f => f.type === 'alerts')).toBe(true);
  });
  
  test('趋势报告包含统计信息', () => {
    const now = new Date();
    
    for (let i = 0; i < 10; i++) {
      ThresholdService.importWaterQuality({
        tank_id: tank.id,
        temperature: 18 + (Math.random() - 0.5) * 2,
        salinity: 24,
        oxygen: 7,
        recorded_at: new Date(now.getTime() - (10 - i) * 60 * 60 * 1000).toISOString()
      });
    }
    
    const result = AttributionService.getTrendReport(tank.id, 7);
    
    expect(result.success).toBe(true);
    expect(result.report).toBeDefined();
    expect(result.report.waterQuality.sampleCount).toBe(10);
    expect(result.report.waterQuality.temperature).toBeDefined();
    expect(result.report.waterQuality.temperature.avg).toBeDefined();
    expect(result.report.recommendations.length).toBeGreaterThan(0);
  });
});
