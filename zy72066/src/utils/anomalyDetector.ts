import { DeviceData, Anomaly, AnomalyType, ParameterConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';

const ANOMALY_MESSAGES: Record<AnomalyType, string> = {
  coordinate_offset: '设备坐标偏移超出容差范围',
  duplicate_name: '存在重名设备',
  missing_photo: '设备缺少照片',
  cross_floor: '设备坐标与所在楼层不匹配',
  empty_value: '存在空值字段',
  boundary: '能耗值处于边界阈值',
};

const ANOMALY_SEVERITY: Record<AnomalyType, 'low' | 'medium' | 'high'> = {
  coordinate_offset: 'medium',
  duplicate_name: 'high',
  missing_photo: 'low',
  cross_floor: 'high',
  empty_value: 'high',
  boundary: 'medium',
};

export function createAnomaly(
  type: AnomalyType,
  deviceId: string,
  extraInfo?: string
): Anomaly {
  return {
    id: uuidv4(),
    type,
    deviceId,
    description: extraInfo 
      ? `${ANOMALY_MESSAGES[type]}: ${extraInfo}`
      : ANOMALY_MESSAGES[type],
    severity: ANOMALY_SEVERITY[type],
    resolved: false,
  };
}

export function detectCoordinateOffset(
  devices: DeviceData[],
  tolerance: number
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const standardPositions: Record<number, { x: number; z: number }[]> = {
    1: [{ x: -2, z: -2 }, { x: 0, z: -2 }, { x: 2, z: -2 }, { x: -2, z: 0 }, { x: 0, z: 0 }],
    2: [{ x: -2, z: -2 }, { x: 0, z: -2 }, { x: 2, z: -2 }, { x: -2, z: 0 }, { x: 0, z: 0 }],
    3: [{ x: -2, z: -2 }, { x: 0, z: -2 }, { x: 2, z: -2 }, { x: -2, z: 0 }, { x: 0, z: 0 }],
  };

  devices.forEach((device) => {
    const floorPositions = standardPositions[device.floor] || [];
    const minDistance = Math.min(
      ...floorPositions.map(
        (pos) =>
          Math.sqrt(
            Math.pow(device.position.x - pos.x, 2) +
            Math.pow(device.position.z - pos.z, 2)
          )
      ),
      Infinity
    );

    if (minDistance > tolerance && floorPositions.length > 0) {
      anomalies.push(
        createAnomaly(
          'coordinate_offset',
          device.id,
          `偏移距离 ${minDistance.toFixed(2)}m`
        )
      );
    }
  });

  return anomalies;
}

export function detectDuplicateNames(devices: DeviceData[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const nameMap = new Map<string, string[]>();

  devices.forEach((device) => {
    const existing = nameMap.get(device.name) || [];
    nameMap.set(device.name, [...existing, device.id]);
  });

  nameMap.forEach((deviceIds, name) => {
    if (deviceIds.length > 1) {
      deviceIds.forEach((id) => {
        anomalies.push(
          createAnomaly(
            'duplicate_name',
            id,
            `设备名称 "${name}" 出现 ${deviceIds.length} 次`
          )
        );
      });
    }
  });

  return anomalies;
}

export function detectMissingPhotos(devices: DeviceData[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  devices.forEach((device) => {
    if (!device.photo) {
      anomalies.push(createAnomaly('missing_photo', device.id));
    }
  });

  return anomalies;
}

export function detectCrossFloor(devices: DeviceData[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const floorHeight = 3;

  devices.forEach((device) => {
    const expectedY = (device.floor - 1) * floorHeight + 1;
    if (Math.abs(device.position.y - expectedY) > floorHeight / 2) {
      anomalies.push(
        createAnomaly(
          'cross_floor',
          device.id,
          `预期Y坐标约 ${expectedY}m，实际 ${device.position.y.toFixed(2)}m`
        )
      );
    }
  });

  return anomalies;
}

export function detectEmptyValues(devices: DeviceData[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  devices.forEach((device) => {
    const emptyFields: string[] = [];
    
    if (!device.name || device.name.trim() === '') {
      emptyFields.push('设备名称');
    }
    if (device.energyConsumption === undefined || device.energyConsumption === null) {
      emptyFields.push('能耗值');
    }
    if (device.floor === undefined || device.floor === null) {
      emptyFields.push('楼层');
    }

    if (emptyFields.length > 0) {
      anomalies.push(
        createAnomaly('empty_value', device.id, `缺少字段: ${emptyFields.join(', ')}`)
      );
    }
  });

  return anomalies;
}

export function detectBoundaryValues(
  devices: DeviceData[],
  config: ParameterConfig
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const warningThreshold = config.energyThreshold.warning;
  const errorThreshold = config.energyThreshold.error;
  const boundaryRange = 0.05;

  devices.forEach((device) => {
    const nearWarning =
      Math.abs(device.energyConsumption - warningThreshold) / warningThreshold <
      boundaryRange;
    const nearError =
      Math.abs(device.energyConsumption - errorThreshold) / errorThreshold <
      boundaryRange;

    if (nearWarning || nearError) {
      anomalies.push(
        createAnomaly(
          'boundary',
          device.id,
          `当前能耗 ${device.energyConsumption}kWh 接近${nearError ? '错误' : '警告'}阈值`
        )
      );
    }
  });

  return anomalies;
}

export function detectAllAnomalies(
  devices: DeviceData[],
  config: ParameterConfig
): Anomaly[] {
  const detectors = [
    () => detectCoordinateOffset(devices, config.coordinateTolerance),
    () => detectDuplicateNames(devices),
    () => detectMissingPhotos(devices),
    () => detectCrossFloor(devices),
    () => detectEmptyValues(devices),
    () => detectBoundaryValues(devices, config),
  ];

  return detectors.flatMap((detector) => detector());
}
