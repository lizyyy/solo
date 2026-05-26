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
exports.importCustomersFromJson = importCustomersFromJson;
exports.importPurchaseRecordsFromCsv = importPurchaseRecordsFromCsv;
exports.importMedicinesFromJson = importMedicinesFromJson;
exports.importFollowUpRulesFromJson = importFollowUpRulesFromJson;
const fs = __importStar(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const database_1 = require("../database");
const id_1 = require("../utils/id");
async function importCustomersFromJson(filePath, operator) {
    const db = (0, database_1.getDb)();
    const result = { success: 0, failed: 0, errors: [], warnings: [], batchId: (0, id_1.generateId)('cust_batch') };
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const customers = Array.isArray(data) ? data : data.customers;
        if (!Array.isArray(customers)) {
            result.errors.push('无效的顾客档案JSON格式');
            return result;
        }
        const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO customers (id, name, id_card, phone, tags, address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        const tx = db.transaction((customers) => {
            for (const customer of customers) {
                try {
                    const customerId = customer.id || (0, id_1.generateId)('cust');
                    insertStmt.run(customerId, customer.name, customer.idCard || customer.id_card, customer.phone, JSON.stringify(customer.tags || []), customer.address || '', Date.now());
                    result.success++;
                }
                catch (err) {
                    result.failed++;
                    result.errors.push(`顾客 ${customer.name || '未知'} 导入失败: ${err.message}`);
                }
            }
        });
        tx(customers);
    }
    catch (err) {
        result.errors.push(`解析文件失败: ${err.message}`);
    }
    return result;
}
async function importPurchaseRecordsFromCsv(filePath, operator) {
    const db = (0, database_1.getDb)();
    const batchId = (0, id_1.generateId)('batch');
    const result = { success: 0, failed: 0, errors: [], warnings: [], batchId };
    const insertBatch = db.prepare(`
    INSERT INTO batches (id, source_file, record_count, status, created_at, created_by)
    VALUES (?, ?, ?, 'processing', ?, ?)
  `);
    insertBatch.run(batchId, filePath, 0, Date.now(), operator);
    const insertRecord = db.prepare(`
    INSERT INTO purchase_records (id, batch_id, customer_id, medicine_id, quantity, purchase_date, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `);
    const records = [];
    return new Promise((resolve) => {
        fs.createReadStream(filePath)
            .pipe((0, csv_parser_1.default)())
            .on('data', (row) => records.push(row))
            .on('end', () => {
            const tx = db.transaction(() => {
                for (const row of records) {
                    try {
                        const recordId = (0, id_1.generateId)('rec');
                        const purchaseDate = row.purchaseDate
                            ? new Date(row.purchaseDate).getTime()
                            : Date.now();
                        if (!row.customerId || !row.medicineId) {
                            result.failed++;
                            result.warnings.push(`记录 ${recordId} 缺少必要字段，已跳过`);
                            continue;
                        }
                        insertRecord.run(recordId, batchId, row.customerId, row.medicineId, parseInt(row.quantity || '1', 10), purchaseDate, row.notes || '');
                        result.success++;
                    }
                    catch (err) {
                        result.failed++;
                        result.errors.push(`记录导入失败: ${err.message}`);
                    }
                }
            });
            try {
                tx();
                db.prepare('UPDATE batches SET record_count = ?, status = ? WHERE id = ?').run(result.success, result.failed > 0 ? 'failed' : 'completed', batchId);
            }
            catch (err) {
                result.errors.push(`事务执行失败: ${err.message}`);
            }
            resolve(result);
        })
            .on('error', (err) => {
            result.errors.push(`读取CSV文件失败: ${err.message}`);
            resolve(result);
        });
    });
}
async function importMedicinesFromJson(filePath, operator) {
    const db = (0, database_1.getDb)();
    const result = { success: 0, failed: 0, errors: [], warnings: [], batchId: (0, id_1.generateId)('med_batch') };
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const medicines = Array.isArray(data) ? data : data.medicines;
        if (!Array.isArray(medicines)) {
            result.errors.push('无效的药品JSON格式');
            return result;
        }
        const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO medicines (id, name, category, is_controlled, contraindications, min_interval_days, max_dosage)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        const tx = db.transaction((medicines) => {
            for (const med of medicines) {
                try {
                    const medId = med.id || (0, id_1.generateId)('med');
                    insertStmt.run(medId, med.name, med.category, med.isControlled ? 1 : 0, JSON.stringify(med.contraindications || []), med.minIntervalDays || 0, med.maxDosage || 0);
                    result.success++;
                }
                catch (err) {
                    result.failed++;
                    result.errors.push(`药品 ${med.name || '未知'} 导入失败: ${err.message}`);
                }
            }
        });
        tx(medicines);
    }
    catch (err) {
        result.errors.push(`解析文件失败: ${err.message}`);
    }
    return result;
}
async function importFollowUpRulesFromJson(filePath, operator) {
    const db = (0, database_1.getDb)();
    const result = { success: 0, failed: 0, errors: [], warnings: [], batchId: (0, id_1.generateId)('rule_batch') };
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const rules = Array.isArray(data) ? data : data.rules;
        if (!Array.isArray(rules)) {
            result.errors.push('无效的随访规则JSON格式');
            return result;
        }
        const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO follow_up_rules (id, medicine_category, days_after_purchase, required_checks, description)
      VALUES (?, ?, ?, ?, ?)
    `);
        const tx = db.transaction((rules) => {
            for (const rule of rules) {
                try {
                    const ruleId = rule.id || (0, id_1.generateId)('rule');
                    insertStmt.run(ruleId, rule.medicineCategory, rule.daysAfterPurchase, JSON.stringify(rule.requiredChecks || []), rule.description || '');
                    result.success++;
                }
                catch (err) {
                    result.failed++;
                    result.errors.push(`规则导入失败: ${err.message}`);
                }
            }
        });
        tx(rules);
    }
    catch (err) {
        result.errors.push(`解析文件失败: ${err.message}`);
    }
    return result;
}
