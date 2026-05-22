"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyExportIntegrity = exports.getExportHistory = exports.exportRawData = exports.exportReconciliationResults = void 0;
const connection_1 = require("../database/connection");
const schema_1 = require("../database/schema");
const json2csv_1 = require("json2csv");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const uuid_1 = require("uuid");
const EXPORT_DIR = path_1.default.join(process.cwd(), 'exports');
const ensureExportDir = () => {
    if (!fs_1.default.existsSync(EXPORT_DIR)) {
        fs_1.default.mkdirSync(EXPORT_DIR, { recursive: true });
    }
};
const exportReconciliationResults = async (taskId, exportedBy) => {
    ensureExportDir();
    const results = await (0, connection_1.runQuery)(`SELECT r.result_id, r.task_id, r.franchisee_id, r.material_code, 
            r.expected_quantity, r.actual_quantity, r.difference,
            r.unit_price, r.difference_amount, r.status, r.created_at,
            o.material_name, o.unit
     FROM ${schema_1.TABLES.RECONCILIATION_RESULTS} r
     LEFT JOIN ${schema_1.TABLES.ORDER_ITEMS} o ON r.franchisee_id = o.franchisee_id AND r.material_code = o.material_code
     WHERE r.task_id = ?
     GROUP BY r.result_id`, [taskId]);
    if (results.length === 0) {
        throw new Error('没有可导出的对账结果');
    }
    const fields = [
        'result_id', 'task_id', 'franchisee_id', 'material_code', 'material_name',
        'expected_quantity', 'actual_quantity', 'difference', 'unit',
        'unit_price', 'difference_amount', 'status', 'created_at'
    ];
    const parser = new json2csv_1.Parser({ fields });
    const csv = parser.parse(results);
    const exportId = `export_${(0, uuid_1.v4)().slice(0, 24)}`;
    const fileName = `reconciliation_${taskId}_${Date.now()}.csv`;
    const filePath = path_1.default.join(EXPORT_DIR, fileName);
    fs_1.default.writeFileSync(filePath, csv, 'utf-8');
    const fileHash = crypto_1.default.createHash('md5').update(csv).digest('hex');
    await (0, connection_1.runInsert)(`INSERT INTO ${schema_1.TABLES.EXPORT_RECORDS} (
      export_id, task_id, export_type, file_path, exported_by, record_count, export_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [exportId, taskId, 'reconciliation', filePath, exportedBy, results.length, fileHash]);
    return {
        exportId,
        filePath,
        recordCount: results.length
    };
};
exports.exportReconciliationResults = exportReconciliationResults;
const exportRawData = async (sourceType, exportedBy, franchiseeId) => {
    ensureExportDir();
    const tableMap = {
        order: schema_1.TABLES.ORDER_ITEMS,
        waste: schema_1.TABLES.WASTE_RECORDS,
        price: schema_1.TABLES.HEADQUARTER_PRICES,
        supplement: schema_1.TABLES.SUPPLEMENT_RECORDS
    };
    const tableName = tableMap[sourceType];
    let whereClause = franchiseeId ? 'WHERE franchisee_id = ?' : '';
    const params = franchiseeId ? [franchiseeId] : [];
    const records = await (0, connection_1.runQuery)(`SELECT * FROM ${tableName} ${whereClause} ORDER BY created_at DESC`, params);
    if (records.length === 0) {
        throw new Error('没有可导出的数据');
    }
    const fields = Object.keys(records[0]);
    const parser = new json2csv_1.Parser({ fields });
    const csv = parser.parse(records);
    const exportId = `export_${(0, uuid_1.v4)().slice(0, 24)}`;
    const fileName = `${sourceType}_raw_${Date.now()}.csv`;
    const filePath = path_1.default.join(EXPORT_DIR, fileName);
    fs_1.default.writeFileSync(filePath, csv, 'utf-8');
    const fileHash = crypto_1.default.createHash('md5').update(csv).digest('hex');
    await (0, connection_1.runInsert)(`INSERT INTO ${schema_1.TABLES.EXPORT_RECORDS} (
      export_id, export_type, file_path, exported_by, record_count, export_hash
    ) VALUES (?, ?, ?, ?, ?, ?)`, [exportId, `${sourceType}_raw`, filePath, exportedBy, records.length, fileHash]);
    return {
        exportId,
        filePath,
        recordCount: records.length
    };
};
exports.exportRawData = exportRawData;
const getExportHistory = async () => {
    return await (0, connection_1.runQuery)(`SELECT * FROM ${schema_1.TABLES.EXPORT_RECORDS} ORDER BY created_at DESC LIMIT 50`);
};
exports.getExportHistory = getExportHistory;
const verifyExportIntegrity = async (exportId) => {
    const records = await (0, connection_1.runQuery)(`SELECT file_path, export_hash FROM ${schema_1.TABLES.EXPORT_RECORDS} WHERE export_id = ?`, [exportId]);
    if (records.length === 0) {
        return false;
    }
    const record = records[0];
    if (!fs_1.default.existsSync(record.file_path)) {
        return false;
    }
    const content = fs_1.default.readFileSync(record.file_path, 'utf-8');
    const currentHash = crypto_1.default.createHash('md5').update(content).digest('hex');
    return currentHash === record.export_hash;
};
exports.verifyExportIntegrity = verifyExportIntegrity;
