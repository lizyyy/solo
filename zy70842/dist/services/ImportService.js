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
exports.importService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const uuid_1 = require("uuid");
const types_1 = require("../models/types");
const store_1 = require("../models/store");
class ImportService {
    constructor() {
        this.uploadDir = path.join(process.cwd(), 'uploads');
        this.ensureUploadDirectory();
    }
    ensureUploadDirectory() {
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }
    async importBoothApplications(filePath) {
        const result = {
            success: true,
            importedCount: 0,
            failedCount: 0,
            errors: [],
            warnings: []
        };
        try {
            const records = await this.parseCSV(filePath);
            for (const record of records) {
                try {
                    const app = {
                        id: (0, uuid_1.v4)(),
                        applicationNo: record['申请编号'] || record['applicationNo'] || '',
                        merchantName: record['商户名称'] || record['merchantName'] || '',
                        contactPerson: record['联系人'] || record['contactPerson'] || '',
                        contactPhone: record['联系电话'] || record['contactPhone'] || '',
                        boothType: record['摊位类型'] || record['boothType'] || '',
                        boothLocation: record['摊位位置'] || record['boothLocation'] || '',
                        startDate: this.normalizeDate(record['开始日期'] || record['startDate'] || ''),
                        endDate: this.normalizeDate(record['结束日期'] || record['endDate'] || ''),
                        boothFee: parseFloat(record['摊位费用'] || record['boothFee'] || '0'),
                        depositAmount: parseFloat(record['押金金额'] || record['depositAmount'] || '0'),
                        status: record['状态'] || record['status'] || 'PENDING',
                        appliedAt: new Date().toISOString(),
                        notes: record['备注'] || record['notes']
                    };
                    if (!app.applicationNo || !app.merchantName) {
                        result.warnings.push(`跳过记录: 申请编号或商户名称为空`);
                        continue;
                    }
                    store_1.dataStore.addBoothApplication(app);
                    result.importedCount++;
                }
                catch (err) {
                    result.failedCount++;
                    result.errors.push(`解析记录失败: ${err.message}`);
                }
            }
        }
        catch (err) {
            result.success = false;
            result.errors.push(`导入失败: ${err.message}`);
        }
        return result;
    }
    async importLicenseAttachments(filePath) {
        const result = {
            success: true,
            importedCount: 0,
            failedCount: 0,
            errors: [],
            warnings: []
        };
        try {
            const records = await this.parseCSV(filePath);
            for (const record of records) {
                try {
                    const applicationNo = record['申请编号'] || record['applicationNo'] || '';
                    const application = store_1.dataStore.getBoothApplicationsByNo(applicationNo);
                    if (!application) {
                        result.warnings.push(`未找到申请编号 ${applicationNo} 对应的摊位申请`);
                        continue;
                    }
                    const licenseTypeMap = {
                        '营业执照': types_1.LicenseType.BUSINESS_LICENSE,
                        '消防合格证': types_1.LicenseType.FIRE_SAFETY,
                        '食品经营许可证': types_1.LicenseType.FOOD_SAFETY,
                        '其他': types_1.LicenseType.OTHER
                    };
                    const license = {
                        id: (0, uuid_1.v4)(),
                        applicationId: application.id,
                        licenseType: licenseTypeMap[record['证照类型'] || record['licenseType'] || ''] || types_1.LicenseType.OTHER,
                        licenseNo: record['证照编号'] || record['licenseNo'] || '',
                        issueDate: this.normalizeDate(record['签发日期'] || record['issueDate'] || ''),
                        expiryDate: this.normalizeDate(record['到期日期'] || record['expiryDate'] || ''),
                        fileName: record['文件名'] || record['fileName'] || '',
                        uploadTime: new Date().toISOString(),
                        isVerified: (record['已验证'] || record['isVerified'] || 'false').toLowerCase() === 'true',
                        notes: record['备注'] || record['notes']
                    };
                    store_1.dataStore.addLicenseAttachment(license);
                    result.importedCount++;
                }
                catch (err) {
                    result.failedCount++;
                    result.errors.push(`解析记录失败: ${err.message}`);
                }
            }
        }
        catch (err) {
            result.success = false;
            result.errors.push(`导入失败: ${err.message}`);
        }
        return result;
    }
    async importVenueCalendar(filePath) {
        const result = {
            success: true,
            importedCount: 0,
            failedCount: 0,
            errors: [],
            warnings: []
        };
        try {
            const records = await this.parseCSV(filePath);
            for (const record of records) {
                try {
                    const cal = {
                        id: (0, uuid_1.v4)(),
                        date: this.normalizeDate(record['日期'] || record['date'] || ''),
                        boothLocation: record['摊位位置'] || record['boothLocation'] || '',
                        isAvailable: (record['是否可用'] || record['isAvailable'] || 'true').toLowerCase() === 'true',
                        bookedApplicationId: record['已预订申请编号'] || record['bookedApplicationId'],
                        bookedMerchantName: record['已预订商户名称'] || record['bookedMerchantName'],
                        notes: record['备注'] || record['notes']
                    };
                    if (!cal.date || !cal.boothLocation) {
                        result.warnings.push(`跳过记录: 日期或摊位位置为空`);
                        continue;
                    }
                    store_1.dataStore.addVenueCalendar(cal);
                    result.importedCount++;
                }
                catch (err) {
                    result.failedCount++;
                    result.errors.push(`解析记录失败: ${err.message}`);
                }
            }
        }
        catch (err) {
            result.success = false;
            result.errors.push(`导入失败: ${err.message}`);
        }
        return result;
    }
    parseCSV(filePath) {
        return new Promise((resolve, reject) => {
            const results = [];
            fs.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => results.push(data))
                .on('end', () => resolve(results))
                .on('error', reject);
        });
    }
    normalizeDate(dateStr) {
        if (!dateStr)
            return '';
        const formats = [
            /^\d{4}-\d{2}-\d{2}$/,
            /^\d{4}\/\d{2}\/\d{2}$/,
            /^\d{4}年\d{1,2}月\d{1,2}日$/
        ];
        for (const format of formats) {
            if (format.test(dateStr)) {
                const parts = dateStr.split(/[-/年月日]/).filter(Boolean);
                if (parts.length >= 3) {
                    const year = parts[0];
                    const month = parts[1].padStart(2, '0');
                    const day = parts[2].padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
            }
        }
        return dateStr;
    }
}
exports.importService = new ImportService();
