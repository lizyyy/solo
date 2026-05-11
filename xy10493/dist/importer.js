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
exports.dataImporter = exports.DataImporter = void 0;
const fs = __importStar(require("fs"));
const sync_1 = require("csv-parse/sync");
const data_store_1 = require("./data-store");
class DataImporter {
    validateFileExists(filePath) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`文件不存在: ${filePath}`);
        }
    }
    readCSV(filePath, columns) {
        this.validateFileExists(filePath);
        const content = fs.readFileSync(filePath, 'utf-8');
        const records = (0, sync_1.parse)(content, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });
        for (const col of columns) {
            if (!records[0] || !(col in records[0])) {
                throw new Error(`CSV 文件缺少必要列: ${col}`);
            }
        }
        return records;
    }
    importBookInventory(filePath, auditId) {
        const records = this.readCSV(filePath, ['location', 'sku', 'quantity']);
        const errors = [];
        const inventories = [];
        const seen = new Set();
        for (const record of records) {
            const key = `${record.location}-${record.sku}`;
            if (seen.has(key)) {
                errors.push({
                    type: 'sku_missing',
                    message: `重复的库位 + SKU 组合: ${key}`,
                    details: record
                });
                continue;
            }
            seen.add(key);
            const quantity = parseInt(record.quantity, 10);
            if (isNaN(quantity)) {
                errors.push({
                    type: 'sku_missing',
                    message: `无效的数量: ${record.quantity} (SKU: ${record.sku})`,
                    details: record
                });
                continue;
            }
            inventories.push({
                auditId,
                location: record.location.trim(),
                sku: record.sku.trim(),
                quantity
            });
        }
        data_store_1.dataStore.saveBookInventory(auditId, inventories);
        return {
            success: errors.length === 0,
            importedCount: inventories.length,
            errors
        };
    }
    importActualCount(filePath, auditId) {
        const records = this.readCSV(filePath, ['location', 'sku', 'quantity']);
        const errors = [];
        const counts = [];
        const seen = new Set();
        for (const record of records) {
            const key = `${record.location}-${record.sku}`;
            if (seen.has(key)) {
                errors.push({
                    type: 'sku_missing',
                    message: `重复的库位 + SKU 组合: ${key}`,
                    details: record
                });
                continue;
            }
            seen.add(key);
            const quantity = parseInt(record.quantity, 10);
            if (isNaN(quantity)) {
                errors.push({
                    type: 'sku_missing',
                    message: `无效的数量: ${record.quantity} (SKU: ${record.sku})`,
                    details: record
                });
                continue;
            }
            counts.push({
                auditId,
                location: record.location.trim(),
                sku: record.sku.trim(),
                quantity,
                countedAt: record.countedAt || new Date().toISOString()
            });
        }
        data_store_1.dataStore.saveActualCount(auditId, counts);
        return {
            success: errors.length === 0,
            importedCount: counts.length,
            errors
        };
    }
    importLocationOwners(filePath) {
        const records = this.readCSV(filePath, ['location', 'owner']);
        const errors = [];
        const owners = [];
        const seen = new Set();
        for (const record of records) {
            const location = record.location.trim();
            if (seen.has(location)) {
                errors.push({
                    type: 'location_mismatch',
                    message: `重复的库位: ${location}`,
                    details: record
                });
                continue;
            }
            seen.add(location);
            owners.push({
                location,
                owner: record.owner.trim()
            });
        }
        data_store_1.dataStore.saveLocationOwners(owners);
        return {
            success: errors.length === 0,
            importedCount: owners.length,
            errors
        };
    }
}
exports.DataImporter = DataImporter;
exports.dataImporter = new DataImporter();
