import { cacheExplanationStore } from '../store/cacheExplanationStore';
import { CacheExplanationStatus } from '../types';

describe('CacheExplanationStore', () => {
  beforeEach(() => {
    cacheExplanationStore['explanations'].clear();
  });

  const sampleRequest = {
    apiPath: '/api/v1/users',
    cacheKey: 'users:all:page1',
    cacheKeyCalculation: {
      algorithm: 'SHA256',
      factors: ['path', 'queryParams'],
      rawValue: '/api/v1/users?page=1'
    },
    matchedRule: {
      id: 'rule-001',
      name: '用户列表缓存',
      description: '缓存用户列表接口30分钟',
      ttl: 1800,
      priority: 1,
      conditions: [{ field: 'path', operator: 'equals', value: '/api/v1/users' }]
    },
    ttlSeconds: 1800,
    expirationConditions: ['用户数据变更', '主动刷新'],
    explanationReport: {
      summary: '命中用户列表缓存规则',
      details: ['缓存键由路径和查询参数计算', 'TTL为30分钟', '数据来自规则ID: rule-001'],
      recommendations: '如需实时数据请强制刷新'
    },
    createdBy: 'system'
  };

  describe('create', () => {
    it('应该成功创建缓存解释记录', () => {
      const result = cacheExplanationStore.create(sampleRequest);
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.apiPath).toBe(sampleRequest.apiPath);
      expect(result.cacheKey).toBe(sampleRequest.cacheKey);
      expect(result.status).toBe(CacheExplanationStatus.PENDING);
      expect(result.hitHistory).toEqual([]);
    });
  });

  describe('findById', () => {
    it('应该根据ID找到记录', () => {
      const created = cacheExplanationStore.create(sampleRequest);
      const found = cacheExplanationStore.findById(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('不存在的ID应该返回undefined', () => {
      const found = cacheExplanationStore.findById('non-existent-id');
      expect(found).toBeUndefined();
    });
  });

  describe('findByCacheKey', () => {
    it('应该根据缓存键找到记录', () => {
      const created = cacheExplanationStore.create(sampleRequest);
      const found = cacheExplanationStore.findByCacheKey(sampleRequest.cacheKey);
      expect(found).toBeDefined();
      expect(found?.cacheKey).toBe(created.cacheKey);
    });
  });

  describe('query', () => {
    it('应该支持分页查询', () => {
      for (let i = 0; i < 25; i++) {
        cacheExplanationStore.create({
          ...sampleRequest,
          cacheKey: `key-${i}`
        });
      }

      const result = cacheExplanationStore.query({ page: 1, pageSize: 10 });
      expect(result.data.length).toBe(10);
      expect(result.total).toBe(25);
    });

    it('应该支持按状态筛选', () => {
      const exp1 = cacheExplanationStore.create(sampleRequest);
      cacheExplanationStore.create({ ...sampleRequest, cacheKey: 'key2' });

      cacheExplanationStore.updateStatus(exp1.id, CacheExplanationStatus.CONFIRMED);

      const result = cacheExplanationStore.query({ status: CacheExplanationStatus.CONFIRMED });
      expect(result.total).toBe(1);
    });
  });

  describe('updateStatus', () => {
    it('应该正确更新状态', () => {
      const exp = cacheExplanationStore.create(sampleRequest);
      const updated = cacheExplanationStore.updateStatus(exp.id, CacheExplanationStatus.CONFIRMED, 'user1');

      expect(updated?.status).toBe(CacheExplanationStatus.CONFIRMED);
      expect(updated?.metadata.confirmedBy).toBe('user1');
    });
  });

  describe('manualCorrection', () => {
    it('应该支持人工修正状态和TTL', () => {
      const exp = cacheExplanationStore.create(sampleRequest);
      const result = cacheExplanationStore.manualCorrection({
        explanationId: exp.id,
        newStatus: CacheExplanationStatus.COMPENSATED,
        reason: '数据不准确',
        correctedBy: 'admin',
        overrideTtl: 3600
      });

      expect(result).toBeDefined();
      expect(result?.status).toBe(CacheExplanationStatus.COMPENSATED);
      expect(result?.expiration.ttlSeconds).toBe(3600);
    });
  });

  describe('recordHit', () => {
    it('应该记录命中历史', () => {
      cacheExplanationStore.create(sampleRequest);
      const result = cacheExplanationStore.recordHit(sampleRequest.cacheKey, 'req-123', '192.168.1.1');

      expect(result).toBeDefined();
      expect(result?.hitHistory.length).toBe(1);
      expect(result?.hitHistory[0].requestId).toBe('req-123');
    });
  });

  describe('forceRefresh', () => {
    it('应该强制刷新并标记为已撤销', () => {
      cacheExplanationStore.create(sampleRequest);
      const result = cacheExplanationStore.forceRefresh({
        cacheKey: sampleRequest.cacheKey,
        reason: '数据更新',
        refreshedBy: 'admin'
      });

      expect(result).toBeDefined();
      expect(result?.status).toBe(CacheExplanationStatus.REVOKED);
    });
  });

  describe('recordFailure', () => {
    it('应该记录失败详情并标记为被拦截', () => {
      const exp = cacheExplanationStore.create(sampleRequest);
      const result = cacheExplanationStore.recordFailure(
        exp.id,
        { input: 'test' },
        ['依据1', '依据2'],
        '处理失败结论',
        'Error stack'
      );

      expect(result).toBeDefined();
      expect(result?.status).toBe(CacheExplanationStatus.BLOCKED);
      expect(result?.failureDetails).toBeDefined();
      expect(result?.failureDetails?.rawInput).toEqual({ input: 'test' });
      expect(result?.failureDetails?.processingBasis).toEqual(['依据1', '依据2']);
      expect(result?.failureDetails?.finalConclusion).toBe('处理失败结论');
    });
  });
});
