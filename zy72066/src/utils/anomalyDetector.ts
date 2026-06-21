import { DeviceData, Anomaly, AnomalyType, ParameterConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';

const ANOMALY_MESSAGES: Record<AnomalyType, string> = {
  coordinate_offset: '设备坐标偏移超出容差范围',
  duplicate_name: '存在重名设备',
  same_device_different_name: '同一设备被记录为两个不同名称',
  missing_photo: '设备缺少照片',
  cross_floor: '设备坐标与所在楼层不匹配',
  empty_value: '存在空值字段',
  boundary: '能耗值处于边界阈值',
};

const ANOMALY_SEVERITY: Record<AnomalyType, 'low' | 'medium' | 'high'> = {
  coordinate_offset: 'medium',
  duplicate_name: 'high',
  same_device_different_name: 'high',
  missing_photo: 'low',
  cross_floor: 'high',
  empty_value: 'high',
  boundary: 'medium',
};

export function createAnomaly(
  type: AnomalyType,
  deviceId: string,
  extraInfo?: string,
  relatedDeviceId?: string
): Anomaly {
  return {
    id: uuidv4(),
    type,
    deviceId,
    relatedDeviceId,
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

export function detectSameDeviceDifferentNames(
  devices: DeviceData[],
  config: ParameterConfig
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const processedPairs = new Set<string>();
  const positionTolerance = config.sameDevicePositionTolerance || 0.5;
  const energyTolerance = config.sameDeviceEnergyTolerance || 0.1;

  for (let i = 0; i < devices.length; i++) {
    for (let j = i + 1; j < devices.length; j++) {
      const d1 = devices[i];
      const d2 = devices[j];

      if (d1.floor !== d2.floor) continue;
      if (d1.name === d2.name) continue;

      const distance = Math.sqrt(
        Math.pow(d1.position.x - d2.position.x, 2) +
        Math.pow(d1.position.y - d2.position.y, 2) +
        Math.pow(d1.position.z - d2.position.z, 2)
      );

      const avgEnergy = (d1.energyConsumption + d2.energyConsumption) / 2;
      const energyDiffRatio = avgEnergy > 0
        ? Math.abs(d1.energyConsumption - d2.energyConsumption) / avgEnergy
        : Math.abs(d1.energyConsumption - d2.energyConsumption);

      if (distance <= positionTolerance && energyDiffRatio <= energyTolerance) {
        const pairKey1 = `${d1.id}-${d2.id}`;
        const pairKey2 = `${d2.id}-${d1.id}`;
        if (processedPairs.has(pairKey1) || processedPairs.has(pairKey2)) continue;
        processedPairs.add(pairKey1);
        processedPairs.add(pairKey2);

        anomalies.push(
          createAnomaly(
            'same_device_different_name',
            d1.id,
            `设备 "${d1.name}" 与 "${d2.name}" 位置差${distance.toFixed(2)}m、能耗差${(energyDiffRatio * 100).toFixed(1)}%，疑似同一物理设备`,
            d2.id
          )
        );
        anomalies.push(
          createAnomaly(
            'same_device_different_name',
            d2.id,
            `设备 "${d2.name}" 与 "${d1.name}" 位置差${distance.toFixed(2)}m、能耗差${(energyDiffRatio * 100).toFixed(1)}%，疑似同一物理设备`,
            d1.id
          )
        );
      }
    }
  }

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
    () => detectSameDeviceDifferentNames(devices, config),
    () => detectMissingPhotos(devices),
    () => detectCrossFloor(devices),
    () => detectEmptyValues(devices),
    () => detectBoundaryValues(devices, config),
  ];

  return detectors.flatMap((detector) => detector());
}
