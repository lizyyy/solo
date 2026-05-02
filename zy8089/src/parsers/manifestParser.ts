import * as fs from 'fs';
import * as path from 'path';
import { FirmwareManifest, ValidationError } from '../types';

export function parseFirmwareManifest(filePath: string): { manifest: FirmwareManifest | null; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as FirmwareManifest;

    if (!data.version) {
      errors.push({
        code: 'MANIFEST_MISSING_VERSION',
        message: 'Manifest is missing version field',
        severity: 'error'
      });
    }

    if (!data.targetDeviceType) {
      errors.push({
        code: 'MANIFEST_MISSING_DEVICE_TYPE',
        message: 'Manifest is missing targetDeviceType field',
        severity: 'error'
      });
    }

    if (!data.chunks || !Array.isArray(data.chunks)) {
      errors.push({
        code: 'MANIFEST_INVALID_CHUNKS',
        message: 'Manifest chunks must be an array',
        severity: 'error'
      });
    } else {
      data.chunks.forEach((chunk, index) => {
        if (chunk.index !== index) {
          errors.push({
            code: 'MANIFEST_CHUNK_INDEX_MISMATCH',
            message: `Chunk at position ${index} has wrong index ${chunk.index}`,
            severity: 'warning',
            affectedChunks: [index]
          });
        }
      });
    }

    if (errors.length > 0) {
      return { manifest: null, errors };
    }

    return { manifest: data, errors };
  } catch (err) {
    return {
      manifest: null,
      errors: [{
        code: 'MANIFEST_PARSE_ERROR',
        message: `Failed to parse manifest: ${(err as Error).message}`,
        severity: 'error'
      }]
    };
  }
}
