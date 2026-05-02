import * as fs from 'fs';
import csv from 'csv-parser';
import { RolloutDevice, ValidationError } from '../types';

export async function parseRolloutCsv(filePath: string): Promise<{ devices: RolloutDevice[]; errors: ValidationError[] }> {
  return new Promise((resolve) => {
    const devices: RolloutDevice[] = [];
    const errors: ValidationError[] = [];
    const seenDeviceIds = new Set<string>();

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row: Record<string, string>) => {
        const deviceId = row.device_id || row.deviceId || '';
        const deviceType = row.device_type || row.deviceType || '';
        const currentVersion = row.current_version || row.currentVersion || '';
        const targetVersion = row.target_version || row.targetVersion || '';
        const priority = (row.priority || 'medium') as 'high' | 'medium' | 'low';
        const region = row.region || 'unknown';

        if (!deviceId) {
          errors.push({
            code: 'ROLLOUT_MISSING_DEVICE_ID',
            message: 'Row missing device_id',
            severity: 'error'
          });
          return;
        }

        if (seenDeviceIds.has(deviceId)) {
          errors.push({
            code: 'ROLLOUT_DUPLICATE_DEVICE',
            message: `Duplicate device ID: ${deviceId}`,
            severity: 'warning',
            affectedDevices: [deviceId]
          });
        }
        seenDeviceIds.add(deviceId);

        devices.push({
          deviceId,
          deviceType,
          currentVersion,
          targetVersion,
          priority,
          region
        });
      })
      .on('end', () => {
        resolve({ devices, errors });
      })
      .on('error', (err: Error) => {
        errors.push({
          code: 'ROLLOUT_PARSE_ERROR',
          message: `Failed to parse rollout CSV: ${err.message}`,
          severity: 'error'
        });
        resolve({ devices, errors });
      });
  });
}
