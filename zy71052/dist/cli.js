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
exports.parseCLIArguments = parseCLIArguments;
exports.validateOptions = validateOptions;
exports.ensureOutputDirectory = ensureOutputDirectory;
exports.checkExistingFiles = checkExistingFiles;
const commander_1 = require("commander");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function parseCLIArguments() {
    const program = new commander_1.Command();
    program
        .name('odinspect')
        .description('OpenAPI 退役路由巡检 CLI 工具 - 检查哪些客户端仍在使用已退役的 API 路径')
        .version('1.0.0')
        .requiredOption('-o, --openapi <path>', 'OpenAPI 规范文件路径 (JSON/YAML)')
        .requiredOption('-l, --logs <path>', '网关日志文件路径 (JSON/NDJSON)')
        .requiredOption('-c, --clients <path>', '客户端清单文件路径 (JSON)')
        .requiredOption('-w, --owners <path>', '负责人表文件路径 (JSON)')
        .option('-O, --output <directory>', '输出目录', './reports')
        .option('-f, --format <formats...>', '输出格式 (json, markdown, terminal)', ['json', 'markdown', 'terminal'])
        .option('-d, --deprecation-date <date>', '全局退役日期 (ISO 格式，如 2024-06-30)')
        .option('-t, --timezone <timezone>', '时区，用于日期计算', 'Asia/Shanghai')
        .option('--overwrite', '覆盖已存在的输出文件', false)
        .option('--append', '追加模式，在已有报告后追加新数据', false)
        .option('-v, --verbose', '显示详细日志', false)
        .addHelpText('after', `
退出码说明:
  0  - 成功完成，无严重风险
  1  - 参数验证错误
  2  - 输入文件错误
  3  - 处理过程错误
  4  - 发现严重风险客户端

示例:
  $ odinspect -o openapi.yaml -l gateway.logs -c clients.json -w owners.json
  $ odinspect -o openapi.json -l logs/ -O ./output -f json markdown
  $ odinspect -o spec.yaml -l access.log -d 2024-12-31 -t America/New_York
`);
    program.parse();
    return program.opts();
}
function validateOptions(options) {
    const errors = [];
    if (!fs.existsSync(options.openapi)) {
        errors.push({
            field: 'openapi',
            message: `OpenAPI 文件不存在: ${options.openapi}`,
            severity: 'error',
        });
    }
    else {
        const ext = path.extname(options.openapi).toLowerCase();
        if (!['.json', '.yaml', '.yml'].includes(ext)) {
            errors.push({
                field: 'openapi',
                message: `OpenAPI 文件格式不支持，应为 JSON 或 YAML: ${options.openapi}`,
                severity: 'error',
            });
        }
    }
    if (!fs.existsSync(options.logs)) {
        errors.push({
            field: 'logs',
            message: `网关日志文件不存在: ${options.logs}`,
            severity: 'error',
        });
    }
    if (!fs.existsSync(options.clients)) {
        errors.push({
            field: 'clients',
            message: `客户端清单文件不存在: ${options.clients}`,
            severity: 'error',
        });
    }
    if (!fs.existsSync(options.owners)) {
        errors.push({
            field: 'owners',
            message: `负责人表文件不存在: ${options.owners}`,
            severity: 'error',
        });
    }
    const validFormats = ['json', 'markdown', 'terminal'];
    const invalidFormats = options.format.filter((f) => !validFormats.includes(f));
    if (invalidFormats.length > 0) {
        errors.push({
            field: 'format',
            message: `不支持的输出格式: ${invalidFormats.join(', ')}，可选: ${validFormats.join(', ')}`,
            severity: 'error',
        });
    }
    if (options.deprecationDate) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(options.deprecationDate)) {
            errors.push({
                field: 'deprecationDate',
                message: `退役日期格式不正确，应为 YYYY-MM-DD: ${options.deprecationDate}`,
                severity: 'error',
            });
        }
        else {
            const date = new Date(options.deprecationDate);
            if (isNaN(date.getTime())) {
                errors.push({
                    field: 'deprecationDate',
                    message: `退役日期无效: ${options.deprecationDate}`,
                    severity: 'error',
                });
            }
        }
    }
    try {
        Intl.DateTimeFormat(undefined, { timeZone: options.timezone });
    }
    catch {
        errors.push({
            field: 'timezone',
            message: `无效的时区: ${options.timezone}`,
            severity: 'error',
        });
    }
    if (options.overwrite && options.append) {
        errors.push({
            field: 'overwrite/append',
            message: '不能同时指定 --overwrite 和 --append',
            severity: 'error',
        });
    }
    if (fs.existsSync(options.output)) {
        const stats = fs.statSync(options.output);
        if (!stats.isDirectory()) {
            errors.push({
                field: 'output',
                message: `输出路径不是目录: ${options.output}`,
                severity: 'error',
            });
        }
    }
    else {
        errors.push({
            field: 'output',
            message: `输出目录不存在，将自动创建: ${options.output}`,
            severity: 'warning',
        });
    }
    return errors;
}
function ensureOutputDirectory(outputPath) {
    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
    }
}
function checkExistingFiles(outputPath, formats) {
    const existingFiles = [];
    if (formats.includes('json')) {
        const jsonPath = path.join(outputPath, 'inspection-report.json');
        if (fs.existsSync(jsonPath))
            existingFiles.push(jsonPath);
    }
    if (formats.includes('markdown')) {
        const mdPath = path.join(outputPath, 'inspection-report.md');
        if (fs.existsSync(mdPath))
            existingFiles.push(mdPath);
    }
    return {
        exists: existingFiles.length > 0,
        files: existingFiles,
    };
}
//# sourceMappingURL=cli.js.map