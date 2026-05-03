import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { DeviceConfig, AlertRule, ImportValidationResult } from '../types';

export class YamlConfigParser {
  async parseDeviceConfig(filePath: string): Promise<{
    devices: DeviceConfig[];
    errors: string[];
  }> {
    const devices: DeviceConfig[] = [];
    const errors: string[] = [];

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const parsed = yaml.load(content) as Record<string, unknown>;

      if (!parsed) {
        throw new Error('Empty or invalid YAML file');
      }

      const devicesArray = this.extractDevices(parsed);

      for (const deviceData of devicesArray) {
        try {
          const device = this.validateAndConvertDevice(deviceData);
          devices.push(device);
        } catch (error) {
          errors.push(`Device validation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      errors.push(`Failed to parse YAML file: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { devices, errors };
  }

  async parseAlertRules(filePath: string): Promise<{
    rules: AlertRule[];
    errors: string[];
  }> {
    const rules: AlertRule[] = [];
    const errors: string[] = [];

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const parsed = yaml.load(content) as Record<string, unknown>;

      if (!parsed) {
        throw new Error('Empty or invalid YAML file');
      }

      const rulesArray = this.extractRules(parsed);

      for (const ruleData of rulesArray) {
        try {
          const rule = this.validateAndConvertRule(ruleData);
          rules.push(rule);
        } catch (error) {
          errors.push(`Rule validation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      errors.push(`Failed to parse YAML file: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { rules, errors };
  }

  private extractDevices(parsed: Record<string, unknown>): Record<string, unknown>[] {
    if ('devices' in parsed && Array.isArray(parsed.devices)) {
      return parsed.devices as Record<string, unknown>[];
    }

    if ('deviceConfigs' in parsed && Array.isArray(parsed.deviceConfigs)) {
      return parsed.deviceConfigs as Record<string, unknown>[];
    }

    if ('deviceId' in parsed || 'name' in parsed) {
      return [parsed];
    }

    throw new Error('Could not find devices array in YAML');
  }

  private extractRules(parsed: Record<string, unknown>): Record<string, unknown>[] {
    if ('rules' in parsed && Array.isArray(parsed.rules)) {
      return parsed.rules as Record<string, unknown>[];
    }

    if ('alertRules' in parsed && Array.isArray(parsed.alertRules)) {
      return parsed.alertRules as Record<string, unknown>[];
    }

    if ('id' in parsed || 'name' in parsed) {
      return [parsed];
    }

    throw new Error('Could not find rules array in YAML');
  }

  private validateAndConvertDevice(obj: Record<string, unknown>): DeviceConfig {
    const requiredFields = ['deviceId', 'name'];
    const missingFields = requiredFields.filter(field => !(field in obj));

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    const deviceId = String(obj.deviceId);
    const name = String(obj.name);
    const type = typeof obj.type === 'string' ? obj.type : 'unknown';
    const shadowVersion = typeof obj.shadowVersion === 'number' ? obj.shadowVersion : 
                          typeof obj.shadowVersion === 'string' ? parseInt(obj.shadowVersion, 10) : 1;
    const desiredConfig = typeof obj.desiredConfig === 'object' && obj.desiredConfig !== null ? 
                          obj.desiredConfig as Record<string, unknown> : {};
    const lastSeen = typeof obj.lastSeen === 'number' ? obj.lastSeen : 
                     typeof obj.lastSeen === 'string' ? Date.parse(obj.lastSeen) : 0;
    const status = this.parseDeviceStatus(obj.status);

    return {
      deviceId,
      name,
      type,
      shadowVersion: isNaN(shadowVersion) ? 1 : shadowVersion,
      desiredConfig,
      lastSeen: isNaN(lastSeen) ? 0 : lastSeen,
      status
    };
  }

  private validateAndConvertRule(obj: Record<string, unknown>): AlertRule {
    const requiredFields = ['id', 'name', 'condition'];
    const missingFields = requiredFields.filter(field => !(field in obj));

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    const id = String(obj.id);
    const name = String(obj.name);
    const description = typeof obj.description === 'string' ? obj.description : '';
    const condition = this.parseCondition(obj.condition);
    const severity = this.parseSeverity(obj.severity);
    const enabled = typeof obj.enabled === 'boolean' ? obj.enabled : true;
    const topicPattern = typeof obj.topicPattern === 'string' ? obj.topicPattern : '#';

    return {
      id,
      name,
      description,
      condition,
      severity,
      enabled,
      topicPattern
    };
  }

  private parseCondition(value: unknown): AlertRule['condition'] {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Condition must be an object');
    }

    const obj = value as Record<string, unknown>;
    const type = this.parseConditionType(obj.type);
    const parameters = typeof obj.parameters === 'object' && obj.parameters !== null ?
                        obj.parameters as Record<string, unknown> : {};

    return { type, parameters };
  }

  private parseConditionType(value: unknown): AlertRule['condition']['type'] {
    const validTypes: AlertRule['condition']['type'][] = ['threshold', 'state_change', 'timeout', 'custom'];
    const stringValue = String(value).toLowerCase();

    if (validTypes.includes(stringValue as AlertRule['condition']['type'])) {
      return stringValue as AlertRule['condition']['type'];
    }

    return 'custom';
  }

  private parseSeverity(value: unknown): AlertRule['severity'] {
    const validSeverities: AlertRule['severity'][] = ['critical', 'warning', 'info'];
    const stringValue = String(value).toLowerCase();

    if (validSeverities.includes(stringValue as AlertRule['severity'])) {
      return stringValue as AlertRule['severity'];
    }

    return 'warning';
  }

  private parseDeviceStatus(value: unknown): DeviceConfig['status'] {
    const validStatuses: DeviceConfig['status'][] = ['online', 'offline', 'unknown'];
    const stringValue = String(value).toLowerCase();

    if (validStatuses.includes(stringValue as DeviceConfig['status'])) {
      return stringValue as DeviceConfig['status'];
    }

    return 'unknown';
  }

  validateImport(
    messages: { total: number; errors: number },
    devices: { total: number; errors: number },
    rules: { total: number; errors: number }
  ): ImportValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (messages.total === 0) {
      warnings.push('No MQTT messages imported');
    }

    if (messages.errors > 0) {
      errors.push(`${messages.errors} messages failed to parse`);
    }

    if (devices.total === 0) {
      warnings.push('No device configurations imported');
    }

    if (devices.errors > 0) {
      errors.push(`${devices.errors} device configurations failed to parse`);
    }

    if (rules.errors > 0) {
      errors.push(`${rules.errors} alert rules failed to parse`);
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors,
      stats: {
        messages: messages.total,
        devices: devices.total,
        rules: rules.total
      }
    };
  }
}