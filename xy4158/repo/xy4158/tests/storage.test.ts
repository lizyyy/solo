import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ProjectStorage } from '../src/storage';
import { DeviceConfig, ValidationRules } from '../src/types';

describe('ProjectStorage', () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocv-test-'));
    projectDir = path.join(tempDir, 'test-project');
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('initProject', () => {
    it('should initialize a new project with default rules', () => {
      const storage = new ProjectStorage({ projectDir });
      const state = storage.initProject('Test Project', 'Test description');

      expect(state.config.name).toBe('Test Project');
      expect(state.config.description).toBe('Test description');
      expect(state.config.rules.allowedExtensions).toBeDefined();
      expect(state.config.rules.maxMissingIntervals).toBe(3);
      expect(state.config.devices).toHaveLength(0);
    });

    it('should create necessary directories', () => {
      const storage = new ProjectStorage({ projectDir });
      storage.initProject('Test Project');

      expect(fs.existsSync(projectDir)).toBe(true);
      expect(fs.existsSync(path.join(projectDir, 'data'))).toBe(true);
      expect(fs.existsSync(path.join(projectDir, 'quarantine'))).toBe(true);
      expect(fs.existsSync(path.join(projectDir, 'reports'))).toBe(true);
      expect(fs.existsSync(path.join(projectDir, 'ocv-project.json'))).toBe(true);
    });
  });

  describe('loadProject', () => {
    it('should load an existing project', () => {
      const storage = new ProjectStorage({ projectDir });
      storage.initProject('Test Project');

      const loadedStorage = new ProjectStorage({ projectDir });
      const state = loadedStorage.loadProject();

      expect(state.config.name).toBe('Test Project');
    });

    it('should throw error for non-existent project', () => {
      const storage = new ProjectStorage({ projectDir });
      expect(() => storage.loadProject()).toThrow();
    });
  });

  describe('projectExists', () => {
    it('should return true for existing project', () => {
      const storage = new ProjectStorage({ projectDir });
      storage.initProject('Test Project');

      expect(storage.projectExists()).toBe(true);
    });

    it('should return false for non-existent project', () => {
      const storage = new ProjectStorage({ projectDir });
      expect(storage.projectExists()).toBe(false);
    });
  });

  describe('addDevice', () => {
    it('should add a new device', () => {
      const storage = new ProjectStorage({ projectDir });
      storage.initProject('Test Project');

      const device: DeviceConfig = {
        id: 'LOGGER001',
        name: 'Temperature Logger 1',
        type: 'logger',
        expectedInterval: 5
      };

      storage.addDevice(device);
      const state = storage.getState();

      expect(state.config.devices).toHaveLength(1);
      expect(state.config.devices[0].id).toBe('LOGGER001');
    });

    it('should update existing device', () => {
      const storage = new ProjectStorage({ projectDir });
      storage.initProject('Test Project');

      const device: DeviceConfig = {
        id: 'LOGGER001',
        name: 'Temperature Logger 1',
        type: 'logger',
        expectedInterval: 5
      };

      storage.addDevice(device);

      const updatedDevice: DeviceConfig = {
        ...device,
        name: 'Updated Logger',
        expectedInterval: 10
      };

      storage.addDevice(updatedDevice);
      const state = storage.getState();

      expect(state.config.devices).toHaveLength(1);
      expect(state.config.devices[0].name).toBe('Updated Logger');
      expect(state.config.devices[0].expectedInterval).toBe(10);
    });
  });

  describe('removeDevice', () => {
    it('should remove existing device', () => {
      const storage = new ProjectStorage({ projectDir });
      storage.initProject('Test Project');

      storage.addDevice({
        id: 'LOGGER001',
        name: 'Test Logger',
        type: 'logger',
        expectedInterval: 5
      });

      const result = storage.removeDevice('LOGGER001');
      const state = storage.getState();

      expect(result).toBe(true);
      expect(state.config.devices).toHaveLength(0);
    });

    it('should return false for non-existent device', () => {
      const storage = new ProjectStorage({ projectDir });
      storage.initProject('Test Project');

      const result = storage.removeDevice('NONEXISTENT');
      expect(result).toBe(false);
    });
  });

  describe('getStatistics', () => {
    it('should return default stats for empty project', () => {
      const storage = new ProjectStorage({ projectDir });
      storage.initProject('Test Project');

      const stats = storage.getStatistics();

      expect(stats.totalFiles).toBe(0);
      expect(stats.validFiles).toBe(0);
      expect(stats.invalidFiles).toBe(0);
      expect(stats.totalIssues).toBe(0);
      expect(stats.criticalIssues).toBe(0);
      expect(stats.quarantinedFiles).toBe(0);
      expect(stats.devices).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('should update partial config', () => {
      const storage = new ProjectStorage({ projectDir });
      storage.initProject('Test Project');

      storage.updateConfig({
        name: 'Updated Project'
      });

      const state = storage.getState();
      expect(state.config.name).toBe('Updated Project');
    });

    it('should update validation rules', () => {
      const storage = new ProjectStorage({ projectDir });
      storage.initProject('Test Project');

      const newRules: ValidationRules = {
        allowedExtensions: ['.csv', '.log'],
        maxMissingIntervals: 5,
        maxTimeDriftMinutes: 30,
        minFileSize: 100,
        maxDuplicateThreshold: 3,
        requireDeviceIdInFilename: false
      };

      storage.updateConfig({ rules: newRules });
      const state = storage.getState();

      expect(state.config.rules.maxMissingIntervals).toBe(5);
      expect(state.config.rules.requireDeviceIdInFilename).toBe(false);
    });
  });
});
