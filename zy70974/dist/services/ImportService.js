"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportService = void 0;
const fs = __importStar(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const uuid_1 = require("uuid");
const types_1 = require("../types");
class ImportService {
    parseDate(dateStr) {
        if (!dateStr)
            return new Date();
        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    parseActivityType(type) {
        if (!type)
            return types_1.ActivityType.PARENT_CHILD;
        const lower = type.toLowerCase();
        if (lower.includes('parent') || lower.includes('child') || lower.includes('亲子')) {
            return types_1.ActivityType.PARENT_CHILD;
        }
        if (lower.includes('elder') || lower.includes('老人') || lower.includes('老年')) {
            return types_1.ActivityType.ELDERLY;
        }
        return types_1.ActivityType.PARENT_CHILD;
    }
    parseRegistrationStatus(status) {
        if (!status)
            return types_1.RegistrationStatus.CONFIRMED;
        const lower = status.toLowerCase();
        if (lower.includes('cancel') || lower.includes('取消'))
            return types_1.RegistrationStatus.CANCELLED;
        if (lower.includes('wait') || lower.includes('候补'))
            return types_1.RegistrationStatus.WAITLIST;
        if (lower.includes('pending') || lower.includes('待确认'))
            return types_1.RegistrationStatus.PENDING;
        if (lower.includes('promote') || lower.includes('递补'))
            return types_1.RegistrationStatus.PROMOTED;
        return types_1.RegistrationStatus.CONFIRMED;
    }
    parseCheckInStatus(status) {
        if (!status)
            return types_1.CheckInStatus.CHECKED_IN;
        const lower = status.toLowerCase();
        if (lower.includes('no') || lower.includes('未签') || lower.includes('缺席'))
            return types_1.CheckInStatus.NOT_CHECKED_IN;
        if (lower.includes('absent') || lower.includes('缺勤'))
            return types_1.CheckInStatus.ABSENT;
        return types_1.CheckInStatus.CHECKED_IN;
    }
    async parseRegistrationCSV(filePath) {
        return new Promise((resolve) => {
            const results = [];
            const errors = [];
            const warnings = [];
            let rowCount = 0;
            fs.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => {
                rowCount++;
                try {
                    const name = data['姓名'] || data['name'] || data['Name'];
                    const phone = data['电话'] || data['手机'] || data['phone'] || data['Phone'];
                    if (!name || !phone) {
                        warnings.push(`第 ${rowCount} 行: 缺少姓名或电话，已跳过`);
                        return;
                    }
                    const record = {
                        id: (0, uuid_1.v4)(),
                        activityType: this.parseActivityType(data['活动类型'] || data['activityType']),
                        activityName: data['活动名称'] || data['activityName'] || data['Activity'] || '未命名活动',
                        name: name.trim(),
                        phone: phone.trim(),
                        idCard: data['身份证'] || data['idCard'] || data['ID'],
                        registrationTime: this.parseDate(data['报名时间'] || data['registrationTime'] || data['Date']),
                        status: this.parseRegistrationStatus(data['状态'] || data['status']),
                        source: types_1.DataSource.REGISTRATION_CSV,
                        originalData: { ...data, rowNumber: rowCount },
                    };
                    results.push(record);
                }
                catch (e) {
                    errors.push(`第 ${rowCount} 行解析失败: ${e.message}`);
                }
            })
                .on('end', () => {
                resolve({
                    success: errors.length === 0,
                    data: results,
                    errors,
                    warnings,
                    totalCount: rowCount,
                    validCount: results.length,
                });
            })
                .on('error', (err) => {
                resolve({
                    success: false,
                    data: results,
                    errors: [`文件读取失败: ${err.message}`],
                    warnings,
                    totalCount: rowCount,
                    validCount: results.length,
                });
            });
        });
    }
    async parseWaitlistJSON(filePath) {
        return new Promise((resolve) => {
            try {
                const rawData = fs.readFileSync(filePath, 'utf-8');
                const jsonData = JSON.parse(rawData);
                const results = [];
                const errors = [];
                const warnings = [];
                let rowCount = 0;
                const waitlistArray = Array.isArray(jsonData) ? jsonData : (jsonData.waitlist || jsonData.data || []);
                for (const item of waitlistArray) {
                    rowCount++;
                    try {
                        const name = item.name || item.姓名;
                        const phone = item.phone || item.电话 || item.手机;
                        if (!name || !phone) {
                            warnings.push(`候补记录 ${rowCount}: 缺少姓名或电话，已跳过`);
                            continue;
                        }
                        const record = {
                            id: (0, uuid_1.v4)(),
                            activityType: this.parseActivityType(item.activityType || item.活动类型),
                            activityName: item.activityName || item.活动名称 || '未命名活动',
                            name: name.trim(),
                            phone: phone.trim(),
                            idCard: item.idCard || item.身份证,
                            waitlistPosition: item.position || item.排名 || rowCount,
                            addedTime: this.parseDate(item.addedTime || item.添加时间),
                            promotedToMain: item.promoted || item.已递补 || false,
                            promotedTime: item.promotedTime ? this.parseDate(item.promotedTime) : undefined,
                            source: types_1.DataSource.WAITLIST_JSON,
                            originalData: { ...item, index: rowCount },
                        };
                        results.push(record);
                    }
                    catch (e) {
                        errors.push(`候补记录 ${rowCount} 解析失败: ${e.message}`);
                    }
                }
                resolve({
                    success: errors.length === 0,
                    data: results,
                    errors,
                    warnings,
                    totalCount: rowCount,
                    validCount: results.length,
                });
            }
            catch (err) {
                resolve({
                    success: false,
                    data: [],
                    errors: [`JSON文件解析失败: ${err.message}`],
                    warnings: [],
                    totalCount: 0,
                    validCount: 0,
                });
            }
        });
    }
    async parseCheckInCSV(filePath) {
        return new Promise((resolve) => {
            const results = [];
            const errors = [];
            const warnings = [];
            let rowCount = 0;
            fs.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => {
                rowCount++;
                try {
                    const name = data['姓名'] || data['name'] || data['Name'];
                    const phone = data['电话'] || data['手机'] || data['phone'] || data['Phone'];
                    if (!name || !phone) {
                        warnings.push(`签到表第 ${rowCount} 行: 缺少姓名或电话，已跳过`);
                        return;
                    }
                    const record = {
                        id: (0, uuid_1.v4)(),
                        activityType: this.parseActivityType(data['活动类型'] || data['activityType']),
                        activityName: data['活动名称'] || data['activityName'] || data['Activity'] || '未命名活动',
                        name: name.trim(),
                        phone: phone.trim(),
                        checkInTime: this.parseDate(data['签到时间'] || data['checkInTime'] || data['Time']),
                        status: this.parseCheckInStatus(data['状态'] || data['status']),
                        source: types_1.DataSource.CHECKIN_CSV,
                        originalData: { ...data, rowNumber: rowCount },
                    };
                    results.push(record);
                }
                catch (e) {
                    errors.push(`签到表第 ${rowCount} 行解析失败: ${e.message}`);
                }
            })
                .on('end', () => {
                resolve({
                    success: errors.length === 0,
                    data: results,
                    errors,
                    warnings,
                    totalCount: rowCount,
                    validCount: results.length,
                });
            })
                .on('error', (err) => {
                resolve({
                    success: false,
                    data: results,
                    errors: [`签到表文件读取失败: ${err.message}`],
                    warnings,
                    totalCount: rowCount,
                    validCount: results.length,
                });
            });
        });
    }
    async parseBlacklistJSON(filePath) {
        return new Promise((resolve) => {
            try {
                const rawData = fs.readFileSync(filePath, 'utf-8');
                const jsonData = JSON.parse(rawData);
                const results = [];
                const errors = [];
                const warnings = [];
                let rowCount = 0;
                const blacklistArray = Array.isArray(jsonData) ? jsonData : (jsonData.blacklist || jsonData.data || []);
                for (const item of blacklistArray) {
                    rowCount++;
                    try {
                        const name = item.name || item.姓名;
                        const phone = item.phone || item.电话 || item.手机;
                        if (!name || !phone) {
                            warnings.push(`黑名单记录 ${rowCount}: 缺少姓名或电话，已跳过`);
                            continue;
                        }
                        const record = {
                            id: (0, uuid_1.v4)(),
                            name: name.trim(),
                            phone: phone.trim(),
                            idCard: item.idCard || item.身份证,
                            reason: item.reason || item.原因 || '未说明原因',
                            addedTime: this.parseDate(item.addedTime || item.添加时间),
                            source: types_1.DataSource.BLACKLIST_JSON,
                        };
                        results.push(record);
                    }
                    catch (e) {
                        errors.push(`黑名单记录 ${rowCount} 解析失败: ${e.message}`);
                    }
                }
                resolve({
                    success: errors.length === 0,
                    data: results,
                    errors,
                    warnings,
                    totalCount: rowCount,
                    validCount: results.length,
                });
            }
            catch (err) {
                resolve({
                    success: false,
                    data: [],
                    errors: [`黑名单JSON文件解析失败: ${err.message}`],
                    warnings: [],
                    totalCount: 0,
                    validCount: 0,
                });
            }
        });
    }
}
exports.ImportService = ImportService;
