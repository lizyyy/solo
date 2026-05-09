import { initDatabase, closeDatabase } from '../../config/database';
import { transactionService } from '../transaction-service';
import { customerService } from '../customer-service';
import { exchangeRateService } from '../exchange-rate-service';
import { v4 as uuidv4 } from 'uuid';

describe('Transaction Service', () => {
  let customerId: string;

  beforeAll(async () => {
    await initDatabase();
    const customer = await customerService.createCustomer('交易测试用户', uuidv4());
    customerId = customer.id;
    await exchangeRateService.createSnapshot('USD', 7.15, 7.25);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('createTransaction', () => {
    it('应该创建成功的购汇交易', async () => {
      const idempotentKey = `TEST-BUY-${Date.now()}`;
      const transaction = await transactionService.createTransaction({
        idempotentKey,
        customerId,
        type: 'BUY',
        currency: 'USD',
        foreignCurrencyAmount: 1000
      });

      expect(transaction).toBeDefined();
      expect(transaction.status).toBe('SUCCESS');
      expect(transaction.type).toBe('BUY');
      expect(transaction.currency).toBe('USD');
      expect(transaction.foreignCurrencyAmount).toBe(1000);
      expect(transaction.rmbAmount).toBe(7250);
    });

    it('应该创建成功的结汇交易', async () => {
      const idempotentKey = `TEST-SELL-${Date.now()}`;
      const transaction = await transactionService.createTransaction({
        idempotentKey,
        customerId,
        type: 'SELL',
        currency: 'USD',
        foreignCurrencyAmount: 500
      });

      expect(transaction.status).toBe('SUCCESS');
      expect(transaction.type).toBe('SELL');
      expect(transaction.rmbAmount).toBe(3575);
    });

    it('应该处理幂等请求', async () => {
      const idempotentKey = `TEST-IDEMPOTENT-${Date.now()}`;
      
      const tx1 = await transactionService.createTransaction({
        idempotentKey,
        customerId,
        type: 'BUY',
        currency: 'USD',
        foreignCurrencyAmount: 100
      });

      const tx2 = await transactionService.createTransaction({
        idempotentKey,
        customerId,
        type: 'BUY',
        currency: 'USD',
        foreignCurrencyAmount: 100
      });

      expect(tx1.id).toBe(tx2.id);
    });

    it('应该拒绝不存在的币种', async () => {
      const idempotentKey = `TEST-INVALID-CURRENCY-${Date.now()}`;
      
      await expect(
        transactionService.createTransaction({
          idempotentKey,
          customerId,
          type: 'BUY',
          currency: 'INVALID',
          foreignCurrencyAmount: 100
        })
      ).rejects.toThrow('未找到');
    });

    it('应该拒绝超过年度额度的交易', async () => {
      const newCustomer = await customerService.createCustomer('额度超限测试', uuidv4());
      const idempotentKey = `TEST-OVER-LIMIT-${Date.now()}`;
      
      await expect(
        transactionService.createTransaction({
          idempotentKey,
          customerId: newCustomer.id,
          type: 'BUY',
          currency: 'USD',
          foreignCurrencyAmount: 8000
        })
      ).rejects.toThrow('额度不足');
    });
  });

  describe('getTransactionById', () => {
    it('应该返回正确的交易信息', async () => {
      const idempotentKey = `TEST-GET-${Date.now()}`;
      const created = await transactionService.createTransaction({
        idempotentKey,
        customerId,
        type: 'BUY',
        currency: 'USD',
        foreignCurrencyAmount: 200
      });

      const found = await transactionService.getTransactionById(created.id);
      
      expect(found.id).toBe(created.id);
      expect(found.status).toBe('SUCCESS');
    });

    it('应该对不存在的交易抛出错误', async () => {
      await expect(
        transactionService.getTransactionById('non-existent-id')
      ).rejects.toThrow('交易不存在');
    });
  });

  describe('cancelTransaction', () => {
    it('应该取消成功的交易并释放额度', async () => {
      const idempotentKey = `TEST-CANCEL-${Date.now()}`;
      const transaction = await transactionService.createTransaction({
        idempotentKey,
        customerId,
        type: 'BUY',
        currency: 'USD',
        foreignCurrencyAmount: 100
      });

      const cancelled = await transactionService.cancelTransaction(transaction.id);
      
      expect(cancelled.status).toBe('CANCELLED');
    });

    it('应该拒绝取消已取消的交易', async () => {
      const idempotentKey = `TEST-CANCEL-TWICE-${Date.now()}`;
      const transaction = await transactionService.createTransaction({
        idempotentKey,
        customerId,
        type: 'BUY',
        currency: 'USD',
        foreignCurrencyAmount: 100
      });

      await transactionService.cancelTransaction(transaction.id);
      
      await expect(
        transactionService.cancelTransaction(transaction.id)
      ).rejects.toThrow('无法取消');
    });
  });
});