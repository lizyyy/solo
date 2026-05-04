import { generateIdempotencyKey, generateUUID, generateTransactionId } from '../../utils/idempotency';

describe('Idempotency', () => {
  describe('generateIdempotencyKey', () => {
    const createValidUUID = (): `${string}-${string}-${string}-${string}-${string}` => {
      return '12345678-1234-5678-1234-567812345678' as const;
    };

    it('should generate consistent keys for same inputs', () => {
      const employeeId = createValidUUID();
      const year = 2024;
      const month = 5;
      const batchId = 'batch-abc';

      const key1 = generateIdempotencyKey(employeeId, year, month, batchId);
      const key2 = generateIdempotencyKey(employeeId, year, month, batchId);

      expect(key1).toEqual(key2);
      expect(typeof key1).toBe('string');
      expect(key1.length).toBeGreaterThan(0);
    });

    it('should generate different keys for different employees', () => {
      const year = 2024;
      const month = 5;
      const batchId = 'batch-abc';
      const emp1 = createValidUUID();
      const emp2 = '87654321-4321-8765-4321-876543214321' as const;

      const key1 = generateIdempotencyKey(emp1, year, month, batchId);
      const key2 = generateIdempotencyKey(emp2, year, month, batchId);

      expect(key1).not.toEqual(key2);
    });

    it('should generate different keys for different months', () => {
      const employeeId = createValidUUID();
      const year = 2024;
      const batchId = 'batch-abc';

      const key1 = generateIdempotencyKey(employeeId, year, 1, batchId);
      const key2 = generateIdempotencyKey(employeeId, year, 2, batchId);

      expect(key1).not.toEqual(key2);
    });

    it('should generate different keys for different years', () => {
      const employeeId = createValidUUID();
      const month = 5;
      const batchId = 'batch-abc';

      const key1 = generateIdempotencyKey(employeeId, 2023, month, batchId);
      const key2 = generateIdempotencyKey(employeeId, 2024, month, batchId);

      expect(key1).not.toEqual(key2);
    });

    it('should generate different keys for different batches', () => {
      const employeeId = createValidUUID();
      const year = 2024;
      const month = 5;

      const key1 = generateIdempotencyKey(employeeId, year, month, 'batch-001');
      const key2 = generateIdempotencyKey(employeeId, year, month, 'batch-002');

      expect(key1).not.toEqual(key2);
    });

    it('should generate different keys when batchId is undefined', () => {
      const employeeId = createValidUUID();
      const year = 2024;
      const month = 5;

      const keyWithBatch = generateIdempotencyKey(employeeId, year, month, 'batch-001');
      const keyWithoutBatch = generateIdempotencyKey(employeeId, year, month);

      expect(keyWithBatch).not.toEqual(keyWithoutBatch);
    });

    it('should generate keys in SHA256 format', () => {
      const employeeId = createValidUUID();
      const key = generateIdempotencyKey(employeeId, 2024, 5, 'batch-abc');

      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('generateUUID', () => {
    it('should generate valid UUIDs', () => {
      const uuid = generateUUID();
      
      expect(typeof uuid).toBe('string');
      expect(uuid.length).toBe(36);
      expect(uuid.split('-').length).toBe(5);
    });

    it('should generate unique UUIDs', () => {
      const uuids = new Set<string>();
      
      for (let i = 0; i < 100; i++) {
        uuids.add(generateUUID());
      }
      
      expect(uuids.size).toBe(100);
    });
  });

  describe('generateTransactionId', () => {
    it('should generate transaction IDs', () => {
      const txId = generateTransactionId();
      
      expect(typeof txId).toBe('string');
      expect(txId.startsWith('TXN-')).toBe(true);
    });

    it('should generate unique transaction IDs', () => {
      const ids = new Set<string>();
      
      for (let i = 0; i < 100; i++) {
        ids.add(generateTransactionId());
      }
      
      expect(ids.size).toBe(100);
    });
  });

  describe('idempotency guarantees', () => {
    const createValidUUID = (): `${string}-${string}-${string}-${string}-${string}` => {
      return '12345678-1234-5678-1234-567812345678' as const;
    };

    it('should guarantee same key for same pay period and employee', () => {
      const employeeId = createValidUUID();
      const year = 2024;
      const month = 5;
      const batchId = 'batch-may-2024';

      const keys: string[] = [];
      for (let i = 0; i < 10; i++) {
        keys.push(generateIdempotencyKey(employeeId, year, month, batchId));
      }

      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(1);
    });

    it('should prevent duplicate payments across retries', () => {
      const employeeId = createValidUUID();
      const year = 2024;
      const month = 5;
      const batchId = 'batch-abc';

      const firstAttemptKey = generateIdempotencyKey(employeeId, year, month, batchId);
      const secondAttemptKey = generateIdempotencyKey(employeeId, year, month, batchId);

      expect(firstAttemptKey).toEqual(secondAttemptKey);
    });

    it('should allow different payments for different months', () => {
      const employeeId = createValidUUID();
      const year = 2024;
      const batchId = 'batch-abc';

      const mayKey = generateIdempotencyKey(employeeId, year, 5, batchId);
      const juneKey = generateIdempotencyKey(employeeId, year, 6, batchId);

      expect(mayKey).not.toEqual(juneKey);
    });
  });

  describe('performance', () => {
    const createValidUUID = (): `${string}-${string}-${string}-${string}-${string}` => {
      return '12345678-1234-5678-1234-567812345678' as const;
    };

    it('should generate keys quickly', () => {
      const startTime = Date.now();
      const iterations = 10000;
      const baseId = createValidUUID();

      for (let i = 0; i < iterations; i++) {
        generateIdempotencyKey(baseId, 2024, 5, 'batch-abc');
      }

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(200);
    });

    it('should generate UUIDs quickly', () => {
      const startTime = Date.now();
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        generateUUID();
      }

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(100);
    });
  });
});
