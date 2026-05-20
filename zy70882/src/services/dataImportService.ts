import csv from 'csv-parser';
import { Readable } from 'stream';
import { MeterReading, TenantContract, TemperatureZone, MultiplierChange } from '../types';
import { dataStore } from '../store/dataStore';
import moment from 'moment';

export class DataImportService {
  async parseMeterCSV(fileBuffer: Buffer, sourceFileName: string): Promise<{ readings: Omit<MeterReading, 'id'>[]; errors: string[] }> {
    const results: any[] = [];
    const errors: string[] = [];
    const readings: Omit<MeterReading, 'id'>[] = [];

    return new Promise((resolve) => {
      const stream = Readable.from(fileBuffer.toString());
      stream
        .pipe(csv({ headers: true }))
        .on('data', (data: any) => results.push(data))
        .on('end', () => {
          results.forEach((row, index) => {
            try {
              const reading = this.parseMeterRow(row, sourceFileName);
              readings.push(reading);
            } catch (e: any) {
              errors.push(`行 ${index + 2}: ${e.message}`);
            }
          });
          resolve({ readings, errors });
        });
    });
  }

  private parseMeterRow(row: any, sourceFileName: string): Omit<MeterReading, 'id'> {
    const requiredFields = ['meterId', 'zoneId', 'timestamp', 'reading', 'consumption'];
    for (const field of requiredFields) {
      if (!row[field]) {
        throw new Error(`缺少必填字段: ${field}`);
      }
    }

    const timestamp = moment(row.timestamp, ['YYYY-MM-DD HH:mm:ss', 'YYYY/MM/DD HH:mm', 'YYYY-MM-DD']).toDate();
    if (!moment(timestamp).isValid()) {
      throw new Error(`时间格式无效: ${row.timestamp}`);
    }

    const reading = parseFloat(row.reading);
    const consumption = parseFloat(row.consumption);
    if (isNaN(reading) || isNaN(consumption)) {
      throw new Error('读数或用电量必须是数字');
    }

    return {
      meterId: row.meterId.trim(),
      zoneId: row.zoneId.trim(),
      timestamp,
      reading,
      consumption,
      isPeak: row.isPeak === 'true' || row.isPeak === '1' || this.isPeakHour(timestamp),
      sourceFile: sourceFileName,
    };
  }

  private isPeakHour(timestamp: Date): boolean {
    const hour = timestamp.getHours();
    return hour >= 8 && hour < 22;
  }

  async importMeterData(fileBuffer: Buffer, sourceFileName: string): Promise<{ imported: number; errors: string[] }> {
    const { readings, errors } = await this.parseMeterCSV(fileBuffer, sourceFileName);
    if (errors.length > 0) {
      return { imported: 0, errors };
    }
    dataStore.addMeterReadings(readings);
    return { imported: readings.length, errors: [] };
  }

  async parseContractJSON(fileBuffer: Buffer): Promise<TenantContract> {
    const data = JSON.parse(fileBuffer.toString());
    return this.validateContractData(data);
  }

  private validateContractData(data: any): TenantContract {
    const requiredFields = ['tenantId', 'tenantName', 'zoneIds', 'startDate', 'endDate', 'baseMultiplier', 'ratePerKwh', 'baseRent'];
    for (const field of requiredFields) {
      if (data[field] === undefined) {
        throw new Error(`合同缺少必填字段: ${field}`);
      }
    }

    const startDate = moment(data.startDate, ['YYYY-MM-DD', 'YYYY/MM/DD']).toDate();
    const endDate = moment(data.endDate, ['YYYY-MM-DD', 'YYYY/MM/DD']).toDate();

    if (!moment(startDate).isValid() || !moment(endDate).isValid()) {
      throw new Error('合同日期格式无效');
    }

    if (startDate >= endDate) {
      throw new Error('合同开始日期必须早于结束日期');
    }

    const overtimeHours = (data.overtimeHours || []).map((h: any) => ({
      date: moment(h.date, ['YYYY-MM-DD']).toDate(),
      hours: parseFloat(h.hours) || 0,
      reason: h.reason || '未说明',
    }));

    return {
      id: '',
      tenantId: data.tenantId.trim(),
      tenantName: data.tenantName.trim(),
      zoneIds: Array.isArray(data.zoneIds) ? data.zoneIds.map((z: string) => z.trim()) : [data.zoneIds.trim()],
      startDate,
      endDate,
      baseMultiplier: parseFloat(data.baseMultiplier) || 1,
      overtimeMultiplier: parseFloat(data.overtimeMultiplier) || 1.5,
      ratePerKwh: parseFloat(data.ratePerKwh) || 1,
      baseRent: parseFloat(data.baseRent) || 0,
      overtimeHours,
      status: data.status || 'active',
    };
  }

  async importContract(fileBuffer: Buffer): Promise<TenantContract> {
    const contract = await this.parseContractJSON(fileBuffer);
    const { id, ...contractWithoutId } = contract;
    return dataStore.addTenantContract(contractWithoutId);
  }

  async importZones(zonesData: any[]): Promise<TemperatureZone[]> {
    const zones: TemperatureZone[] = [];
    for (const zoneData of zonesData) {
      const zone = await this.validateZoneData(zoneData);
      const { id, ...zoneWithoutId } = zone;
      zones.push(dataStore.addTemperatureZone(zoneWithoutId));
    }
    return zones;
  }

  private async validateZoneData(data: any): Promise<TemperatureZone> {
    const requiredFields = ['name', 'type', 'targetTemp', 'multiplier', 'isVacant'];
    for (const field of requiredFields) {
      if (data[field] === undefined) {
        throw new Error(`温区配置缺少必填字段: ${field}`);
      }
    }

    const validTypes = ['frozen', 'chilled', 'ambient'];
    if (!validTypes.includes(data.type)) {
      throw new Error(`温区类型无效，必须是: ${validTypes.join(', ')}`);
    }

    return {
      id: '',
      name: data.name.trim(),
      type: data.type,
      targetTemp: parseFloat(data.targetTemp),
      multiplier: parseFloat(data.multiplier) || 1,
      tenantId: data.tenantId?.trim(),
      isVacant: data.isVacant === true || data.isVacant === 'true',
      vacantStartDate: data.vacantStartDate ? moment(data.vacantStartDate).toDate() : undefined,
    };
  }

  async importMultiplierChanges(changesData: any[]): Promise<MultiplierChange[]> {
    const changes: MultiplierChange[] = [];
    for (const changeData of changesData) {
      const change = this.validateMultiplierChange(changeData);
      const { id, ...changeWithoutId } = change;
      changes.push(dataStore.addMultiplierChange(changeWithoutId));
    }
    return changes;
  }

  private validateMultiplierChange(data: any): MultiplierChange {
    const requiredFields = ['zoneId', 'effectiveDate', 'oldMultiplier', 'newMultiplier', 'reason'];
    for (const field of requiredFields) {
      if (data[field] === undefined) {
        throw new Error(`倍率变更记录缺少必填字段: ${field}`);
      }
    }

    return {
      id: '',
      zoneId: data.zoneId.trim(),
      effectiveDate: moment(data.effectiveDate).toDate(),
      oldMultiplier: parseFloat(data.oldMultiplier),
      newMultiplier: parseFloat(data.newMultiplier),
      reason: data.reason.trim(),
    };
  }

  async getImportSummary(periodStart: Date, periodEnd: Date) {
    const readings = dataStore.getMeterReadingsByPeriod(periodStart, periodEnd);
    const contracts = dataStore.getAllContracts();
    const zones = dataStore.getAllZones();

    const zoneStats = new Map<string, number>();
    readings.forEach(r => {
      zoneStats.set(r.zoneId, (zoneStats.get(r.zoneId) || 0) + r.consumption);
    });

    return {
      meterReadings: {
        count: readings.length,
        totalConsumption: readings.reduce((sum, r) => sum + r.consumption, 0),
        byZone: Object.fromEntries(zoneStats.entries()),
      },
      contracts: {
        count: contracts.length,
        activeCount: contracts.filter(c => c.status === 'active').length,
      },
      zones: {
        count: zones.length,
        vacantCount: zones.filter(z => z.isVacant).length,
      },
    };
  }
}

export const dataImportService = new DataImportService();
