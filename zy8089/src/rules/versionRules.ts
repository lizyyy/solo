import { FirmwareManifest, RolloutDevice, VersionValidationResult, ValidationError } from '../types';

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = v2.split('.').map(p => parseInt(p, 10) || 0);
  const maxLen = Math.max(parts1.length, parts2.length);
  
  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

export function validateVersionCompatibility(manifest: FirmwareManifest, devices: RolloutDevice[]): VersionValidationResult {
  const errors: ValidationError[] = [];
  const incompatibleDevices: string[] = [];
  const devicesWithHigherVersion: string[] = [];
  const devicesBelowMinVersion: string[] = [];

  devices.forEach(device => {
    if (device.deviceType !== manifest.targetDeviceType) {
      incompatibleDevices.push(device.deviceId);
      return;
    }

    const currentVersion = device.currentVersion;
    const targetVersion = manifest.version;

    const cmpCurrentToTarget = compareVersions(currentVersion, targetVersion);
    
    if (cmpCurrentToTarget > 0) {
      devicesWithHigherVersion.push(device.deviceId);
      errors.push({
        code: 'VERSION_HIGHER_THAN_TARGET',
        message: `Device ${device.deviceId} has version ${currentVersion}, which is higher than target ${targetVersion}`,
        severity: 'error',
        affectedDevices: [device.deviceId]
      });
    }

    if (manifest.minSupportedVersion) {
      const cmpToMin = compareVersions(currentVersion, manifest.minSupportedVersion);
      if (cmpToMin < 0) {
        devicesBelowMinVersion.push(device.deviceId);
        errors.push({
          code: 'VERSION_BELOW_MIN',
          message: `Device ${device.deviceId} has version ${currentVersion}, below minimum supported ${manifest.minSupportedVersion}`,
          severity: 'error',
          affectedDevices: [device.deviceId]
        });
      }
    }

    if (manifest.maxSupportedVersion) {
      const cmpToMax = compareVersions(currentVersion, manifest.maxSupportedVersion);
      if (cmpToMax > 0) {
        errors.push({
          code: 'VERSION_ABOVE_MAX',
          message: `Device ${device.deviceId} has version ${currentVersion}, above maximum supported ${manifest.maxSupportedVersion}`,
          severity: 'warning',
          affectedDevices: [device.deviceId]
        });
      }
    }
  });

  if (incompatibleDevices.length > 0) {
    errors.push({
      code: 'DEVICE_TYPE_MISMATCH',
      message: `${incompatibleDevices.length} devices have incompatible device type`,
      severity: 'error',
      affectedDevices: incompatibleDevices
    });
  }

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
    incompatibleDevices,
    devicesWithHigherVersion,
    devicesBelowMinVersion
  };
}
