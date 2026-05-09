const fs = require('fs');
const path = require('path');

const testDbDir = path.join(__dirname, '../../data-test');
const testDbPath = path.join(testDbDir, 'test.db');

beforeEach(() => {
  if (fs.existsSync(testDbDir)) {
    fs.readdirSync(testDbDir).forEach(f => fs.unlinkSync(path.join(testDbDir, f)));
  } else {
    fs.mkdirSync(testDbDir, { recursive: true });
  }
  process.env.DB_PATH = testDbPath;
  delete require.cache[require.resolve('../config/database')];
});

afterAll(() => {
  if (fs.existsSync(testDbDir)) {
    fs.readdirSync(testDbDir).forEach(f => fs.unlinkSync(path.join(testDbDir, f)));
    fs.rmdirSync(testDbDir);
  }
});

function resetModules() {
  const modulesToDelete = [
    '../config/database',
    '../database/schema',
    '../repositories/MemberRepository',
    '../repositories/PointLedgerRepository',
    '../repositories/FreezeBucketRepository',
    '../repositories/FreezeRuleRepository',
    '../repositories/BalanceSnapshotRepository',
    '../repositories/IdempotencyRepository',
    '../services/BalanceService',
    '../services/PointService',
    '../errors/ApiError',
    '../app'
  ];
  modulesToDelete.forEach(m => {
    delete require.cache[require.resolve(m)];
  });
}

const systemOp = { name: 'test', id: 'test-001', type: 'test' };

describe('PointService - 核心积分操作', () => {
  let memberRepo, freezeRuleRepo, pointService, balanceService;
  let BalanceService;
  let member;

  beforeEach(() => {
    resetModules();
    require('../app');
    memberRepo = require('../repositories/MemberRepository');
    freezeRuleRepo = require('../repositories/FreezeRuleRepository');
    pointService = require('../services/PointService');
    const bs = require('../services/BalanceService');
    BalanceService = bs.BalanceService;
    balanceService = new BalanceService();

    member = memberRepo.create('测试用户');
    freezeRuleRepo.create({
      code: 'TEST_7D',
      name: '测试7天冻结',
      releaseType: 'TIME',
      releaseDays: 7,
      autoRelease: true
    });
  });

  test('充值积分 - 余额正确累加', () => {
    pointService.recharge(member.id, 10000, 't1', systemOp);
    const balance = balanceService.getCurrentBalance(member.id);
    expect(balance.totalBalance).toBe(10000);
    expect(balance.availableBalance).toBe(10000);
    expect(balance.freezeBalance).toBe(0);
  });

  test('消费积分 - 可用余额正确扣减', () => {
    pointService.recharge(member.id, 10000, 't1', systemOp);
    pointService.consume(member.id, 3000, 't2', systemOp);
    const balance = balanceService.getCurrentBalance(member.id);
    expect(balance.totalBalance).toBe(7000);
    expect(balance.availableBalance).toBe(7000);
  });

  test('退款 - 余额正确回滚', () => {
    pointService.recharge(member.id, 10000, 't1', systemOp);
    pointService.consume(member.id, 3000, 't2', systemOp, 'ORD-001');
    pointService.refund(member.id, 3000, 't3', systemOp, 'ORD-001');
    
    const balance = balanceService.getCurrentBalance(member.id);
    expect(balance.totalBalance).toBe(10000);
    expect(balance.availableBalance).toBe(10000);
  });
});

describe('PointService - 冻结/解冻', () => {
  let memberRepo, freezeRuleRepo, pointService, balanceService;
  let member;

  beforeEach(() => {
    resetModules();
    require('../app');
    memberRepo = require('../repositories/MemberRepository');
    freezeRuleRepo = require('../repositories/FreezeRuleRepository');
    pointService = require('../services/PointService');
    const bs = require('../services/BalanceService');
    balanceService = new bs.BalanceService();

    member = memberRepo.create('测试用户');
    freezeRuleRepo.create({
      code: 'TEST_7D',
      name: '测试7天冻结',
      releaseType: 'TIME',
      releaseDays: 7,
      autoRelease: true
    });
    pointService.recharge(member.id, 10000, 't1', systemOp);
  });

  test('冻结积分 - 可用减少，冻结增加，总额不变', () => {
    const freezeResult = pointService.freeze(member.id, 3000, 'TEST_7D', 't2', systemOp);
    const balance = balanceService.getCurrentBalance(member.id);
    
    expect(balance.totalBalance).toBe(10000);
    expect(balance.freezeBalance).toBe(3000);
    expect(balance.availableBalance).toBe(7000);
    expect(freezeResult.result.bucket.status).toBe('ACTIVE');
  });

  test('解冻积分 - 冻结减少，可用增加，总额不变', () => {
    const freezeResult = pointService.freeze(member.id, 3000, 'TEST_7D', 't2', systemOp);
    const bucketId = freezeResult.result.bucket.id;
    
    pointService.unfreeze(member.id, bucketId, 3000, 't3', systemOp);
    
    const balance = balanceService.getCurrentBalance(member.id);
    expect(balance.totalBalance).toBe(10000);
    expect(balance.freezeBalance).toBe(0);
    expect(balance.availableBalance).toBe(10000);
  });
});

describe('PointService - 重复扣减拦截（幂等）', () => {
  let memberRepo, freezeRuleRepo, pointService, balanceService;
  let member;

  beforeEach(() => {
    resetModules();
    require('../app');
    memberRepo = require('../repositories/MemberRepository');
    freezeRuleRepo = require('../repositories/FreezeRuleRepository');
    pointService = require('../services/PointService');
    const bs = require('../services/BalanceService');
    balanceService = new bs.BalanceService();

    member = memberRepo.create('测试用户');
    pointService.recharge(member.id, 10000, 't1', systemOp);
  });

  test('相同 requestId + action 只扣一次', () => {
    const reqId = 'test-consume-001';
    
    const r1 = pointService.consume(member.id, 1000, reqId, systemOp);
    const r2 = pointService.consume(member.id, 1000, reqId, systemOp);
    
    const balance = balanceService.getCurrentBalance(member.id);
    expect(balance.totalBalance).toBe(9000);
    expect(r2.isIdempotent).toBe(true);
  });

  test('充值幂等 - 只加一次', () => {
    const reqId = 'test-recharge-001';
    
    pointService.recharge(member.id, 2000, reqId, systemOp);
    pointService.recharge(member.id, 2000, reqId, systemOp);
    
    const balance = balanceService.getCurrentBalance(member.id);
    expect(balance.totalBalance).toBe(12000);
  });
});

describe('PointService - 消费时可选择使用冻结积分', () => {
  let memberRepo, freezeRuleRepo, pointService, balanceService;
  let member;

  beforeEach(() => {
    resetModules();
    require('../app');
    memberRepo = require('../repositories/MemberRepository');
    freezeRuleRepo = require('../repositories/FreezeRuleRepository');
    pointService = require('../services/PointService');
    const bs = require('../services/BalanceService');
    balanceService = new bs.BalanceService();

    member = memberRepo.create('测试用户');
    freezeRuleRepo.create({
      code: 'TEST_7D',
      name: '测试7天冻结',
      releaseType: 'TIME',
      releaseDays: 7,
      autoRelease: true
    });
  });

  test('允许从冻结桶消费时 - 余额不足可用余额会用冻结', () => {
    pointService.recharge(member.id, 5000, 't1', systemOp);
    pointService.freeze(member.id, 4000, 'TEST_7D', 't2', systemOp);
    
    const balance1 = balanceService.getCurrentBalance(member.id);
    expect(balance1.availableBalance).toBe(1000);
    
    const result = pointService.consume(member.id, 3000, 't3', systemOp, null, '紧急消费', true);
    
    expect(result.result.breakdown.consumedFromAvailable).toBe(1000);
    expect(result.result.breakdown.consumedFromFreeze).toBe(2000);
    
    const balance2 = balanceService.getCurrentBalance(member.id);
    expect(balance2.totalBalance).toBe(2000);
    expect(balance2.freezeBalance).toBe(2000);
    expect(balance2.availableBalance).toBe(0);
  });

  test('不允许时 - 余额不足直接报错', () => {
    pointService.recharge(member.id, 5000, 't1', systemOp);
    pointService.freeze(member.id, 4000, 'TEST_7D', 't2', systemOp);
    
    expect(() => {
      pointService.consume(member.id, 3000, 't3', systemOp, null, '消费', false);
    }).toThrow();
  });
});

describe('BalanceService - 余额一致性校验', () => {
  let memberRepo, freezeRuleRepo, pointService, balanceService, BalanceService;
  let member;

  beforeEach(() => {
    resetModules();
    require('../app');
    memberRepo = require('../repositories/MemberRepository');
    freezeRuleRepo = require('../repositories/FreezeRuleRepository');
    pointService = require('../services/PointService');
    const bs = require('../services/BalanceService');
    BalanceService = bs.BalanceService;
    balanceService = new BalanceService();

    member = memberRepo.create('测试用户');
    freezeRuleRepo.create({
      code: 'TEST_7D',
      name: '测试7天冻结',
      releaseType: 'TIME',
      releaseDays: 7,
      autoRelease: true
    });
  });

  test('操作后一致性检查通过', () => {
    pointService.recharge(member.id, 10000, 't1', systemOp);
    pointService.freeze(member.id, 3000, 'TEST_7D', 't2', systemOp);
    pointService.consume(member.id, 2000, 't3', systemOp);
    pointService.refund(member.id, 1000, 't4', systemOp);
    
    const consistency = balanceService.verifyConsistency(member.id);
    expect(consistency.isConsistent).toBe(true);
    expect(consistency.diff).toBe(0);
  });
});
