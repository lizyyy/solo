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
exports.ImportService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sync_1 = require("csv-parse/sync");
class ImportService {
    constructor(store) {
        this.store = store;
    }
    async importFiles(filePaths) {
        let imported = 0;
        let skipped = 0;
        const errors = [];
        for (const filePath of filePaths) {
            const result = await this.importFile(filePath);
            imported += result.imported;
            skipped += result.skipped;
            errors.push(...result.errors);
        }
        return {
            success: errors.length === 0,
            imported,
            skipped,
            errors
        };
    }
    async importFile(filePath) {
        let imported = 0;
        let skipped = 0;
        const errors = [];
        try {
            if (!fs.existsSync(filePath)) {
                errors.push({
                    code: 'FILE_NOT_FOUND',
                    message: `文件不存在: ${filePath}`,
                    details: '请检查文件路径是否正确'
                });
                return { success: false, imported: 0, skipped: 0, errors };
            }
            const ext = path.extname(filePath).toLowerCase();
            let records;
            if (ext === '.json') {
                records = this.parseJsonFile(filePath);
            }
            else if (ext === '.csv') {
                records = this.parseCsvFile(filePath);
            }
            else {
                errors.push({
                    code: 'UNSUPPORTED_FORMAT',
                    message: `不支持的文件格式: ${ext}`,
                    details: '仅支持 .json 和 .csv 格式文件'
                });
                return { success: false, imported: 0, skipped: 0, errors };
            }
            for (const record of records) {
                const result = this.processRecord(record);
                if (result.added) {
                    imported++;
                }
                else if (result.skipped) {
                    skipped++;
                }
                if (result.errors) {
                    errors.push(...result.errors);
                }
            }
        }
        catch (error) {
            errors.push({
                code: 'IMPORT_ERROR',
                message: `导入文件时发生错误: ${filePath}`,
                details: error instanceof Error ? error.message : String(error)
            });
        }
        return {
            success: errors.length === 0,
            imported,
            skipped,
            errors
        };
    }
    parseJsonFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
            return data;
        }
        if (data && typeof data === 'object') {
            if ('products' in data || 'purchases' in data || 'sales' in data || 'losses' in data || 'inventories' in data) {
                const allRecords = [];
                if (Array.isArray(data.products))
                    allRecords.push(...data.products.map((p) => ({ ...p, _type: 'product' })));
                if (Array.isArray(data.purchases))
                    allRecords.push(...data.purchases.map((p) => ({ ...p, _type: 'purchase' })));
                if (Array.isArray(data.sales))
                    allRecords.push(...data.sales.map((p) => ({ ...p, _type: 'sale' })));
                if (Array.isArray(data.losses))
                    allRecords.push(...data.losses.map((p) => ({ ...p, _type: 'loss' })));
                if (Array.isArray(data.inventories))
                    allRecords.push(...data.inventories.map((p) => ({ ...p, _type: 'inventory' })));
                return allRecords;
            }
            return [data];
        }
        return [];
    }
    parseCsvFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return (0, sync_1.parse)(content, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });
    }
    processRecord(record) {
        const errors = [];
        let added = false;
        let skipped = false;
        try {
            const recordType = record._type || record.type;
            switch (recordType) {
                case 'product': {
                    const product = this.validateProduct(record);
                    const success = this.store.addProduct(product);
                    if (!success) {
                        skipped = true;
                    }
                    else {
                        added = true;
                    }
                    break;
                }
                case 'purchase': {
                    const purchase = this.validatePurchase(record);
                    const result = this.store.addPurchase(purchase);
                    if (result.errors.length > 0) {
                        errors.push(...result.errors);
                    }
                    else if (result.added) {
                        added = true;
                    }
                    else {
                        skipped = true;
                    }
                    break;
                }
                case 'sale': {
                    const sale = this.validateSale(record);
                    const result = this.store.addSale(sale);
                    if (result.errors.length > 0) {
                        errors.push(...result.errors);
                    }
                    else if (result.added) {
                        added = true;
                    }
                    else {
                        skipped = true;
                    }
                    break;
                }
                case 'loss': {
                    const loss = this.validateLoss(record);
                    const result = this.store.addLoss(loss);
                    if (result.errors.length > 0) {
                        errors.push(...result.errors);
                    }
                    else if (result.added) {
                        added = true;
                    }
                    else {
                        skipped = true;
                    }
                    break;
                }
                case 'inventory': {
                    const inventory = this.validateInventory(record);
                    const result = this.store.addInventory(inventory);
                    if (result.errors.length > 0) {
                        errors.push(...result.errors);
                    }
                    else if (result.added) {
                        added = true;
                    }
                    else {
                        skipped = true;
                    }
                    break;
                }
                default:
                    if (!recordType) {
                        errors.push({
                            code: 'MISSING_TYPE',
                            message: '记录缺少类型标识',
                            details: '请在记录中添加 type 字段或 _type 字段，值为 product、purchase、sale、loss 或 inventory',
                            recordId: record.id
                        });
                    }
                    else {
                        errors.push({
                            code: 'UNKNOWN_TYPE',
                            message: `未知的记录类型: ${recordType}`,
                            details: '支持的类型：product、purchase、sale、loss、inventory',
                            recordId: record.id
                        });
                    }
            }
        }
        catch (error) {
            errors.push({
                code: 'RECORD_ERROR',
                message: '处理记录时发生错误',
                details: error instanceof Error ? error.message : String(error),
                recordId: record.id
            });
        }
        return { added, skipped, errors };
    }
    validateProduct(record) {
        if (!record.code) {
            throw new Error('商品编码(code)不能为空');
        }
        if (!record.name) {
            throw new Error('商品名称(name)不能为空');
        }
        if (!record.unit) {
            throw new Error('商品单位(unit)不能为空');
        }
        if (record.basePrice === undefined || record.basePrice === null) {
            throw new Error('商品基准价格(basePrice)不能为空');
        }
        return {
            code: String(record.code),
            name: String(record.name),
            unit: String(record.unit),
            basePrice: Number(record.basePrice)
        };
    }
    validatePurchase(record) {
        if (!record.id) {
            throw new Error('记录ID(id)不能为空');
        }
        if (!record.productCode) {
            throw new Error('商品编码(productCode)不能为空');
        }
        if (!record.batchId) {
            throw new Error('批次号(batchId)不能为空');
        }
        if (record.quantity === undefined || record.quantity === null) {
            throw new Error('采购数量(quantity)不能为空');
        }
        if (record.unitCost === undefined || record.unitCost === null) {
            throw new Error('采购单价(unitCost)不能为空');
        }
        const now = Date.now();
        return {
            id: String(record.id),
            type: 'purchase',
            timestamp: record.timestamp ? Number(record.timestamp) : now,
            productCode: String(record.productCode),
            batchId: String(record.batchId),
            quantity: Number(record.quantity),
            unitCost: Number(record.unitCost),
            expirationDate: record.expirationDate ? String(record.expirationDate) : undefined,
            supplier: record.supplier ? String(record.supplier) : undefined
        };
    }
    validateSale(record) {
        if (!record.id) {
            throw new Error('记录ID(id)不能为空');
        }
        if (!record.productCode) {
            throw new Error('商品编码(productCode)不能为空');
        }
        if (!record.batchId) {
            throw new Error('批次号(batchId)不能为空');
        }
        if (record.quantity === undefined || record.quantity === null) {
            throw new Error('销售数量(quantity)不能为空');
        }
        if (record.unitPrice === undefined || record.unitPrice === null) {
            throw new Error('销售单价(unitPrice)不能为空');
        }
        const now = Date.now();
        return {
            id: String(record.id),
            type: 'sale',
            timestamp: record.timestamp ? Number(record.timestamp) : now,
            productCode: String(record.productCode),
            batchId: String(record.batchId),
            quantity: Number(record.quantity),
            unitPrice: Number(record.unitPrice),
            discountRate: record.discountRate !== undefined && record.discountRate !== null ? Number(record.discountRate) : undefined,
            originalPrice: record.originalPrice !== undefined && record.originalPrice !== null ? Number(record.originalPrice) : undefined,
            saleTime: record.saleTime ? Number(record.saleTime) : now
        };
    }
    validateLoss(record) {
        if (!record.id) {
            throw new Error('记录ID(id)不能为空');
        }
        if (!record.productCode) {
            throw new Error('商品编码(productCode)不能为空');
        }
        if (!record.batchId) {
            throw new Error('批次号(batchId)不能为空');
        }
        if (record.quantity === undefined || record.quantity === null) {
            throw new Error('报损数量(quantity)不能为空');
        }
        if (!record.lossReason) {
            throw new Error('报损原因(lossReason)不能为空');
        }
        const now = Date.now();
        return {
            id: String(record.id),
            type: 'loss',
            timestamp: record.timestamp ? Number(record.timestamp) : now,
            productCode: String(record.productCode),
            batchId: String(record.batchId),
            quantity: Number(record.quantity),
            lossReason: String(record.lossReason),
            lossTime: record.lossTime ? Number(record.lossTime) : now,
            reporter: record.reporter ? String(record.reporter) : undefined
        };
    }
    validateInventory(record) {
        if (!record.id) {
            throw new Error('记录ID(id)不能为空');
        }
        if (!record.productCode) {
            throw new Error('商品编码(productCode)不能为空');
        }
        if (!record.batchId) {
            throw new Error('批次号(batchId)不能为空');
        }
        if (record.countedQuantity === undefined || record.countedQuantity === null) {
            throw new Error('盘点数量(countedQuantity)不能为空');
        }
        const now = Date.now();
        return {
            id: String(record.id),
            type: 'inventory',
            timestamp: record.timestamp ? Number(record.timestamp) : now,
            productCode: String(record.productCode),
            batchId: String(record.batchId),
            countedQuantity: Number(record.countedQuantity),
            inventoryDate: record.inventoryDate ? Number(record.inventoryDate) : now,
            operator: record.operator ? String(record.operator) : undefined
        };
    }
}
exports.ImportService = ImportService;
