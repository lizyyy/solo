import { recycleService } from '../services/recycleService';
import { RecycleStatus } from '../types';

describe('RecycleService', () => {
  beforeEach(() => {
  });

  describe('create', () => {
    it('should create a new recycle record with pending status', () => {
      const request = {
        configKey: 'feature.toggle.v1',
        grayScope: { type: 'percentage' as const, value: 50 },
        owner: 'zhangsan',
        recycleDate: '2025-12-31T00:00:00.000Z'
      };

      const record = recycleService.create(request);

      expect(record).toBeDefined();
      expect(record.configKey).toBe('feature.toggle.v1');
      expect(record.status).toBe(RecycleStatus.PENDING);
      expect(record.owner).toBe('zhangsan');
      expect(record.exceptions).toEqual([]);
    });
  });

  describe('transitionStatus', () => {
    it('should transition from pending to in_progress', () => {
      const request = {
        configKey: 'feature.toggle.v2',
        grayScope: { type: 'percentage' as const, value: 30 },
        owner: 'lisi',
        recycleDate: '2025-12-31T00:00:00.000Z'
      };
      const record = recycleService.create(request);

      const updated = recycleService.transitionStatus(record.id, {
        status: RecycleStatus.IN_PROGRESS,
        operator: 'lisi'
      });

      expect(updated?.status).toBe(RecycleStatus.IN_PROGRESS);
    });

    it('should transition from in_progress to completed', () => {
      const request = {
        configKey: 'feature.toggle.v3',
        grayScope: { type: 'percentage' as const, value: 30 },
        owner: 'wangwu',
        recycleDate: '2025-12-31T00:00:00.000Z',
        hitTenants: ['tenant1', 'tenant2']
      };
      const record = recycleService.create(request);

      recycleService.transitionStatus(record.id, {
        status: RecycleStatus.IN_PROGRESS,
        operator: 'wangwu'
      });

      const updated = recycleService.transitionStatus(record.id, {
        status: RecycleStatus.COMPLETED,
        operator: 'wangwu'
      });

      expect(updated?.status).toBe(RecycleStatus.COMPLETED);
      expect(updated?.report).toBeDefined();
      expect(updated?.report?.recycledCount).toBe(2);
    });

    it('should throw error for invalid transition', () => {
      const request = {
        configKey: 'feature.toggle.v4',
        grayScope: { type: 'percentage' as const, value: 30 },
        owner: 'zhaoliu',
        recycleDate: '2025-12-31T00:00:00.000Z'
      };
      const record = recycleService.create(request);

      expect(() => {
        recycleService.transitionStatus(record.id, {
          status: RecycleStatus.COMPLETED,
          operator: 'zhaoliu'
        });
      }).toThrow('Invalid status transition');
    });

    it('should not allow duplicate status transition', () => {
      const request = {
        configKey: 'feature.toggle.v5',
        grayScope: { type: 'percentage' as const, value: 30 },
        owner: 'sunqi',
        recycleDate: '2025-12-31T00:00:00.000Z'
      };
      const record = recycleService.create(request);

      recycleService.transitionStatus(record.id, {
        status: RecycleStatus.IN_PROGRESS,
        operator: 'sunqi'
      });

      recycleService.transitionStatus(record.id, {
        status: RecycleStatus.COMPLETED,
        operator: 'sunqi'
      });

      expect(() => {
        recycleService.transitionStatus(record.id, {
          status: RecycleStatus.COMPLETED,
          operator: 'sunqi'
        });
      }).toThrow('Invalid status transition');
    });
  });

  describe('exceptions', () => {
    it('should add exception and change status to error', () => {
      const request = {
        configKey: 'feature.toggle.v6',
        grayScope: { type: 'percentage' as const, value: 30 },
        owner: 'zhouba',
        recycleDate: '2025-12-31T00:00:00.000Z'
      };
      const record = recycleService.create(request);

      const originalInput = { some: 'data' };
      const exception = recycleService.addException(record.id, originalInput, 'Something went wrong');

      expect(exception).toBeDefined();
      expect(exception?.originalInput).toEqual(originalInput);
      expect(exception?.errorMessage).toBe('Something went wrong');

      const updated = recycleService.findById(record.id);
      expect(updated?.status).toBe(RecycleStatus.ERROR);
      expect(updated?.exceptions.length).toBe(1);
    });

    it('should handle exception and revert to pending', () => {
      const request = {
        configKey: 'feature.toggle.v7',
        grayScope: { type: 'percentage' as const, value: 30 },
        owner: 'wujiu',
        recycleDate: '2025-12-31T00:00:00.000Z'
      };
      const record = recycleService.create(request);

      const exception = recycleService.addException(record.id, {}, 'Test error');

      const updated = recycleService.handleException(record.id, exception!.id, {
        handler: 'admin',
        resolution: 'Fixed the issue'
      });

      expect(updated?.status).toBe(RecycleStatus.PENDING);
      expect(updated?.exceptions[0].handler).toBe('admin');
      expect(updated?.exceptions[0].resolution).toBe('Fixed the issue');
    });
  });

  describe('manualCorrection', () => {
    it('should update record and log exception', () => {
      const request = {
        configKey: 'feature.toggle.v8',
        grayScope: { type: 'percentage' as const, value: 30 },
        owner: 'zhengshi',
        recycleDate: '2025-12-31T00:00:00.000Z'
      };
      const record = recycleService.create(request);

      const updated = recycleService.manualCorrection(record.id, {
        configKey: 'feature.toggle.v8-updated',
        owner: 'newowner',
        operator: 'admin',
        reason: 'Corrected configuration key'
      });

      expect(updated?.configKey).toBe('feature.toggle.v8-updated');
      expect(updated?.owner).toBe('newowner');
      expect(updated?.exceptions.length).toBe(1);
      expect(updated?.exceptions[0].resolution).toBe('Corrected configuration key');
    });
  });

  describe('query', () => {
    it('should filter by status', () => {
      for (let i = 0; i < 3; i++) {
        recycleService.create({
          configKey: `feature.query.${i}`,
          grayScope: { type: 'percentage' as const, value: 10 },
          owner: 'tester',
          recycleDate: '2025-12-31T00:00:00.000Z'
        });
      }

      const result = recycleService.query({ status: RecycleStatus.PENDING });

      expect(result.data.length).toBeGreaterThanOrEqual(3);
    });
  });
});
