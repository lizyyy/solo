import { v4 as uuidv4 } from 'uuid';
import {
  BoothApplication,
  LicenseAttachment,
  VenueCalendar,
  ReconciliationRecord,
  Discrepancy,
  ReviewAction,
  DeductionItem
} from './types';

class DataStore {
  private boothApplications: Map<string, BoothApplication> = new Map();
  private licenseAttachments: Map<string, LicenseAttachment> = new Map();
  private venueCalendars: Map<string, VenueCalendar> = new Map();
  private reconciliationRecords: Map<string, ReconciliationRecord> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    const sampleApp1: BoothApplication = {
      id: uuidv4(),
      applicationNo: 'APP-2026-001',
      merchantName: '星光美食有限公司',
      contactPerson: '张三',
      contactPhone: '13800138001',
      boothType: '餐饮类',
      boothLocation: 'A区-01号',
      startDate: '2026-06-01',
      endDate: '2026-06-07',
      boothFee: 3500,
      depositAmount: 2000,
      status: 'APPROVED',
      appliedAt: '2026-05-15T10:00:00Z'
    };

    const sampleApp2: BoothApplication = {
      id: uuidv4(),
      applicationNo: 'APP-2026-002',
      merchantName: '潮流饰品店',
      contactPerson: '李四',
      contactPhone: '13800138002',
      boothType: '零售类',
      boothLocation: 'B区-03号',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      boothFee: 1500,
      depositAmount: 1000,
      status: 'APPROVED',
      appliedAt: '2026-05-16T14:30:00Z'
    };

    const sampleApp3: BoothApplication = {
      id: uuidv4(),
      applicationNo: 'APP-2026-003',
      merchantName: '创意手作工坊',
      contactPerson: '王五',
      contactPhone: '13800138003',
      boothType: '手工类',
      boothLocation: 'A区-01号',
      startDate: '2026-06-05',
      endDate: '2026-06-07',
      boothFee: 1800,
      depositAmount: 1000,
      status: 'APPROVED',
      appliedAt: '2026-05-17T09:15:00Z'
    };

    this.boothApplications.set(sampleApp1.id, sampleApp1);
    this.boothApplications.set(sampleApp2.id, sampleApp2);
    this.boothApplications.set(sampleApp3.id, sampleApp3);

    const license1: LicenseAttachment = {
      id: uuidv4(),
      applicationId: sampleApp1.id,
      licenseType: 'BUSINESS_LICENSE' as any,
      licenseNo: 'BJ-2026-001234',
      issueDate: '2026-01-01',
      expiryDate: '2026-05-20',
      fileName: '营业执照_星光美食.pdf',
      uploadTime: '2026-05-15T10:30:00Z',
      isVerified: true
    };

    const license2: LicenseAttachment = {
      id: uuidv4(),
      applicationId: sampleApp1.id,
      licenseType: 'FIRE_SAFETY' as any,
      licenseNo: 'XF-2026-005678',
      issueDate: '2026-02-01',
      expiryDate: '2027-01-31',
      fileName: '消防合格证_星光美食.pdf',
      uploadTime: '2026-05-15T11:00:00Z',
      isVerified: true
    };

    const license3: LicenseAttachment = {
      id: uuidv4(),
      applicationId: sampleApp2.id,
      licenseType: 'BUSINESS_LICENSE' as any,
      licenseNo: 'SH-2026-009999',
      issueDate: '2025-06-01',
      expiryDate: '2026-12-31',
      fileName: '营业执照_潮流饰品.pdf',
      uploadTime: '2026-05-16T15:00:00Z',
      isVerified: true
    };

    this.licenseAttachments.set(license1.id, license1);
    this.licenseAttachments.set(license2.id, license2);
    this.licenseAttachments.set(license3.id, license3);

    const dates = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06', '2026-06-07'];
    const locations = ['A区-01号', 'A区-01号', 'B区-03号'];

    dates.forEach(date => {
      const cal1: VenueCalendar = {
        id: uuidv4(),
        date,
        boothLocation: 'A区-01号',
        isAvailable: date >= '2026-06-05',
        bookedApplicationId: date < '2026-06-05' ? sampleApp1.id : undefined,
        bookedMerchantName: date < '2026-06-05' ? sampleApp1.merchantName : undefined
      };
      this.venueCalendars.set(cal1.id, cal1);

      const cal2: VenueCalendar = {
        id: uuidv4(),
        date,
        boothLocation: 'A区-01号',
        isAvailable: date <= '2026-06-04',
        bookedApplicationId: date > '2026-06-04' ? sampleApp3.id : undefined,
        bookedMerchantName: date > '2026-06-04' ? sampleApp3.merchantName : undefined
      };
      this.venueCalendars.set(cal2.id, cal2);

      const cal3: VenueCalendar = {
        id: uuidv4(),
        date,
        boothLocation: 'B区-03号',
        isAvailable: date > '2026-06-03',
        bookedApplicationId: date <= '2026-06-03' ? sampleApp2.id : undefined,
        bookedMerchantName: date <= '2026-06-03' ? sampleApp2.merchantName : undefined
      };
      this.venueCalendars.set(cal3.id, cal3);
    });
  }

  addBoothApplication(app: BoothApplication): void {
    this.boothApplications.set(app.id, app);
  }

  getBoothApplication(id: string): BoothApplication | undefined {
    return this.boothApplications.get(id);
  }

  getAllBoothApplications(): BoothApplication[] {
    return Array.from(this.boothApplications.values());
  }

  getBoothApplicationsByNo(applicationNo: string): BoothApplication | undefined {
    return this.getAllBoothApplications().find(a => a.applicationNo === applicationNo);
  }

  addLicenseAttachment(license: LicenseAttachment): void {
    this.licenseAttachments.set(license.id, license);
  }

  getLicenseAttachmentsByApplicationId(applicationId: string): LicenseAttachment[] {
    return Array.from(this.licenseAttachments.values()).filter(l => l.applicationId === applicationId);
  }

  getAllLicenseAttachments(): LicenseAttachment[] {
    return Array.from(this.licenseAttachments.values());
  }

  addVenueCalendar(calendar: VenueCalendar): void {
    this.venueCalendars.set(calendar.id, calendar);
  }

  getVenueCalendarByLocationAndDate(location: string, date: string): VenueCalendar | undefined {
    return Array.from(this.venueCalendars.values()).find(c => c.boothLocation === location && c.date === date);
  }

  getVenueCalendarByDateRange(location: string, startDate: string, endDate: string): VenueCalendar[] {
    return Array.from(this.venueCalendars.values()).filter(
      c => c.boothLocation === location && c.date >= startDate && c.date <= endDate
    );
  }

  getAllVenueCalendars(): VenueCalendar[] {
    return Array.from(this.venueCalendars.values());
  }

  addReconciliationRecord(record: ReconciliationRecord): void {
    this.reconciliationRecords.set(record.id, record);
  }

  getReconciliationRecord(id: string): ReconciliationRecord | undefined {
    return this.reconciliationRecords.get(id);
  }

  getReconciliationByApplicationId(applicationId: string): ReconciliationRecord | undefined {
    return Array.from(this.reconciliationRecords.values()).find(r => r.applicationId === applicationId);
  }

  getAllReconciliationRecords(): ReconciliationRecord[] {
    return Array.from(this.reconciliationRecords.values());
  }

  updateReconciliationRecord(id: string, updates: Partial<ReconciliationRecord>): ReconciliationRecord | undefined {
    const record = this.reconciliationRecords.get(id);
    if (record) {
      const updated = { ...record, ...updates, updatedAt: new Date().toISOString() };
      this.reconciliationRecords.set(id, updated);
      return updated;
    }
    return undefined;
  }

  clearAll(): void {
    this.boothApplications.clear();
    this.licenseAttachments.clear();
    this.venueCalendars.clear();
    this.reconciliationRecords.clear();
  }
}

export const dataStore = new DataStore();
