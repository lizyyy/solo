"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCLIArgs = parseCLIArgs;
const commander_1 = require("commander");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
function parseCLIArgs() {
    const program = new commander_1.Command();
    program
        .name('sales-visit-merge')
        .description('售楼处来访合并工具 - 处理渠道表和来访登记表的重复认领问题')
        .version('1.0.0')
        .requiredOption('-v, --visit <path>', '来访表文件路径 (Excel)')
        .requiredOption('-c, --channel <path>', '渠道表文件路径 (Excel)')
        .option('-o, --output <directory>', '输出目录', './output')
        .option('--priority <channels...>', '渠道优先级，逗号分隔或多次指定')
        .option('--phone-column <name>', '电话列名')
        .option('--advisor-column <name>', '置业顾问列名')
        .option('--channel-column <name>', '渠道名列名')
        .option('--status-column <name>', '状态列名')
        .option('--silent', '静默模式，减少输出');
    program.parse();
    const options = program.opts();
    return validateOptions({
        来访表路径: options.visit,
        渠道表路径: options.channel,
        输出目录: options.output,
        渠道优先级: options.priority,
        电话列名: options.phoneColumn,
        顾问列名: options.advisorColumn,
        渠道列名: options.channelColumn,
        状态列名: options.statusColumn,
        静默: options.silent
    });
}
function validateOptions(options) {
    const errors = [];
    if (!fs_1.default.existsSync(options.来访表路径)) {
        errors.push(`来访表文件不存在: ${options.来访表路径}`);
    }
    else {
        const ext = path_1.default.extname(options.来访表路径).toLowerCase();
        if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
            errors.push(`来访表文件格式不支持，仅支持 xlsx, xls, csv: ${options.来访表路径}`);
        }
    }
    if (!fs_1.default.existsSync(options.渠道表路径)) {
        errors.push(`渠道表文件不存在: ${options.渠道表路径}`);
    }
    else {
        const ext = path_1.default.extname(options.渠道表路径).toLowerCase();
        if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
            errors.push(`渠道表文件格式不支持，仅支持 xlsx, xls, csv: ${options.渠道表路径}`);
        }
    }
    if (!fs_1.default.existsSync(options.输出目录)) {
        try {
            fs_1.default.mkdirSync(options.输出目录, { recursive: true });
        }
        catch (e) {
            errors.push(`无法创建输出目录: ${options.输出目录}`);
        }
    }
    if (options.渠道优先级 && typeof options.渠道优先级 === 'string') {
        options.渠道优先级 = options.渠道优先级.split(',').map(s => s.trim());
    }
    if (errors.length > 0) {
        console.error('\n' + chalk_1.default.red('❌ 输入校验失败:') + '\n');
        errors.forEach((err, i) => {
            console.error(chalk_1.default.yellow(`  ${i + 1}. `) + err);
        });
        console.error('\n' + chalk_1.default.blue('💡 使用 -h 或 --help 查看帮助信息') + '\n');
        process.exit(1);
    }
    return options;
}
