#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cli_1 = require("./cli");
const inspector_1 = require("./inspector");
const exporter_1 = require("./exporter");
const types_1 = require("./types");
const chalk_1 = __importDefault(require("chalk"));
async function main() {
    try {
        const options = (0, cli_1.parseCLIArguments)();
        if (options.verbose) {
            console.log(chalk_1.default.gray('解析命令行参数完成'));
        }
        const validationErrors = (0, cli_1.validateOptions)(options);
        const errors = validationErrors.filter(e => e.severity === 'error');
        const warnings = validationErrors.filter(e => e.severity === 'warning');
        if (warnings.length > 0) {
            for (const warning of warnings) {
                console.log(chalk_1.default.yellow(`⚠️  警告: ${warning.message}`));
            }
        }
        if (errors.length > 0) {
            console.log(chalk_1.default.red.bold('❌ 参数验证失败:'));
            for (const error of errors) {
                console.log(chalk_1.default.red(`  - ${error.field}: ${error.message}`));
            }
            return types_1.EXIT_CODES.VALIDATION_ERROR;
        }
        if (options.verbose) {
            console.log(chalk_1.default.gray('参数验证通过'));
        }
        (0, cli_1.ensureOutputDirectory)(options.output);
        const existing = (0, cli_1.checkExistingFiles)(options.output, options.format);
        if (existing.exists && !options.overwrite && !options.append) {
            console.log(chalk_1.default.yellow('⚠️  检测到已存在的输出文件:'));
            for (const file of existing.files) {
                console.log(chalk_1.default.yellow(`  - ${file}`));
            }
            console.log(chalk_1.default.yellow('使用 --overwrite 覆盖，或 --append 追加'));
            return types_1.EXIT_CODES.VALIDATION_ERROR;
        }
        if (options.verbose) {
            console.log(chalk_1.default.gray(`输出目录: ${options.output}`));
            console.log(chalk_1.default.gray('开始执行巡检...'));
        }
        const result = (0, inspector_1.runInspection)(options);
        if (options.verbose) {
            console.log(chalk_1.default.gray('巡检完成，开始导出结果...'));
        }
        (0, exporter_1.exportResults)(result, options);
        if (result.summary.criticalRiskClients > 0) {
            return types_1.EXIT_CODES.CRITICAL_RISK_FOUND;
        }
        return types_1.EXIT_CODES.SUCCESS;
    }
    catch (error) {
        console.error(chalk_1.default.red.bold('❌ 执行过程中发生错误:'));
        console.error(chalk_1.default.red(error instanceof Error ? error.message : String(error)));
        if (process.env.DEBUG) {
            console.error(chalk_1.default.gray(error instanceof Error ? error.stack : ''));
        }
        return types_1.EXIT_CODES.PROCESSING_ERROR;
    }
}
main().then(exitCode => {
    process.exit(exitCode);
}).catch(() => {
    process.exit(types_1.EXIT_CODES.PROCESSING_ERROR);
});
//# sourceMappingURL=index.js.map