import { UserRole, SampleRecord, TemperatureRecord, WasteRecord } from '../types';

export class DataMaskingService {
  private maskPhone(phone: string | undefined): string | undefined {
    if (!phone) return undefined;
    if (phone.length < 7) return '*'.repeat(phone.length);
    return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
  }

  private shouldMaskSensitive(role: UserRole): boolean {
    return role === UserRole.STORE_MANAGER;
  }

  private canSeeAllData(role: UserRole): boolean {
    return role === UserRole.ADMIN || role === UserRole.QUALITY_CONTROL;
  }

  async maskSampleRecords(records: SampleRecord[], userRole: UserRole): Promise<SampleRecord[]> {
    if (this.canSeeAllData(userRole)) {
      return records;
    }

    return records.map(record => ({
      ...record,
      samplePersonPhone: this.maskPhone(record.samplePersonPhone)
    }));
  }

  async maskTemperatureRecords(records: TemperatureRecord[], userRole: UserRole): Promise<TemperatureRecord[]> {
    if (this.canSeeAllData(userRole)) {
      return records;
    }

    return records.map(record => ({
      ...record,
      recordPersonPhone: this.maskPhone(record.recordPersonPhone)
    }));
  }

  async maskWasteRecords(records: WasteRecord[], userRole: UserRole): Promise<WasteRecord[]> {
    if (this.canSeeAllData(userRole)) {
      return records;
    }

    return records.map(record => ({
      ...record,
      wastePersonPhone: this.maskPhone(record.wastePersonPhone)
    }));
  }

  async maskRuleLogDetails(details: string, userRole: UserRole): Promise<string> {
    if (this.canSeeAllData(userRole)) {
      return details;
    }

    return details.replace(/1[3-9]\d{9}/g, (match) => this.maskPhone(match) || match);
  }

  filterRecordsByStore<T extends { storeId: string }>(records: T[], storeId: string, userRole: UserRole): T[] {
    if (this.canSeeAllData(userRole)) {
      return records;
    }

    return records.filter(r => r.storeId === storeId);
  }
}
