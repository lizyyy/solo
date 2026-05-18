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
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const chalk_1 = __importDefault(require("chalk"));
const fileParser_1 = require("./parsers/fileParser");
const estimationEngine_1 = require("./rules/estimationEngine");
const exceptionReporter_1 = require("./report/exceptionReporter");
const defaultConfig_1 = require("./rules/defaultConfig");
const program = new commander_1.Command();
program
    .name('moving-estimate')
    .description('搬家调度队 - 装车估算CLI工具')
    .version('1.0.0');
program
    .command('estimate')
    .description('执行装车估算')
    .argument('<files...>', '要处理的文件路径')
    .option('--no-elevator', '目标地点无电梯')
    .option('--floors <number>', '楼层数', '3')
    .option('--output-json <path>', '输出JSON报告路径')
    .option('--output-text <path>', '输出文本报告路径')
    .option('--show-rules', '显示默认估算规则')
    .action(async (files, options) => {
    if (options.showRules) {
        console.log(chalk_1.default.bold.blue('\n默认估算规则:'));
        console.log(defaultConfig_1.volumeCalculationFormula);
        console.log(defaultConfig_1.weightCalculationFormula);
        console.log(defaultConfig_1.specialCaseRulesDescription);
        console.log(chalk_1.default.bold('车辆配置:'));
        for (const truck of defaultConfig_1.defaultEstimationConfig.truckTypes) {
            console.log(`  ${truck.name}: 最大体积=${truck.maxVolume}m³, 最大重量=${truck.maxWeight}kg, 基础费用=${truck.baseCost}元`);
        }
        console.log('');
        return;
    }
    const filePaths = files.map(file => {
        if (path.isAbsolute(file)) {
            return file;
        }
        return path.resolve(process.cwd(), file);
    });
    for (const filePath of filePaths) {
        if (!fs.existsSync(filePath)) {
            console.error(chalk_1.default.red(`错误: 文件不存在 - ${filePath}`));
            process.exit(1);
        }
    }
    console.log(chalk_1.default.bold.blue('\n搬家调度队 - 装车估算开始'));
    console.log(chalk_1.default.gray(`处理文件: ${files.join(', ')}`));
    console.log(chalk_1.default.gray(`无电梯模式: ${options.noElevator ? '开启' : '关闭'}`));
    if (options.noElevator) {
        console.log(chalk_1.default.gray(`楼层数: ${options.floors}`));
    }
    console.log('');
    const fileParser = new fileParser_1.FileParser();
    const estimationEngine = new estimationEngine_1.EstimationEngine();
    const exceptionReporter = new exceptionReporter_1.ExceptionReporter();
    try {
        const parseResults = await fileParser.parseFiles(filePaths);
        const estimationResults = parseResults.map(result => {
            const validItems = result.items.filter(item => item.data !== null);
            return estimationEngine.estimate(validItems, !options.noElevator, parseInt(options.floors, 10));
        });
        for (let i = 0; i < estimationResults.length; i++) {
            const result = estimationResults[i];
            const fileName = parseResults[i].fileName;
            console.log(chalk_1.default.bold.green(`\n[${fileName}] 估算结果:`));
            console.log(`  总体积: ${result.totalVolume.toFixed(3)} m³`);
            console.log(`  总重量: ${result.totalWeight.toFixed(2)} kg`);
            console.log(`  调整后体积: ${result.adjustedVolume.toFixed(3)} m³`);
            console.log(`  调整后重量: ${result.adjustedWeight.toFixed(2)} kg`);
            console.log(chalk_1.default.bold('\n  推荐车辆:'));
            for (const rec of result.recommendedTrucks.slice(0, 3)) {
                console.log(`    ${rec.truckType.name} x ${rec.quantity}: ${rec.totalCost} 元`);
            }
            console.log(chalk_1.default.bold('\n  明细:'));
            for (const detail of result.estimationDetails) {
                const notes = detail.notes.length > 0 ? ` [${detail.notes.join(', ')}]` : '';
                console.log(`    [${detail.fileName}:${detail.lineNumber}] ${detail.itemName}: ` +
                    `${detail.volume.toFixed(3)}m³ / ${detail.weight.toFixed(2)}kg` +
                    `${notes}`);
            }
        }
        const report = exceptionReporter.generateReport(parseResults, estimationResults);
        exceptionReporter.printConsoleReport(report);
        if (options.outputJson) {
            const outputPath = path.isAbsolute(options.outputJson)
                ? options.outputJson
                : path.resolve(process.cwd(), options.outputJson);
            exceptionReporter.saveJsonReport(report, outputPath);
        }
        if (options.outputText) {
            const outputPath = path.isAbsolute(options.outputText)
                ? options.outputText
                : path.resolve(process.cwd(), options.outputText);
            exceptionReporter.saveTextReport(report, outputPath);
        }
    }
    catch (error) {
        console.error(chalk_1.default.red(`\n处理失败: ${error.message}`));
        process.exit(1);
    }
});
program
    .command('sample')
    .description('使用样例数据演示')
    .option('--no-elevator', '模拟无电梯场景')
    .option('--output-json <path>', '输出JSON报告路径')
    .option('--output-text <path>', '输出文本报告路径')
    .action(async (options) => {
    const samplesDir = path.resolve(__dirname, '../samples');
    if (!fs.existsSync(samplesDir)) {
        console.error(chalk_1.default.red('错误: 样例目录不存在'));
        process.exit(1);
    }
    const sampleFiles = [
        'normal_furniture.csv',
        'large_non_disassemblable.csv',
        'with_errors.csv',
        'office_moving.csv'
    ].map(file => path.join(samplesDir, file));
    console.log(chalk_1.default.bold.blue('\n搬家调度队 - 装车估算演示'));
    console.log(chalk_1.default.gray('使用样例文件: ' + sampleFiles.map(f => path.basename(f)).join(', ')));
    console.log(chalk_1.default.gray(`无电梯模式: ${options.noElevator ? '开启' : '关闭'}`));
    console.log('');
    const fileParser = new fileParser_1.FileParser();
    const estimationEngine = new estimationEngine_1.EstimationEngine();
    const exceptionReporter = new exceptionReporter_1.ExceptionReporter();
    try {
        const parseResults = await fileParser.parseFiles(sampleFiles);
        const estimationResults = parseResults.map(result => {
            const validItems = result.items.filter(item => item.data !== null);
            return estimationEngine.estimate(validItems, !options.noElevator, 3);
        });
        for (let i = 0; i < estimationResults.length; i++) {
            const result = estimationResults[i];
            const fileName = parseResults[i].fileName;
            console.log(chalk_1.default.bold.green(`\n[${fileName}] 估算结果:`));
            console.log(`  总体积: ${result.totalVolume.toFixed(3)} m³`);
            console.log(`  总重量: ${result.totalWeight.toFixed(2)} kg`);
            console.log(`  调整后体积: ${result.adjustedVolume.toFixed(3)} m³`);
            console.log(`  调整后重量: ${result.adjustedWeight.toFixed(2)} kg`);
            console.log(chalk_1.default.bold('\n  推荐车辆:'));
            for (const rec of result.recommendedTrucks.slice(0, 2)) {
                console.log(`    ${rec.truckType.name} x ${rec.quantity}: ${rec.totalCost} 元`);
            }
        }
        const report = exceptionReporter.generateReport(parseResults, estimationResults);
        exceptionReporter.printConsoleReport(report);
        if (options.outputJson) {
            const outputPath = path.isAbsolute(options.outputJson)
                ? options.outputJson
                : path.resolve(process.cwd(), options.outputJson);
            exceptionReporter.saveJsonReport(report, outputPath);
        }
        if (options.outputText) {
            const outputPath = path.isAbsolute(options.outputText)
                ? options.outputText
                : path.resolve(process.cwd(), options.outputText);
            exceptionReporter.saveTextReport(report, outputPath);
        }
    }
    catch (error) {
        console.error(chalk_1.default.red(`\n处理失败: ${error.message}`));
        process.exit(1);
    }
});
program
    .command('rules')
    .description('显示默认估算规则')
    .action(() => {
    console.log(chalk_1.default.bold.blue('\n搬家调度队 - 默认估算规则'));
    console.log('='.repeat(60));
    console.log(defaultConfig_1.volumeCalculationFormula);
    console.log(defaultConfig_1.weightCalculationFormula);
    console.log(defaultConfig_1.specialCaseRulesDescription);
    console.log(chalk_1.default.bold('车辆配置:'));
    for (const truck of defaultConfig_1.defaultEstimationConfig.truckTypes) {
        console.log(`  ${truck.name}:`);
        console.log(`    最大体积: ${truck.maxVolume} m³`);
        console.log(`    最大重量: ${truck.maxWeight} kg`);
        console.log(`    基础费用: ${truck.baseCost} 元`);
    }
    console.log('');
});
program.parse();
