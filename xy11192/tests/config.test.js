const fs = require('fs');
const path = require('path');
const tmp = require('tmp');
const { loadConfig, DEFAULT_CONFIG } = require('../src/config');

describe('config', () => {
  describe('DEFAULT_CONFIG', () => {
    test('应包含所有必要的配置项', () => {
      expect(DEFAULT_CONFIG).toHaveProperty('requiredColumns');
      expect(DEFAULT_CONFIG).toHaveProperty('optionalColumns');
      expect(DEFAULT_CONFIG).toHaveProperty('output');
      expect(DEFAULT_CONFIG).toHaveProperty('validation');
      expect(DEFAULT_CONFIG).toHaveProperty('encoding');
    });

    test('应包含所有必要的必填列', () => {
      expect(DEFAULT_CONFIG.requiredColumns).toContain('设备编号');
      expect(DEFAULT_CONFIG.requiredColumns).toContain('设备名称');
      expect(DEFAULT_CONFIG.requiredColumns).toContain('设备类型');
      expect(DEFAULT_CONFIG.requiredColumns).toContain('检修日期');
      expect(DEFAULT_CONFIG.requiredColumns).toContain('检修人员');
      expect(DEFAULT_CONFIG.requiredColumns).toContain('检修状态');
    });

    test('应包含灯泡寿命阈值配置', () => {
      expect(DEFAULT_CONFIG.validation.maxBulbHours).toBe(2000);
      expect(DEFAULT_CONFIG.validation.warningBulbHours).toBe(1500);
    });
  });

  describe('loadConfig', () => {
    test('无自定义配置时应返回默认配置', () => {
      const config = loadConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    test('应正确加载自定义配置', () => {
      const tempDir = tmp.dirSync({ unsafeCleanup: true });
      const customConfigPath = path.join(tempDir.name, 'custom_config.json');
      
      const customConfig = {
        validation: {
          maxBulbHours: 1500,
          warningBulbHours: 1000
        }
      };
      
      fs.writeFileSync(customConfigPath, JSON.stringify(customConfig));
      
      const config = loadConfig(customConfigPath);
      
      expect(config.validation.maxBulbHours).toBe(1500);
      expect(config.validation.warningBulbHours).toBe(1000);
      expect(config.requiredColumns).toEqual(DEFAULT_CONFIG.requiredColumns);
      
      tempDir.removeCallback();
    });

    test('配置文件不存在时应使用默认配置', () => {
      const config = loadConfig('/non/existent/path.json');
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    test('配置文件格式错误时应使用默认配置', () => {
      const tempDir = tmp.dirSync({ unsafeCleanup: true });
      const badConfigPath = path.join(tempDir.name, 'bad_config.json');
      
      fs.writeFileSync(badConfigPath, 'not valid json');
      
      const config = loadConfig(badConfigPath);
      expect(config).toEqual(DEFAULT_CONFIG);
      
      tempDir.removeCallback();
    });
  });
});
