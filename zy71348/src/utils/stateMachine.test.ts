import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  canTransition,
  validateTransition,
  getMissingFields,
  canSubmitToPending,
  getInitialStatus,
  isModifiable,
  canExport,
  getAvailableTransitions,
} from './stateMachine';
import type { RecordFormData, RecordStatus } from '@/types';

describe('stateMachine', () => {
  describe('canTransition', () => {
    it('should allow draft -> pending', () => {
      expect(canTransition('draft', 'pending')).toBe(true);
    });

    it('should allow pending -> verified', () => {
      expect(canTransition('pending', 'verified')).toBe(true);
    });

    it('should allow pending -> archived', () => {
      expect(canTransition('pending', 'archived')).toBe(true);
    });

    it('should allow verified -> listed', () => {
      expect(canTransition('verified', 'listed')).toBe(true);
    });

    it('should allow verified -> archived', () => {
      expect(canTransition('verified', 'archived')).toBe(true);
    });

    it('should not allow verified -> draft (reverse)', () => {
      expect(canTransition('verified', 'draft')).toBe(false);
    });

    it('should not allow pending -> draft (reverse)', () => {
      expect(canTransition('pending', 'draft')).toBe(false);
    });

    it('should not allow listed -> anything', () => {
      expect(canTransition('listed', 'archived')).toBe(false);
      expect(canTransition('listed', 'verified')).toBe(false);
    });

    it('should not allow archived -> anything', () => {
      expect(canTransition('archived', 'draft')).toBe(false);
      expect(canTransition('archived', 'pending')).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('should return valid for same status', () => {
      const result = validateTransition('draft', 'draft');
      expect(result.valid).toBe(true);
    });

    it('should return valid for allowed transition', () => {
      const result = validateTransition('draft', 'pending');
      expect(result.valid).toBe(true);
    });

    it('should return invalid with message for disallowed transition', () => {
      const result = validateTransition('verified', 'draft');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('不允许');
    });
  });

  describe('getMissingFields', () => {
    const completeData: RecordFormData = {
      catalogNumber: 'RLP001',
      albumName: 'Test Album',
      artist: 'Test Artist',
      pressYear: '2020',
      condition: 'NM',
      consignor: '张三',
      price: 200,
      shelfLocation: 'A-01',
      verificationReport: '核对通过',
    };

    it('should return empty array for complete data', () => {
      expect(getMissingFields(completeData)).toEqual([]);
    });

    it('should detect missing catalogNumber', () => {
      const data = { ...completeData, catalogNumber: '' };
      expect(getMissingFields(data)).toContain('catalogNumber');
    });

    it('should detect missing albumName', () => {
      const data = { ...completeData, albumName: '' };
      expect(getMissingFields(data)).toContain('albumName');
    });

    it('should detect missing artist', () => {
      const data = { ...completeData, artist: '' };
      expect(getMissingFields(data)).toContain('artist');
    });

    it('should detect missing pressYear', () => {
      const data = { ...completeData, pressYear: '' };
      expect(getMissingFields(data)).toContain('pressYear');
    });

    it('should detect missing condition', () => {
      const data = { ...completeData, condition: undefined as any };
      expect(getMissingFields(data)).toContain('condition');
    });

    it('should detect missing consignor', () => {
      const data = { ...completeData, consignor: '' };
      expect(getMissingFields(data)).toContain('consignor');
    });

    it('should detect missing price', () => {
      const data = { ...completeData, price: undefined as any };
      expect(getMissingFields(data)).toContain('price');
    });

    it('should detect price as NaN', () => {
      const data = { ...completeData, price: NaN };
      expect(getMissingFields(data)).toContain('price');
    });

    it('should detect missing shelfLocation', () => {
      const data = { ...completeData, shelfLocation: '' };
      expect(getMissingFields(data)).toContain('shelfLocation');
    });

    it('should detect missing verificationReport', () => {
      const data = { ...completeData, verificationReport: '' };
      expect(getMissingFields(data)).toContain('verificationReport');
    });

    it('should detect whitespace-only strings', () => {
      const data = { ...completeData, catalogNumber: '   ' };
      expect(getMissingFields(data)).toContain('catalogNumber');
    });
  });

  describe('canSubmitToPending', () => {
    const completeData: RecordFormData = {
      catalogNumber: 'RLP001',
      albumName: 'Test Album',
      artist: 'Test Artist',
      pressYear: '2020',
      condition: 'NM',
      consignor: '张三',
      price: 200,
      shelfLocation: 'A-01',
      verificationReport: '核对通过',
    };

    it('should return valid for complete data', () => {
      const result = canSubmitToPending(completeData);
      expect(result.valid).toBe(true);
      expect(result.missingFields).toEqual([]);
    });

    it('should return invalid for incomplete data', () => {
      const data = { ...completeData, price: undefined as any };
      const result = canSubmitToPending(data);
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('price');
    });
  });

  describe('getInitialStatus', () => {
    const completeData: RecordFormData = {
      catalogNumber: 'RLP001',
      albumName: 'Test Album',
      artist: 'Test Artist',
      pressYear: '2020',
      condition: 'NM',
      consignor: '张三',
      price: 200,
      shelfLocation: 'A-01',
      verificationReport: '核对通过',
    };

    it('should return pending for complete data', () => {
      expect(getInitialStatus(completeData)).toBe('pending');
    });

    it('should return draft for incomplete data', () => {
      const data = { ...completeData, price: undefined as any };
      expect(getInitialStatus(data)).toBe('draft');
    });
  });

  describe('isModifiable', () => {
    it('should allow modification for draft', () => {
      expect(isModifiable('draft')).toBe(true);
    });

    it('should allow modification for pending', () => {
      expect(isModifiable('pending')).toBe(true);
    });

    it('should allow modification for verified', () => {
      expect(isModifiable('verified')).toBe(true);
    });

    it('should not allow modification for listed', () => {
      expect(isModifiable('listed')).toBe(false);
    });

    it('should not allow modification for archived', () => {
      expect(isModifiable('archived')).toBe(false);
    });
  });

  describe('canExport', () => {
    it('should allow export only for verified status', () => {
      expect(canExport('verified')).toBe(true);
      expect(canExport('draft')).toBe(false);
      expect(canExport('pending')).toBe(false);
      expect(canExport('listed')).toBe(false);
      expect(canExport('archived')).toBe(false);
    });
  });

  describe('getAvailableTransitions', () => {
    it('should return pending from draft', () => {
      expect(getAvailableTransitions('draft')).toEqual(['pending']);
    });

    it('should return verified and archived from pending', () => {
      expect(getAvailableTransitions('pending')).toEqual(['verified', 'archived']);
    });

    it('should return listed and archived from verified', () => {
      expect(getAvailableTransitions('verified')).toEqual(['listed', 'archived']);
    });

    it('should return empty array for listed and archived', () => {
      expect(getAvailableTransitions('listed')).toEqual([]);
      expect(getAvailableTransitions('archived')).toEqual([]);
    });
  });
});
