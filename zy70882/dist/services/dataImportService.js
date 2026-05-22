"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataImportService = exports.DataImportService = void 0;
const dataStore_1 = require("../store/dataStore");
const moment_1 = __importDefault(require("moment"));
class DataImportService {
    async parseMeterCSV(fileBuffer, sourceFileName) {
        const errors = [];
        const readings = [];
        return new Promise((resolve) => {
            let content = fileBuffer.toString('utf8');
            content = content.replace(/^\uFEFF/, '');
            const lines = content.split(/\r?\n/).filter(line => line.trim());
            if (lines.length < 2) {
                resolve({ readings: [], errors: ['CSV文件为空或格式错误'] });
                return;
            }
            const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
            for (let i = 1; i < lines.length; i++) {
                try {
                    const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
                    if (values.length !== headers.length) {
                        errors.push(`行 ${i + 1}: 列数不匹配`);
                        continue;
                    }
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = values[index];
                    });
                    const reading = this.parseMeterRow(row, sourceFileName);
                    readings.push(reading);
                }
                catch (e) {
                    errors.push(`行 ${i + 1}: ${e.message}`);
                }
            }
            resolve({ readings, errors });
        });
    }
    parseMeterRow(row, sourceFileName) {
        const requiredFields = ['meterId', 'zoneId', 'timestamp', 'reading', 'consumption'];
        for (const field of requiredFields) {
            if (!row[field]) {
                throw new Error(`缺少必填字段: ${field}`);
            }
        }
        const timestamp = (0, moment_1.default)(row.timestamp, ['YYYY-MM-DD HH:mm:ss', 'YYYY/MM/DD HH:mm', 'YYYY-MM-DD']).toDate();
        if (!(0, moment_1.default)(timestamp).isValid()) {
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
    isPeakHour(timestamp) {
        const hour = timestamp.getHours();
        return hour >= 8 && hour < 22;
    }
    async importMeterData(fileBuffer, sourceFileName) {
        const { readings, errors } = await this.parseMeterCSV(fileBuffer, sourceFileName);
        if (errors.length > 0) {
            return { imported: 0, errors };
        }
        dataStore_1.dataStore.addMeterReadings(readings);
        return { imported: readings.length, errors: [] };
    }
    async parseContractJSON(fileBuffer) {
        const data = JSON.parse(fileBuffer.toString());
        return this.validateContractData(data);
    }
    validateContractData(data) {
        const requiredFields = ['tenantId', 'tenantName', 'zoneIds', 'startDate', 'endDate', 'baseMultiplier', 'ratePerKwh', 'baseRent'];
        for (const field of requiredFields) {
            if (data[field] === undefined) {
                throw new Error(`合同缺少必填字段: ${field}`);
            }
        }
        const startDate = (0, moment_1.default)(data.startDate, ['YYYY-MM-DD', 'YYYY/MM/DD']).toDate();
        const endDate = (0, moment_1.default)(data.endDate, ['YYYY-MM-DD', 'YYYY/MM/DD']).toDate();
        if (!(0, moment_1.default)(startDate).isValid() || !(0, moment_1.default)(endDate).isValid()) {
            throw new Error('合同日期格式无效');
        }
        if (startDate >= endDate) {
            throw new Error('合同开始日期必须早于结束日期');
        }
        const overtimeHours = (data.overtimeHours || []).map((h) => ({
            date: (0, moment_1.default)(h.date, ['YYYY-MM-DD']).toDate(),
            hours: parseFloat(h.hours) || 0,
            reason: h.reason || '未说明',
        }));
        return {
            id: '',
            tenantId: data.tenantId.trim(),
            tenantName: data.tenantName.trim(),
            zoneIds: Array.isArray(data.zoneIds) ? data.zoneIds.map((z) => z.trim()) : [data.zoneIds.trim()],
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
    async importContract(fileBuffer) {
        const contract = await this.parseContractJSON(fileBuffer);
        const { id, ...contractWithoutId } = contract;
        return dataStore_1.dataStore.addTenantContract(contractWithoutId);
    }
    async importZones(zonesData) {
        const zones = [];
        for (const zoneData of zonesData) {
            const zone = this.validateZoneData(zoneData);
            zones.push(dataStore_1.dataStore.addTemperatureZone(zone));
        }
        return zones;
    }
    validateZoneData(data) {
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
        const result = {
            name: data.name.trim(),
            type: data.type,
            targetTemp: parseFloat(data.targetTemp),
            multiplier: parseFloat(data.multiplier) || 1,
            tenantId: data.tenantId?.trim(),
            isVacant: data.isVacant === true || data.isVacant === 'true',
            vacantStartDate: data.vacantStartDate ? (0, moment_1.default)(data.vacantStartDate).toDate() : undefined,
        };
        if (data.id) {
            result.id = data.id.trim();
        }
        return result;
    }
    async importMultiplierChanges(changesData) {
        const changes = [];
        for (const changeData of changesData) {
            const change = this.validateMultiplierChange(changeData);
            const { id, ...changeWithoutId } = change;
            changes.push(dataStore_1.dataStore.addMultiplierChange(changeWithoutId));
        }
        return changes;
    }
    validateMultiplierChange(data) {
        const requiredFields = ['zoneId', 'effectiveDate', 'oldMultiplier', 'newMultiplier', 'reason'];
        for (const field of requiredFields) {
            if (data[field] === undefined) {
                throw new Error(`倍率变更记录缺少必填字段: ${field}`);
            }
        }
        return {
            id: '',
            zoneId: data.zoneId.trim(),
            effectiveDate: (0, moment_1.default)(data.effectiveDate).toDate(),
            oldMultiplier: parseFloat(data.oldMultiplier),
            newMultiplier: parseFloat(data.newMultiplier),
            reason: data.reason.trim(),
        };
    }
    async getImportSummary(periodStart, periodEnd) {
        const readings = dataStore_1.dataStore.getMeterReadingsByPeriod(periodStart, periodEnd);
        const contracts = dataStore_1.dataStore.getAllContracts();
        const zones = dataStore_1.dataStore.getAllZones();
        const zoneStats = new Map();
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
exports.DataImportService = DataImportService;
exports.dataImportService = new DataImportService();
//# sourceMappingURL=dataImportService.js.map