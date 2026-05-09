import { initDatabase, closeDatabase } from '../../config/database';
import { quotaLedgerService } from '../quota-ledger-service';
import { customerService } from '../customer-service';
import { v4 as uuidv4 } from 'uuid';

describe('Quota Ledger Service', () => {
  let customerId: string;

  beforeAll(async () => {
    await initDatabase();
    const customer = await customerService.createCustomer('测试用户', uuidv4());
    customerId = customer.id;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('getOrCreateLedger', () => {
    it('应该创建新的额度台账', async () => {
      const ledger = await quotaLedgerService.getOrCreateLedger(customerId, 2026);
      
      expect(ledger).toBeDefined();
      expect(ledger.customerId).toBe(customerId);
      expect(ledger.year).toBe(2026);
      expect(ledger.totalQuota).toBe(50000);
      expect(ledger.usedQuota).toBe(0);
      expect(ledger.availableQuota).toBe(50000);
      expect(ledger.version).toBe(0);
    });

    it('应该返回已存在的额度台账', async () => {
      const ledger1 = await quotaLedgerService.getOrCreateLedger(customerId, 2026);
      const ledger2 = await quotaLedgerService.getOrCreateLedger(customerId, 2026);
      
      expect(ledger1.id).toBe(ledger2.id);
    });
  });

  describe('occupyQuota', () => {
    it('应该正常占用额度', async () => {
      const testCustomer = await customerService.createCustomer('占用测试用户', uuidv4());
      const ledger = await quotaLedgerService.occupyQuota(testCustomer.id, 1000, 2026);
      
      expect(ledger.usedQuota).toBe(1000);
      expect(ledger.availableQuota).toBe(49000);
      expect(ledger.version).toBe(1);
    });

    it('应该拒绝超过可用额度的占用', async () => {
      const testCustomer = await customerService.createCustomer('额度不足测试', uuidv4());
      
      await expect(
        quotaLedgerService.occupyQuota(testCustomer.id, 60000, 2026)
      ).rejects.toThrow('额度不足');
    });

    it('应该正确处理多次占用', async () => {
      const testCustomer = await customerService.createCustomer('多次占用测试', uuidv4());
      
      await quotaLedgerService.occupyQuota(testCustomer.id, 1000, 2026);
      await quotaLedgerService.occupyQuota(testCustomer.id, 2000, 2026);
      const finalLedger = await quotaLedgerService.getLedger(testCustomer.id, 2026);
      
      expect(finalLedger?.usedQuota).toBe(3000);
      expect(finalLedger?.availableQuota).toBe(47000);
    });
  });

  describe('releaseQuota', () => {
    it('应该正常释放额度', async () => {
      const testCustomer = await customerService.createCustomer('释放测试用户', uuidv4());
      await quotaLedgerService.occupyQuota(testCustomer.id, 2000, 2026);
      
      const ledger = await quotaLedgerService.releaseQuota(testCustomer.id, 1000, 2026);
      
      expect(ledger.usedQuota).toBe(1000);
      expect(ledger.availableQuota).toBe(49000);
    });

    it('应该拒绝释放超过已使用的额度', async () => {
      const testCustomer = await customerService.createCustomer('超额释放测试', uuidv4());
      await quotaLedgerService.occupyQuota(testCustomer.id, 1000, 2026);
      
      await expect(
        quotaLedgerService.releaseQuota(testCustomer.id, 2000, 2026)
      ).rejects.toThrow('释放金额超过已使用额度');
    });
  });

  describe('recalculateQuota', () => {
    it('应该基于成功交易重算额度', async () => {
      const testCustomer = await customerService.createCustomer('重算测试用户', uuidv4());
      
      const ledger = await quotaLedgerService.recalculateQuota(testCustomer.id, 2026);
      
      expect(ledger).toBeDefined();
      expect(ledger.usedQuota).toBe(0);
      expect(ledger.availableQuota).toBe(50000);
    });
  });

  describe('版本控制', () => {
    it('应该正确更新版本号', async () => {
      const testCustomer = await customerService.createCustomer('版本测试用户', uuidv4());
      const ledger1 = await quotaLedgerService.getOrCreateLedger(testCustomer.id, 2026);
      expect(ledger1.version).toBe(0);

      const ledger2 = await quotaLedgerService.occupyQuota(testCustomer.id, 500, 2026);
      expect(ledger2.version).toBe(1);

      const ledger3 = await quotaLedgerService.releaseQuota(testCustomer.id, 500, 2026);
      expect(ledger3.version).toBe(2);
    });
  });
});