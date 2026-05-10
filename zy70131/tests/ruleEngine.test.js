const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const sequelize = require('../src/config/database');
const { Material } = require('../src/models/Material');
const { Authorization, AuthorizationStatus } = require('../src/models/Authorization');
const { RegionRule, RegionRuleType } = require('../src/models/RegionRule');
const RuleEngine = require('../src/services/RuleEngine');

describe('RuleEngine', () => {
  let ruleEngine;
  let testMaterial;
  let testAuthorization;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    ruleEngine = new RuleEngine();

    testMaterial = await Material.create({
      id: uuidv4(),
      materialCode: 'MAT-001',
      materialName: '测试素材',
      materialType: 'image',
      copyrightOwner: '测试版权方',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    await Authorization.destroy({ where: {} });
    await RegionRule.destroy({ where: {} });
  });

  describe('evaluateAuthorizationValidity', () => {
    test('应正确判定活跃且在有效期内的授权为有效', async () => {
      testAuthorization = await Authorization.create({
        id: uuidv4(),
        authorizationCode: 'AUTH-001',
        materialId: testMaterial.id,
        channelId: uuidv4(),
        channelName: '测试渠道',
        scope: 'full',
        effectiveDate: dayjs().subtract(1, 'day').toDate(),
        expirationDate: dayjs().add(30, 'day').toDate(),
        status: AuthorizationStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await ruleEngine.evaluateAuthorizationValidity(testAuthorization);

      expect(result.isValid).toBe(true);
      expect(result.reason).toBe('ALL_CHECKS_PASSED');
      expect(result.evaluationSteps).toHaveLength(3);
    });

    test('应正确判定非活跃状态的授权为无效', async () => {
      testAuthorization = await Authorization.create({
        id: uuidv4(),
        authorizationCode: 'AUTH-002',
        materialId: testMaterial.id,
        channelId: uuidv4(),
        channelName: '测试渠道',
        scope: 'full',
        effectiveDate: dayjs().subtract(1, 'day').toDate(),
        expirationDate: dayjs().add(30, 'day').toDate(),
        status: AuthorizationStatus.EXPIRED,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await ruleEngine.evaluateAuthorizationValidity(testAuthorization);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('AUTHORIZATION_NOT_ACTIVE');
    });

    test('应正确判定尚未生效的授权为无效', async () => {
      testAuthorization = await Authorization.create({
        id: uuidv4(),
        authorizationCode: 'AUTH-003',
        materialId: testMaterial.id,
        channelId: uuidv4(),
        channelName: '测试渠道',
        scope: 'full',
        effectiveDate: dayjs().add(1, 'day').toDate(),
        expirationDate: dayjs().add(30, 'day').toDate(),
        status: AuthorizationStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await ruleEngine.evaluateAuthorizationValidity(testAuthorization);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('NOT_YET_EFFECTIVE');
    });

    test('应正确判定已到期的授权为无效', async () => {
      testAuthorization = await Authorization.create({
        id: uuidv4(),
        authorizationCode: 'AUTH-004',
        materialId: testMaterial.id,
        channelId: uuidv4(),
        channelName: '测试渠道',
        scope: 'full',
        effectiveDate: dayjs().subtract(30, 'day').toDate(),
        expirationDate: dayjs().subtract(1, 'day').toDate(),
        status: AuthorizationStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await ruleEngine.evaluateAuthorizationValidity(testAuthorization);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('AUTHORIZATION_EXPIRED');
      expect(result.triggeredAction).toBe('TRIGGER_EXPIRATION_REMOVAL');
    });
  });

  describe('evaluateRegionRule', () => {
    beforeEach(async () => {
      testAuthorization = await Authorization.create({
        id: uuidv4(),
        authorizationCode: 'AUTH-REGION',
        materialId: testMaterial.id,
        channelId: uuidv4(),
        channelName: '测试渠道',
        scope: 'full',
        effectiveDate: dayjs().subtract(1, 'day').toDate(),
        expirationDate: dayjs().add(30, 'day').toDate(),
        status: AuthorizationStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    test('无地域规则时应默认可访问', async () => {
      const result = await ruleEngine.evaluateRegionRule(testAuthorization, 'CN', []);
      expect(result.isValid).toBe(true);
    });

    test('排除规则中的地区应被拒绝', async () => {
      const rules = [
        {
          ruleType: RegionRuleType.EXCLUDE,
          regionCode: 'US',
          regionName: '美国',
          priority: 10
        }
      ];

      const result = await ruleEngine.evaluateRegionRule(testAuthorization, 'US', rules);
      expect(result.isValid).toBe(false);
      expect(result.detail).toContain('美国');
    });

    test('包含规则中存在的地区应被允许', async () => {
      const rules = [
        {
          ruleType: RegionRuleType.INCLUDE,
          regionCode: 'CN',
          regionName: '中国',
          priority: 10
        },
        {
          ruleType: RegionRuleType.INCLUDE,
          regionCode: 'JP',
          regionName: '日本',
          priority: 5
        }
      ];

      const result = await ruleEngine.evaluateRegionRule(testAuthorization, 'CN', rules);
      expect(result.isValid).toBe(true);
    });

    test('包含规则中不存在的地区应被拒绝', async () => {
      const rules = [
        {
          ruleType: RegionRuleType.INCLUDE,
          regionCode: 'CN',
          regionName: '中国',
          priority: 10
        }
      ];

      const result = await ruleEngine.evaluateRegionRule(testAuthorization, 'US', rules);
      expect(result.isValid).toBe(false);
    });

    test('排除规则优先级高于包含规则', async () => {
      const rules = [
        {
          ruleType: RegionRuleType.EXCLUDE,
          regionCode: 'CN-HK',
          regionName: '中国香港',
          priority: 20
        },
        {
          ruleType: RegionRuleType.INCLUDE,
          regionCode: 'CN',
          regionName: '中国',
          priority: 10
        }
      ];

      const result = await ruleEngine.evaluateRegionRule(testAuthorization, 'CN-HK', rules);
      expect(result.isValid).toBe(false);
    });
  });

  describe('checkExpiringAuthorizations', () => {
    test('应正确识别即将到期的授权', async () => {
      await Authorization.create({
        id: uuidv4(),
        authorizationCode: 'AUTH-EXPIRING',
        materialId: testMaterial.id,
        channelId: uuidv4(),
        channelName: '测试渠道',
        scope: 'full',
        effectiveDate: dayjs().subtract(30, 'day').toDate(),
        expirationDate: dayjs().add(5, 'day').toDate(),
        status: AuthorizationStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await ruleEngine.checkExpiringAuthorizations(7);

      expect(result.count).toBe(1);
      expect(result.expiringAuthorizations[0].daysRemaining).toBe(5);
    });
  });

  describe('evaluation history', () => {
    test('每次评估应记录到历史日志', async () => {
      const auth = await Authorization.create({
        id: uuidv4(),
        authorizationCode: 'AUTH-HISTORY',
        materialId: testMaterial.id,
        channelId: uuidv4(),
        channelName: '测试渠道',
        scope: 'full',
        effectiveDate: dayjs().subtract(1, 'day').toDate(),
        expirationDate: dayjs().add(30, 'day').toDate(),
        status: AuthorizationStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await ruleEngine.evaluateAuthorizationValidity(auth);
      await ruleEngine.evaluateAuthorizationValidity(auth, 'CN');

      const history = await ruleEngine.getEvaluationHistory(auth.id);

      expect(history.length).toBe(2);
      expect(history[0].evaluationType).toBe('validity_check');
    });
  });
});
