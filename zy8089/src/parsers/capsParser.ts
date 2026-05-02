import * as fs from 'fs';
import * as yaml from 'yaml';
import { DeviceCapability, ValidationError } from '../types';

export function parseDeviceCaps(filePath: string): { capabilities: DeviceCapability[]; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = yaml.parse(content) as { capabilities: DeviceCapability[] };

    if (!data || !data.capabilities || !Array.isArray(data.capabilities)) {
      return {
        capabilities: [],
        errors: [{
          code: 'CAPS_INVALID_FORMAT',
          message: 'Invalid device capabilities format',
          severity: 'error'
        }]
      };
    }

    data.capabilities.forEach((cap, index) => {
      if (!cap.deviceType) {
        errors.push({
          code: 'CAPS_MISSING_DEVICE_TYPE',
          message: `Capability at index ${index} is missing deviceType`,
          severity: 'error'
        });
      }
      if (!cap.model) {
        errors.push({
          code: 'CAPS_MISSING_MODEL',
          message: `Capability at index ${index} is missing model`,
          severity: 'warning'
        });
      }
    });

    return { capabilities: data.capabilities, errors };
  } catch (err) {
    return {
      capabilities: [],
      errors: [{
        code: 'CAPS_PARSE_ERROR',
        message: `Failed to parse device capabilities: ${(err as Error).message}`,
        severity: 'error'
      }]
    };
  }
}
