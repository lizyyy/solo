import * as yaml from 'js-yaml';
import { DeviceProfile } from '../types';

interface RawDeviceProfile {
  station_id: string;
  device_model: string;
  stx: string;
  etx: string;
  unit: 'kg' | 'g' | 'lb';
  tare: number;
  precision: number;
  frame_format: 'type1' | 'type2' | 'type3';
}

export function parseDeviceProfiles(yamlContent: string): DeviceProfile[] {
  try {
    const raw = yaml.load(yamlContent) as { devices: RawDeviceProfile[] };
    
    if (!raw || !raw.devices || !Array.isArray(raw.devices)) {
      throw new Error('Invalid device_profiles.yaml format: expected devices array');
    }

    return raw.devices.map((device: RawDeviceProfile, index: number) => {
      validateDeviceProfile(device, index);
      return {
        stationId: device.station_id,
        deviceModel: device.device_model,
        stx: device.stx,
        etx: device.etx,
        unit: device.unit,
        tare: device.tare,
        precision: device.precision,
        frameFormat: device.frame_format,
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to parse device_profiles.yaml: ${message}`);
  }
}

function validateDeviceProfile(device: RawDeviceProfile, index: number): void {
  const requiredFields = [
    'station_id', 'device_model', 'stx', 'etx', 
    'unit', 'tare', 'precision', 'frame_format'
  ];

  for (const field of requiredFields) {
    if (!(field in device)) {
      throw new Error(`Device at index ${index} is missing required field: ${field}`);
    }
  }

  const validUnits = ['kg', 'g', 'lb'];
  if (!validUnits.includes(device.unit)) {
    throw new Error(`Device at index ${index} has invalid unit: ${device.unit}. Must be one of: ${validUnits.join(', ')}`);
  }

  const validFormats = ['type1', 'type2', 'type3'];
  if (!validFormats.includes(device.frame_format)) {
    throw new Error(`Device at index ${index} has invalid frame_format: ${device.frame_format}. Must be one of: ${validFormats.join(', ')}`);
  }

  if (typeof device.tare !== 'number' || device.tare < 0) {
    throw new Error(`Device at index ${index} has invalid tare: ${device.tare}. Must be a non-negative number.`);
  }

  if (typeof device.precision !== 'number' || device.precision < 0) {
    throw new Error(`Device at index ${index} has invalid precision: ${device.precision}. Must be a non-negative number.`);
  }
}
