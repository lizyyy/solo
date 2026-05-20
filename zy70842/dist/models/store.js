"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataStore = void 0;
const uuid_1 = require("uuid");
const types_1 = require("./types");
class DataStore {
    constructor() {
        this.boothApplications = new Map();
        this.licenseAttachments = new Map();
        this.venueCalendars = new Map();
        this.reconciliationRecords = new Map();
        this.depositDeductions = new Map();
        this.initializeSampleData();
    }
    initializeSampleData() {
        const sampleApp1 = {
            id: (0, uuid_1.v4)(),
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
        const sampleApp2 = {
            id: (0, uuid_1.v4)(),
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
        const sampleApp3 = {
            id: (0, uuid_1.v4)(),
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
        const license1 = {
            id: (0, uuid_1.v4)(),
            applicationId: sampleApp1.id,
            licenseType: 'BUSINESS_LICENSE',
            licenseNo: 'BJ-2026-001234',
            issueDate: '2026-01-01',
            expiryDate: '2026-05-20',
            fileName: '营业执照_星光美食.pdf',
            uploadTime: '2026-05-15T10:30:00Z',
            isVerified: true
        };
        const license2 = {
            id: (0, uuid_1.v4)(),
            applicationId: sampleApp1.id,
            licenseType: 'FIRE_SAFETY',
            licenseNo: 'XF-2026-005678',
            issueDate: '2026-02-01',
            expiryDate: '2027-01-31',
            fileName: '消防合格证_星光美食.pdf',
            uploadTime: '2026-05-15T11:00:00Z',
            isVerified: true
        };
        const license3 = {
            id: (0, uuid_1.v4)(),
            applicationId: sampleApp2.id,
            licenseType: 'BUSINESS_LICENSE',
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
            const cal1 = {
                id: (0, uuid_1.v4)(),
                date,
                boothLocation: 'A区-01号',
                isAvailable: date >= '2026-06-05',
                bookedApplicationId: date < '2026-06-05' ? sampleApp1.id : undefined,
                bookedMerchantName: date < '2026-06-05' ? sampleApp1.merchantName : undefined
            };
            this.venueCalendars.set(cal1.id, cal1);
            const cal2 = {
                id: (0, uuid_1.v4)(),
                date,
                boothLocation: 'A区-01号',
                isAvailable: date <= '2026-06-04',
                bookedApplicationId: date > '2026-06-04' ? sampleApp3.id : undefined,
                bookedMerchantName: date > '2026-06-04' ? sampleApp3.merchantName : undefined
            };
            this.venueCalendars.set(cal2.id, cal2);
            const cal3 = {
                id: (0, uuid_1.v4)(),
                date,
                boothLocation: 'B区-03号',
                isAvailable: date > '2026-06-03',
                bookedApplicationId: date <= '2026-06-03' ? sampleApp2.id : undefined,
                bookedMerchantName: date <= '2026-06-03' ? sampleApp2.merchantName : undefined
            };
            this.venueCalendars.set(cal3.id, cal3);
        });
        const depositDeduction1 = {
            id: (0, uuid_1.v4)(),
            applicationId: sampleApp1.id,
            deductionType: types_1.DepositDeductionType.FACILITY_DAMAGE,
            amount: 300,
            description: '摊位桌面有划痕，需要修复',
            reportedBy: '现场管理员-王芳',
            reportedAt: '2026-06-08T09:30:00Z',
            isVerified: true,
            evidence: '照片_20260608_桌面划痕.jpg',
            notes: '经与商户确认，同意从押金中扣除修复费'
        };
        const depositDeduction2 = {
            id: (0, uuid_1.v4)(),
            applicationId: sampleApp1.id,
            deductionType: types_1.DepositDeductionType.CLEANING_FEE,
            amount: 150,
            description: '摊位遗留大量油污，需深度清洁',
            reportedBy: '保洁主管-李明',
            reportedAt: '2026-06-08T14:00:00Z',
            isVerified: true,
            notes: '清洁费用从押金中扣除'
        };
        const depositDeduction3 = {
            id: (0, uuid_1.v4)(),
            applicationId: sampleApp2.id,
            deductionType: types_1.DepositDeductionType.OVERTIME_PENALTY,
            amount: 200,
            description: '活动结束后超时1小时未撤场',
            reportedBy: '现场管理员-王芳',
            reportedAt: '2026-06-04T18:30:00Z',
            isVerified: false,
            notes: '商户称有特殊情况，待核实'
        };
        this.depositDeductions.set(depositDeduction1.id, depositDeduction1);
        this.depositDeductions.set(depositDeduction2.id, depositDeduction2);
        this.depositDeductions.set(depositDeduction3.id, depositDeduction3);
    }
    addBoothApplication(app) {
        this.boothApplications.set(app.id, app);
    }
    getBoothApplication(id) {
        return this.boothApplications.get(id);
    }
    getAllBoothApplications() {
        return Array.from(this.boothApplications.values());
    }
    getBoothApplicationsByNo(applicationNo) {
        return this.getAllBoothApplications().find(a => a.applicationNo === applicationNo);
    }
    addLicenseAttachment(license) {
        this.licenseAttachments.set(license.id, license);
    }
    getLicenseAttachmentsByApplicationId(applicationId) {
        return Array.from(this.licenseAttachments.values()).filter(l => l.applicationId === applicationId);
    }
    getAllLicenseAttachments() {
        return Array.from(this.licenseAttachments.values());
    }
    addVenueCalendar(calendar) {
        this.venueCalendars.set(calendar.id, calendar);
    }
    getVenueCalendarByLocationAndDate(location, date) {
        return Array.from(this.venueCalendars.values()).find(c => c.boothLocation === location && c.date === date);
    }
    getVenueCalendarByDateRange(location, startDate, endDate) {
        return Array.from(this.venueCalendars.values()).filter(c => c.boothLocation === location && c.date >= startDate && c.date <= endDate);
    }
    getAllVenueCalendars() {
        return Array.from(this.venueCalendars.values());
    }
    addReconciliationRecord(record) {
        this.reconciliationRecords.set(record.id, record);
    }
    getReconciliationRecord(id) {
        return this.reconciliationRecords.get(id);
    }
    getReconciliationByApplicationId(applicationId) {
        return Array.from(this.reconciliationRecords.values()).find(r => r.applicationId === applicationId);
    }
    getAllReconciliationRecords() {
        return Array.from(this.reconciliationRecords.values());
    }
    updateReconciliationRecord(id, updates) {
        const record = this.reconciliationRecords.get(id);
        if (record) {
            const updated = { ...record, ...updates, updatedAt: new Date().toISOString() };
            this.reconciliationRecords.set(id, updated);
            return updated;
        }
        return undefined;
    }
    addDepositDeduction(deduction) {
        this.depositDeductions.set(deduction.id, deduction);
    }
    getDepositDeductionsByApplicationId(applicationId) {
        return Array.from(this.depositDeductions.values()).filter(d => d.applicationId === applicationId);
    }
    getAllDepositDeductions() {
        return Array.from(this.depositDeductions.values());
    }
    clearAll() {
        this.boothApplications.clear();
        this.licenseAttachments.clear();
        this.venueCalendars.clear();
        this.reconciliationRecords.clear();
        this.depositDeductions.clear();
    }
}
exports.dataStore = new DataStore();
