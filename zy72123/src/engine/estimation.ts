import type {
  SensorRecord,
  ParamValues,
  EstimationResult,
  AnomalyRecord,
  ConflictRecord,
  FieldNote,
} from '@/types';

function uid(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function computeMotorTorque(rpm: number, voltage: number, current: number, coeffs: number[]): number {
  const [a0, a1, a2] = coeffs;
  let torque = a0 * rpm + a1 * rpm * rpm + a2 * rpm * rpm * rpm;
  if (voltage > 0 && current < 0) {
    const electricalPower = Math.abs(voltage * current);
    const mechanicalPower = electricalPower * 0.92;
    const omega = (rpm * 2 * Math.PI) / 60;
    if (omega > 0) {
      const torqueFromPower = mechanicalPower / omega;
      torque = (torque + torqueFromPower) / 2;
    }
  }
  return torque;
}

export function estimateRegenBraking(
  records: SensorRecord[],
  params: ParamValues,
  runId: string
): { results: EstimationResult[]; anomalies: AnomalyRecord[] } {
  const results: EstimationResult[] = [];
  const anomalies: AnomalyRecord[] = [];
  let totalEnergy = 0;

  for (const record of records) {
    if (record.vehicleSpeed === null || record.motorRpm === null ||
        record.batteryVoltage === null || record.batteryCurrent === null ||
        record.brakePressure === null) {
      results.push({
        id: `${runId}-res-${uid()}`,
        runId,
        timestamp: record.timestamp,
        regenBrakeForce: 0,
        energyRecoveryRate: 0,
        totalEnergyRecovered: 0,
        anomalyFlag: 'excluded',
      });
      anomalies.push({
        id: `${runId}-anom-${uid()}`,
        runId,
        recordId: record.id,
        level: 'excluded',
        type: 'empty_value',
        description: `记录时间 ${record.timestamp}s 存在空值字段，无法参与估算`,
        evidence: `空值字段: ${Object.entries(record).filter(([, v]) => v === null).map(([k]) => k).join(', ')}`,
        resolution: '',
      });
      continue;
    }

    if (record.status === 'duplicate') {
      results.push({
        id: `${runId}-res-${uid()}`,
        runId,
        timestamp: record.timestamp,
        regenBrakeForce: 0,
        energyRecoveryRate: 0,
        totalEnergyRecovered: 0,
        anomalyFlag: 'excluded',
      });
      anomalies.push({
        id: `${runId}-anom-${uid()}`,
        runId,
        recordId: record.id,
        level: 'excluded',
        type: 'duplicate',
        description: `时间 ${record.timestamp}s 的记录为重复项，已排除`,
        evidence: '与已有记录时间戳和所有字段完全相同',
        resolution: '',
      });
      continue;
    }

    const torque = computeMotorTorque(
      record.motorRpm,
      record.batteryVoltage,
      record.batteryCurrent,
      params.motorTorqueCoefficients
    );

    const regenForce = Math.max(0, (torque * params.transmissionRatio * params.motorEfficiency) / params.wheelRadius);

    const kineticEnergy = 0.5 * params.vehicleMass * Math.pow((record.vehicleSpeed / 3.6), 2);
    const recoveryPower = Math.max(0, Math.abs(record.batteryVoltage * record.batteryCurrent));
    const dt = 0.5;
    const recoveredEnergy = recoveryPower * dt;
    totalEnergy += recoveredEnergy;

    const recoveryRate = kineticEnergy > 0 ? (recoveredEnergy / kineticEnergy) * 100 : 0;

    let anomalyFlag: EstimationResult['anomalyFlag'] = 'none';

    if (regenForce > params.maxBrakeForce) {
      anomalyFlag = 'severe';
      anomalies.push({
        id: `${runId}-anom-${uid()}`,
        runId,
        recordId: record.id,
        level: 'severe',
        type: 'physical_limit',
        description: `时间 ${record.timestamp}s 再生制动力 ${regenForce.toFixed(1)}N 超出上限 ${params.maxBrakeForce}N`,
        evidence: `F_regen=${regenForce.toFixed(1)}N, max=${params.maxBrakeForce}N`,
        resolution: '',
      });
    }

    if (record.vehicleSpeed >= params.maxVehicleSpeed) {
      anomalyFlag = anomalyFlag === 'severe' ? 'severe' : 'warning';
      anomalies.push({
        id: `${runId}-anom-${uid()}`,
        runId,
        recordId: record.id,
        level: 'warning',
        type: 'boundary',
        description: `时间 ${record.timestamp}s 车速 ${record.vehicleSpeed}km/h 达到设计极限 ${params.maxVehicleSpeed}km/h`,
        evidence: `speed=${record.vehicleSpeed}, max=${params.maxVehicleSpeed}`,
        resolution: '',
      });
    }

    if (record.brakePressure < 0 || record.batteryCurrent > 0) {
      anomalyFlag = 'severe';
      anomalies.push({
        id: `${runId}-anom-${uid()}`,
        runId,
        recordId: record.id,
        level: 'severe',
        type: 'physical_limit',
        description: `时间 ${record.timestamp}s 制动压力为负(${record.brakePressure}MPa)或电池电流为正(${record.batteryCurrent}A)，物理不合理`,
        evidence: `brakePressure=${record.brakePressure}, batteryCurrent=${record.batteryCurrent}`,
        resolution: '',
      });
    }

    results.push({
      id: `${runId}-res-${uid()}`,
      runId,
      timestamp: record.timestamp,
      regenBrakeForce: Math.round(regenForce * 100) / 100,
      energyRecoveryRate: Math.round(recoveryRate * 1000) / 1000,
      totalEnergyRecovered: Math.round(totalEnergy * 100) / 100,
      anomalyFlag,
    });
  }

  return { results, anomalies };
}

export function detectConflicts(
  records: SensorRecord[],
  notes: FieldNote[],
  runId: string
): ConflictRecord[] {
  const conflicts: ConflictRecord[] = [];

  for (const note of notes) {
    const relevantRecords = records.filter(
      (r) => r.timestamp >= note.startTime && r.timestamp <= note.endTime
    );

    if (note.content.includes('无制动') || note.content.includes('松开踏板')) {
      const brakingRecords = relevantRecords.filter(
        (r) => r.brakePressure !== null && r.brakePressure > 0.5
      );

      if (brakingRecords.length > 0) {
        for (const br of brakingRecords) {
          conflicts.push({
            id: `${runId}-conf-${uid()}`,
            runId,
            noteId: note.id,
            recordId: br.id,
            sensorEvidence: `时间 ${br.timestamp}s: 传感器记录制动压力=${br.brakePressure}MPa`,
            noteEvidence: `现场备注(${note.startTime}-${note.endTime}s): ${note.content}`,
            suggestedAction: '备注声称无制动，但传感器记录有制动压力。建议：1)使用传感器值 2)使用备注值(排除该段) 3)标记为待确认 4)排除',
            userDecision: '',
            decisionReason: '',
            decisionTime: null,
          });
        }
      }
    }

    if (note.content.includes('湿滑') || note.content.includes('偏差')) {
      const allInNote = relevantRecords.filter((r) => r.status === 'normal');
      for (const r of allInNote) {
        if (r.vehicleSpeed !== null && r.vehicleSpeed > 50) {
          conflicts.push({
            id: `${runId}-conf-${uid()}`,
            runId,
            noteId: note.id,
            recordId: r.id,
            sensorEvidence: `时间 ${r.timestamp}s: 传感器记录车速=${r.vehicleSpeed}km/h`,
            noteEvidence: `现场备注: ${note.content}`,
            suggestedAction: '环境条件可能影响测量精度。建议：1)使用传感器值(加备注) 2)标记为待确认 3)降权处理',
            userDecision: '',
            decisionReason: '',
            decisionTime: null,
          });
        }
      }
    }
  }

  return conflicts;
}
