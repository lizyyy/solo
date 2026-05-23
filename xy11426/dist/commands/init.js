"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCommand = initCommand;
const database_1 = require("../db/database");
const chalk_1 = __importDefault(require("chalk"));
async function initCommand() {
    console.log(chalk_1.default.blue('正在初始化园区访客通行巡检工具...'));
    if ((0, database_1.isDatabaseInitialized)()) {
        console.log(chalk_1.default.yellow('数据库已初始化，跳过创建。'));
        return 0;
    }
    try {
        (0, database_1.initDatabase)();
        console.log(chalk_1.default.green('✓ 数据库初始化成功！'));
        console.log(chalk_1.default.gray('  数据文件位置: .park-inspect/data.db'));
        console.log('');
        console.log(chalk_1.default.cyan('下一步操作:'));
        console.log('  1. 导入数据: park-inspect import <文件路径>');
        console.log('  2. 校验数据: park-inspect check <批次ID>');
        console.log('  3. 生成报表: park-inspect report <批次ID>');
        return 0;
    }
    catch (error) {
        console.error(chalk_1.default.red('初始化失败:'), error.message);
        return 1;
    }
}
