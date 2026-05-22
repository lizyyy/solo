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
exports.fixCommand = fixCommand;
exports.reimportCommand = reimportCommand;
const chalk_1 = __importDefault(require("chalk"));
const uuid_1 = require("uuid");
const database_1 = require("../services/database");
const stateManager_1 = require("../services/stateManager");
const autoCheck_1 = require("../services/autoCheck");
const types_1 = require("../models/types");
async function fixCommand(recordId, options) {
    console.log(chalk_1.default.blue('\n=== 修正数据 ===\n'));
    try {
        const operatorId = options.operator || 'default-admin';
        const stateManager = await (0, stateManager_1.createStateManager)(operatorId);
        const autoCheck = new autoCheck_1.AutoCheckService(stateManager);
        const hasPermission = await autoCheck.checkPermission('fix', 'data');
        if (!hasPermission) {
            console.error(chalk_1.default.red('✗ 权限不足: 没有修正数据的权限'));
            process.exit(1);
        }
        const record = await database_1.dbService.getRecordById(recordId);
        if (!record) {
            console.error(chalk_1.default.red(`✗ 记录不存在: ${recordId}`));
            process.exit(1);
        }
        console.log(chalk_1.default.gray(`记录ID: ${recordId}`));
        console.log(chalk_1.default.gray(`当前状态: ${record.status}`));
        console.log(chalk_1.default.gray(`物料名称: ${record.materialName || '未设置'}`));
        console.log(chalk_1.default.gray(`原始行号: ${record.rawData.originalRowNumber}`));
        console.log();
        await stateManager.transitionState(recordId, record.status, types_1.RecordStatus.FIXING, `开始修正: ${options.reason}`);
        const sql = `UPDATE records SET ${options.field} = ?, updated_at = ? WHERE id = ?`;
        await database_1.dbService.runQuery(sql, [options.value, Date.now(), recordId]);
        const operator = stateManager.getCurrentOperator();
        await database_1.dbService.insertCheckResult({
            id: (0, uuid_1.v4)(),
            recordId,
            checkName: '手动修正',
            status: types_1.CheckStatus.PASS,
            message: `字段 ${options.field} 已修正为: ${options.value}`,
            details: {
                field: options.field,
                oldValue: record[options.field],
                newValue: options.value,
                reason: options.reason
            },
            timestamp: Date.now(),
            operatorId: operator.id
        });
        await stateManager.transitionState(recordId, types_1.RecordStatus.FIXING, types_1.RecordStatus.FIXED, `修正完成: ${options.reason}`, {
            field: options.field,
            oldValue: record[options.field],
            newValue: options.value
        });
        console.log(chalk_1.default.green(`✓ 修正成功!`));
        console.log(chalk_1.default.gray(`  字段: ${options.field}`));
        console.log(chalk_1.default.gray(`  原值: ${record[options.field] || '(空)'}`));
        console.log(chalk_1.default.gray(`  新值: ${options.value}`));
        console.log(chalk_1.default.gray(`  原因: ${options.reason}`));
        if (options.recheck) {
            console.log();
            console.log(chalk_1.default.gray('重新执行校验...'));
            const { checkCommand } = await Promise.resolve().then(() => __importStar(require('./import')));
            await checkCommand({ recordId, operator: operatorId });
        }
        await stateManager.logAction('record_fixed', 'record', recordId, {
            field: options.field,
            oldValue: record[options.field],
            newValue: options.value,
            reason: options.reason
        });
    }
    catch (error) {
        console.error(chalk_1.default.red('\n✗ 修正失败:'), error.message);
        process.exit(1);
    }
}
async function reimportCommand(recordId, options) {
    console.log(chalk_1.default.blue('\n=== 重新导入 ===\n'));
    try {
        const operatorId = options.operator || 'default-admin';
        const stateManager = await (0, stateManager_1.createStateManager)(operatorId);
        const autoCheck = new autoCheck_1.AutoCheckService(stateManager);
        const hasPermission = await autoCheck.checkPermission('fix', 'data');
        if (!hasPermission) {
            console.error(chalk_1.default.red('✗ 权限不足: 没有重新导入的权限'));
            process.exit(1);
        }
        const record = await database_1.dbService.getRecordById(recordId);
        if (!record) {
            console.error(chalk_1.default.red(`✗ 记录不存在: ${recordId}`));
            process.exit(1);
        }
        console.log(chalk_1.default.gray(`记录ID: ${recordId}`));
        console.log(chalk_1.default.gray(`当前状态: ${record.status}`));
        console.log();
        await stateManager.transitionState(recordId, record.status, types_1.RecordStatus.REIMPORTED, '修正后重新导入', {
            originalStatus: record.status,
            originalRowNumber: record.rawData.originalRowNumber
        });
        console.log(chalk_1.default.green(`✓ 重新导入成功!`));
        console.log(chalk_1.default.gray(`记录已标记为重新导入状态，可以再次进行校验`));
        await stateManager.logAction('record_reimported', 'record', recordId, {
            previousStatus: record.status
        });
        console.log();
        console.log(chalk_1.default.gray('执行校验...'));
        const { checkCommand } = await Promise.resolve().then(() => __importStar(require('./import')));
        await checkCommand({ recordId, operator: operatorId });
    }
    catch (error) {
        console.error(chalk_1.default.red('\n✗ 重新导入失败:'), error.message);
        process.exit(1);
    }
}
