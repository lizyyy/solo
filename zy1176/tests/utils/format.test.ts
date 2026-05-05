import { describe, it, expect } from 'vitest';
import { formatFileSize, formatDate, formatRelativeDate, truncatePath } from '../../src/utils/format';

describe('formatFileSize', () => {
  it('should return "0 B" for 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('should format bytes correctly', () => {
    expect(formatFileSize(512)).toBe('512.00 B');
  });

  it('should format kilobytes correctly', () => {
    expect(formatFileSize(1024)).toBe('1.00 KB');
    expect(formatFileSize(1536)).toBe('1.50 KB');
  });

  it('should format megabytes correctly', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.00 MB');
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.50 MB');
  });

  it('should format gigabytes correctly', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.00 GB');
  });
});

describe('formatDate', () => {
  it('should format date correctly', () => {
    const date = new Date('2024-01-15T14:30:00Z').toISOString();
    const result = formatDate(date);
    expect(result).toMatch(/\d{4}\/\d{2}\/\d{2}/);
  });
});

describe('formatRelativeDate', () => {
  it('should return "刚刚" for recent times', () => {
    const now = new Date();
    const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000).toISOString();
    expect(formatRelativeDate(thirtySecondsAgo)).toBe('刚刚');
  });

  it('should return minutes for recent minutes', () => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeDate(fiveMinutesAgo)).toBe('5 分钟前');
  });

  it('should return hours for recent hours', () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(twoHoursAgo)).toBe('2 小时前');
  });

  it('should return days for recent days', () => {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(threeDaysAgo)).toBe('3 天前');
  });
});

describe('truncatePath', () => {
  it('should return original path if shorter than maxLength', () => {
    const path = '/short/path';
    expect(truncatePath(path, 50)).toBe(path);
  });

  it('should truncate long paths with ellipsis', () => {
    const path = '/Users/username/projects/project-name/src/components/TestComponent.tsx';
    const result = truncatePath(path, 30);
    expect(result).toContain('...');
    expect(result.length).toBeLessThanOrEqual(30 + 3);
  });

  it('should handle Windows-style paths', () => {
    const path = 'C:\\Users\\username\\Documents\\file.txt';
    const result = truncatePath(path, 20);
    expect(result).toContain('...');
  });
});
