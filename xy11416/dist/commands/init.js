"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCommand = initCommand;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const database_1 = require("../database");
async function initCommand(workDir, options) {
    const absoluteDir = path_1.default.resolve(workDir);
    if (!fs_1.default.existsSync(absoluteDir)) {
        fs_1.default.mkdirSync(absoluteDir, { recursive: true });
    }
    const dbPath = path_1.default.join(absoluteDir, 'pmi.db');
    if (fs_1.default.existsSync(dbPath) && !options.force) {
        console.log(chalk_1.default.yellow(`工作目录已存在: ${absoluteDir}`));
        console.log(chalk_1.default.yellow('使用 --force 选项重新初始化'));
        return;
    }
    const db = (0, database_1.getDatabase)(absoluteDir);
    await db.initSchema();
    const dataDir = path_1.default.join(absoluteDir, 'data');
    const exportDir = path_1.default.join(absoluteDir, 'exports');
    const importDir = path_1.default.join(absoluteDir, 'imports');
    [dataDir, exportDir, importDir].forEach(dir => {
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
    });
    const configPath = path_1.default.join(absoluteDir, 'pmi.json');
    const config = {
        version: '1.0.0',
        initializedAt: new Date().toISOString(),
        workDir: absoluteDir,
    };
    fs_1.default.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(chalk_1.default.green('✓ 初始化成功!'));
    console.log(chalk_1.default.gray(`  工作目录: ${absoluteDir}`));
    console.log(chalk_1.default.gray(`  数据库: ${dbPath}`));
    console.log('');
    console.log(chalk_1.default.blue('下一步:'));
    console.log(chalk_1.default.gray('  1. 放入待导入文件到 imports/ 目录'));
    console.log(chalk_1.default.gray('  2. 运行 pmi import <文件路径> 导入数据'));
    console.log(chalk_1.default.gray('  3. 运行 pmi check 检查数据质量'));
}
//# sourceMappingURL=init.js.map