import fs from 'fs';
import path from 'path';
import { Appointment, Batch, UsageRecord, ManualCorrection, ImportResult, ImportError } from '../models';

interface DataStoreSnapshot {
  appointments: Appointment[];
  batches: Batch[];
  usageRecords: UsageRecord[];
  manualCorrections: ManualCorrection[];
  importFingerprints: {
    appointments: Set<string>;
    batches: Set<string>;
    usage: Set<string>;
  };
}

export class DataStore {
  private dataPath: string;
  private appointments: Map<string, Appointment> = new Map();
  private batches: Map<string, Batch> = new Map();
  private usageRecords: Map<string, UsageRecord> = new Map();
  private manualCorrections: Map<string, ManualCorrection> = new Map();
  
  private appointmentFingerprints: Set<string> = new Set();
  private batchFingerprints: Set<string> = new Set();
  private usageFingerprints: Set<string> = new Set();

  constructor(dataPath?: string) {
    this.dataPath = dataPath || path.join(process.cwd(), 'data');
    this.ensureDataDirectory();
    this.loadData();
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  private loadData(): void {
    const files = [
      { file: 'appointments.json', key: 'appointments' as const },
      { file: 'batches.json', key: 'batches' as const },
      { file: 'usage.json', key: 'usage' as const },
      { file: 'corrections.json', key: 'corrections' as const },
      { file: 'fingerprints.json', key: 'fingerprints' as const },
    ];

    files.forEach(({ file, key }) => {
      const filePath = path.join(this.dataPath, file);
      if (fs.existsSync(filePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          this.populateData(key, data);
        } catch (e) {
          console.warn(`警告: 无法读取文件 ${file}`);
        }
      }
    });
  }

  private populateData(key: string, data: any): void {
    if (key === 'appointments' && Array.isArray(data)) {
      data.forEach((item: Appointment) => this.appointments.set(item.appointmentId, item));
    } else if (key === 'batches' && Array.isArray(data)) {
      data.forEach((item: Batch) => this.batches.set(item.batchNumber, item));
    } else if (key === 'usage' && Array.isArray(data)) {
      data.forEach((item: UsageRecord) => {
        const fingerprint = this.generateUsageFingerprint(item);
        this.usageRecords.set(fingerprint, item);
      });
    } else if (key === 'corrections' && Array.isArray(data)) {
      data.forEach((item: ManualCorrection) => this.manualCorrections.set(item.id, item));
    } else if (key === 'fingerprints') {
      if (data.appointments) this.appointmentFingerprints = new Set(data.appointments);
      if (data.batches) this.batchFingerprints = new Set(data.batches);
      if (data.usage) this.usageFingerprints = new Set(data.usage);
    }
  }

  private saveData(): void {
    fs.writeFileSync(
      path.join(this.dataPath, 'appointments.json'),
      JSON.stringify(Array.from(this.appointments.values()), null, 2),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(this.dataPath, 'batches.json'),
      JSON.stringify(Array.from(this.batches.values()), null, 2),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(this.dataPath, 'usage.json'),
      JSON.stringify(Array.from(this.usageRecords.values()), null, 2),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(this.dataPath, 'corrections.json'),
      JSON.stringify(Array.from(this.manualCorrections.values()), null, 2),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(this.dataPath, 'fingerprints.json'),
      JSON.stringify({
        appointments: Array.from(this.appointmentFingerprints),
        batches: Array.from(this.batchFingerprints),
        usage: Array.from(this.usageFingerprints),
      }, null, 2),
      'utf-8'
    );
  }

  private generateAppointmentFingerprint(item: Appointment): string {
    return `${item.appointmentId}-${item.scheduledDate}-${item.patientName}`;
  }

  private generateBatchFingerprint(item: Batch): string {
    return `${item.batchNumber}-${item.contrastAgent}`;
  }

  private generateUsageFingerprint(item: UsageRecord): string {
    return `${item.appointmentId}-${item.batchNumber}-${item.openedAt}-${item.isRefund}`;
  }

  importAppointments(items: Appointment[]): ImportResult {
    const errors: ImportError[] = [];
    let imported = 0;
    let skipped = 0;
    const warnings: string[] = [];

    items.forEach((item, index) => {
      const row = index + 2;
      
      if (!item.appointmentId || item.appointmentId.trim() === '') {
        errors.push({
          row,
          field: 'appointmentId',
          value: item.appointmentId,
          message: '缺少预约号'
        });
        return;
      }

      const fingerprint = this.generateAppointmentFingerprint(item);
      
      if (this.appointmentFingerprints.has(fingerprint)) {
        skipped++;
        return;
      }

      this.appointments.set(item.appointmentId, item);
      this.appointmentFingerprints.add(fingerprint);
      imported++;
    });

    this.saveData();

    return {
      success: errors.length === 0,
      imported,
      skipped,
      errors,
      warnings
    };
  }

  importBatches(items: Batch[]): ImportResult {
    const errors: ImportError[] = [];
    let imported = 0;
    let skipped = 0;
    const warnings: string[] = [];

    items.forEach((item, index) => {
      const row = index + 2;
      
      if (!item.batchNumber || item.batchNumber.trim() === '') {
        errors.push({
          row,
          field: 'batchNumber',
          value: item.batchNumber,
          message: '缺少药剂批号'
        });
        return;
      }

      const fingerprint = this.generateBatchFingerprint(item);
      
      if (this.batchFingerprints.has(fingerprint)) {
        const existing = this.batches.get(item.batchNumber);
        if (existing && 
            (existing.totalVolume !== item.totalVolume || 
             existing.contrastAgent !== item.contrastAgent)) {
          errors.push({
            row,
            field: 'batchNumber',
            value: item.batchNumber,
            message: `重复药剂批号，但批次信息不一致`
          });
          return;
        }
        skipped++;
        return;
      }

      this.batches.set(item.batchNumber, item);
      this.batchFingerprints.add(fingerprint);
      imported++;
    });

    this.saveData();

    return {
      success: errors.length === 0,
      imported,
      skipped,
      errors,
      warnings
    };
  }

  importUsageRecords(items: UsageRecord[]): ImportResult {
    const errors: ImportError[] = [];
    let imported = 0;
    let skipped = 0;
    const warnings: string[] = [];

    const appointmentUsageMap = new Map<string, { hasNormal: boolean; hasRefund: boolean }>();

    items.forEach(item => {
      if (!item.appointmentId) return;
      if (!appointmentUsageMap.has(item.appointmentId)) {
        appointmentUsageMap.set(item.appointmentId, { hasNormal: false, hasRefund: false });
      }
      const status = appointmentUsageMap.get(item.appointmentId)!;
      if (item.isRefund) status.hasRefund = true;
      else status.hasNormal = true;
    });

    items.forEach((item, index) => {
      const row = index + 2;
      
      if (!item.appointmentId || item.appointmentId.trim() === '') {
        errors.push({
          row,
          field: 'appointmentId',
          value: item.appointmentId,
          message: '缺少预约号'
        });
        return;
      }

      const usageStatus = appointmentUsageMap.get(item.appointmentId);
      if (usageStatus && usageStatus.hasNormal && usageStatus.hasRefund) {
        errors.push({
          row,
          field: 'isRefund',
          value: String(item.isRefund),
          message: `预约号 ${item.appointmentId} 同时存在用药和退费记录`
        });
        return;
      }

      if (!this.appointments.has(item.appointmentId)) {
        errors.push({
          row,
          field: 'appointmentId',
          value: item.appointmentId,
          message: `预约号 ${item.appointmentId} 不存在于预约清单中`
        });
        return;
      }

      if (!item.batchNumber || item.batchNumber.trim() === '') {
        errors.push({
          row,
          field: 'batchNumber',
          value: item.batchNumber,
          message: '缺少药剂批号'
        });
        return;
      }

      if (!this.batches.has(item.batchNumber)) {
        errors.push({
          row,
          field: 'batchNumber',
          value: item.batchNumber,
          message: `药剂批号 ${item.batchNumber} 不存在于批次库中`
        });
        return;
      }

      const fingerprint = this.generateUsageFingerprint(item);
      
      if (this.usageFingerprints.has(fingerprint)) {
        skipped++;
        return;
      }

      this.usageRecords.set(fingerprint, item);
      this.usageFingerprints.add(fingerprint);
      imported++;
    });

    this.saveData();

    return {
      success: errors.length === 0,
      imported,
      skipped,
      errors,
      warnings
    };
  }

  addManualCorrection(correction: Omit<ManualCorrection, 'id' | 'createdAt'>): ManualCorrection {
    const id = `CORR-${Date.now()}`;
    const fullCorrection: ManualCorrection = {
      ...correction,
      id,
      createdAt: new Date().toISOString()
    };
    this.manualCorrections.set(id, fullCorrection);
    this.saveData();
    return fullCorrection;
  }

  getAppointmentsByDate(date: string): Appointment[] {
    return Array.from(this.appointments.values()).filter(a => a.scheduledDate === date);
  }

  getUsageByDate(date: string): UsageRecord[] {
    return Array.from(this.usageRecords.values()).filter(u => {
      const usageDate = u.openedAt.split('T')[0];
      return usageDate === date;
    });
  }

  getBatches(): Batch[] {
    return Array.from(this.batches.values());
  }

  getBatch(batchNumber: string): Batch | undefined {
    return this.batches.get(batchNumber);
  }

  getUsageByAppointment(appointmentId: string): UsageRecord[] {
    return Array.from(this.usageRecords.values()).filter(u => u.appointmentId === appointmentId);
  }

  getManualCorrections(date?: string): ManualCorrection[] {
    const corrections = Array.from(this.manualCorrections.values());
    if (date) {
      return corrections.filter(c => c.date === date);
    }
    return corrections;
  }

  getAppointment(appointmentId: string): Appointment | undefined {
    return this.appointments.get(appointmentId);
  }

  clear(): void {
    this.appointments.clear();
    this.batches.clear();
    this.usageRecords.clear();
    this.manualCorrections.clear();
    this.appointmentFingerprints.clear();
    this.batchFingerprints.clear();
    this.usageFingerprints.clear();
    this.saveData();
  }
}
