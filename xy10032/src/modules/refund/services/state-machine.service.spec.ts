import { Test, TestingModule } from '@nestjs/testing';
import { StateMachineService } from './state-machine.service';
import { RefundStatus } from '../../../common/enums/refund-status.enum';

describe('StateMachineService', () => {
  let service: StateMachineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StateMachineService],
    }).compile();

    service = module.get<StateMachineService>(StateMachineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('canTransition', () => {
    it('should allow DRAFT -> PENDING transition', () => {
      expect(service.canTransition(RefundStatus.DRAFT, RefundStatus.PENDING)).toBe(true);
    });

    it('should allow DRAFT -> CANCELLED transition', () => {
      expect(service.canTransition(RefundStatus.DRAFT, RefundStatus.CANCELLED)).toBe(true);
    });

    it('should not allow DRAFT -> SUCCESS transition', () => {
      expect(service.canTransition(RefundStatus.DRAFT, RefundStatus.SUCCESS)).toBe(false);
    });

    it('should allow PENDING -> PROCESSING transition', () => {
      expect(service.canTransition(RefundStatus.PENDING, RefundStatus.PROCESSING)).toBe(true);
    });

    it('should allow PENDING -> REJECTED transition', () => {
      expect(service.canTransition(RefundStatus.PENDING, RefundStatus.REJECTED)).toBe(true);
    });

    it('should allow PENDING -> CANCELLED transition', () => {
      expect(service.canTransition(RefundStatus.PENDING, RefundStatus.CANCELLED)).toBe(true);
    });

    it('should allow PROCESSING -> SUCCESS transition', () => {
      expect(service.canTransition(RefundStatus.PROCESSING, RefundStatus.SUCCESS)).toBe(true);
    });

    it('should allow PROCESSING -> FAILED transition', () => {
      expect(service.canTransition(RefundStatus.PROCESSING, RefundStatus.FAILED)).toBe(true);
    });

    it('should allow FAILED -> RETRYING transition', () => {
      expect(service.canTransition(RefundStatus.FAILED, RefundStatus.RETRYING)).toBe(true);
    });

    it('should allow FAILED -> CANCELLED transition', () => {
      expect(service.canTransition(RefundStatus.FAILED, RefundStatus.CANCELLED)).toBe(true);
    });

    it('should not allow SUCCESS -> any transition', () => {
      expect(service.canTransition(RefundStatus.SUCCESS, RefundStatus.FAILED)).toBe(false);
      expect(service.canTransition(RefundStatus.SUCCESS, RefundStatus.CANCELLED)).toBe(false);
    });

    it('should not allow CANCELLED -> any transition', () => {
      expect(service.canTransition(RefundStatus.CANCELLED, RefundStatus.PENDING)).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('should not throw for valid transition', () => {
      expect(() => {
        service.validateTransition(RefundStatus.DRAFT, RefundStatus.PENDING);
      }).not.toThrow();
    });

    it('should throw for invalid transition', () => {
      expect(() => {
        service.validateTransition(RefundStatus.DRAFT, RefundStatus.SUCCESS);
      }).toThrow();
    });
  });

  describe('getAllowedTransitions', () => {
    it('should return allowed transitions for DRAFT', () => {
      const transitions = service.getAllowedTransitions(RefundStatus.DRAFT);
      expect(transitions).toContain(RefundStatus.PENDING);
      expect(transitions).toContain(RefundStatus.CANCELLED);
      expect(transitions.length).toBe(2);
    });

    it('should return empty array for terminal status', () => {
      expect(service.getAllowedTransitions(RefundStatus.SUCCESS)).toEqual([]);
      expect(service.getAllowedTransitions(RefundStatus.CANCELLED)).toEqual([]);
    });
  });

  describe('isTerminalStatus', () => {
    it('should return true for terminal statuses', () => {
      expect(service.isTerminalStatus(RefundStatus.SUCCESS)).toBe(true);
      expect(service.isTerminalStatus(RefundStatus.CANCELLED)).toBe(true);
      expect(service.isTerminalStatus(RefundStatus.REJECTED)).toBe(true);
    });

    it('should return false for non-terminal statuses', () => {
      expect(service.isTerminalStatus(RefundStatus.DRAFT)).toBe(false);
      expect(service.isTerminalStatus(RefundStatus.PENDING)).toBe(false);
      expect(service.isTerminalStatus(RefundStatus.PROCESSING)).toBe(false);
      expect(service.isTerminalStatus(RefundStatus.FAILED)).toBe(false);
      expect(service.isTerminalStatus(RefundStatus.RETRYING)).toBe(false);
    });
  });

  describe('getStatusDescription', () => {
    it('should return Chinese description', () => {
      expect(service.getStatusDescription(RefundStatus.DRAFT)).toBe('草稿');
      expect(service.getStatusDescription(RefundStatus.SUCCESS)).toBe('退款成功');
    });
  });
});
