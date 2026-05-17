import { whitelistService, WhitelistValidationError } from '../services/whitelist.service';
import { WhitelistStatus, RateLimitUnit, whitelistModel } from '../models/whitelist.model';

describe('API网关控制台租户限流白名单', () => {
  beforeEach(() => {
    whitelistService.clearAll();
  });

  const createTestRecord = (overrides = {}) => ({
    tenantId: 'tenant-001',
    tenantName: '测试租户A',
    apiGroupId: 'api-group-001',
    apiGroupName: '用户中心接口组',
    rateLimitRule: {
      maxRequests: 1000,
      unit: RateLimitUnit.MINUTE,
      burstLimit: 200
    },
    effectiveDate: new Date(),
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    applicant: '张三',
    reason: '大促活动需要临时提升限流',
    remark: '双11活动专用',
    ...overrides
  });

  describe('白名单缓存机制', () => {
    it('应缓存白名单检查结果，数据变更后清除缓存应返回最新状态', () => {
      const record = whitelistService.create(createTestRecord());
      whitelistService.approve(record.id, { approver: '审批人A' });

      const result1 = whitelistService.checkWhitelist(
        record.tenantId,
        record.apiGroupId
      );
      expect(result1.allowed).toBe(true);
      expect(result1.rule?.maxRequests).toBe(1000);

      whitelistService.revoke(record.id, '管理员', '活动结束');

      const result2 = whitelistService.checkWhitelist(
        record.tenantId,
        record.apiGroupId
      );
      expect(result2.allowed).toBe(false);
    });

    it('手动强制清除缓存后应重新计算状态', () => {
      const record = whitelistService.create({
        ...createTestRecord(),
        effectiveDate: new Date(Date.now() - 10000),
        expiryDate: new Date(Date.now() + 86400000)
      });
      whitelistService.approve(record.id, { approver: '审批人A' });

      const result1 = whitelistService.checkWhitelist(
        record.tenantId,
        record.apiGroupId
      );
      expect(result1.allowed).toBe(true);

      whitelistModel.update(record.id, {
        expiryDate: new Date(Date.now() - 1000)
      }, 'system');

      const result2 = whitelistService.checkWhitelist(
        record.tenantId,
        record.apiGroupId
      );
      expect(result2.allowed).toBe(true);

      whitelistService.forceExpireCache(record.tenantId, record.apiGroupId);

      const result3 = whitelistService.checkWhitelist(
        record.tenantId,
        record.apiGroupId
      );
      expect(result3.allowed).toBe(false);
    });
  });

  describe('重复请求', () => {
    it('应拒绝同一租户同一接口组的重复待审批申请', () => {
      whitelistService.create(createTestRecord());

      expect(() => {
        whitelistService.create(createTestRecord());
      }).toThrow(WhitelistValidationError);
      expect(() => {
        whitelistService.create(createTestRecord());
      }).toThrow('该租户在该接口组下已有待审批或生效的白名单');
    });

    it('应拒绝同一租户同一接口组已生效白名单的重复申请', () => {
      const record = whitelistService.create(createTestRecord());
      whitelistService.approve(record.id, { approver: '审批人A' });

      expect(() => {
        whitelistService.create(createTestRecord());
      }).toThrow(WhitelistValidationError);
    });

    it('不同租户相同接口组应允许申请', () => {
      whitelistService.create(createTestRecord());

      expect(() => {
        whitelistService.create(
          createTestRecord({
            tenantId: 'tenant-002',
            tenantName: '测试租户B'
          })
        );
      }).not.toThrow();
    });

    it('同一租户不同接口组应允许申请', () => {
      whitelistService.create(createTestRecord());

      expect(() => {
        whitelistService.create(
          createTestRecord({
            apiGroupId: 'api-group-002',
            apiGroupName: '订单中心接口组'
          })
        );
      }).not.toThrow();
    });
  });

  describe('撤回后再提交', () => {
    it('应允许撤回后重新提交', () => {
      const record = whitelistService.create(createTestRecord());
      expect(record.status).toBe(WhitelistStatus.PENDING_APPROVAL);

      whitelistService.revoke(record.id, '张三', '需要修改限流规则');

      const revokedRecord = whitelistService.findById(record.id);
      expect(revokedRecord?.status).toBe(WhitelistStatus.REVOKED);

      const resubmitted = whitelistService.resubmit(record.id, '张三');
      expect(resubmitted.status).toBe(WhitelistStatus.PENDING_APPROVAL);
    });

    it('应拒绝已生效状态的记录直接重新提交', () => {
      const record = whitelistService.create(createTestRecord());
      whitelistService.approve(record.id, { approver: '审批人A' });

      expect(() => {
        whitelistService.resubmit(record.id, '张三');
      }).toThrow(WhitelistValidationError);
      expect(() => {
        whitelistService.resubmit(record.id, '张三');
      }).toThrow('只有已撤回或已拒绝的记录才能重新提交');
    });

    it('撤回后重新提交时如有冲突应拒绝', () => {
      const record1 = whitelistService.create(createTestRecord());
      whitelistService.revoke(record1.id, '张三', '撤回');

      whitelistService.create(createTestRecord());

      expect(() => {
        whitelistService.resubmit(record1.id, '张三');
      }).toThrow(WhitelistValidationError);
    });
  });

  describe('状态流转校验', () => {
    it('应正确流转待审批 -> 已生效', () => {
      const record = whitelistService.create(createTestRecord());
      expect(record.status).toBe(WhitelistStatus.PENDING_APPROVAL);

      const approved = whitelistService.approve(record.id, { approver: '审批人A' });
      expect(approved.status).toBe(WhitelistStatus.ACTIVE);
    });

    it('应正确流转待审批 -> 已拒绝', () => {
      const record = whitelistService.create(createTestRecord());
      const rejected = whitelistService.reject(record.id, '审批人A', '限流阈值过高');
      expect(rejected.status).toBe(WhitelistStatus.REJECTED);
    });

    it('应正确流转已生效 -> 已撤回', () => {
      const record = whitelistService.create(createTestRecord());
      whitelistService.approve(record.id, { approver: '审批人A' });

      const revoked = whitelistService.revoke(record.id, '管理员', '活动结束');
      expect(revoked.status).toBe(WhitelistStatus.REVOKED);
    });

    it('应拒绝非法状态流转', () => {
      const record = whitelistService.create(createTestRecord());
      whitelistService.reject(record.id, '审批人A', '拒绝');

      expect(() => {
        whitelistService.approve(record.id, { approver: '审批人B' });
      }).toThrow(WhitelistValidationError);
    });
  });

  describe('历史记录', () => {
    it('应记录完整的操作历史', () => {
      const record = whitelistService.create(createTestRecord());
      whitelistService.approve(record.id, { approver: '审批人A', remark: '同意' });
      whitelistService.revoke(record.id, '管理员', '活动结束');

      const histories = whitelistService.getHistories(record.id);
      expect(histories.length).toBe(3);
      const actions = histories.map(h => h.action);
      expect(actions).toContain('CREATE');
      expect(actions).toContain('APPROVE');
      expect(actions).toContain('STATUS_REVOKED');
    });
  });
});
