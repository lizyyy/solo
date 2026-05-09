import { initDatabase, closeDatabase } from '../../config/database';
import { transactionService } from '../transaction-service';
import { reversalService } from '../reversal-service';
import { customerService } from '../customer-service';
import { exchangeRateService } from '../exchange-rate-service';
import { quotaLedgerService } from '../quota-ledger-service';
import { v4 as uuidv4 } from 'uuid';

describe('Reversal Service', () => {
  let customerId: string;

  beforeAll(async () => {
    await initDatabase();
    const customer = await customerService.createCustomer('冲正测试用户', uuidv4());
    customerId = customer.id;
    await exchangeRateService.createSnapshot('USD', 7.15, 7.25);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('createReversal', () => {
    it('应该成功冲正交易并恢复额度', async () => {
      const idempotentKey = `REV-TEST-${Date.now()}`;
      const transaction = await transactionService.createTransaction({
        idempotentKey,
        customerId,
        type: 'BUY',
        currency: 'USD',
        foreignCurrencyAmount: 1000
      });

      const ledgerBefore = await quotaLedgerService.getLedger(customerId);
      const usedBefore = ledgerBefore?.usedQuota || 0;

      const reversal = await reversalService.createReversal(
        transaction.id,
        '用户操作失误'
      );

      expect(reversal.status).toBe('SUCCESS');
      expect(reversal.originalTransactionId).toBe(transaction.id);

      const updatedTransaction = await transactionService.getTransactionById(transaction.id);
      expect(updatedTransaction.status).toBe('REVERSED');

      const ledgerAfter = await quotaLedgerService.getLedger(customerId);
      expect(ledgerAfter?.usedQuota).toBe(usedBefore - transaction.rmbAmount);
    });

    it('应该拒绝冲正非SUCCESS状态的交易', async () => {
      const idempotentKey = `REV-TEST-CANCELLED-${Date.now()}`;
      const transaction = await transactionService.createTransaction({
        idempotentKey,
        customerId,
        type: 'BUY',
        currency: 'USD',
        foreignCurrencyAmount: 100
      });

      await transactionService.cancelTransaction(transaction.id);

      await expect(
        reversalService.createReversal(transaction.id, '测试原因')
      ).rejects.toThrow('只能冲正');
    });

    it('应该拒绝冲正不存在的交易', async () => {
      await expect(
        reversalService.createReversal('non-existent-id', '测试原因')
      ).rejects.toThrow('交易不存在');
    });
  });

  describe('getReversalById', () => {
    it('应该返回正确的冲正记录', async () => {
      const idempotentKey = `REV-GET-${Date.now()}`;
      const transaction = await transactionService.createTransaction({
        idempotentKey,
        customerId,
        type: 'BUY',
        currency: 'USD',
        foreignCurrencyAmount: 100
      });

      const created = await reversalService.createReversal(
        transaction.id,
        '测试原因'
      );

      const found = await reversalService.getReversalById(created.id);
      
      expect(found.id).toBe(created.id);
      expect(found.status).toBe('SUCCESS');
      expect(found.reason).toBe('测试原因');
    });

    it('应该对不存在的冲正记录抛出错误', async () => {
      await expect(
        reversalService.getReversalById('non-existent-id')
      ).rejects.toThrow('冲正记录不存在');
    });
  });

  describe('getReversalsByTransaction', () => {
    it('应该返回交易的所有冲正记录', async () => {
      const idempotentKey = `REV-MULTI-${Date.now()}`;
      const transaction = await transactionService.createTransaction({
        idempotentKey,
        customerId,
        type: 'BUY',
        currency: 'USD',
        foreignCurrencyAmount: 100
      });

      await reversalService.createReversal(transaction.id, '第一个冲正原因');

      const reversals = await reversalService.getReversalsByTransaction(transaction.id);
      
      expect(reversals.length).toBeGreaterThan(0);
      expect(reversals[0].originalTransactionId).toBe(transaction.id);
    });
  });

  describe('executeReversal', () => {
    it('应该允许重试失败的冲正', async () => {
      const idempotentKey = `REV-RETRY-${Date.now()}`;
      const transaction = await transactionService.createTransaction({
        idempotentKey,
        customerId,
        type: 'BUY',
        currency: 'USD',
        foreignCurrencyAmount: 500
      });

      const reversal = await reversalService.createReversal(
        transaction.id,
        '测试重试'
      );

      const retried = await reversalService.executeReversal(reversal.id);
      
      expect(retried.status).toBe('SUCCESS');
      expect(retried.retryCount).toBeGreaterThan(0);
    });
  });
});