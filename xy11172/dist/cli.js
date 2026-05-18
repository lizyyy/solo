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
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const processor_1 = require("./processor");
const fileHandler_1 = require("./fileHandler");
const reportGenerator_1 = require("./reportGenerator");
const program = new commander_1.Command();
program
    .name('clinic-return')
    .description('社区诊疗车库存回库 CLI 工具')
    .version('1.0.0');
program
    .command('process')
    .description('处理库存回库文件')
    .argument('<files...>', '要处理的CSV文件路径，支持多个文件')
    .option('-o, --output <dir>', '输出目录，默认为各文件所在目录的output文件夹')
    .option('-r, --reset', '重置已处理记录标记，允许重新处理已处理的记录')
    .action(async (files, options) => {
    const processor = new processor_1.InventoryProcessor();
    const fileHandler = new fileHandler_1.FileHandler();
    const reportGenerator = new reportGenerator_1.ReportGenerator();
    if (options.reset) {
        processor.resetProcessedKeys();
    }
    const fileSummaries = [];
    const allErrors = [];
    for (const filePath of files) {
        const absolutePath = path.resolve(filePath);
        if (!fs.existsSync(absolutePath)) {
            console.error(`文件不存在: ${filePath}`);
            continue;
        }
        if (!filePath.endsWith('.csv')) {
            console.error(`跳过非CSV文件: ${filePath}`);
            continue;
        }
        console.log(`正在处理: ${filePath}`);
        try {
            const records = fileHandler.readCsvFile(absolutePath);
            const result = processor.processRecords(records);
            const outputPaths = fileHandler.getOutputPaths(absolutePath);
            if (result.success.length > 0) {
                fileHandler.writeSuccessFile(outputPaths.success, result.success);
            }
            if (result.skipped.length > 0) {
                fileHandler.writeSkippedFile(outputPaths.skipped, result.skipped);
            }
            if (result.failed.length > 0) {
                fileHandler.writeFailedFile(outputPaths.failed, result.failed);
                const rerunRecords = result.failed.map(f => ({
                    车辆编号: f.车辆编号,
                    回库日期: f.回库日期,
                    药品编码: f.药品编码,
                    药品名称: f.药品名称,
                    批号: f.批号,
                    出库数量: f.出库数量,
                    销售数量: f.销售数量,
                    回库数量: f.回库数量,
                    途中报损数量: f.途中报损数量,
                    报损原因: f.报损原因,
                    拆分批号: f.拆分批号,
                    拆分后数量: f.拆分后数量,
                    状态: '待修正',
                    处理标记: '',
                    备注: f.错误信息
                }));
                fileHandler.writeRerunFile(outputPaths.rerun, rerunRecords);
                allErrors.push(...result.failed);
            }
            fileSummaries.push({
                filename: path.basename(filePath),
                totalRecords: records.length,
                successCount: result.success.length,
                skippedCount: result.skipped.length,
                failedCount: result.failed.length,
                errors: result.failed
            });
        }
        catch (error) {
            console.error(`处理文件 ${filePath} 时出错:`, error);
        }
    }
    const summary = {
        totalFiles: fileSummaries.length,
        totalRecords: fileSummaries.reduce((sum, f) => sum + f.totalRecords, 0),
        totalSuccess: fileSummaries.reduce((sum, f) => sum + f.successCount, 0),
        totalSkipped: fileSummaries.reduce((sum, f) => sum + f.skippedCount, 0),
        totalFailed: fileSummaries.reduce((sum, f) => sum + f.failedCount, 0),
        fileSummaries,
        errorSummary: {
            '途中报损异常': allErrors.filter(e => e.错误类型 === '途中报损异常'),
            '批号拆分异常': allErrors.filter(e => e.错误类型 === '批号拆分异常'),
            '数据校验失败': allErrors.filter(e => e.错误类型 === '数据校验失败'),
            '数量不匹配': allErrors.filter(e => e.错误类型 === '数量不匹配'),
            '必填项缺失': allErrors.filter(e => e.错误类型 === '必填项缺失')
        }
    };
    const report = reportGenerator.generateConsoleReport(summary);
    console.log(report);
    if (summary.totalFailed > 0) {
        process.exit(1);
    }
});
program
    .command('template')
    .description('生成样例数据文件')
    .option('-d, --dir <directory>', '输出目录，默认为当前目录下的samples文件夹')
    .action((options) => {
    const outputDir = options.dir || path.join(process.cwd(), 'samples');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    console.log(`正在生成样例文件到: ${outputDir}`);
    generateSampleData(outputDir);
    console.log('样例文件生成完成！');
});
function generateSampleData(outputDir) {
    const fileHandler = new fileHandler_1.FileHandler();
    const sample1 = [
        {
            车辆编号: 'CLINIC-VEH-001',
            回库日期: '2024-01-15',
            药品编码: 'MED001',
            药品名称: '感冒清热颗粒',
            批号: 'B2024001',
            出库数量: 100,
            销售数量: 50,
            回库数量: 45,
            途中报损数量: 5,
            报损原因: '包装破损',
            拆分批号: '',
            拆分后数量: 0,
            状态: '',
            处理标记: '',
            备注: ''
        },
        {
            车辆编号: 'CLINIC-VEH-001',
            回库日期: '2024-01-15',
            药品编码: 'MED002',
            药品名称: '布洛芬缓释胶囊',
            批号: 'B2024002',
            出库数量: 50,
            销售数量: 30,
            回库数量: 20,
            途中报损数量: 0,
            报损原因: '',
            拆分批号: '',
            拆分后数量: 0,
            状态: '',
            处理标记: '',
            备注: ''
        },
        {
            车辆编号: 'CLINIC-VEH-001',
            回库日期: '2024-01-15',
            药品编码: 'MED003',
            药品名称: '维生素C片',
            批号: 'B2024003',
            出库数量: 200,
            销售数量: 100,
            回库数量: 95,
            途中报损数量: 5,
            报损原因: '',
            拆分批号: '',
            拆分后数量: 0,
            状态: '',
            处理标记: '',
            备注: '报损原因为空，应该失败'
        },
        {
            车辆编号: 'CLINIC-VEH-002',
            回库日期: '2024-01-16',
            药品编码: 'MED004',
            药品名称: '阿莫西林胶囊',
            批号: 'B2024004',
            出库数量: 80,
            销售数量: 40,
            回库数量: 35,
            途中报损数量: 3,
            报损原因: '温度失控',
            拆分批号: 'B2024004-SPLIT-1',
            拆分后数量: 35,
            状态: '',
            处理标记: '',
            备注: ''
        },
        {
            车辆编号: 'CLINIC-VEH-002',
            回库日期: '2024-01-16',
            药品编码: 'MED005',
            药品名称: '连花清瘟胶囊',
            批号: 'B2024005',
            出库数量: 60,
            销售数量: 40,
            回库数量: 15,
            途中报损数量: 0,
            报损原因: '',
            拆分批号: 'B2024005-1',
            拆分后数量: 15,
            状态: '',
            处理标记: '',
            备注: '拆分批号格式错误，应该失败'
        }
    ];
    const sample2 = [
        {
            车辆编号: 'CLINIC-VEH-003',
            回库日期: '2024-01-17',
            药品编码: 'MED006',
            药品名称: '板蓝根颗粒',
            批号: 'B2024006',
            出库数量: 150,
            销售数量: 80,
            回库数量: 65,
            途中报损数量: 5,
            报损原因: '挤压变形',
            拆分批号: '',
            拆分后数量: 0,
            状态: '',
            处理标记: '',
            备注: ''
        },
        {
            车辆编号: 'CLINIC-VEH-003',
            回库日期: '2024-01-17',
            药品编码: '',
            药品名称: '健胃消食片',
            批号: 'B2024007',
            出库数量: 100,
            销售数量: 60,
            回库数量: 40,
            途中报损数量: 0,
            报损原因: '',
            拆分批号: '',
            拆分后数量: 0,
            状态: '',
            处理标记: '',
            备注: '药品编码为空，应该失败'
        },
        {
            车辆编号: 'CLINIC-VEH-003',
            回库日期: '2024-01-17',
            药品编码: 'MED008',
            药品名称: '藿香正气水',
            批号: 'B2024008',
            出库数量: 50,
            销售数量: 30,
            回库数量: 25,
            途中报损数量: 0,
            报损原因: '',
            拆分批号: '',
            拆分后数量: 0,
            状态: '',
            处理标记: '',
            备注: '数量不匹配，应该失败'
        },
        {
            车辆编号: 'CLINIC-VEH-004',
            回库日期: '2024-01-18',
            药品编码: 'MED009',
            药品名称: '复方甘草片',
            批号: 'B2024009',
            出库数量: 40,
            销售数量: 20,
            回库数量: 18,
            途中报损数量: 2,
            报损原因: '液体泄漏',
            拆分批号: '',
            拆分后数量: 0,
            状态: '处理完成',
            处理标记: '已处理',
            备注: '已处理，应该跳过'
        },
        {
            车辆编号: 'CLINIC-VEH-004',
            回库日期: '2024-01-18',
            药品编码: 'MED010',
            药品名称: '牛黄解毒片',
            批号: 'B2024010',
            出库数量: 60,
            销售数量: 35,
            回库数量: 22,
            途中报损数量: 3,
            报损原因: '其他',
            拆分批号: '',
            拆分后数量: 0,
            状态: '',
            处理标记: '',
            备注: ''
        }
    ];
    fileHandler.writeSuccessFile(path.join(outputDir, '诊疗车001-002回库.csv'), sample1);
    fileHandler.writeSuccessFile(path.join(outputDir, '诊疗车003-004回库.csv'), sample2);
    console.log(`  - 诊疗车001-002回库.csv (5条，含途中报损和批号拆分异常)`);
    console.log(`  - 诊疗车003-004回库.csv (5条，含必填项缺失和数量不匹配)`);
}
program.parse();
