const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const app = require('../src/server');
const TankDao = require('../src/daos/tankDao');
const FishGroupDao = require('../src/daos/fishGroupDao');
const IsolationRuleDao = require('../src/daos/isolationRuleDao');

describe('鱼群、缸体和隔离规则管理', () => {
  let tankId, fishGroupId, ruleId;

  test('应成功创建缸体', async () => {
    const response = await request(app)
      .post('/api/tanks')
      .send({
        name: '测试隔离缸',
        type: 'quarantine',
        capacity: 50,
        waterPh: 7.0,
        waterTemperature: 26.0,
        waterSalinity: 0.0,
        isQuarantineReady: true
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    tankId = response.body.data.id;
  });

  test('应成功创建鱼群', async () => {
    const response = await request(app)
      .post('/api/fish-groups')
      .send({
        species: 'test_species',
        speciesName: '测试鱼种',
        count: 10,
        tankId: tankId
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    fishGroupId = response.body.data.id;
  });

  test('应成功创建隔离规则', async () => {
    const response = await request(app)
      .post('/api/isolation-rules')
      .send({
        diseaseName: '测试疾病',
        requiredTankType: 'quarantine',
        minPh: 6.5,
        maxPh: 8.0,
        minTemperature: 24.0,
        maxTemperature: 28.0,
        quarantineDays: 7,
        priority: 2
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    ruleId = response.body.data.id;
  });

  test('重复请求应返回缓存结果（幂等性）', async () => {
    const requestId = uuidv4();
    
    const firstResponse = await request(app)
      .post('/api/fish-groups')
      .set('X-Request-ID', requestId)
      .send({
        species: 'idempotent_test',
        speciesName: '幂等性测试鱼种',
        count: 5
      });
    
    const secondResponse = await request(app)
      .post('/api/fish-groups')
      .set('X-Request-ID', requestId)
      .send({
        species: 'idempotent_test',
        speciesName: '幂等性测试鱼种',
        count: 5
      });

    expect(secondResponse.body._from_cache).toBe(true);
    expect(secondResponse.body.data.id).toBe(firstResponse.body.data.id);
  });
});

describe('隔离调度业务逻辑', () => {
  let mainTankId, quarantineTankId, fishGroupId, sessionId;

  beforeEach(async () => {
    const mainTank = await TankDao.create({
      id: uuidv4(),
      name: '测试主缸',
      type: 'main',
      capacity: 100,
      waterPh: 7.2,
      waterTemperature: 25.0,
      waterSalinity: 0.0,
      isQuarantineReady: false
    });
    mainTankId = mainTank.id;

    const quarantineTank = await TankDao.create({
      id: uuidv4(),
      name: '专用隔离缸',
      type: 'quarantine',
      capacity: 50,
      waterPh: 7.0,
      waterTemperature: 26.0,
      waterSalinity: 0.0,
      isQuarantineReady: true
    });
    quarantineTankId = quarantineTank.id;

    await IsolationRuleDao.create({
      id: uuidv4(),
      diseaseName: '业务测试疾病',
      requiredTankType: 'quarantine',
      minPh: 6.5,
      maxPh: 8.0,
      minTemperature: 24.0,
      maxTemperature: 28.0,
      quarantineDays: 10,
      priority: 1,
      isActive: true
    });

    fishGroupId = uuidv4();
    await FishGroupDao.create(fishGroupId, 'business_test', '业务测试鱼种', 20, mainTankId);
    await TankDao.updateOccupancy(mainTankId, 20);
  });

  test('应成功创建隔离请求', async () => {
    const response = await request(app)
      .post('/api/isolation/request')
      .send({
        fishGroupId: fishGroupId,
        disease: '业务测试疾病',
        affectedCount: 5,
        operator: '测试操作员'
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.tank).toBeDefined();
    expect(response.body.tank.type).toBe('quarantine');
    expect(response.body.session).toBeDefined();
    expect(response.body.session.status).toBe('active');
    expect(response.body.waterCompatibility.compatible).toBe(true);
    sessionId = response.body.session.id;
  });

  test('应成功推进隔离会话', async () => {
    const createResponse = await request(app)
      .post('/api/isolation/request')
      .send({
        fishGroupId: fishGroupId,
        disease: '业务测试疾病',
        affectedCount: 5,
        operator: '测试操作员'
      });
    
    const advanceResponse = await request(app)
      .post(`/api/isolation/${createResponse.body.session.id}/advance`)
      .send({ operator: '测试操作员' });

    expect(advanceResponse.statusCode).toBe(200);
    expect(advanceResponse.body.success).toBe(true);
  });

  test('应成功撤回隔离', async () => {
    const createResponse = await request(app)
      .post('/api/isolation/request')
      .send({
        fishGroupId: fishGroupId,
        disease: '业务测试疾病',
        affectedCount: 5,
        operator: '测试操作员'
      });
    
    const withdrawResponse = await request(app)
      .post(`/api/isolation/${createResponse.body.session.id}/withdraw`)
      .send({
        reason: '误判，鱼群健康',
        operator: '测试操作员'
      });

    expect(withdrawResponse.statusCode).toBe(200);
    expect(withdrawResponse.body.success).toBe(true);
    expect(withdrawResponse.body.sessionStatus).toBe('cancelled');
  });

  test('应成功完成隔离', async () => {
    const createResponse = await request(app)
      .post('/api/isolation/request')
      .send({
        fishGroupId: fishGroupId,
        disease: '业务测试疾病',
        affectedCount: 5,
        operator: '测试操作员'
      });
    
    const completeResponse = await request(app)
      .post(`/api/isolation/${createResponse.body.session.id}/complete`)
      .send({ operator: '测试操作员' });

    expect(completeResponse.statusCode).toBe(200);
    expect(completeResponse.body.success).toBe(true);
    expect(completeResponse.body.sessionStatus).toBe('completed');
  });

  test('对不存在的鱼群应返回错误', async () => {
    const response = await request(app)
      .post('/api/isolation/request')
      .send({
        fishGroupId: 'non-existent-id',
        disease: '业务测试疾病',
        operator: '测试操作员'
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('鱼群不存在');
  });

  test('对不存在的疾病规则应返回错误', async () => {
    const response = await request(app)
      .post('/api/isolation/request')
      .send({
        fishGroupId: fishGroupId,
        disease: '未知疾病',
        operator: '测试操作员'
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('未找到疾病');
  });
});

describe('汇总查询', () => {
  test('仪表盘查询应返回汇总数据', async () => {
    const response = await request(app).get('/api/summary/dashboard');

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.fishGroups).toBeDefined();
    expect(response.body.data.tanks).toBeDefined();
    expect(response.body.data.sessions).toBeDefined();
    expect(response.body.data.riskReports).toBeDefined();
  });
});
