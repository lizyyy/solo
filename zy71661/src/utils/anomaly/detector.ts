import type { DataPoint, Anomaly, Simulation } from '@/types/simulation';
import { nanoid } from 'nanoid';
import { MIN_RAMP_ANGLE, MAX_RAMP_ANGLE, ENERGY_TOLERANCE, SPIKE_ACCELERATION_THRESHOLD } from '@/constants/physics';

export function detectAngleOutOfRange(angle: number, minAngle: number = MIN_RAMP_ANGLE, maxAngle: number = MAX_RAMP_ANGLE): Anomaly | null {
  if (angle < minAngle || angle > maxAngle) {
    return {
      id: nanoid(),
      type: 'angle_out_of_range',
      severity: angle < 0 || angle >= 90 ? 'critical' : angle < minAngle || angle > maxAngle ? 'high' : 'medium',
      description: `坡道角度 ${angle.toFixed(1)}° 超出有效范围 [${minAngle}°, ${maxAngle}°]`,
      timestamp: Date.now() / 1000,
      detectedAt: new Date().toISOString(),
      isConfirmed: false,
      data: { angle, minAngle, maxAngle },
    };
  }
  return null;
}

export function detectEnergyIncrease(dataPoints: DataPoint[], tolerance: number = ENERGY_TOLERANCE): Anomaly[] {
  const anomalies: Anomaly[] = [];
  for (let i = 1; i < dataPoints.length; i++) {
    const prevTotal = dataPoints[i - 1].potentialEnergy + dataPoints[i - 1].kineticEnergy;
    const currTotal = dataPoints[i].potentialEnergy + dataPoints[i].kineticEnergy;
    if (currTotal > prevTotal + tolerance * Math.max(Math.abs(prevTotal), 1)) {
      anomalies.push({
        id: nanoid(),
        type: 'energy_increase',
        severity: (currTotal - prevTotal) / Math.max(Math.abs(prevTotal), 1) > 0.1 ? 'high' : 'medium',
        description: `时刻 ${dataPoints[i].timestamp.toFixed(2)}s 总能量从 ${prevTotal.toFixed(2)}J 增加到 ${currTotal.toFixed(2)}J，违反能量守恒`,
        timestamp: dataPoints[i].timestamp,
        detectedAt: new Date().toISOString(),
        isConfirmed: false,
        data: { prevEnergy: prevTotal, currEnergy: currTotal, increase: currTotal - prevTotal },
      });
    }
  }
  return anomalies;
}

export function detectSampleSpikes(dataPoints: DataPoint[], threshold: number = SPIKE_ACCELERATION_THRESHOLD): Anomaly[] {
  const anomalies: Anomaly[] = [];
  for (let i = 1; i < dataPoints.length; i++) {
    const dv = Math.abs(dataPoints[i].velocity - dataPoints[i - 1].velocity);
    const dt = dataPoints[i].timestamp - dataPoints[i - 1].timestamp;
    if (dt > 0) {
      const accel = dv / dt;
      if (accel > threshold) {
        anomalies.push({
          id: nanoid(),
          type: 'sample_spike',
          severity: accel > threshold * 3 ? 'critical' : accel > threshold * 2 ? 'high' : 'medium',
          description: `时刻 ${dataPoints[i].timestamp.toFixed(2)}s 速度突变 ${accel.toFixed(2)} m/s²，超过阈值 ${threshold} m/s²`,
          timestamp: dataPoints[i].timestamp,
          detectedAt: new Date().toISOString(),
          isConfirmed: false,
          data: { acceleration: accel, threshold, velocityChange: dv },
        });
      }
    }
  }
  return anomalies;
}

export function detectAllAnomalies(simulation: Simulation): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const angleAnomaly = detectAngleOutOfRange(simulation.physicsParams.rampAngle);
  if (angleAnomaly) anomalies.push(angleAnomaly);
  anomalies.push(...detectEnergyIncrease(simulation.dataPoints));
  anomalies.push(...detectSampleSpikes(simulation.dataPoints));
  return anomalies;
}
