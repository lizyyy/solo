import { whitelistService, WhitelistValidationError } from '../services/whitelist.service';
import { WhitelistStatus, RateLimitUnit } from '../models/whitelist.model';

describe('API网关白名单验收测试', () => {
  beforeEach(() => {
    whitelistService.clearAll();
  });

  const createBaseRequest = (overrides = {}) => ({
    tenantId: 'tenant-001',
    tenantName: '阿里巴巴集团',
    apiGroupId: 'api-group-001',
    apiGroupName: '用户中心接口组',
    rateLimitRule: {
      maxRequests: 5000,
      unit: RateLimitUnit.SECOND,
      burstLimit: 10000
    },
    effectiveDate: new Date(),
    expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    applicant: '张三',
    reason: '双11大促活动提升限流',
    remark: '2024双11专属白名单',
    ...overrides
  });

  describe('完整流转流程', () => {
    it('应完成创建、审批、检查、导出的完整流程', () => {
      const created = whitelistService.create(createBaseRequest());
      expect(created.status).toBe(WhitelistStatus.PENDING_APPROVAL);

      const approved = whitelistService.approve(created.id, {
        approver: '审批人A',
        remark: '同意申请'
      });
      expect(approved.status).toBe(WhitelistStatus.ACTIVE);

      const checkResult = whitelistService.checkWhitelist(
        'tenant-001',
        'api-group-001'
      );
      expect(checkResult.allowed).toBe(true);
      expect(checkResult.rule?.maxRequests).toBe(5000);

      const detail = whitelistService.findById(created.id);
      expect(detail).toBeDefined();
      expect(detail?.tenantName).toBe('阿里巴巴集团');

      const histories = whitelistService.getHistories(created.id);
      expect(histories.length).toBe(2);
      const actions = histories.map(h => h.action);
      expect(actions).toContain('CREATE');
      expect(actions).toContain('APPROVE');

      const exported = whitelistService.export();
      expect(exported.length).toBe(1);
      expect(exported[0].status).toBe(WhitelistStatus.ACTIVE);
    });

    it('列表、详情、历史应互相对应', () => {
      const record1 = whitelistService.create(createBaseRequest());
      const record2 = whitelistService.create(
        createBaseRequest({
          tenantId: 'tenant-002',
          tenantName: '腾讯科技'
        })
      );

      whitelistService.approve(record1.id, { approver: '审批人A' });
      whitelistService.revoke(record1.id, '管理员', '活动结束');

      const list = whitelistService.findAll();
      expect(list.length).toBe(2);

      const detail1 = whitelistService.findById(list[0].id);
      const detail2 = whitelistService.findById(list[1].id);
      expect(detail1?.id).toBe(list[0].id);
      expect(detail2?.id).toBe(list[1].id);

      const histories1 = whitelistService.getHistories(record1.id);
      const histories2 = whitelistService.getHistories(record2.id);
      expect(histories1.length).toBe(3);
      expect(histories2.length).toBe(1);

      const exported = whitelistService.export();
      expect(exported.length).toBe(2);
      expect(exported.find(r => r.id === record1.id)?.status).toBe(
        WhitelistStatus.REVOKED
      );
      expect(exported.find(r => r.id === record2.id)?.status).toBe(
        WhitelistStatus.PENDING_APPROVAL
      );
    });
  });

  describe('冲突记录场景', () => {
    it('应正确处理重复申请冲突', () => {
      const record1 = whitelistService.create(createBaseRequest());

      expect(() => {
        whitelistService.create(createBaseRequest());
      }).toThrow(WhitelistValidationError);
      expect(() => {
        whitelistService.create(createBaseRequest());
      }).toThrow('该租户在该接口组下已有待审批或生效的白名单');

      whitelistService.reject(record1.id, '审批人A', '限流阈值过高');

      const record2 = whitelistService.create(
        createBaseRequest({
          rateLimitRule: {
            maxRequests: 1000,
            unit: RateLimitUnit.SECOND
          },
          reason: '调整后重新申请'
        })
      );
      expect(record2).toBeDefined();
      expect(record2.rateLimitRule.maxRequests).toBe(1000);

      const list = whitelistService.findAll();
      expect(list.length).toBe(2);

      const pendingList = whitelistService.findAll({
        status: WhitelistStatus.PENDING_APPROVAL
      });
      expect(pendingList.length).toBe(1);
      expect(pendingList[0].id).toBe(record2.id);
    });
  });

  describe('导入坏行场景', () => {
    it('应正确导入好数据并跳过坏数据', () => {
      const importData = [
        createBaseRequest(),
        {
          ...createBaseRequest({
            tenantId: 'tenant-002',
            tenantName: '腾讯科技'
          })
        },
        {
          ...createBaseRequest({
            tenantId: '',
            tenantName: ''
          })
        },
        {
          ...createBaseRequest({
            apiGroupId: '',
            rateLimitRule: null as any
          })
        },
        {
          ...createBaseRequest({
            tenantId: 'tenant-003',
            tenantName: '字节跳动',
            effectiveDate: new Date(Date.now() + 100000),
            expiryDate: new Date()
          })
        }
      ];

      const result = whitelistService.bulkImport(importData);

      expect(result.success.length).toBe(2);
      expect(result.failed.length).toBe(3);

      expect(result.failed[0].row).toBe(3);
      expect(result.failed[0].error).toContain('租户ID不能为空');

      expect(result.failed[1].row).toBe(4);
      expect(result.failed[1].error).toContain('接口组ID不能为空');

      expect(result.failed[2].row).toBe(5);
      expect(result.failed[2].error).toContain('生效日期必须早于失效日期');

      const list = whitelistService.findAll();
      expect(list.length).toBe(2);

      const exported = whitelistService.export();
      expect(exported.length).toBe(2);
    });

    it('导入数据后列表和详情应一致', () => {
      const importData = [
        createBaseRequest(),
        createBaseRequest({
          tenantId: 'tenant-002',
          tenantName: '腾讯科技',
          apiGroupId: 'api-group-002',
          apiGroupName: '订单中心接口组'
        }),
        createBaseRequest({
          tenantId: 'tenant-003',
          tenantName: '字节跳动',
          apiGroupId: 'api-group-003',
          apiGroupName: '支付中心接口组'
        })
      ];

      const result = whitelistService.bulkImport(importData);
      expect(result.success.length).toBe(3);

      const list = whitelistService.findAll();
      expect(list.length).toBe(3);

      list.forEach(record => {
        const detail = whitelistService.findById(record.id);
        expect(detail).toBeDefined();
        expect(detail?.tenantId).toBe(record.tenantId);
        expect(detail?.apiGroupId).toBe(record.apiGroupId);

        const histories = whitelistService.getHistories(record.id);
        expect(histories.length).toBe(1);
        expect(histories[0].action).toBe('CREATE');
      });
    });
  });

  describe('状态自动更新', () => {
    it('应自动更新临期和过期状态', () => {
      const expiringSoon = whitelistService.create(
        createBaseRequest({
          expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        })
      );
      whitelistService.approve(expiringSoon.id, { approver: '审批人A' });

      const expired = whitelistService.create(
        createBaseRequest({
          tenantId: 'tenant-002',
          tenantName: '腾讯科技',
          effectiveDate: new Date(Date.now() - 10000),
          expiryDate: new Date(Date.now() - 1000)
        })
      );
      whitelistService.approve(expired.id, { approver: '审批人A' });

      const normal = whitelistService.create(
        createBaseRequest({
          tenantId: 'tenant-003',
          tenantName: '字节跳动'
        })
      );
      whitelistService.approve(normal.id, { approver: '审批人A' });

      whitelistService.refreshStatuses();

      const list = whitelistService.findAll();
      const statuses = list.map(r => r.status);
      expect(statuses).toContain(WhitelistStatus.EXPIRING_SOON);
      expect(statuses).toContain(WhitelistStatus.EXPIRED);
      expect(statuses).toContain(WhitelistStatus.ACTIVE);

      const expiredRecord = whitelistService.findById(expired.id);
      expect(expiredRecord?.status).toBe(WhitelistStatus.EXPIRED);

      whitelistService.forceExpireCache('tenant-002', 'api-group-001');
      const checkResult = whitelistService.checkWhitelist(
        'tenant-002',
        'api-group-001'
      );
      expect(checkResult.allowed).toBe(false);
    });
  });
});
