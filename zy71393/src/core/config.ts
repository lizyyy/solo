import { ValidationConfig } from '../types';

export const DEFAULT_CONFIG: ValidationConfig = {
  samplingDelayThresholdMs: 5000,
  allowDeprecatedEvents: false,
  allowOptionalParameters: true,
  strictTypeChecking: true,
  pagePathMatching: 'prefix'
};

export function mergeConfig(partial: Partial<ValidationConfig>): ValidationConfig {
  return {
    ...DEFAULT_CONFIG,
    ...partial
  };
}
