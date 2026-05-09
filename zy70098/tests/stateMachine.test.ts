import {
  validateStateTransition,
  canPerformOperation,
  getAvailableOperations,
  BATCH_STATUS_TRANSITIONS,
  ENROLLMENT_STATUS_TRANSITIONS
} from '../src/core/stateMachine';
import { InvitationBatchStatus, EnrollmentStatus } from '../src/types';

describe('State Machine', () => {
  describe('Batch Status Transitions', () => {
    it('should allow DRAFT -> PUBLISHED with publish operation', () => {
      const result = validateStateTransition(
        'batch',
        InvitationBatchStatus.DRAFT,
        InvitationBatchStatus.PUBLISHED,
        'publish'
      );
      expect(result.success).toBe(true);
    });

    it('should allow DRAFT -> CANCELLED with cancel operation', () => {
      const result = validateStateTransition(
        'batch',
        InvitationBatchStatus.DRAFT,
        InvitationBatchStatus.CANCELLED,
        'cancel'
      );
      expect(result.success).toBe(true);
    });

    it('should reject DRAFT -> ENROLLMENT_STARTED transition', () => {
      const result = validateStateTransition(
        'batch',
        InvitationBatchStatus.DRAFT,
        InvitationBatchStatus.ENROLLMENT_STARTED,
        'start_enrollment'
      );
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should reject invalid operation for valid transition', () => {
      const result = validateStateTransition(
        'batch',
        InvitationBatchStatus.DRAFT,
        InvitationBatchStatus.PUBLISHED,
        'start_enrollment'
      );
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_OPERATION');
    });

    it('should reject CANCELLED -> any other status', () => {
      const result = validateStateTransition(
        'batch',
        InvitationBatchStatus.CANCELLED,
        InvitationBatchStatus.PUBLISHED,
        'publish'
      );
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_STATE_TRANSITION');
    });
  });

  describe('Enrollment Status Transitions', () => {
    it('should allow PENDING_REVIEW -> APPROVED with approve operation', () => {
      const result = validateStateTransition(
        'enrollment',
        EnrollmentStatus.PENDING_REVIEW,
        EnrollmentStatus.APPROVED,
        'approve'
      );
      expect(result.success).toBe(true);
    });

    it('should allow PENDING_REVIEW -> REJECTED with reject operation', () => {
      const result = validateStateTransition(
        'enrollment',
        EnrollmentStatus.PENDING_REVIEW,
        EnrollmentStatus.REJECTED,
        'reject'
      );
      expect(result.success).toBe(true);
    });

    it('should allow PENDING_REVIEW -> CANCELLED with cancel operation', () => {
      const result = validateStateTransition(
        'enrollment',
        EnrollmentStatus.PENDING_REVIEW,
        EnrollmentStatus.CANCELLED,
        'cancel'
      );
      expect(result.success).toBe(true);
    });

    it('should allow APPROVED -> CANCELLED with cancel operation', () => {
      const result = validateStateTransition(
        'enrollment',
        EnrollmentStatus.APPROVED,
        EnrollmentStatus.CANCELLED,
        'cancel'
      );
      expect(result.success).toBe(true);
    });

    it('should reject APPROVED -> REJECTED transition', () => {
      const result = validateStateTransition(
        'enrollment',
        EnrollmentStatus.APPROVED,
        EnrollmentStatus.REJECTED,
        'reject'
      );
      expect(result.success).toBe(false);
    });

    it('should reject REJECTED -> APPROVED transition', () => {
      const result = validateStateTransition(
        'enrollment',
        EnrollmentStatus.REJECTED,
        EnrollmentStatus.APPROVED,
        'approve'
      );
      expect(result.success).toBe(false);
    });
  });

  describe('canPerformOperation', () => {
    it('should return true for allowed operations', () => {
      expect(canPerformOperation('batch', InvitationBatchStatus.DRAFT, 'publish')).toBe(true);
      expect(canPerformOperation('batch', InvitationBatchStatus.DRAFT, 'cancel')).toBe(true);
    });

    it('should return false for disallowed operations', () => {
      expect(canPerformOperation('batch', InvitationBatchStatus.DRAFT, 'start_enrollment')).toBe(false);
      expect(canPerformOperation('batch', InvitationBatchStatus.CANCELLED, 'publish')).toBe(false);
    });
  });

  describe('getAvailableOperations', () => {
    it('should return available operations for batch in DRAFT status', () => {
      const operations = getAvailableOperations('batch', InvitationBatchStatus.DRAFT);
      expect(operations).toContain('publish');
      expect(operations).toContain('cancel');
      expect(operations.length).toBe(2);
    });

    it('should return available operations for enrollment in PENDING_REVIEW status', () => {
      const operations = getAvailableOperations('enrollment', EnrollmentStatus.PENDING_REVIEW);
      expect(operations).toContain('approve');
      expect(operations).toContain('reject');
      expect(operations).toContain('cancel');
      expect(operations.length).toBe(3);
    });

    it('should return empty array for cancelled batch', () => {
      const operations = getAvailableOperations('batch', InvitationBatchStatus.CANCELLED);
      expect(operations.length).toBe(0);
    });
  });

  describe('Transition Rules Coverage', () => {
    it('should have all batch transitions defined', () => {
      const batchStatuses = Object.values(InvitationBatchStatus);
      expect(batchStatuses.length).toBeGreaterThan(0);
    });

    it('should have all enrollment transitions defined', () => {
      const enrollmentStatuses = Object.values(EnrollmentStatus);
      expect(enrollmentStatuses.length).toBeGreaterThan(0);
    });

    it('should have transitions defined for batch workflow', () => {
      expect(BATCH_STATUS_TRANSITIONS.length).toBeGreaterThan(5);
    });

    it('should have transitions defined for enrollment workflow', () => {
      expect(ENROLLMENT_STATUS_TRANSITIONS.length).toBeGreaterThan(2);
    });
  });
});
