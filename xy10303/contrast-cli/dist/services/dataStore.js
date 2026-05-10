"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataStore = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class DataStore {
    constructor(dataPath) {
        this.appointments = new Map();
        this.batches = new Map();
        this.usageRecords = new Map();
        this.manualCorrections = new Map();
        this.appointmentFingerprints = new Set();
        this.batchFingerprints = new Set();
        this.usageFingerprints = new Set();
        this.dataPath = dataPath || path_1.default.join(process.cwd(), 'data');
        this.ensureDataDirectory();
        this.loadData();
    }
    ensureDataDirectory() {
        if (!fs_1.default.existsSync(this.dataPath)) {
            fs_1.default.mkdirSync(this.dataPath, { recursive: true });
        }
    }
    loadData() {
        const files = [
            { file: 'appointments.json', key: 'appointments' },
            { file: 'batches.json', key: 'batches' },
            { file: 'usage.json', key: 'usage' },
            { file: 'corrections.json', key: 'corrections' },
            { file: 'fingerprints.json', key: 'fingerprints' },
        ];
        files.forEach(({ file, key }) => {
            const filePath = path_1.default.join(this.dataPath, file);
            if (fs_1.default.existsSync(filePath)) {
                try {
                    const data = JSON.parse(fs_1.default.readFileSync(filePath, 'utf-8'));
                    this.populateData(key, data);
                }
                catch (e) {
                    console.warn(`警告: 无法读取文件 ${file}`);
                }
            }
        });
    }
    populateData(key, data) {
        if (key === 'appointments' && Array.isArray(data)) {
            data.forEach((item) => this.appointments.set(item.appointmentId, item));
        }
        else if (key === 'batches' && Array.isArray(data)) {
            data.forEach((item) => this.batches.set(item.batchNumber, item));
        }
        else if (key === 'usage' && Array.isArray(data)) {
            data.forEach((item) => {
                const fingerprint = this.generateUsageFingerprint(item);
                this.usageRecords.set(fingerprint, item);
            });
        }
        else if (key === 'corrections' && Array.isArray(data)) {
            data.forEach((item) => this.manualCorrections.set(item.id, item));
        }
        else if (key === 'fingerprints') {
            if (data.appointments)
                this.appointmentFingerprints = new Set(data.appointments);
            if (data.batches)
                this.batchFingerprints = new Set(data.batches);
            if (data.usage)
                this.usageFingerprints = new Set(data.usage);
        }
    }
    saveData() {
        fs_1.default.writeFileSync(path_1.default.join(this.dataPath, 'appointments.json'), JSON.stringify(Array.from(this.appointments.values()), null, 2), 'utf-8');
        fs_1.default.writeFileSync(path_1.default.join(this.dataPath, 'batches.json'), JSON.stringify(Array.from(this.batches.values()), null, 2), 'utf-8');
        fs_1.default.writeFileSync(path_1.default.join(this.dataPath, 'usage.json'), JSON.stringify(Array.from(this.usageRecords.values()), null, 2), 'utf-8');
        fs_1.default.writeFileSync(path_1.default.join(this.dataPath, 'corrections.json'), JSON.stringify(Array.from(this.manualCorrections.values()), null, 2), 'utf-8');
        fs_1.default.writeFileSync(path_1.default.join(this.dataPath, 'fingerprints.json'), JSON.stringify({
            appointments: Array.from(this.appointmentFingerprints),
            batches: Array.from(this.batchFingerprints),
            usage: Array.from(this.usageFingerprints),
        }, null, 2), 'utf-8');
    }
    generateAppointmentFingerprint(item) {
        return `${item.appointmentId}-${item.scheduledDate}-${item.patientName}`;
    }
    generateBatchFingerprint(item) {
        return `${item.batchNumber}-${item.contrastAgent}`;
    }
    generateUsageFingerprint(item) {
        return `${item.appointmentId}-${item.batchNumber}-${item.openedAt}-${item.isRefund}`;
    }
    importAppointments(items) {
        const errors = [];
        let imported = 0;
        let skipped = 0;
        const warnings = [];
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
    importBatches(items) {
        const errors = [];
        let imported = 0;
        let skipped = 0;
        const warnings = [];
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
    importUsageRecords(items) {
        const errors = [];
        let imported = 0;
        let skipped = 0;
        const warnings = [];
        const appointmentUsageMap = new Map();
        items.forEach(item => {
            if (!item.appointmentId)
                return;
            if (!appointmentUsageMap.has(item.appointmentId)) {
                appointmentUsageMap.set(item.appointmentId, { hasNormal: false, hasRefund: false });
            }
            const status = appointmentUsageMap.get(item.appointmentId);
            if (item.isRefund)
                status.hasRefund = true;
            else
                status.hasNormal = true;
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
    addManualCorrection(correction) {
        const id = `CORR-${Date.now()}`;
        const fullCorrection = {
            ...correction,
            id,
            createdAt: new Date().toISOString()
        };
        this.manualCorrections.set(id, fullCorrection);
        this.saveData();
        return fullCorrection;
    }
    getAppointmentsByDate(date) {
        return Array.from(this.appointments.values()).filter(a => a.scheduledDate === date);
    }
    getUsageByDate(date) {
        return Array.from(this.usageRecords.values()).filter(u => {
            const usageDate = u.openedAt.split('T')[0];
            return usageDate === date;
        });
    }
    getBatches() {
        return Array.from(this.batches.values());
    }
    getBatch(batchNumber) {
        return this.batches.get(batchNumber);
    }
    getUsageByAppointment(appointmentId) {
        return Array.from(this.usageRecords.values()).filter(u => u.appointmentId === appointmentId);
    }
    getManualCorrections(date) {
        const corrections = Array.from(this.manualCorrections.values());
        if (date) {
            return corrections.filter(c => c.date === date);
        }
        return corrections;
    }
    getAppointment(appointmentId) {
        return this.appointments.get(appointmentId);
    }
    clear() {
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
exports.DataStore = DataStore;
