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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileParserService = void 0;
const fs = __importStar(require("fs"));
const csvParser = require("csv-parser");
class FileParserService {
    async parseAddItemsCSV(filePath) {
        return new Promise((resolve, reject) => {
            const results = [];
            fs.createReadStream(filePath)
                .pipe(csvParser())
                .on('data', (data) => {
                results.push(this.mapToAddItemRecord(data));
            })
                .on('end', () => {
                resolve(results);
            })
                .on('error', reject);
        });
    }
    mapToAddItemRecord(data) {
        return {
            id: data.id || data.ID || data.recordId || '',
            customerName: data.customerName || data.客户姓名 || data.name || '',
            idCard: data.idCard || data.身份证号 || data.idNumber || '',
            phone: data.phone || data.手机号 || data.telephone || '',
            packageCode: data.packageCode || data.套餐编码 || data.pkgCode || '',
            itemCode: data.itemCode || data.项目编码 || data.code || '',
            itemName: data.itemName || data.项目名称 || data.name || '',
            itemPrice: parseFloat(data.itemPrice || data.项目价格 || data.price || '0'),
            quantity: parseInt(data.quantity || data.数量 || data.qty || '1', 10),
            couponCode: data.couponCode || data.优惠券编码 || data.coupon || undefined,
            couponAmount: data.couponAmount ? parseFloat(data.couponAmount) :
                data.优惠券金额 ? parseFloat(data.优惠券金额) : undefined,
            unitCode: data.unitCode || data.单位编码 || data.companyCode || undefined,
            operator: data.operator || data.操作员 || data.operatedBy || '',
            operationTime: data.operationTime || data.操作时间 || data.time || new Date().toISOString(),
            remark: data.remark || data.备注 || data.note || undefined,
            isRefund: (data.isRefund || data.是否退项 || data.refund) === 'true' ||
                (data.isRefund || data.是否退项 || data.refund) === true,
            originalRecordId: data.originalRecordId || data.原记录ID || undefined,
        };
    }
    parsePackagesJSON(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        return Array.isArray(data) ? data : data.packages || data.data || [];
    }
    parseUnitAgreementJSON(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        return Array.isArray(data) ? data : data.units || data.agreements || data.data || [];
    }
    parseCouponsJSON(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        return Array.isArray(data) ? data : data.coupons || data.data || [];
    }
    async parseAllFiles(addItemsPath, packagesPath, unitAgreementPath, couponsPath) {
        const parsedData = {
            addItems: [],
            packages: [],
            unitAgreements: [],
            coupons: [],
        };
        if (addItemsPath) {
            parsedData.addItems = await this.parseAddItemsCSV(addItemsPath);
        }
        if (packagesPath) {
            parsedData.packages = this.parsePackagesJSON(packagesPath);
        }
        if (unitAgreementPath) {
            parsedData.unitAgreements = this.parseUnitAgreementJSON(unitAgreementPath);
        }
        if (couponsPath) {
            parsedData.coupons = this.parseCouponsJSON(couponsPath);
        }
        return parsedData;
    }
}
exports.FileParserService = FileParserService;
