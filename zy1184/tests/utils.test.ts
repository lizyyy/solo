import { 
  generateId, 
  generateShortId, 
  hashString, 
  generateDeterministicId 
} from '../src/utils/id-generator';

import { 
  readFile, 
  writeFile, 
  readJsonFile, 
  writeJsonFile, 
  ensureDir, 
  fileExists,
  listFiles
} from '../src/utils/file-utils';

import { 
  parseDate, 
  durationToMs 
} from '../src/utils/date-utils';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('id-generator', () => {
  describe('generateId', () => {
    it('should generate a valid UUID', () => {
      const id = generateId();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(id)).toBe(true);
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('generateShortId', () => {
    it('should generate a short hex string', () => {
      const id = generateShortId();
      expect(id.length).toBe(16);
      const hexRegex = /^[0-9a-f]{16}$/i;
      expect(hexRegex.test(id)).toBe(true);
    });

    it('should generate unique short IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateShortId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('hashString', () => {
    it('should generate a SHA256 hash', () => {
      const hash = hashString('test');
      expect(hash.length).toBe(64);
      const hexRegex = /^[0-9a-f]{64}$/i;
      expect(hexRegex.test(hash)).toBe(true);
    });

    it('should generate same hash for same input', () => {
      const hash1 = hashString('same input');
      const hash2 = hashString('same input');
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different input', () => {
      const hash1 = hashString('input1');
      const hash2 = hashString('input2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateDeterministicId', () => {
    it('should generate a 16-character deterministic ID', () => {
      const id = generateDeterministicId('part1', 'part2', 123);
      expect(id.length).toBe(16);
      const hexRegex = /^[0-9a-f]{16}$/i;
      expect(hexRegex.test(id)).toBe(true);
    });

    it('should generate same ID for same parts', () => {
      const id1 = generateDeterministicId('a', 'b', 1);
      const id2 = generateDeterministicId('a', 'b', 1);
      expect(id1).toBe(id2);
    });

    it('should generate different ID for different parts', () => {
      const id1 = generateDeterministicId('a', 'b');
      const id2 = generateDeterministicId('a', 'c');
      expect(id1).not.toBe(id2);
    });
  });
});

describe('file-utils', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-file-utils-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('ensureDir', () => {
    it('should create directory if it does not exist', () => {
      const testDir = path.join(tempDir, 'test-dir');
      expect(fs.existsSync(testDir)).toBe(false);
      ensureDir(testDir);
      expect(fs.existsSync(testDir)).toBe(true);
      expect(fs.statSync(testDir).isDirectory()).toBe(true);
    });

    it('should not throw error if directory already exists', () => {
      const testDir = path.join(tempDir, 'existing-dir');
      fs.mkdirSync(testDir);
      expect(() => ensureDir(testDir)).not.toThrow();
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', () => {
      const testFile = path.join(tempDir, 'test.txt');
      fs.writeFileSync(testFile, 'content');
      expect(fileExists(testFile)).toBe(true);
    });

    it('should return false for non-existing file', () => {
      const testFile = path.join(tempDir, 'nonexistent.txt');
      expect(fileExists(testFile)).toBe(false);
    });
  });

  describe('writeFile and readFile', () => {
    it('should write and read file correctly', () => {
      const testFile = path.join(tempDir, 'test.txt');
      const content = 'Hello, World!';
      
      writeFile(testFile, content);
      const readContent = readFile(testFile);
      
      expect(readContent).toBe(content);
    });

    it('should create parent directories if needed', () => {
      const testFile = path.join(tempDir, 'subdir', 'nested', 'test.txt');
      const content = 'nested content';
      
      writeFile(testFile, content);
      const readContent = readFile(testFile);
      
      expect(readContent).toBe(content);
      expect(fs.existsSync(testFile)).toBe(true);
    });
  });

  describe('writeJsonFile and readJsonFile', () => {
    it('should write and read JSON correctly', () => {
      const testFile = path.join(tempDir, 'test.json');
      const data = {
        name: 'Test',
        value: 123,
        nested: { key: 'value' }
      };
      
      writeJsonFile(testFile, data);
      const readData = readJsonFile(testFile);
      
      expect(readData).toEqual(data);
    });

    it('should pretty print JSON', () => {
      const testFile = path.join(tempDir, 'test.json');
      const data = { key: 'value' };
      
      writeJsonFile(testFile, data);
      const content = readFile(testFile);
      
      expect(content).toContain('\n');
      expect(content).toContain('  ');
    });
  });

  describe('listFiles', () => {
    it('should list files in directory', () => {
      const testDir = path.join(tempDir, 'list-test');
      fs.mkdirSync(testDir);
      fs.writeFileSync(path.join(testDir, 'file1.txt'), '');
      fs.writeFileSync(path.join(testDir, 'file2.txt'), '');
      fs.writeFileSync(path.join(testDir, 'data.json'), '');
      
      const files = listFiles(testDir);
      expect(files.length).toBe(3);
      expect(files).toContain('file1.txt');
      expect(files).toContain('file2.txt');
      expect(files).toContain('data.json');
    });

    it('should filter files by pattern', () => {
      const testDir = path.join(tempDir, 'list-test');
      fs.mkdirSync(testDir);
      fs.writeFileSync(path.join(testDir, 'file1.txt'), '');
      fs.writeFileSync(path.join(testDir, 'file2.txt'), '');
      fs.writeFileSync(path.join(testDir, 'data.json'), '');
      
      const txtFiles = listFiles(testDir, '\\.txt$');
      expect(txtFiles.length).toBe(2);
      expect(txtFiles).toContain('file1.txt');
      expect(txtFiles).toContain('file2.txt');
    });

    it('should return empty array for non-existent directory', () => {
      const files = listFiles(path.join(tempDir, 'nonexistent'));
      expect(files).toEqual([]);
    });
  });
});

describe('date-utils', () => {
  describe('parseDate', () => {
    it('should parse ISO date string', () => {
      const dateStr = '2024-01-15T10:30:00.000Z';
      const date = parseDate(dateStr);
      expect(date).toBeInstanceOf(Date);
      expect(date.getUTCFullYear()).toBe(2024);
      expect(date.getUTCMonth()).toBe(0);
      expect(date.getUTCDate()).toBe(15);
    });

    it('should parse date with different formats', () => {
      const dateStr = '2024-01-15 10:30:00';
      const date = parseDate(dateStr);
      expect(date).toBeInstanceOf(Date);
    });

    it('should return current date for invalid input', () => {
      const now = Date.now();
      const date = parseDate('invalid date');
      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBeGreaterThanOrEqual(now);
    });
  });

  describe('durationToMs', () => {
    it('should convert milliseconds correctly', () => {
      expect(durationToMs('100', 'ms')).toBe(100);
      expect(durationToMs('100.5', 'ms')).toBe(100.5);
      expect(durationToMs('100')).toBe(100);
    });

    it('should convert seconds correctly', () => {
      expect(durationToMs('1', 's')).toBe(1000);
      expect(durationToMs('2.5', 's')).toBe(2500);
    });

    it('should convert microseconds correctly', () => {
      expect(durationToMs('1000', 'us')).toBe(1);
      expect(durationToMs('500000', 'us')).toBe(500);
    });

    it('should handle numeric string input', () => {
      expect(durationToMs('100', 'ms')).toBe(100);
    });
  });
});
