const fs = require('fs');
const path = require('path');

const testDbDir = path.join(__dirname, '../../data-test');

function resetModules(dbPath) {
  try {
    const dbModule = require('../config/database');
    dbModule.resetDatabase();
  } catch(e) {}
  
  try {
    const appModule = require('../app');
    if (appModule.resetApp) appModule.resetApp();
  } catch(e) {}
  
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
    '../routes/members',
    '../routes/points',
    '../app'
  ];
  modulesToDelete.forEach(m => {
    try { delete require.cache[require.resolve(m)]; } catch(e) {}
  });
}

const systemOp = { name: 'test', id: 'test-001', type: 'test' };

describe('PointService - 核心积分操作', () => {
  let memberRepo, freezeRuleRepo, pointService, balanceService;
  let member;

  beforeEach(async () => {
    const testDbPath = path.join(testDbDir, `service-core-${Date.now()}.db`);
    if (fs.existsSync(testDbDir)) {
      fs.readdirSync(testDbDir).forEach(f => {
        try { fs.unlinkSync(path.join(testDbDir, f)); } catch(e) {}
      });
    } else {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
    process.env.DB_PATH = testDbPath;
    resetModules(testDbPath);
    
    const createApp = require('../app');
    await createApp();
    
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

  afterAll(() => {
    if (fs.existsSync(testDbDir)) {
      fs.readdirSync(testDbDir).forEach(f => {
        try { fs.unlinkSync(path.join(testDbDir, f)); } catch(e) {}
      });
      try { fs.rmdirSync(testDbDir); } catch(e) {}
    }
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

  beforeEach(async () => {
    const testDbPath = path.join(testDbDir, `service-freeze-${Date.now()}.db`);
    if (fs.existsSync(testDbDir)) {
      fs.readdirSync(testDbDir).forEach(f => {
        try { fs.unlinkSync(path.join(testDbDir, f)); } catch(e) {}
      });
    } else {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
    process.env.DB_PATH = testDbPath;
    resetModules(testDbPath);
    
    const createApp = require('../app');
    await createApp();
    
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

  afterAll(() => {
    if (fs.existsSync(testDbDir)) {
      fs.readdirSync(testDbDir).forEach(f => {
        try { fs.unlinkSync(path.join(testDbDir, f)); } catch(e) {}
      });
      try { fs.rmdirSync(testDbDir); } catch(e) {}
    }
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

  beforeEach(async () => {
    const testDbPath = path.join(testDbDir, `service-idempotent-${Date.now()}.db`);
    if (fs.existsSync(testDbDir)) {
      fs.readdirSync(testDbDir).forEach(f => {
        try { fs.unlinkSync(path.join(testDbDir, f)); } catch(e) {}
      });
    } else {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
    process.env.DB_PATH = testDbPath;
    resetModules(testDbPath);
    
    const createApp = require('../app');
    await createApp();
    
    memberRepo = require('../repositories/MemberRepository');
    freezeRuleRepo = require('../repositories/FreezeRuleRepository');
    pointService = require('../services/PointService');
    const bs = require('../services/BalanceService');
    balanceService = new bs.BalanceService();

    member = memberRepo.create('测试用户');
    pointService.recharge(member.id, 10000, 't1', systemOp);
  });

  afterAll(() => {
    if (fs.existsSync(testDbDir)) {
      fs.readdirSync(testDbDir).forEach(f => {
        try { fs.unlinkSync(path.join(testDbDir, f)); } catch(e) {}
      });
      try { fs.rmdirSync(testDbDir); } catch(e) {}
    }
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

  beforeEach(async () => {
    const testDbPath = path.join(testDbDir, `service-consume-${Date.now()}.db`);
    if (fs.existsSync(testDbDir)) {
      fs.readdirSync(testDbDir).forEach(f => {
        try { fs.unlinkSync(path.join(testDbDir, f)); } catch(e) {}
      });
    } else {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
    process.env.DB_PATH = testDbPath;
    resetModules(testDbPath);
    
    const createApp = require('../app');
    await createApp();
    
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

  afterAll(() => {
    if (fs.existsSync(testDbDir)) {
      fs.readdirSync(testDbDir).forEach(f => {
        try { fs.unlinkSync(path.join(testDbDir, f)); } catch(e) {}
      });
      try { fs.rmdirSync(testDbDir); } catch(e) {}
    }
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
  let memberRepo, freezeRuleRepo, pointService, balanceService;
  let member;

  beforeEach(async () => {
    const testDbPath = path.join(testDbDir, `service-consistency-${Date.now()}.db`);
    if (fs.existsSync(testDbDir)) {
      fs.readdirSync(testDbDir).forEach(f => {
        try { fs.unlinkSync(path.join(testDbDir, f)); } catch(e) {}
      });
    } else {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
    process.env.DB_PATH = testDbPath;
    resetModules(testDbPath);
    
    const createApp = require('../app');
    await createApp();
    
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

  afterAll(() => {
    if (fs.existsSync(testDbDir)) {
      fs.readdirSync(testDbDir).forEach(f => {
        try { fs.unlinkSync(path.join(testDbDir, f)); } catch(e) {}
      });
      try { fs.rmdirSync(testDbDir); } catch(e) {}
    }
  });

  test('操作后一致性检查通过', () => {
    pointService.recharge(member.id, 10000, 't1', systemOp);
    pointService.freeze(member.id, 3000, 'TEST_7D', 't2', systemOp);
    pointService.consume(member.id, 2000, 't3', systemOp, 'ORDER-001');
    pointService.refund(member.id, 1000, 't4', systemOp, 'ORDER-001');
    
    const consistency = balanceService.verifyConsistency(member.id);
    expect(consistency.isConsistent).toBe(true);
    expect(consistency.diff).toBe(0);
  });
});

describe('PointService - 失败流水记录', () => {
  let memberRepo, freezeRuleRepo, pointService, balanceService, pointLedgerRepo;
  let member;

  beforeEach(async () => {
    const testDbPath = path.join(testDbDir, `service-failed-${Date.now()}.db`);
    if (fs.existsSync(testDbDir)) {
      fs.readdirSync(testDbDir).forEach(f => {
        try { fs.unlinkSync(path.join(testDbDir, f)); } catch(e) {}
      });
    } else {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
    process.env.DB_PATH = testDbPath;
    resetModules(testDbPath);
    
    const createApp = require('../app');
    await createApp();
    
    memberRepo = require('../repositories/MemberRepository');
    freezeRuleRepo = require('../repositories/FreezeRuleRepository');
    pointService = require('../services/PointService');
    pointLedgerRepo = require('../repositories/PointLedgerRepository');
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

  afterAll(() => {
    if (fs.existsSync(testDbDir)) {
      fs.readdirSync(testDbDir).forEach(f => {
        try { fs.unlinkSync(path.join(testDbDir, f)); } catch(e) {}
      });
      try { fs.rmdirSync(testDbDir); } catch(e) {}
    }
  });

  test('消费失败时记录 FAILED 流水', () => {
    pointService.recharge(member.id, 1000, 't1', systemOp);
    
    expect(() => {
      pointService.consume(member.id, 5000, 't2', systemOp, null, '测试失败消费', false);
    }).toThrow();
    
    const ledgers = pointLedgerRepo.findByMemberId(member.id, 10);
    const failedLedger = ledgers.find(l => l.status === 'FAILED');
    
    expect(failedLedger).toBeDefined();
    expect(failedLedger.trans_type).toBe('consume');
    expect(failedLedger.error_code).toBe('INSUFFICIENT_BALANCE');
    expect(failedLedger.balance_before).toBe(1000);
    expect(failedLedger.balance_after).toBe(1000);
  });

  test('冻结失败时记录 FAILED 流水（可用余额不足）', () => {
    expect(() => {
      pointService.freeze(member.id, 5000, 'TEST_7D', 't1', systemOp);
    }).toThrow();
    
    const ledgers = pointLedgerRepo.findByMemberId(member.id, 10);
    const failedLedger = ledgers.find(l => l.status === 'FAILED');
    
    expect(failedLedger).toBeDefined();
    expect(failedLedger.trans_type).toBe('freeze');
    expect(failedLedger.error_code).toBe('INSUFFICIENT_BALANCE');
  });
});

describe('PointService - 退款重复扣款防护', () => {
  let memberRepo, pointService, balanceService;
  let member;

  beforeEach(async () => {
    const testDbPath = path.join(testDbDir, `service-refund-protection-${Date.now()}.db`);
    if (fs.existsSync(testDbDir)) {
      fs.readdirSync(testDbDir).forEach(f => {
        try { fs.unlinkSync(path.join(testDbDir, f)); } catch(e) {}
      });
    } else {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
    process.env.DB_PATH = testDbPath;
    resetModules(testDbPath);
    
    const createApp = require('../app');
    await createApp();
    
    memberRepo = require('../repositories/MemberRepository');
    pointService = require('../services/PointService');
    const bs = require('../services/BalanceService');
    balanceService = new bs.BalanceService();

    member = memberRepo.create('测试用户');
  });

  afterAll(() => {
    if (fs.existsSync(testDbDir)) {
      fs.readdirSync(testDbDir).forEach(f => {
        try { fs.unlinkSync(path.join(testDbDir, f)); } catch(e) {}
      });
      try { fs.rmdirSync(testDbDir); } catch(e) {}
    }
  });

  test('没有对应消费记录时退款失败', () => {
    pointService.recharge(member.id, 10000, 't1', systemOp);
    
    expect(() => {
      pointService.refund(member.id, 1000, 't2', systemOp, 'NON_EXISTENT_ORDER');
    }).toThrow();
    
    const balance = balanceService.getCurrentBalance(member.id);
    expect(balance.totalBalance).toBe(10000);
  });

  test('同一订单使用不同 requestId 不能重复退款', () => {
    pointService.recharge(member.id, 10000, 't1', systemOp);
    pointService.consume(member.id, 3000, 't2', systemOp, 'PROTECTED_ORDER_001');
    
    const balance1 = balanceService.getCurrentBalance(member.id);
    expect(balance1.totalBalance).toBe(7000);
    
    pointService.refund(member.id, 3000, 't3', systemOp, 'PROTECTED_ORDER_001');
    
    const balance2 = balanceService.getCurrentBalance(member.id);
    expect(balance2.totalBalance).toBe(10000);
    
    expect(() => {
      pointService.refund(member.id, 3000, 't4', systemOp, 'PROTECTED_ORDER_001');
    }).toThrow();
    
    const balance3 = balanceService.getCurrentBalance(member.id);
    expect(balance3.totalBalance).toBe(10000);
  });

  test('退款金额不能超过已消费金额', () => {
    pointService.recharge(member.id, 10000, 't1', systemOp);
    pointService.consume(member.id, 2000, 't2', systemOp, 'OVERFLOW_ORDER_001');
    
    expect(() => {
      pointService.refund(member.id, 5000, 't3', systemOp, 'OVERFLOW_ORDER_001');
    }).toThrow();
    
    const balance = balanceService.getCurrentBalance(member.id);
    expect(balance.totalBalance).toBe(8000);
  });

  test('部分退款后剩余金额可再次退款', () => {
    pointService.recharge(member.id, 10000, 't1', systemOp);
    pointService.consume(member.id, 3000, 't2', systemOp, 'PARTIAL_ORDER_001');
    
    const balance1 = balanceService.getCurrentBalance(member.id);
    expect(balance1.totalBalance).toBe(7000);
    
    pointService.refund(member.id, 1000, 't3', systemOp, 'PARTIAL_ORDER_001');
    
    const balance2 = balanceService.getCurrentBalance(member.id);
    expect(balance2.totalBalance).toBe(8000);
    
    pointService.refund(member.id, 2000, 't4', systemOp, 'PARTIAL_ORDER_001');
    
    const balance3 = balanceService.getCurrentBalance(member.id);
    expect(balance3.totalBalance).toBe(10000);
    
    expect(() => {
      pointService.refund(member.id, 100, 't5', systemOp, 'PARTIAL_ORDER_001');
    }).toThrow();
  });
});
