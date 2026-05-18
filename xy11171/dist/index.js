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
const yargs = __importStar(require("yargs"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const parcelProcessor_1 = require("./parcelProcessor");
const processor = new parcelProcessor_1.ParcelProcessor();
async function main() {
    const argv = await yargs
        .command('process <files...>', '处理包裹数据文件', (yargs) => {
        return yargs.positional('files', {
            describe: '要处理的CSV文件路径（支持多个文件）',
            type: 'string',
            array: true,
        });
    })
        .option('output', {
        alias: 'o',
        type: 'string',
        description: '输出报告文件路径',
    })
        .option('fail-fast', {
        type: 'boolean',
        description: '遇到错误时立即停止',
        default: false,
    })
        .demandCommand(1, '请指定要执行的命令')
        .help()
        .argv;
    const command = argv._[0];
    if (command === 'process') {
        const files = argv.files;
        const outputPath = argv.output;
        const failFast = argv['fail-fast'];
        console.log(chalk_1.default.blue('═══════════════════════════════════════════════════════════════'));
        console.log(chalk_1.default.blue('              快递驿站包裹找回 CLI 工具'));
        console.log(chalk_1.default.blue('═══════════════════════════════════════════════════════════════\n'));
        const results = [];
        let hasError = false;
        for (const file of files) {
            const absolutePath = path.resolve(file);
            console.log(chalk_1.default.yellow(`处理文件: ${path.basename(file)}`));
            try {
                const result = await processor.processFile(absolutePath);
                results.push(result);
                if (result.success) {
                    console.log(chalk_1.default.green(`  ✓ 成功处理: ${result.validRecords} 条有效记录`));
                    if (result.anomalies.length > 0) {
                        console.log(chalk_1.default.yellow(`  ⚠ 发现 ${result.anomalies.length} 条异常`));
                    }
                }
                else {
                    hasError = true;
                    console.log(chalk_1.default.red(`  ✗ 处理失败`));
                    result.errors.forEach(error => {
                        console.log(chalk_1.default.red(`    - ${error.message}`));
                    });
                    if (failFast) {
                        console.log(chalk_1.default.red('\n启用了 fail-fast 模式，停止后续处理'));
                        break;
                    }
                }
                console.log('');
            }
            catch (error) {
                hasError = true;
                console.log(chalk_1.default.red(`  ✗ 处理异常: ${error.message}`));
                if (failFast) {
                    break;
                }
            }
        }
        const report = processor.generateSummaryReport(results);
        console.log(report);
        if (outputPath) {
            const absoluteOutput = path.resolve(outputPath);
            fs.writeFileSync(absoluteOutput, report, 'utf-8');
            console.log(chalk_1.default.green(`\n报告已保存至: ${absoluteOutput}`));
        }
        if (hasError) {
            process.exit(1);
        }
    }
}
main().catch(error => {
    console.error(chalk_1.default.red('执行失败:'), error);
    process.exit(1);
});
