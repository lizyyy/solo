import { BatchProcessor, PaymentGateway, PaymentResult } from '../BatchProcessor';

class TestPaymentGateway implements PaymentGateway {
  private shouldFail: boolean;
  private failCount: number;
  private callCount: number;

  constructor(shouldFail: boolean = false, failCount: number = 0) {
    this.shouldFail = shouldFail;
    this.failCount = failCount;
    this.callCount = 0;
  }

  async processPayment(
    _amount: number,
    _bankAccountNumber: string,
    _bankAccountName: string,
    _bankName: string,
    _idempotencyKey: string
  ): Promise<PaymentResult> {
    this.callCount++;

    if (this.shouldFail && this.callCount <= this.failCount) {
      return {
        success: false,
        errorMessage: 'Test failure',
        errorCode: 'TEST_FAILURE'
      };
    }

    return {
      success: true,
      transactionId: `TXN-TEST-${Date.now()}-${this.callCount}`
    };
  }

  getCallCount(): number {
    return this.callCount;
  }
}

describe('BatchProcessor', () => {
  let processor: BatchProcessor;

  beforeEach(() => {
    processor = new BatchProcessor(new TestPaymentGateway());
  });

  describe('constructor', () => {
    it('should create a processor instance', () => {
      expect(processor).toBeDefined();
    });

    it('should extend EventEmitter', () => {
      expect(typeof processor.on).toBe('function');
      expect(typeof processor.emit).toBe('function');
    });
  });

  describe('isBatchActive', () => {
    it('should return false for non-existent batch', () => {
      const fakeId = '00000000-0000-0000-0000-000000000000' as any;
      expect(processor.isBatchActive(fakeId)).toBe(false);
    });
  });

  describe('getActiveBatches', () => {
    it('should return empty array when no active batches', () => {
      const active = processor.getActiveBatches();
      expect(Array.isArray(active)).toBe(true);
      expect(active.length).toBe(0);
    });
  });

  describe('Event Emitter', () => {
    it('should emit events', async () => {
      const eventSpy = jest.fn();
      processor.on('testEvent', eventSpy);

      processor.emit('testEvent', { data: 'test' });

      expect(eventSpy).toHaveBeenCalledWith({ data: 'test' });
    });
  });

  describe('TestPaymentGateway', () => {
    let gateway: TestPaymentGateway;

    beforeEach(() => {
      gateway = new TestPaymentGateway();
    });

    it('should process payment successfully', async () => {
      const result = await gateway.processPayment(
        1000,
        '123456789',
        'Test User',
        'Test Bank',
        'idempotency-key-123'
      );

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
    });

    it('should return failure when configured to fail', async () => {
      const failingGateway = new TestPaymentGateway(true, 1);
      
      const result1 = await failingGateway.processPayment(
        1000,
        '123456789',
        'Test User',
        'Test Bank',
        'idempotency-key-123'
      );

      expect(result1.success).toBe(false);
      expect(result1.errorMessage).toBe('Test failure');
      expect(result1.errorCode).toBe('TEST_FAILURE');

      const result2 = await failingGateway.processPayment(
        1000,
        '123456789',
        'Test User',
        'Test Bank',
        'idempotency-key-456'
      );

      expect(result2.success).toBe(true);
    });

    it('should count calls', async () => {
      expect(gateway.getCallCount()).toBe(0);

      await gateway.processPayment(
        1000,
        '123456789',
        'Test User',
        'Test Bank',
        'idempotency-key-123'
      );

      expect(gateway.getCallCount()).toBe(1);

      await gateway.processPayment(
        2000,
        '987654321',
        'Another User',
        'Another Bank',
        'idempotency-key-456'
      );

      expect(gateway.getCallCount()).toBe(2);
    });
  });
});
