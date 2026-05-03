import * as fs from 'fs';
import * as yaml from 'yaml';
import { RulesConfig, ValidationRule } from '../types';

export class YamlParser {
  parseRulesConfig(content: string): RulesConfig {
    const parsed = yaml.parse(content);

    const config: RulesConfig = {
      rules: [],
      thresholds: parsed.thresholds || {
        maxSegmentDurationVariance: 0.5,
        minBitrateBps: 100000,
        maxBitrateBps: 50000000,
        maxResponseTimeMs: 1000,
      },
    };

    if (parsed.rules && Array.isArray(parsed.rules)) {
      config.rules = parsed.rules.map((rule: Record<string, unknown>) => ({
        id: String(rule.id || rule.ID || ''),
        name: String(rule.name || rule.NAME || ''),
        description: String(rule.description || rule.DESCRIPTION || ''),
        severity: (rule.severity || 'error') as 'error' | 'warning' | 'info',
        enabled: typeof rule.enabled === 'boolean' ? rule.enabled : true,
        config: rule.config as Record<string, unknown> | undefined,
      }));
    } else {
      config.rules = this.getDefaultRules();
    }

    return config;
  }

  private getDefaultRules(): ValidationRule[] {
    return [
      {
        id: 'bitrate_gradient',
        name: 'Bitrate Gradient Check',
        description: 'Verifies that bitrates between variants are not too close or too far apart',
        severity: 'warning',
        enabled: true,
      },
      {
        id: 'segment_duration',
        name: 'Segment Duration Check',
        description: 'Verifies all segments are within the target duration variance',
        severity: 'error',
        enabled: true,
      },
      {
        id: 'discontinuity',
        name: 'Discontinuity Check',
        description: 'Checks for unexpected discontinuities',
        severity: 'warning',
        enabled: true,
      },
      {
        id: 'encryption_key',
        name: 'Encryption Key Check',
        description: 'Verifies encryption keys are consistent across variants',
        severity: 'error',
        enabled: true,
      },
      {
        id: 'missing_segments',
        name: 'Missing Segments Check',
        description: 'Checks for missing segments in the manifest',
        severity: 'error',
        enabled: true,
      },
      {
        id: 'duplicate_segments',
        name: 'Duplicate Segments Check',
        description: 'Checks for duplicate segments',
        severity: 'warning',
        enabled: true,
      },
      {
        id: 'cdn_404',
        name: 'CDN 404 Check',
        description: 'Checks for CDN 404 responses',
        severity: 'error',
        enabled: true,
      },
      {
        id: 'cdn_response_time',
        name: 'CDN Response Time Check',
        description: 'Checks for slow CDN responses',
        severity: 'warning',
        enabled: true,
      },
      {
        id: 'cross_midnight',
        name: 'Cross Midnight Timestamp Check',
        description: 'Warns if program date time crosses midnight',
        severity: 'info',
        enabled: true,
      },
      {
        id: 'variant_consistency',
        name: 'Variant Consistency Check',
        description: 'Ensures all variants have consistent segment counts when expected',
        severity: 'warning',
        enabled: true,
      },
    ];
  }

  async parseRulesConfigFile(filePath: string): Promise<RulesConfig> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return this.parseRulesConfig(content);
  }
}

export default YamlParser;
