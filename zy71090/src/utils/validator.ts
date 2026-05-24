import { z } from 'zod';
import { ValidationError } from '../types';
import { VALID_RECORD_TYPES, MAX_CNAME_CHAIN_DEPTH } from '../config/default';

export const zoneFileSchema = z.object({
  name: z.string().min(1, 'Zone name cannot be empty'),
  records: z.array(z.object({
    name: z.string().min(1, 'Record name cannot be empty'),
    type: z.string().refine(
      (val) => VALID_RECORD_TYPES.includes(val.toUpperCase()),
      (val) => ({ message: `Invalid record type: ${val}` })
    ),
    ttl: z.number().int().min(0, 'TTL must be a non-negative integer'),
    value: z.string().min(1, 'Record value cannot be empty')
  }))
});

export const cliOptionsSchema = z.object({
  zoneFile: z.string().min(1, 'Zone file path is required'),
  zoneDir: z.string().optional(),
  outputDir: z.string().min(1, 'Output directory is required'),
  environments: z.array(z.string()).default([]),
  migrationWindow: z.string().optional(),
  ttlConfig: z.string().optional(),
  envConfig: z.string().optional(),
  format: z.array(z.enum(['json', 'markdown', 'terminal'])).default(['terminal']),
  verbose: z.boolean().default(false),
  strict: z.boolean().default(false),
  expandCNAME: z.boolean().default(true),
  maxChainDepth: z.number().int().min(1).max(MAX_CNAME_CHAIN_DEPTH).default(10),
  minTTLWarn: z.number().int().min(0).default(300),
  maxTTLWarn: z.number().int().min(0).default(3600)
});

export function validateTTL(ttl: number): ValidationError | null {
  if (ttl < 0) {
    return {
      field: 'ttl',
      message: `TTL ${ttl} is negative`,
      severity: 'error'
    };
  }
  if (ttl === 0) {
    return {
      field: 'ttl',
      message: 'TTL is 0, which may cause excessive DNS queries',
      severity: 'warning'
    };
  }
  if (ttl > 604800) {
    return {
      field: 'ttl',
      message: `TTL ${ttl} exceeds 7 days, which is unusually long`,
      severity: 'warning'
    };
  }
  return null;
}

export function validateDomainName(name: string): ValidationError | null {
  if (!name) {
    return {
      field: 'name',
      message: 'Domain name is empty',
      severity: 'error'
    };
  }
  if (name.length > 255) {
    return {
      field: 'name',
      message: `Domain name exceeds 255 characters: ${name.length}`,
      severity: 'error'
    };
  }
  const labels = name.endsWith('.') ? name.slice(0, -1).split('.') : name.split('.');
  for (const label of labels) {
    if (label.length > 63) {
      return {
        field: 'name',
        message: `Label exceeds 63 characters: ${label}`,
        severity: 'error'
      };
    }
    if (!/^[a-zA-Z0-9*-]+$/.test(label)) {
      return {
        field: 'name',
        message: `Label contains invalid characters: ${label}`,
        severity: 'warning'
      };
    }
  }
  return null;
}

export function validateRecordType(type: string): ValidationError | null {
  const upperType = type.toUpperCase();
  if (!VALID_RECORD_TYPES.includes(upperType)) {
    return {
      field: 'type',
      message: `Unknown record type: ${type}`,
      severity: 'warning'
    };
  }
  return null;
}
