import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import {
  MeterReading,
  TenantContract,
  TemperatureZone,
  MultiplierChange,
  BillingRecord,
  Anomaly,
  CalculationDetail,
  ReviewStatus,
  BillingSummary,
} from '../types';
import { dataStore } from '../store/dataStore';

export class BillingCalculatorService {
  private SPIKE_THRESHOLD = 2.0;

  async calculateBillingForPeriod(periodStart: Date, periodEnd: Date): Promise<BillingRecord[]> {
    dataStore.deleteBillingRecordsByPeriod(periodStart, periodEnd);

    const contracts = dataStore.getAllContracts().filter(c =>
      c.status === 'active' &&
      c.startDate <= periodEnd && c.endDate >= periodStart
    );

    const records: BillingRecord[] = [];

    for (const contract of contracts) {
      for (const zoneId of contract.zoneIds) {
        const zone = dataStore.getTemperatureZone(zoneId);
        if (!zone) continue;

        const record = await this.calculateTenantZoneBilling(
          contract,
          zone,
          periodStart,
          periodEnd
        );
        records.push(record);
      }
    }

    return records;
  }

  private async calculateTenantZoneBilling(
    contract: TenantContract,
    zone: TemperatureZone,
    periodStart: Date,
    periodEnd: Date
  ): Promise<BillingRecord> {
    const calculationDetails: CalculationDetail[] = [];
    const anomalies: Anomaly[] = [];

    const readings = dataStore.getMeterReadingsByZone(zone.id, periodStart, periodEnd);

    let baseConsumption = 0;
    let overtimeConsumption = 0;

    readings.forEach(reading => {
      const isOvertime = this.isOvertimeForReading(reading, contract);
      if (isOvertime) {
        overtimeConsumption += reading.consumption;
      } else {
        baseConsumption += reading.consumption;
      }
    });

    calculationDetails.push({
      step: '1',
      description: '基础用电量计算',
      formula: 'Σ(正常时段用电量)',
      inputs: { readingsCount: readings.filter(r => !this.isOvertimeForReading(r, contract)).length },
      result: baseConsumption,
    });

    calculationDetails.push({
      step: '2',
      description: '加班时段用电量计算',
      formula: 'Σ(加班时段用电量)',
      inputs: { overtimeReasons: contract.overtimeHours.map(h => `${moment(h.date).format('YYYY-MM-DD')}: ${h.hours}小时 - ${h.reason}`) },
      result: overtimeConsumption,
    });

    const totalConsumption = baseConsumption + overtimeConsumption;

    calculationDetails.push({
      step: '3',
      description: '总用电量',
      formula: '基础用电量 + 加班时段用电量',
      inputs: { baseConsumption, overtimeConsumption },
      result: totalConsumption,
    });

    const multiplierChanges = dataStore.getMultiplierChangesByZone(zone.id).filter(
      c => c.effectiveDate >= periodStart && c.effectiveDate <= periodEnd
    );

    if (multiplierChanges.length > 0) {
      multiplierChanges.forEach(change => {
        const anomaly: Anomaly = {
          id: uuidv4(),
          type: 'multiplier_change',
          severity: 'medium',
          timestamp: change.effectiveDate,
          description: `倍率变更: ${change.oldMultiplier} → ${change.newMultiplier}`,
          explanation: `原因: ${change.reason}`,
          affectedAmount: 0,
          resolved: false,
        };
        anomalies.push(anomaly);
      });
    }

    const appliedMultiplier = contract.baseMultiplier * zone.multiplier;

    calculationDetails.push({
      step: '4',
      description: '应用倍率计算',
      formula: '合同基础倍率 × 温区倍率',
      inputs: { contractMultiplier: contract.baseMultiplier, zoneMultiplier: zone.multiplier },
      result: appliedMultiplier,
    });

    let finalConsumption = totalConsumption * appliedMultiplier;

    calculationDetails.push({
      step: '5',
      description: '最终计费电量',
      formula: '总用电量 × 应用倍率',
      inputs: { totalConsumption, appliedMultiplier },
      result: finalConsumption,
    });

    let vacancyAdjustment = 0;
    if (zone.isVacant && zone.vacantStartDate) {
      const vacancyOverlap = this.calculateVacancyOverlap(periodStart, periodEnd, zone.vacantStartDate);
      if (vacancyOverlap > 0) {
        const vacancyRatio = vacancyOverlap / (periodEnd.getTime() - periodStart.getTime());
        vacancyAdjustment = -finalConsumption * vacancyRatio * 0.5;

        calculationDetails.push({
          step: '6',
          description: '空置期减免',
          formula: '计费电量 × 空置天数占比 × 50%',
          inputs: { vacancyDays: vacancyOverlap / (1000 * 60 * 60 * 24), vacancyRatio: vacancyRatio.toFixed(2) },
          result: vacancyAdjustment,
        });

        anomalies.push({
          id: uuidv4(),
          type: 'vacant_period',
          severity: 'low',
          timestamp: zone.vacantStartDate,
          description: `温区空置: ${moment(zone.vacantStartDate).format('YYYY-MM-DD')}起`,
          explanation: `空置期用电量享受50%减免`,
          affectedAmount: Math.abs(vacancyAdjustment * contract.ratePerKwh),
          resolved: false,
        });
      }
    }

    const adjustedConsumption = finalConsumption + vacancyAdjustment;

    const electricityCost = adjustedConsumption * contract.ratePerKwh;

    calculationDetails.push({
      step: '7',
      description: '电费计算',
      formula: '(计费电量 + 空置调整) × 电价',
      inputs: { adjustedConsumption, ratePerKwh: contract.ratePerKwh },
      result: electricityCost,
    });

    const overtimeSurcharge = overtimeConsumption * (contract.overtimeMultiplier - 1) * contract.ratePerKwh;

    if (overtimeSurcharge > 0) {
      calculationDetails.push({
        step: '8',
        description: '加班附加费',
        formula: '加班用电量 × (加班倍率 - 1) × 电价',
        inputs: { overtimeConsumption, overtimeMultiplier: contract.overtimeMultiplier, ratePerKwh: contract.ratePerKwh },
        result: overtimeSurcharge,
      });

      anomalies.push({
        id: uuidv4(),
        type: 'overtime',
        severity: 'low',
        timestamp: periodStart,
        description: `加班用电: ${overtimeConsumption.toFixed(2)} kWh`,
        explanation: `加班时段共 ${contract.overtimeHours.length} 次，总 ${contract.overtimeHours.reduce((sum, h) => sum + h.hours, 0)} 小时`,
        affectedAmount: overtimeSurcharge,
        resolved: false,
      });
    }

    const spikeAnomalies = this.detectConsumptionSpikes(readings, contract.ratePerKwh);
    anomalies.push(...spikeAnomalies);

    const baseRent = contract.baseRent;

    calculationDetails.push({
      step: '9',
      description: '基础租金',
      formula: '合同约定基础租金',
      inputs: { contractBaseRent: contract.baseRent },
      result: baseRent,
    });

    const totalAmount = electricityCost + overtimeSurcharge + baseRent;

    calculationDetails.push({
      step: '10',
      description: '总费用',
      formula: '电费 + 加班附加费 + 基础租金',
      inputs: { electricityCost, overtimeSurcharge, baseRent },
      result: totalAmount,
    });

    const record = dataStore.addBillingRecord({
      periodStart,
      periodEnd,
      tenantId: contract.tenantId,
      tenantName: contract.tenantName,
      zoneId: zone.id,
      zoneName: zone.name,
      baseConsumption,
      overtimeConsumption,
      totalConsumption,
      baseMultiplier: contract.baseMultiplier,
      overtimeMultiplier: contract.overtimeMultiplier,
      appliedMultiplier,
      ratePerKwh: contract.ratePerKwh,
      electricityCost,
      baseRent,
      overtimeSurcharge,
      totalAmount,
      anomalies,
      reviewStatus: ReviewStatus.PENDING,
      reviewNotes: [],
      calculationDetails,
    });

    return record;
  }

  private isOvertimeForReading(reading: MeterReading, contract: TenantContract): boolean {
    const readingDate = moment(reading.timestamp).format('YYYY-MM-DD');
    return contract.overtimeHours.some(h =>
      moment(h.date).format('YYYY-MM-DD') === readingDate
    );
  }

  private calculateVacancyOverlap(periodStart: Date, periodEnd: Date, vacantStart: Date): number {
    const overlapStart = Math.max(periodStart.getTime(), vacantStart.getTime());
    const overlapEnd = Math.min(periodEnd.getTime(), periodEnd.getTime());
    return Math.max(0, overlapEnd - overlapStart);
  }

  private detectConsumptionSpikes(readings: MeterReading[], ratePerKwh: number): Anomaly[] {
    const anomalies: Anomaly[] = [];
    if (readings.length < 2) return anomalies;

    const avgConsumption = readings.reduce((sum, r) => sum + r.consumption, 0) / readings.length;
    const threshold = avgConsumption * this.SPIKE_THRESHOLD;

    readings.forEach(reading => {
      if (reading.consumption > threshold) {
        anomalies.push({
          id: uuidv4(),
          type: 'spike',
          severity: 'high',
          timestamp: reading.timestamp,
          description: `用电尖峰: ${reading.consumption.toFixed(2)} kWh`,
          explanation: `超出平均值 ${((reading.consumption / avgConsumption * 100 - 100)).toFixed(0)}%`,
          affectedAmount: (reading.consumption - avgConsumption) * ratePerKwh,
          resolved: false,
        });
      }
    });

    return anomalies;
  }

  async recalculateRecord(recordId: string): Promise<BillingRecord | undefined> {
    const existingRecord = dataStore.getBillingRecord(recordId);
    if (!existingRecord) return undefined;

    const contract = dataStore.getTenantContract(existingRecord.tenantId);
    const zone = dataStore.getTemperatureZone(existingRecord.zoneId);

    if (!contract || !zone) return undefined;

    const newRecord = await this.calculateTenantZoneBilling(
      contract,
      zone,
      existingRecord.periodStart,
      existingRecord.periodEnd
    );

    dataStore.updateBillingRecord(recordId, {
      ...newRecord,
      reviewNotes: existingRecord.reviewNotes,
      reviewStatus: existingRecord.reviewStatus,
    });

    return dataStore.getBillingRecord(recordId);
  }

  getBillingSummary(periodStart: Date, periodEnd: Date): BillingSummary {
    return dataStore.getBillingSummary(periodStart, periodEnd);
  }

  getBillingRecords(periodStart: Date, periodEnd: Date, tenantId?: string, status?: ReviewStatus): BillingRecord[] {
    let records = dataStore.getBillingRecordsByPeriod(periodStart, periodEnd);
    if (tenantId) {
      records = records.filter(r => r.tenantId === tenantId);
    }
    if (status) {
      records = records.filter(r => r.reviewStatus === status);
    }
    return records;
  }
}

export const billingCalculatorService = new BillingCalculatorService();
