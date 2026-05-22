"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCommand = initCommand;
const chalk_1 = __importDefault(require("chalk"));
const database_1 = require("../services/database");
const stateManager_1 = require("../services/stateManager");
const autoCheck_1 = require("../services/autoCheck");
async function initCommand(options) {
    console.log(chalk_1.default.blue('\n=== 初始化连锁茶饮原料巡检系统 ===\n'));
    if (database_1.dbService.isInitialized() && !options.force) {
        console.log(chalk_1.default.yellow('⚠️  系统已初始化'));
        console.log(chalk_1.default.gray('如需重新初始化，请使用 --force 参数\n'));
        return;
    }
    try {
        console.log(chalk_1.default.gray('正在创建工作目录和数据库...'));
        await database_1.dbService.initialize();
        console.log(chalk_1.default.green('✓ 数据库初始化完成'));
        const config = database_1.dbService.getConfig();
        console.log(chalk_1.default.gray(`工作目录: ${config.workDir}`));
        console.log(chalk_1.default.gray(`数据库: ${config.path}`));
        const stateManager = await (0, stateManager_1.createStateManager)();
        await stateManager.logAction('system_init', 'system', undefined, {
            force: options.force || false
        });
        console.log(chalk_1.default.green('✓ 审计日志已记录'));
        const autoCheck = new autoCheck_1.AutoCheckService(stateManager);
        const { consistent, issues } = await autoCheck.verifyRestartConsistency();
        if (consistent) {
            console.log(chalk_1.default.green('✓ 系统一致性检查通过'));
        }
        else {
            console.log(chalk_1.default.yellow(`⚠️  发现 ${issues.length} 个问题:`));
            issues.forEach(issue => console.log(chalk_1.default.yellow(`  - ${issue}`)));
        }
        console.log(chalk_1.default.green('\n✓ 系统初始化成功!'));
        console.log(chalk_1.default.gray('\n可使用以下命令开始:'));
        console.log(chalk_1.default.gray('  tea-inspect import <file>   - 导入数据文件'));
        console.log(chalk_1.default.gray('  tea-inspect check           - 数据校验'));
        console.log(chalk_1.default.gray('  tea-inspect report          - 生成报表\n'));
    }
    catch (error) {
        console.error(chalk_1.default.red('\n✗ 初始化失败:'), error.message);
        process.exit(1);
    }
}
