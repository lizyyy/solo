import { MqttLogParser, YamlConfigParser } from '../src/parser';
import * as fs from 'fs';
import * as path from 'path';

const examplesDir = path.join(__dirname, '..', 'examples');

describe('MqttLogParser', () => {
  let parser: MqttLogParser;

  beforeEach(() => {
    parser = new MqttLogParser();
  });

  describe('parseFile', () => {
    it('should parse valid JSONL file', async () => {
      const filePath = path.join(examplesDir, 'mqtt-messages.jsonl');
      const result = await parser.parseFile(filePath);

      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.errors.length).toBe(0);
    });

    it('should have valid message structure', async () => {
      const filePath = path.join(examplesDir, 'mqtt-messages.jsonl');
      const result = await parser.parseFile(filePath);

      const firstMessage = result.messages[0];
      expect(firstMessage).toHaveProperty('id');
      expect(firstMessage).toHaveProperty('timestamp');
      expect(firstMessage).toHaveProperty('topic');
      expect(firstMessage).toHaveProperty('payload');
      expect(firstMessage).toHaveProperty('qos');
      expect(firstMessage).toHaveProperty('retain');
      expect(firstMessage).toHaveProperty('direction');
      expect(firstMessage).toHaveProperty('clientId');
    });

    it('should sort messages by timestamp', async () => {
      const filePath = path.join(examplesDir, 'mqtt-messages.jsonl');
      const result = await parser.parseFile(filePath);

      for (let i = 1; i < result.messages.length; i++) {
        expect(result.messages[i].timestamp).toBeGreaterThanOrEqual(result.messages[i - 1].timestamp);
      }
    });
  });

  describe('validateMessage', () => {
    it('should validate valid message', () => {
      const validMessage = {
        id: 'test-001',
        timestamp: Date.now(),
        topic: 'test/topic',
        payload: 'test payload',
        qos: 1 as const,
        retain: false,
        dup: false,
        direction: 'in' as const,
        clientId: 'test-client'
      };

      const result = parser.validateMessage(validMessage);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject invalid QoS level', () => {
      const invalidMessage = {
        id: 'test-001',
        timestamp: Date.now(),
        topic: 'test/topic',
        payload: 'test payload',
        qos: 3 as unknown as 0 | 1 | 2,
        retain: false,
        dup: false,
        direction: 'in' as const,
        clientId: 'test-client'
      };

      const result = parser.validateMessage(invalidMessage);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject message without topic', () => {
      const invalidMessage = {
        id: 'test-001',
        timestamp: Date.now(),
        topic: '',
        payload: 'test payload',
        qos: 1 as const,
        retain: false,
        dup: false,
        direction: 'in' as const,
        clientId: 'test-client'
      };

      const result = parser.validateMessage(invalidMessage);
      expect(result.valid).toBe(false);
    });
  });
});

describe('YamlConfigParser', () => {
  let parser: YamlConfigParser;

  beforeEach(() => {
    parser = new YamlConfigParser();
  });

  describe('parseDeviceConfig', () => {
    it('should parse device config file', async () => {
      const filePath = path.join(examplesDir, 'device-config.yaml');
      const result = await parser.parseDeviceConfig(filePath);

      expect(result.devices.length).toBeGreaterThan(0);
      expect(result.errors.length).toBe(0);
    });

    it('should have valid device structure', async () => {
      const filePath = path.join(examplesDir, 'device-config.yaml');
      const result = await parser.parseDeviceConfig(filePath);

      const device = result.devices[0];
      expect(device).toHaveProperty('deviceId');
      expect(device).toHaveProperty('name');
      expect(device).toHaveProperty('type');
      expect(device).toHaveProperty('shadowVersion');
      expect(device).toHaveProperty('desiredConfig');
      expect(device).toHaveProperty('lastSeen');
      expect(device).toHaveProperty('status');
    });
  });

  describe('parseAlertRules', () => {
    it('should parse alert rules file', async () => {
      const filePath = path.join(examplesDir, 'alert-rules.yaml');
      const result = await parser.parseAlertRules(filePath);

      expect(result.rules.length).toBeGreaterThan(0);
      expect(result.errors.length).toBe(0);
    });

    it('should have valid rule structure', async () => {
      const filePath = path.join(examplesDir, 'alert-rules.yaml');
      const result = await parser.parseAlertRules(filePath);

      const rule = result.rules[0];
      expect(rule).toHaveProperty('id');
      expect(rule).toHaveProperty('name');
      expect(rule).toHaveProperty('condition');
      expect(rule.condition).toHaveProperty('type');
      expect(rule.condition).toHaveProperty('parameters');
      expect(rule).toHaveProperty('severity');
      expect(rule).toHaveProperty('enabled');
      expect(rule).toHaveProperty('topicPattern');
    });
  });

  describe('validateImport', () => {
    it('should validate successful import', () => {
      const result = parser.validateImport(
        { total: 100, errors: 0 },
        { total: 5, errors: 0 },
        { total: 3, errors: 0 }
      );

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should warn about empty import', () => {
      const result = parser.validateImport(
        { total: 0, errors: 0 },
        { total: 0, errors: 0 },
        { total: 0, errors: 0 }
      );

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should report parse errors', () => {
      const result = parser.validateImport(
        { total: 100, errors: 5 },
        { total: 5, errors: 1 },
        { total: 3, errors: 0 }
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
