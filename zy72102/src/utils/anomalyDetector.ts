import type { SensorData, DeviceParams, Anomaly, ExtremeValue } from '../types';

function generateId(): string {
  return 'anomaly-' + Math.random().toString(36).substr(2, 9);
}

export function detectTemperatureAnomalies(
  sensorData: SensorData[],
  params: DeviceParams
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const minTemp = params.normalTempMin * 0.9;
  const maxTemp = params.normalTempMax * 1.1;

  sensorData.forEach((data, index) => {
    if (data.temperature > maxTemp) {
      const deviation = data.temperature - maxTemp;
      anomalies.push({
        id: generateId(),
        timestamp: data.timestamp,
        dataIndex: index,
        type: 'temperature',
        severity: deviation > 15 ? 'critical' : 'warning',
        value: data.temperature,
        threshold: maxTemp,
        deviation,
        reason: `温度超出正常范围上限 ${maxTemp.toFixed(1)}°C，可能存在过热风险`,
        acknowledged: false,
      });
    } else if (data.temperature < minTemp) {
      anomalies.push({
        id: generateId(),
        timestamp: data.timestamp,
        dataIndex: index,
        type: 'temperature',
        severity: 'warning',
        value: data.temperature,
        threshold: minTemp,
        deviation: minTemp - data.temperature,
        reason: `温度低于正常范围下限 ${minTemp.toFixed(1)}°C`,
        acknowledged: false,
      });
    }
  });

  return anomalies;
}

export function detectVibrationAnomalies(
  sensorData: SensorData[],
  params: DeviceParams
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const warningThreshold = params.vibrationThreshold * 1.5;
  const criticalThreshold = params.vibrationThreshold * 2.0;

  sensorData.forEach((data, index) => {
    if (data.vibration > criticalThreshold) {
      anomalies.push({
        id: generateId(),
        timestamp: data.timestamp,
        dataIndex: index,
        type: 'vibration',
        severity: 'critical',
        value: data.vibration,
        threshold: criticalThreshold,
        deviation: data.vibration - criticalThreshold,
        reason: `振动严重超出阈值 ${criticalThreshold.toFixed(2)} mm/s，可能存在设备故障`,
        acknowledged: false,
      });
    } else if (data.vibration > warningThreshold) {
      anomalies.push({
        id: generateId(),
        timestamp: data.timestamp,
        dataIndex: index,
        type: 'vibration',
        severity: 'warning',
        value: data.vibration,
        threshold: warningThreshold,
        deviation: data.vibration - warningThreshold,
        reason: `振动超出警告阈值 ${warningThreshold.toFixed(2)} mm/s，建议关注`,
        acknowledged: false,
      });
    }
  });

  return anomalies;
}

export function detectVelocityAnomalies(sensorData: SensorData[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const maxAcceleration = 19.6;

  for (let i = 1; i < sensorData.length; i++) {
    const acceleration = Math.abs(sensorData[i].acceleration);
    if (acceleration > maxAcceleration) {
      anomalies.push({
        id: generateId(),
        timestamp: sensorData[i].timestamp,
        dataIndex: i,
        type: 'velocity',
        severity: 'warning',
        value: acceleration,
        threshold: maxAcceleration,
        deviation: acceleration - maxAcceleration,
        reason: `加速度突变超过 2g (${maxAcceleration} m/s²)，可能存在急刹或碰撞`,
        acknowledged: false,
      });
    }
  }

  return anomalies;
}

export function detectEnergyAnomalies(totalEnergy: { timestamp: number; value: number }[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const windowSize = 10;

  for (let i = windowSize; i < totalEnergy.length - windowSize; i++) {
    const currentValue = totalEnergy[i].value;
    let windowSum = 0;
    for (let j = i - windowSize; j < i + windowSize; j++) {
      if (j !== i) {
        windowSum += totalEnergy[j].value;
      }
    }
    const windowAvg = windowSum / (windowSize * 2 - 1);
    const deviation = Math.abs(currentValue - windowAvg) / windowAvg;

    if (deviation > 0.3) {
      anomalies.push({
        id: generateId(),
        timestamp: totalEnergy[i].timestamp,
        dataIndex: i,
        type: 'energy',
        severity: deviation > 0.5 ? 'critical' : 'warning',
        value: currentValue,
        threshold: windowAvg * 1.3,
        deviation: currentValue - windowAvg,
        reason: `能量突变超过周围平均值的 30%，需确认是否为真实数据`,
        acknowledged: false,
      });
    }
  }

  return anomalies;
}

export function detectAllAnomalies(
  sensorData: SensorData[],
  params: DeviceParams,
  totalEnergy: { timestamp: number; value: number }[]
): Anomaly[] {
  return [
    ...detectTemperatureAnomalies(sensorData, params),
    ...detectVibrationAnomalies(sensorData, params),
    ...detectVelocityAnomalies(sensorData),
    ...detectEnergyAnomalies(totalEnergy),
  ].sort((a, b) => a.timestamp - b.timestamp);
}

export function findExtremeValues(sensorData: SensorData[]): ExtremeValue[] {
  const fields: (keyof SensorData)[] = ['velocity', 'acceleration', 'temperature', 'vibration', 'pressure'];
  const extremeValues: ExtremeValue[] = [];

  fields.forEach((field) => {
    const values = sensorData.map((d) => d[field]);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const maxIndex = values.indexOf(maxValue);
    const minIndex = values.indexOf(minValue);

    extremeValues.push({
      id: `extreme-max-${field}`,
      type: 'max',
      field,
      value: maxValue,
      timestamp: sensorData[maxIndex].timestamp,
      dataIndex: maxIndex,
      avgValue: avg,
      deviationPercent: ((maxValue - avg) / avg) * 100,
    });

    extremeValues.push({
      id: `extreme-min-${field}`,
      type: 'min',
      field,
      value: minValue,
      timestamp: sensorData[minIndex].timestamp,
      dataIndex: minIndex,
      avgValue: avg,
      deviationPercent: ((minValue - avg) / avg) * 100,
    });
  });

  return extremeValues;
}
