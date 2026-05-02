import { FirmwareManifest, DeviceCapability, RolloutDevice, CapabilityValidationResult, ValidationError } from '../types';

export function validateDeviceCapabilities(manifest: FirmwareManifest, capabilities: DeviceCapability[], devices: RolloutDevice[]): CapabilityValidationResult {
  const errors: ValidationError[] = [];
  const unsupportedDevices: string[] = [];
  const insufficientBatteryDevices: string[] = [];
  const hashAlgorithmMismatch: string[] = [];

  const capabilityMap = new Map<string, DeviceCapability>();
  capabilities.forEach(cap => {
    capabilityMap.set(cap.deviceType, cap);
  });

  devices.forEach(device => {
    const cap = capabilityMap.get(device.deviceType);
    
    if (!cap) {
      unsupportedDevices.push(device.deviceId);
      errors.push({
        code: 'CAPABILITY_NOT_FOUND',
        message: `No capability definition found for device type ${device.deviceType} (${device.deviceId})`,
        severity: 'error',
        affectedDevices: [device.deviceId]
      });
      return;
    }

    manifest.chunks.forEach(chunk => {
      if (chunk.size > cap.maxChunkSize) {
        errors.push({
          code: 'CHUNK_SIZE_EXCEEDED',
          message: `Chunk ${chunk.index} size ${chunk.size} exceeds max chunk size ${cap.maxChunkSize} for ${device.deviceId}`,
          severity: 'error',
          affectedDevices: [device.deviceId],
          affectedChunks: [chunk.index]
        });
      }
    });

    const sha256Support = cap.supportedHashAlgorithms.some(alg => 
      alg.toLowerCase().includes('sha256') || alg.toLowerCase().includes('sha-256')
    );
    
    if (!sha256Support) {
      hashAlgorithmMismatch.push(device.deviceId);
      errors.push({
        code: 'HASH_ALGORITHM_MISMATCH',
        message: `Device ${device.deviceId} does not support SHA-256 hash algorithm`,
        severity: 'warning',
        affectedDevices: [device.deviceId]
      });
    }

    if (!cap.supportsResume && manifest.chunks.length > 1) {
      errors.push({
        code: 'NO_RESUME_SUPPORT',
        message: `Device ${device.deviceId} does not support resume, but firmware has ${manifest.chunks.length} chunks`,
        severity: 'warning',
        affectedDevices: [device.deviceId]
      });
    }
  });

  if (unsupportedDevices.length > 0) {
    errors.push({
      code: 'UNSUPPORTED_DEVICES',
      message: `${unsupportedDevices.length} devices have unsupported device types`,
      severity: 'error',
      affectedDevices: unsupportedDevices
    });
  }

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
    unsupportedDevices,
    insufficientBatteryDevices,
    hashAlgorithmMismatch
  };
}
