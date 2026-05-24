#!/usr/bin/env node
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
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const provisionParser_1 = require("./provisionParser");
const certificateValidator_1 = require("./certificateValidator");
const configParser_1 = require("./configParser");
const checkEngine_1 = require("./checkEngine");
const reportGenerator_1 = require("./reportGenerator");
const program = new commander_1.Command();
program
    .name('cert-check')
    .description('Xcode 证书体检 CLI - 检查 profile、证书、bundle id 的一致性')
    .version('1.0.0');
program
    .command('check')
    .description('执行证书体检')
    .option('-p, --profile <paths...>', 'MobileProvision 文件或目录路径（多个用空格分隔）')
    .option('-c, --certificate <paths...>', '证书文件或目录路径（多个用空格分隔）')
    .option('-t, --target <bundleIds...>', 'Target Bundle ID 列表（多个用空格分隔）')
    .option('-f, --config <path>', 'Target 配置文件（YAML/JSON）')
    .option('-o, --output <dir>', '报告输出目录', './cert-check-reports')
    .option('-w, --warn-days <days>', '过期提醒天数', '30')
    .option('--strict', '严格模式：警告也返回非零退出码')
    .option('--no-terminal', '不输出终端报告')
    .option('--no-json', '不生成 JSON 报告')
    .option('--no-markdown', '不生成 Markdown 报告')
    .option('--cert-password <password>', 'P12 证书密码')
    .action(async (options) => {
    try {
        await runCheck(options);
    }
    catch (error) {
        console.error(chalk_1.default.red.bold('\n❌ 执行失败:'));
        console.error(chalk_1.default.red(`   ${error.message}`));
        process.exit(3);
    }
});
program
    .command('parse-profile <path>')
    .description('解析并显示 MobileProvision 文件信息')
    .action((path) => {
    try {
        const profile = provisionParser_1.ProvisionParser.parse(path);
        console.log(JSON.stringify(profile, null, 2));
    }
    catch (error) {
        console.error(chalk_1.default.red(`解析失败: ${error.message}`));
        process.exit(1);
    }
});
program
    .command('parse-cert <path>')
    .description('解析并显示证书文件信息')
    .option('-p, --password <password>', 'P12 证书密码')
    .action((path, options) => {
    try {
        const cert = certificateValidator_1.CertificateValidator.parseFromFile(path, options.password);
        console.log(JSON.stringify(cert, null, 2));
    }
    catch (error) {
        console.error(chalk_1.default.red(`解析失败: ${error.message}`));
        process.exit(1);
    }
});
async function runCheck(options) {
    console.log(chalk_1.default.cyan.bold('\n🔍 开始 Xcode 证书体检...\n'));
    if (!options.profile && !options.certificate && !options.target && !options.config) {
        console.error(chalk_1.default.red('错误: 请至少指定 --profile、--certificate、--target 或 --config 中的一项'));
        program.outputHelp();
        process.exit(1);
    }
    let targets = [];
    if (options.config) {
        validateFileExists(options.config, '配置文件');
        targets = configParser_1.ConfigParser.parseTargetsFromFile(options.config);
        console.log(chalk_1.default.gray(`从配置文件加载了 ${targets.length} 个 Target`));
    }
    if (options.target) {
        const cliTargets = options.target.map((bundleId) => configParser_1.ConfigParser.parseSimpleTarget(bundleId));
        targets = [...targets, ...cliTargets];
    }
    let profiles = [];
    if (options.profile) {
        validatePathsExist(options.profile, 'Profile');
        console.log(chalk_1.default.gray(`正在解析 Profile 文件...`));
        profiles = provisionParser_1.ProvisionParser.parseFiles(options.profile);
        console.log(chalk_1.default.gray(`共解析 ${profiles.length} 个 Profile`));
    }
    let certificates = [];
    if (options.certificate) {
        validatePathsExist(options.certificate, '证书');
        console.log(chalk_1.default.gray(`正在解析证书文件...`));
        certificates = certificateValidator_1.CertificateValidator.parseFiles(options.certificate, options.certPassword);
        console.log(chalk_1.default.gray(`共解析 ${certificates.length} 个证书`));
    }
    const warnDays = parseInt(options.warnDays, 10);
    if (isNaN(warnDays) || warnDays < 0) {
        console.error(chalk_1.default.red('错误: --warn-days 必须是一个非负整数'));
        process.exit(1);
    }
    const checkOptions = {
        profiles: options.profile || [],
        certificates: options.certificate || [],
        targets,
        outputDir: options.output,
        warnDaysBeforeExpiration: warnDays,
        strictMode: options.strict || false
    };
    console.log(chalk_1.default.gray(`\n正在执行检查...\n`));
    const report = checkEngine_1.CheckEngine.runFullCheck(profiles, certificates, targets, checkOptions);
    const outputFormats = {
        terminal: options.terminal !== false,
        json: options.json !== false,
        markdown: options.markdown !== false
    };
    reportGenerator_1.ReportGenerator.generateReport(report, options.output, outputFormats);
    process.exit(report.exitCode);
}
function validateFileExists(path, description) {
    if (!fs.existsSync(path)) {
        throw new Error(`${description}不存在: ${path}`);
    }
    if (!fs.statSync(path).isFile()) {
        throw new Error(`${description}不是文件: ${path}`);
    }
}
function validatePathsExist(paths, description) {
    paths.forEach(path => {
        if (!fs.existsSync(path)) {
            throw new Error(`${description}路径不存在: ${path}`);
        }
    });
}
program.parseAsync(process.argv).catch((error) => {
    console.error(chalk_1.default.red.bold('\n❌ 错误:'));
    console.error(chalk_1.default.red(`   ${error.message}`));
    process.exit(1);
});
//# sourceMappingURL=cli.js.map