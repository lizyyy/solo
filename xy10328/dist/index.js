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
const DataStore_1 = require("./store/DataStore");
const ImportService_1 = require("./services/ImportService");
const CalculationService_1 = require("./services/CalculationService");
const ReportService_1 = require("./services/ReportService");
const path = __importStar(require("path"));
const program = new commander_1.Command();
const store = new DataStore_1.InMemoryDataStore();
const importService = new ImportService_1.ImportService(store);
const calculationService = new CalculationService_1.CalculationService(store);
const reportService = new ReportService_1.ReportService();
program
    .name('inventory')
    .description('生鲜店损耗盘点 CLI 工具')
    .version('1.0.0');
program
    .command('import')
    .description('导入数据文件（支持 JSON 和 CSV 格式）')
    .argument('<files...>', '要导入的文件路径，可以多个')
    .action(async (files) => {
    try {
        const absolutePaths = files.map(f => path.resolve(f));
        console.log('📦 正在导入数据...\n');
        const result = await importService.importFiles(absolutePaths);
        console.log(`✅ 导入完成：成功导入 ${result.imported} 条记录`);
        if (result.skipped > 0) {
            console.log(`⏭️  跳过 ${result.skipped} 条重复记录（保持幂等性）`);
        }
        if (result.errors.length > 0) {
            console.log(`\n⚠️  发现 ${result.errors.length} 个问题：`);
            console.log('─'.repeat(60));
            for (const error of result.errors) {
                console.log(`\n❌ ${error.message}`);
                console.log(`   详情：${error.details}`);
                if (error.recordId)
                    console.log(`   记录ID：${error.recordId}`);
                if (error.productCode)
                    console.log(`   商品：${error.productCode}`);
                if (error.batchId)
                    console.log(`   批次：${error.batchId}`);
                console.log(`   错误码：${error.code}`);
            }
            console.log('\n' + '─'.repeat(60));
            console.log('\n💡 处理建议：');
            console.log('   • 商品不存在：请先导入商品信息或检查商品编码是否正确');
            console.log('   • 批次不存在：请先导入该批次的采购记录');
            console.log('   • 库存不足：检查是否有遗漏的采购记录或销售记录是否重复');
            console.log('   • 报损超额：检查报损数量是否正确，或是否有未录入的采购记录');
            console.log('   • 价格负数：检查销售单价是否录入错误');
            process.exit(1);
        }
        console.log('\n📊 数据导入成功，可以运行 inventory summary 查看汇总或 inventory report 生成报告');
    }
    catch (error) {
        console.log('\n❌ 导入失败');
        console.log('─'.repeat(60));
        if (error instanceof Error) {
            console.log(`错误类型：${error.name}`);
            console.log(`错误信息：${error.message}`);
            if (error.message.includes('ENOENT') || error.message.includes('文件不存在')) {
                console.log('\n💡 很抱歉，我们找不到您指定的文件。请检查：');
                console.log('   • 文件名和路径是否正确');
                console.log('   • 文件是否被删除或移动到其他位置');
                console.log('   • 是否有拼写错误（注意文件名区分大小写）');
            }
            else if (error.message.includes('EACCES') || error.message.includes('权限')) {
                console.log('\n💡 很抱歉，我们没有权限读取这个文件。请检查：');
                console.log('   • 您是否有读取该文件的权限');
                console.log('   • 文件是否被其他程序锁定');
            }
            else if (error.message.includes('JSON') || error.message.includes('解析')) {
                console.log('\n💡 很抱歉，文件格式有问题。请检查：');
                console.log('   • JSON 文件格式是否正确（缺少逗号、括号不匹配等）');
                console.log('   • 文件是否损坏');
                console.log('   • 可以使用 JSON 验证工具检查文件格式');
            }
            else {
                console.log('\n💡 建议：');
                console.log('   • 检查文件是否完整');
                console.log('   • 尝试用其他工具打开文件确认内容');
                console.log('   • 联系技术支持获取帮助');
            }
        }
        else {
            console.log(`发生未知错误：${String(error)}`);
        }
        console.log('─'.repeat(60));
        process.exit(1);
    }
});
program
    .command('check')
    .description('检查数据异常')
    .action(() => {
    try {
        console.log('🔍 正在检查数据异常...\n');
        const exceptions = calculationService.detectExceptions();
        if (exceptions.length === 0) {
            console.log('✅ 数据检查通过，未发现异常情况');
            return;
        }
        console.log(`⚠️  发现 ${exceptions.length} 个异常情况：`);
        console.log('─'.repeat(60));
        const discrepancies = exceptions.filter(e => e.code === 'INVENTORY_DISCREPANCY');
        const highLosses = exceptions.filter(e => e.code === 'HIGH_LOSS_RATE');
        const negativeProfits = exceptions.filter(e => e.code === 'NEGATIVE_PROFIT');
        if (discrepancies.length > 0) {
            console.log(`\n📊 盘点不一致 (${discrepancies.length} 项)：`);
            for (const e of discrepancies) {
                console.log(`   • ${e.details}`);
            }
            console.log('\n💡 建议：请检查这些批次的销售记录和盘点记录是否正确录入，或是否存在偷盗情况。');
        }
        if (highLosses.length > 0) {
            console.log(`\n⚠️  损耗率过高 (${highLosses.length} 项)：`);
            for (const e of highLosses) {
                console.log(`   • ${e.details}`);
            }
            console.log('\n💡 建议：请检查采购质量、存储条件和销售流程，找出损耗原因并制定改进措施。');
        }
        if (negativeProfits.length > 0) {
            console.log(`\n💰 负毛利 (${negativeProfits.length} 项)：`);
            for (const e of negativeProfits) {
                console.log(`   • ${e.details}`);
            }
            console.log('\n💡 建议：请检查采购价格和销售价格是否合理，临期打折策略是否需要调整。');
        }
        console.log('\n' + '─'.repeat(60));
        console.log('\n📋 以上异常批次需要店长复核，请运行 inventory report 生成完整报告');
    }
    catch (error) {
        console.log('\n❌ 检查失败');
        console.log('─'.repeat(60));
        if (error instanceof Error) {
            console.log(`错误信息：${error.message}`);
        }
        else {
            console.log(`发生未知错误：${String(error)}`);
        }
        console.log('\n💡 建议：请确保先运行 inventory import 导入数据，再进行检查');
        console.log('─'.repeat(60));
        process.exit(1);
    }
});
program
    .command('summary')
    .description('按商品汇总数据')
    .option('--json', '以 JSON 格式输出', false)
    .action((options) => {
    try {
        const summaries = calculationService.calculateAllProducts();
        if (options.json) {
            console.log(JSON.stringify(summaries, null, 2));
            return;
        }
        if (summaries.length === 0) {
            console.log('ℹ️  暂无商品数据，请先运行 inventory import 导入数据');
            return;
        }
        console.log('📊 商品汇总\n');
        console.log('─'.repeat(100));
        console.log(`| ${'商品编码'.padEnd(10)} | ${'商品名称'.padEnd(10)} | ${'采购量'.padEnd(8)} | ${'销售量'.padEnd(8)} | ${'报损量'.padEnd(8)} | ${'理论库存'.padEnd(8)} | ${'实际库存'.padEnd(8)} | ${'毛利'.padEnd(10)} | ${'损耗率'.padEnd(8)} |`);
        console.log('─'.repeat(100));
        for (const p of summaries) {
            const diff = p.totalDiscrepancy;
            const diffStr = diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
            console.log(`| ${p.productCode.padEnd(10)} | ${p.productName.padEnd(10)} | ${p.totalPurchased.toFixed(2).padEnd(8)} | ${p.totalSold.toFixed(2).padEnd(8)} | ${p.totalLoss.toFixed(2).padEnd(8)} | ${p.expectedInventory.toFixed(2).padEnd(8)} | ${p.actualInventory.toFixed(2).padEnd(8)} | ${('¥' + p.totalGrossProfit.toFixed(2)).padEnd(10)} | ${(p.overallLossRate.toFixed(2) + '%').padEnd(8)} |`);
        }
        console.log('─'.repeat(100));
        console.log('\n💡 运行 inventory check 可查看异常情况，或 inventory report 生成完整报告');
    }
    catch (error) {
        console.log('\n❌ 汇总失败');
        console.log('─'.repeat(60));
        if (error instanceof Error) {
            console.log(`错误信息：${error.message}`);
        }
        else {
            console.log(`发生未知错误：${String(error)}`);
        }
        console.log('\n💡 建议：请确保先运行 inventory import 导入数据');
        console.log('─'.repeat(60));
        process.exit(1);
    }
});
program
    .command('report')
    .description('生成盘点报告')
    .option('-o, --output <path>', '报告输出路径', 'reports/inventory-report')
    .option('--json', '仅生成 JSON 格式报告', false)
    .option('--markdown', '仅生成 Markdown 格式报告', false)
    .action((options) => {
    try {
        console.log('📄 正在生成盘点报告...\n');
        const report = calculationService.generateReport();
        const outputPath = path.resolve(options.output);
        if (!options.json && !options.markdown) {
            reportService.exportToJson(report, `${outputPath}.json`);
            reportService.exportToMarkdown(report, `${outputPath}.md`);
            console.log(`✅ 报告已生成：`);
            console.log(`   • JSON格式：${outputPath}.json`);
            console.log(`   • Markdown格式：${outputPath}.md`);
        }
        else if (options.json) {
            reportService.exportToJson(report, `${outputPath}.json`);
            console.log(`✅ JSON 报告已生成：${outputPath}.json`);
        }
        else if (options.markdown) {
            reportService.exportToMarkdown(report, `${outputPath}.md`);
            console.log(`✅ Markdown 报告已生成：${outputPath}.md`);
        }
        console.log('\n📊 报告摘要：');
        console.log(`   • 商品种类：${report.summary.totalProducts} 种`);
        console.log(`   • 批次数量：${report.summary.totalBatches} 批`);
        console.log(`   • 总毛利：¥${report.summary.totalGrossProfit.toFixed(2)}`);
        console.log(`   • 综合损耗率：${report.summary.overallLossRate.toFixed(2)}%`);
        console.log(`   • 异常数量：${report.exceptions.length} 项`);
        console.log(`   • 需要复核：${report.needsReview.batches.length} 个批次`);
        if (report.needsReview.batches.length > 0) {
            console.log('\n⚠️  需要店长复核的批次：');
            for (const batchId of report.needsReview.batches) {
                const batch = report.batchCalculations.find(b => b.batchId === batchId);
                if (batch) {
                    const issues = [];
                    if (batch.inventoryDiscrepancy !== 0)
                        issues.push('盘点不一致');
                    if (batch.lossRate > 10)
                        issues.push('损耗率过高');
                    if (batch.grossProfitMargin < 0)
                        issues.push('负毛利');
                    console.log(`   • ${batch.productName} (批次 ${batchId}): ${issues.join('、')}`);
                }
            }
        }
    }
    catch (error) {
        console.log('\n❌ 生成报告失败');
        console.log('─'.repeat(60));
        if (error instanceof Error) {
            console.log(`错误类型：${error.name}`);
            console.log(`错误信息：${error.message}`);
            if (error.message.includes('EACCES') || error.message.includes('权限') || error.message.includes('EPERM')) {
                console.log('\n💡 很抱歉，我们没有权限写入文件。请检查：');
                console.log('   • 您是否有写入目标目录的权限');
                console.log('   • 磁盘空间是否充足');
                console.log('   • 文件是否被其他程序打开');
                console.log('   • 尝试使用 --output 指定其他目录');
            }
            else if (error.message.includes('ENOENT') || error.message.includes('目录')) {
                console.log('\n💡 很抱歉，目标目录不存在。请检查：');
                console.log('   • 路径是否正确');
                console.log('   • 是否需要先创建目录');
                console.log('   • 尝试使用其他路径');
            }
            else {
                console.log('\n💡 建议：');
                console.log('   • 检查磁盘空间是否充足');
                console.log('   • 尝试使用不同的输出路径');
                console.log('   • 联系技术支持获取帮助');
            }
        }
        else {
            console.log(`发生未知错误：${String(error)}`);
        }
        console.log('─'.repeat(60));
        process.exit(1);
    }
});
program.parseAsync(process.argv).catch((error) => {
    console.log('\n❌ 命令执行失败');
    console.log('─'.repeat(60));
    if (error instanceof Error) {
        console.log(`错误类型：${error.name}`);
        console.log(`错误信息：${error.message}`);
        if (error.message.includes('missing required argument')) {
            console.log('\n💡 很抱歉，命令缺少必要的参数。请检查：');
            console.log('   • 运行 inventory --help 查看命令用法');
            console.log('   • 确认所有必需的参数都已提供');
        }
        else if (error.message.includes('unknown option')) {
            console.log('\n💡 很抱歉，存在不支持的选项。请检查：');
            console.log('   • 运行 inventory --help 查看可用选项');
            console.log('   • 确认选项拼写是否正确');
        }
        else {
            console.log('\n💡 建议：');
            console.log('   • 运行 inventory --help 查看命令帮助');
            console.log('   • 检查命令参数是否正确');
        }
    }
    else {
        console.log(`发生未知错误：${String(error)}`);
    }
    console.log('─'.repeat(60));
    process.exit(1);
});
