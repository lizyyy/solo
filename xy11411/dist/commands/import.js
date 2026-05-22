"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importCommand = importCommand;
exports.checkCommand = checkCommand;
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const uuid_1 = require("uuid");
const database_1 = require("../services/database");
const stateManager_1 = require("../services/stateManager");
const autoCheck_1 = require("../services/autoCheck");
const fileUtils_1 = require("../utils/fileUtils");
const types_1 = require("../models/types");
function extractField(obj, keys) {
    for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
            return obj[key];
        }
        const lowerKey = key.toLowerCase();
        for (const objKey of Object.keys(obj)) {
            if (objKey.toLowerCase() === lowerKey) {
                return obj[objKey];
            }
        }
    }
    return undefined;
}
function parseNumber(value) {
    if (value === undefined || value === null || value === '')
        return undefined;
    const num = parseFloat(String(value).replace(/[^\d.-]/g, ''));
    return isNaN(num) ? undefined : num;
}
async function importCommand(filePath, options) {
    console.log(chalk_1.default.blue('\n=== 导入数据 ===\n'));
    if (!(0, fileUtils_1.fileExists)(filePath)) {
        console.error(chalk_1.default.red(`✗ 文件不存在: ${filePath}`));
        process.exit(1);
    }
    try {
        const operatorId = options.operator || 'default-admin';
        const stateManager = await (0, stateManager_1.createStateManager)(operatorId);
        const autoCheck = new autoCheck_1.AutoCheckService(stateManager);
        const hasPermission = await autoCheck.checkPermission('import', 'data');
        if (!hasPermission) {
            console.error(chalk_1.default.red('✗ 权限不足: 没有导入数据的权限'));
            process.exit(1);
        }
        const duplicateCheck = await autoCheck.checkDuplicateImport(filePath);
        if (duplicateCheck.isDuplicate && !options.allowDuplicate) {
            console.error(chalk_1.default.red(`✗ 重复导入检测: ${duplicateCheck.message}`));
            console.log(chalk_1.default.gray('如需强制导入，请使用 --allow-duplicate 参数'));
            process.exit(1);
        }
        if (duplicateCheck.isDuplicate && options.allowDuplicate) {
            console.log(chalk_1.default.yellow(`⚠️  检测到重复导入，已允许强制导入`));
        }
        const fileName = path_1.default.basename(filePath);
        const sourceType = options.sourceType
            ? options.sourceType
            : (0, fileUtils_1.detectSourceType)(fileName);
        console.log(chalk_1.default.gray(`文件: ${fileName}`));
        console.log(chalk_1.default.gray(`数据源类型: ${sourceType}`));
        const fileHash = (0, fileUtils_1.calculateFileHash)(filePath);
        const parseResult = await (0, fileUtils_1.parseDataFile)(filePath);
        console.log(chalk_1.default.gray(`解析到 ${parseResult.rows.length} 条数据`));
        const batchId = (0, uuid_1.v4)();
        const now = Date.now();
        const operator = stateManager.getCurrentOperator();
        const batch = {
            id: batchId,
            sourceType,
            sourceFile: fileName,
            fileHash,
            operatorId: operator.id,
            timestamp: now,
            totalRecords: parseResult.rows.length,
            successCount: 0,
            failedCount: 0,
            status: 'processing'
        };
        await database_1.dbService.insertImportBatch(batch);
        console.log(chalk_1.default.gray(`批次号: ${batchId}`));
        console.log(chalk_1.default.gray(`操作员: ${operator.name}`));
        console.log();
        let successCount = 0;
        let failedCount = 0;
        for (let i = 0; i < parseResult.rows.length; i++) {
            const row = parseResult.rows[i];
            const rowNumber = i + 2;
            try {
                const record = await createRecordFromRow(row, rowNumber, sourceType, fileName, fileHash, batchId, stateManager);
                await database_1.dbService.insertRecord(record);
                await stateManager.transitionState(record.id, null, types_1.RecordStatus.IMPORTED, '数据文件导入', { rowNumber, sourceFile: fileName });
                successCount++;
                console.log(chalk_1.default.green(`  ✓ 第 ${rowNumber} 行: 导入成功`));
            }
            catch (error) {
                failedCount++;
                console.log(chalk_1.default.red(`  ✗ 第 ${rowNumber} 行: 导入失败 - ${error.message}`));
            }
        }
        await database_1.dbService.updateImportBatch(batchId, {
            status: 'completed',
            successCount,
            failedCount
        });
        await stateManager.logAction('import_completed', 'batch', batchId, {
            fileName,
            sourceType,
            totalRecords: parseResult.rows.length,
            successCount,
            failedCount
        });
        console.log();
        console.log(chalk_1.default.green(`✓ 导入完成!`));
        console.log(chalk_1.default.gray(`  成功: ${successCount} 条`));
        console.log(chalk_1.default.gray(`  失败: ${failedCount} 条`));
        if (!options.skipCheck && successCount > 0) {
            console.log();
            console.log(chalk_1.default.gray('自动执行数据校验...'));
            await checkCommand({ batchId, operator: operatorId });
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('\n✗ 导入失败:'), error.message);
        process.exit(1);
    }
}
async function createRecordFromRow(row, rowNumber, sourceType, sourceFile, fileHash, batchId, stateManager) {
    const now = Date.now();
    const recordId = (0, uuid_1.v4)();
    const quantity = parseNumber(extractField(row, ['数量', 'quantity', 'qty', 'num']));
    const price = parseNumber(extractField(row, ['单价', 'price', 'unit_price']));
    const totalAmount = parseNumber(extractField(row, ['金额', '总价', 'total', 'amount']));
    const record = {
        id: recordId,
        rawData: {
            sourceType,
            sourceFile,
            originalRowNumber: rowNumber,
            rawContent: row,
            fileHash,
            importBatchId: batchId
        },
        status: types_1.RecordStatus.PENDING,
        stateChanges: [],
        checkResults: [],
        materialCode: extractField(row, ['物料编码', 'material_code', 'code', 'sku']),
        materialName: extractField(row, ['物料名称', '品名', 'material_name', 'name', 'product']),
        quantity,
        unit: extractField(row, ['单位', 'unit', 'uom']),
        price,
        totalAmount: totalAmount ?? (quantity !== undefined && price !== undefined ? quantity * price : undefined),
        supplier: extractField(row, ['供应商', 'supplier', 'vendor']),
        batchNumber: extractField(row, ['批次号', 'batch_number', 'lot', 'batch']),
        productionDate: extractField(row, ['生产日期', 'production_date', 'prod_date']),
        expiryDate: extractField(row, ['保质期', '有效期', 'expiry_date', 'exp_date']),
        storeId: extractField(row, ['门店编号', '门店ID', 'store_id', 'store']),
        storeName: extractField(row, ['门店名称', '门店', 'store_name']),
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        tags: [sourceType]
    };
    return record;
}
async function checkCommand(options) {
    try {
        const operatorId = options.operator || 'default-admin';
        const stateManager = await (0, stateManager_1.createStateManager)(operatorId);
        const autoCheck = new autoCheck_1.AutoCheckService(stateManager);
        const hasPermission = await autoCheck.checkPermission('check', 'data');
        if (!hasPermission) {
            console.error(chalk_1.default.red('✗ 权限不足: 没有数据校验的权限'));
            process.exit(1);
        }
        let records = await database_1.dbService.getAllRecords();
        if (options.batchId) {
            records = records.filter(r => r.rawData.importBatchId === options.batchId);
        }
        if (options.recordId) {
            const record = await database_1.dbService.getRecordById(options.recordId);
            records = record ? [record] : [];
        }
        records = records.filter(r => r.status === types_1.RecordStatus.IMPORTED ||
            r.status === types_1.RecordStatus.PENDING ||
            r.status === types_1.RecordStatus.FIXED);
        if (records.length === 0) {
            console.log(chalk_1.default.gray('没有需要校验的记录'));
            return;
        }
        console.log(chalk_1.default.gray(`开始校验 ${records.length} 条记录...`));
        console.log();
        let validCount = 0;
        let invalidCount = 0;
        for (const record of records) {
            await stateManager.transitionState(record.id, record.status, types_1.RecordStatus.CHECKING, '开始数据校验');
            const { valid, failures } = await validateRecord(record, stateManager);
            if (valid) {
                await stateManager.transitionState(record.id, types_1.RecordStatus.CHECKING, types_1.RecordStatus.VALID, '数据校验通过');
                validCount++;
                console.log(chalk_1.default.green(`  ✓ 记录 ${record.id.slice(0, 8)}: 校验通过`));
            }
            else {
                await stateManager.transitionState(record.id, types_1.RecordStatus.CHECKING, types_1.RecordStatus.INVALID, `数据校验失败: ${failures.join(', ')}`);
                invalidCount++;
                console.log(chalk_1.default.red(`  ✗ 记录 ${record.id.slice(0, 8)}: 校验失败 - ${failures.join(', ')}`));
            }
        }
        await stateManager.logAction('check_completed', 'system', undefined, {
            totalRecords: records.length,
            validCount,
            invalidCount,
            batchId: options.batchId
        });
        console.log();
        console.log(chalk_1.default.green(`✓ 校验完成!`));
        console.log(chalk_1.default.gray(`  通过: ${validCount} 条`));
        console.log(chalk_1.default.gray(`  失败: ${invalidCount} 条`));
    }
    catch (error) {
        console.error(chalk_1.default.red('\n✗ 校验失败:'), error.message);
        process.exit(1);
    }
}
async function validateRecord(record, stateManager) {
    const failures = [];
    const operator = stateManager.getCurrentOperator();
    const now = Date.now();
    const checks = [
        {
            name: '物料名称必填',
            check: () => !!record.materialName,
            message: '物料名称为空'
        },
        {
            name: '数量合法性',
            check: () => record.quantity === undefined || record.quantity >= 0,
            message: '数量不能为负数'
        },
        {
            name: '价格合法性',
            check: () => record.price === undefined || record.price >= 0,
            message: '单价不能为负数'
        },
        {
            name: '数据完整性',
            check: () => {
                const rawContent = JSON.stringify(record.rawData.rawContent);
                return rawContent.length > 2;
            },
            message: '原始数据为空'
        }
    ];
    for (const check of checks) {
        const passed = check.check();
        await database_1.dbService.insertCheckResult({
            id: (0, uuid_1.v4)(),
            recordId: record.id,
            checkName: check.name,
            status: passed ? types_1.CheckStatus.PASS : types_1.CheckStatus.FAIL,
            message: passed ? '检查通过' : check.message,
            timestamp: now,
            operatorId: operator.id
        });
        if (!passed) {
            failures.push(check.message);
        }
    }
    return {
        valid: failures.length === 0,
        failures
    };
}
