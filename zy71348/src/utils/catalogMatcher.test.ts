import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  normalizeCatalogNumber,
  normalizeAlbumName,
  isDuplicateCatalogNumber,
  findAlbumMatches,
  generateVersionTagForGroup,
} from './catalogMatcher';
import type { InventoryRecord } from '@/types';

describe('catalogMatcher', () => {
  describe('normalizeCatalogNumber', () => {
    it('should remove spaces and convert to uppercase', () => {
      expect(normalizeCatalogNumber('rlp 001')).toBe('RLP001');
      expect(normalizeCatalogNumber('  RLP-001  ')).toBe('RLP001');
    });

    it('should remove special characters', () => {
      expect(normalizeCatalogNumber('RLP.001')).toBe('RLP001');
      expect(normalizeCatalogNumber('RLP/001')).toBe('RLP001');
      expect(normalizeCatalogNumber('RLP_001')).toBe('RLP001');
      expect(normalizeCatalogNumber('RLP-001/CD')).toBe('RLP001CD');
    });

    it('should handle empty string', () => {
      expect(normalizeCatalogNumber('')).toBe('');
    });
  });

  describe('normalizeAlbumName', () => {
    it('should convert to lowercase and trim whitespace', () => {
      expect(normalizeAlbumName('  The Dark Side  ')).toBe('the dark side');
    });

    it('should preserve Chinese characters', () => {
      expect(normalizeAlbumName(' 月 亮 代 表 我 的 心 ')).toBe('月 亮 代 表 我 的 心');
    });

    it('should remove special characters except letters, numbers, Chinese, and spaces', () => {
      expect(normalizeAlbumName('The Wall!')).toBe('the wall');
      expect(normalizeAlbumName('Album (Deluxe)')).toBe('album deluxe');
    });
  });

  describe('isDuplicateCatalogNumber', () => {
    const records: InventoryRecord[] = [
      { id: '1', catalogNumber: 'RLP001' } as InventoryRecord,
      { id: '2', catalogNumber: 'RLP002' } as InventoryRecord,
    ];

    it('should detect exact duplicate', () => {
      expect(isDuplicateCatalogNumber('RLP001', records)).toBe(true);
    });

    it('should detect duplicate after normalization', () => {
      expect(isDuplicateCatalogNumber('rlp 001', records)).toBe(true);
      expect(isDuplicateCatalogNumber('RLP-001', records)).toBe(true);
    });

    it('should not detect different catalog numbers', () => {
      expect(isDuplicateCatalogNumber('RLP003', records)).toBe(false);
    });

    it('should exclude specified id', () => {
      expect(isDuplicateCatalogNumber('RLP001', records, '1')).toBe(false);
    });
  });

  describe('findAlbumMatches', () => {
    const records: InventoryRecord[] = [
      {
        id: '1',
        catalogNumber: 'RLP001',
        albumName: 'The Dark Side of the Moon',
        artist: 'Pink Floyd',
      } as InventoryRecord,
      {
        id: '2',
        catalogNumber: 'RLP002',
        albumName: 'The Dark Side of the Moon',
        artist: 'Pink Floyd',
      } as InventoryRecord,
      {
        id: '3',
        catalogNumber: 'RLP003',
        albumName: 'The Wall',
        artist: 'Pink Floyd',
      } as InventoryRecord,
    ];

    it('should find same album with different catalog numbers', () => {
      const matches = findAlbumMatches(
        'The Dark Side of the Moon',
        'RLP004',
        records
      );
      expect(matches).toHaveLength(2);
      expect(matches.map((m) => m.id)).toEqual(['1', '2']);
    });

    it('should not match same catalog number', () => {
      const matches = findAlbumMatches(
        'The Dark Side of the Moon',
        'RLP001',
        records
      );
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('2');
    });

    it('should exclude specified id', () => {
      const matches = findAlbumMatches(
        'The Dark Side of the Moon',
        'RLP004',
        records,
        '1'
      );
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('2');
    });

    it('should return empty for different album', () => {
      const matches = findAlbumMatches('Animals', 'RLP004', records);
      expect(matches).toHaveLength(0);
    });
  });

  describe('generateVersionTagForGroup', () => {
    it('should return plain catalog number for first version', () => {
      expect(generateVersionTagForGroup('RLP001', 0)).toBe('RLP001');
    });

    it('should append version number for subsequent versions', () => {
      expect(generateVersionTagForGroup('RLP001', 1)).toBe('RLP001 v2');
      expect(generateVersionTagForGroup('RLP001', 2)).toBe('RLP001 v3');
    });

    it('should normalize catalog number', () => {
      expect(generateVersionTagForGroup('rlp 001', 1)).toBe('RLP001 v2');
    });
  });
});
