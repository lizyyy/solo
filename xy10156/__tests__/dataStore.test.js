const DataStore = require('../src/dataStore');
const fs = require('fs');
const path = require('path');

jest.mock('fs');
jest.mock('path', () => {
  const actualPath = jest.requireActual('path');
  return {
    ...actualPath,
    join: jest.fn((...parts) => actualPath.join(...parts)),
    basename: actualPath.basename
  };
});

describe('DataStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify({
      project: { name: 'test-project' },
      paths: {
        requirements: './data/requirements.json',
        testCases: './data/test-cases.json',
        sourceCode: ['./src/**/*.js'],
        coverage: './data/coverage.json',
        output: './reports'
      },
      mappings: { autoMatch: true, caseSensitive: false }
    }));
    fs.writeFileSync.mockImplementation(() => {});
    fs.mkdirSync.mockImplementation(() => {});
  });

  describe('constructor', () => {
    it('should create directories if they do not exist', () => {
      fs.existsSync.mockReturnValueOnce(false);
      new DataStore();
      expect(fs.mkdirSync).toHaveBeenCalled();
    });

    it('should load config from file', () => {
      const store = new DataStore();
      expect(fs.readFileSync).toHaveBeenCalled();
      expect(store.config.project.name).toBe('test-project');
    });

    it('should use default config if file does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      const store = new DataStore();
      expect(store.config.project.name).toBe('default-project');
    });
  });

  describe('validateRequirements', () => {
    it('should return valid for correct requirements', () => {
      const store = new DataStore();
      const result = store.validateRequirements([
        { id: 'REQ-001', title: 'Test', description: 'Description' },
        { id: 'REQ-002', title: 'Test 2', description: 'Description 2' }
      ]);
      
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should return errors for missing ids', () => {
      const store = new DataStore();
      const result = store.validateRequirements([
        { title: 'Test', description: 'Description' }
      ]);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return errors for duplicate ids', () => {
      const store = new DataStore();
      const result = store.validateRequirements([
        { id: 'REQ-001', title: 'Test', description: 'Description' },
        { id: 'REQ-001', title: 'Test 2', description: 'Description 2' }
      ]);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return warnings for missing fields', () => {
      const store = new DataStore();
      const result = store.validateRequirements([
        { id: 'REQ-001' }
      ]);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateTestCases', () => {
    it('should return valid for correct test cases', () => {
      const store = new DataStore();
      const result = store.validateTestCases([
        { id: 'TC-001', title: 'Test', requirements: ['REQ-001'] }
      ]);
      
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should return warnings for no requirements', () => {
      const store = new DataStore();
      const result = store.validateTestCases([
        { id: 'TC-001', title: 'Test' }
      ]);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('mergeRequirements', () => {
    it('should add new requirements', () => {
      const store = new DataStore();
      const existing = { items: [{ id: 'REQ-001' }], lastUpdated: null };
      const newItems = [{ id: 'REQ-002' }];
      
      const result = store.mergeRequirements(existing, newItems);
      
      expect(result.stats.added).toBe(1);
      expect(result.items.length).toBe(2);
    });

    it('should skip duplicates by default', () => {
      const store = new DataStore();
      const existing = { items: [{ id: 'REQ-001', title: 'Old' }], lastUpdated: null };
      const newItems = [{ id: 'REQ-001', title: 'New' }];
      
      const result = store.mergeRequirements(existing, newItems);
      
      expect(result.stats.duplicates).toBe(1);
      expect(result.items[0].title).toBe('Old');
    });

    it('should overwrite duplicates when option is set', () => {
      const store = new DataStore();
      const existing = { items: [{ id: 'REQ-001', title: 'Old' }], lastUpdated: null };
      const newItems = [{ id: 'REQ-001', title: 'New' }];
      
      const result = store.mergeRequirements(existing, newItems, { overwrite: true });
      
      expect(result.stats.updated).toBe(1);
      expect(result.items[0].title).toBe('New');
    });
  });
});
