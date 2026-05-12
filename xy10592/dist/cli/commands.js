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
exports.createContext = createContext;
exports.executeInit = executeInit;
exports.executeImport = executeImport;
exports.executeCheck = executeCheck;
exports.executeDetail = executeDetail;
exports.executeReport = executeReport;
exports.printHelp = printHelp;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const FileStorage_1 = require("../storage/FileStorage");
const AssetService_1 = require("../services/AssetService");
const ReportService_1 = require("../services/ReportService");
const sampleData_1 = require("../data/sampleData");
const types_1 = require("../types");
function createContext(dataDir) {
    const storage = new FileStorage_1.FileStorage(dataDir);
    const assetService = new AssetService_1.AssetService(storage);
    const reportService = new ReportService_1.ReportService(storage);
    return { storage, assetService, reportService, dataDir };
}
async function executeInit(ctx) {
    console.log('\n=== 初始化数据目录 ===');
    console.log(`数据目录: ${ctx.dataDir}`);
    if (fs.existsSync(ctx.dataDir)) {
        const state = await ctx.storage.getState();
        if (state.initialized) {
            console.log('\n警告: 数据目录已存在，是否覆盖？(y/N)');
            return;
        }
    }
    await ctx.storage.initialize();
    console.log('\n✓ 初始化完成');
    console.log('  - 数据目录已创建');
    console.log('  - 所有数据文件已初始化');
    console.log('  - 系统状态已记录');
    console.log('\n下一步: 使用 import 命令导入样例数据');
}
async function executeImport(ctx, options) {
    console.log('\n=== 导入数据 ===');
    const state = await ctx.storage.getState();
    if (!state.initialized) {
        console.error('\n✗ 系统未初始化，请先执行 init 命令');
        process.exit(1);
    }
    let importData;
    if (options.invalid) {
        console.log('使用错误样例数据（用于演示失败路径）');
        importData = (0, sampleData_1.createInvalidSampleData)();
    }
    else if (options.sample) {
        console.log('使用内置样例数据');
        importData = (0, sampleData_1.createSampleData)();
    }
    else if (options.file) {
        const filePath = path.resolve(options.file);
        if (!fs.existsSync(filePath)) {
            console.error(`\n✗ 文件不存在: ${filePath}`);
            process.exit(1);
        }
        console.log(`从文件导入: ${filePath}`);
        importData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    else {
        console.error('\n✗ 请指定导入来源：--sample 或 --file <path>');
        process.exit(1);
    }
    const oldVersion = state.importVersion;
    const newVersion = oldVersion + 1;
    console.log(`\n导入版本: ${oldVersion} -> ${newVersion}`);
    await ctx.storage.importAll(importData, newVersion);
    console.log('\n✓ 数据导入完成');
    console.log(`  - 门店: ${importData.stores.length} 个`);
    console.log(`  - 资产: ${importData.assets.length} 个`);
    console.log(`  - 购置记录: ${importData.acquisitions.length} 条`);
    console.log(`  - 调拨记录: ${importData.transfers.length} 条`);
    console.log(`  - 维修记录: ${importData.repairs.length} 条`);
    console.log(`  - 报废记录: ${importData.scraps.length} 条`);
    console.log('\n下一步: 使用 check 命令验证数据完整性');
}
async function executeCheck(ctx) {
    console.log('\n=== 验证数据 ===');
    const state = await ctx.storage.getState();
    if (!state.initialized) {
        console.error('\n✗ 系统未初始化，请先执行 init 命令');
        process.exit(1);
    }
    if (state.importVersion === 0) {
        console.error('\n✗ 未导入数据，请先执行 import 命令');
        process.exit(1);
    }
    console.log('\n开始处理业务交易...');
    const result = await ctx.assetService.processAllTransactions('system');
    if (result.warnings.length > 0) {
        console.log('\n处理警告:');
        for (const warning of result.warnings) {
            console.log(`  ⚠ ${warning}`);
        }
    }
    await ctx.assetService.saveProcessingResults(result.assets, result.history, result.corrections);
    console.log('\n✓ 业务交易处理完成');
    console.log(`  - 更新资产: ${result.assets.length} 个`);
    console.log(`  - 历史记录: ${result.history.length} 条`);
    console.log('\n开始验证数据完整性...');
    const validation = await ctx.assetService.validateAll();
    console.log('\n验证结果:');
    console.log(`  有效: ${validation.valid ? '✓' : '✗'}`);
    console.log(`  错误: ${validation.errors.length} 个`);
    console.log(`  警告: ${validation.warnings.length} 个`);
    if (validation.errors.length > 0) {
        console.log('\n错误详情:');
        for (const error of validation.errors) {
            console.log(`  ✗ [${error.code}] ${error.message}`);
            if (error.assetId)
                console.log(`    资产: ${error.assetId}`);
            if (error.recordId)
                console.log(`    记录: ${error.recordId}`);
        }
    }
    if (validation.warnings.length > 0) {
        console.log('\n警告详情:');
        for (const warning of validation.warnings) {
            console.log(`  ⚠ [${warning.code}] ${warning.message}`);
        }
    }
    if (validation.errors.length > 0) {
        console.log('\n✗ 数据验证失败，请检查错误并修正');
        process.exit(1);
    }
    console.log('\n✓ 数据验证通过');
    console.log('\n下一步: 使用 detail 命令查看资产详情，或使用 report 命令生成报表');
}
async function executeDetail(ctx, assetId) {
    console.log(`\n=== 资产详情: ${assetId} ===`);
    const state = await ctx.storage.getState();
    if (!state.initialized) {
        console.error('\n✗ 系统未初始化，请先执行 init 命令');
        process.exit(1);
    }
    const detail = await ctx.assetService.getAssetDetail(assetId);
    if (!detail) {
        console.error(`\n✗ 未找到资产: ${assetId}`);
        process.exit(1);
    }
    const asset = detail.asset;
    const statusMap = {
        [types_1.AssetStatus.ACTIVE]: '正常',
        [types_1.AssetStatus.REPAIRING]: '维修中',
        [types_1.AssetStatus.SCRAPPED]: '已报废'
    };
    const categoryMap = {
        [types_1.AssetCategory.FREEZER]: '冰柜',
        [types_1.AssetCategory.CASH_REGISTER]: '收银机',
        [types_1.AssetCategory.COFFEE_MACHINE]: '咖啡机'
    };
    console.log('\n【基本信息】');
    console.log(`  资产编号: ${asset.code}`);
    console.log(`  资产名称: ${asset.name}`);
    console.log(`  资产类别: ${categoryMap[asset.category] || asset.category}`);
    console.log(`  当前状态: ${statusMap[asset.status] || asset.status}`);
    console.log(`  当前门店: ${detail.currentStore?.name || asset.currentStoreId} (${detail.currentStore?.code || ''})`);
    console.log(`  购置日期: ${asset.acquisitionDate}`);
    console.log(`  使用年限: ${asset.usefulLifeMonths} 个月 (剩余 ${asset.remainingLifeMonths} 个月)`);
    console.log(`  残值率: ${(asset.residualValueRate * 100).toFixed(0)}%`);
    console.log('\n【财务信息】');
    console.log(`  原值: ¥${asset.originalCost.toFixed(2)}`);
    console.log(`  累计折旧: ¥${asset.accumulatedDepreciation.toFixed(2)}`);
    console.log(`  净值: ¥${asset.netBookValue.toFixed(2)}`);
    if (detail.relatedRecords.acquisition) {
        const acq = detail.relatedRecords.acquisition;
        console.log('\n【购置记录】');
        console.log(`  供应商: ${acq.supplier}`);
        console.log(`  发票号: ${acq.invoiceNumber}`);
        console.log(`  操作员: ${acq.createdBy}`);
    }
    if (detail.relatedRecords.transfers.length > 0) {
        console.log('\n【调拨记录】');
        for (const transfer of detail.relatedRecords.transfers) {
            console.log(`  - ${transfer.transferDate}: 从 ${transfer.fromStoreId} 调至 ${transfer.toStoreId}`);
            console.log(`    原因: ${transfer.reason}`);
            console.log(`    移交人: ${transfer.transferor} -> 接收人: ${transfer.transferee}`);
        }
    }
    if (detail.relatedRecords.repairs.length > 0) {
        console.log('\n【维修记录】');
        for (const repair of detail.relatedRecords.repairs) {
            const typeText = repair.repairType === 'CAPITALIZED' ? '资本化' : '费用化';
            console.log(`  - ${repair.repairDate}: ${repair.description}`);
            console.log(`    类型: ${typeText}, 费用: ¥${repair.cost.toFixed(2)}`);
            if (repair.extendedLifeMonths > 0) {
                console.log(`    延长使用年限: ${repair.extendedLifeMonths} 个月`);
            }
        }
    }
    if (detail.relatedRecords.scrap) {
        const scrap = detail.relatedRecords.scrap;
        console.log('\n【报废记录】');
        console.log(`  报废日期: ${scrap.scrapDate}`);
        console.log(`  报废原因: ${scrap.reason}`);
        console.log(`  残值收入: ¥${scrap.scrapValue.toFixed(2)}`);
        console.log(`  审批人: ${scrap.approvedBy}`);
    }
    if (detail.history.length > 0) {
        console.log('\n【历史变更记录】');
        const typeMap = {
            [types_1.TransactionType.ACQUISITION]: '购置',
            [types_1.TransactionType.TRANSFER]: '调拨',
            [types_1.TransactionType.REPAIR]: '维修',
            [types_1.TransactionType.SCRAP]: '报废',
            [types_1.TransactionType.DEPRECIATION]: '折旧',
            [types_1.TransactionType.CORRECTION]: '人工修正'
        };
        for (const hist of detail.history) {
            const date = hist.createdAt.substring(0, 10);
            const type = typeMap[hist.transactionType] || hist.transactionType;
            console.log(`  - ${date} [${type}] ${hist.description}`);
            console.log(`    操作人: ${hist.operator}`);
            if (hist.beforeState && hist.afterState) {
                console.log(`    状态变更: 已记录`);
            }
        }
    }
    if (detail.corrections.length > 0) {
        console.log('\n【人工修正记录】');
        for (const corr of detail.corrections) {
            console.log(`  - ${corr.createdAt.substring(0, 10)}: ${corr.fieldName}`);
            console.log(`    从: ${corr.oldValue} -> 到: ${corr.newValue}`);
            console.log(`    原因: ${corr.reason}, 操作人: ${corr.operator}`);
        }
    }
    if (detail.depreciationHistory.length > 0) {
        console.log('\n【折旧明细】');
        for (const dep of detail.depreciationHistory) {
            console.log(`  - ${dep.periodYear}年${dep.periodMonth}月: ¥${dep.depreciationAmount.toFixed(2)}`);
            console.log(`    方法: ${dep.calculationMethod}`);
        }
    }
}
async function executeReport(ctx, options) {
    console.log('\n=== 财务报表 ===');
    const state = await ctx.storage.getState();
    if (!state.initialized) {
        console.error('\n✗ 系统未初始化，请先执行 init 命令');
        process.exit(1);
    }
    if (state.importVersion === 0) {
        console.error('\n✗ 未导入数据，请先执行 import 命令');
        process.exit(1);
    }
    if (options.year) {
        console.log(`期间: ${options.year}年${options.month ? options.month + '月' : ''}`);
    }
    const report = await ctx.reportService.generateReport(options.year, options.month);
    let targetReports = report.reports;
    if (options.store) {
        targetReports = report.reports.filter(r => r.storeId === options.store || r.storeCode === options.store);
        if (targetReports.length === 0) {
            console.error(`\n✗ 未找到门店: ${options.store}`);
            process.exit(1);
        }
    }
    console.log('\n========================================');
    console.log('              汇总报告');
    console.log('========================================');
    console.log(`门店总数: ${report.summary.totalStores} 家`);
    console.log(`资产总数: ${report.summary.totalAssets} 个`);
    console.log(`资产原值总额: ¥${report.summary.totalOriginalCost.toFixed(2)}`);
    console.log(`累计折旧总额: ¥${report.summary.totalAccumulatedDepreciation.toFixed(2)}`);
    console.log(`资产净值总额: ¥${report.summary.totalNetBookValue.toFixed(2)}`);
    if (report.summary.anomalies.length > 0) {
        console.log('\n----------------------------------------');
        console.log('              异常清单');
        console.log('----------------------------------------');
        for (const anomaly of report.summary.anomalies) {
            const icon = anomaly.type === 'error' ? '✗' : anomaly.type === 'warning' ? '⚠' : 'ℹ';
            console.log(`\n${icon} [${anomaly.code}]`);
            console.log(`   ${anomaly.message}`);
            if (anomaly.assetCode)
                console.log(`   资产: ${anomaly.assetCode}`);
        }
    }
    for (const storeReport of targetReports) {
        console.log(`\n========================================`);
        console.log(`门店: ${storeReport.storeName} (${storeReport.storeCode})`);
        console.log('========================================');
        console.log(`\n【门店汇总】`);
        console.log(`  资产数量: ${storeReport.totalAssets} 个`);
        console.log(`  原值总额: ¥${storeReport.totalOriginalCost.toFixed(2)}`);
        console.log(`  累计折旧: ¥${storeReport.totalAccumulatedDepreciation.toFixed(2)}`);
        console.log(`  净值总额: ¥${storeReport.totalNetBookValue.toFixed(2)}`);
        if (storeReport.assetBreakdown.length > 0) {
            console.log(`\n【分类明细】`);
            const categoryNames = {
                [types_1.AssetCategory.FREEZER]: '冰柜',
                [types_1.AssetCategory.CASH_REGISTER]: '收银机',
                [types_1.AssetCategory.COFFEE_MACHINE]: '咖啡机'
            };
            for (const item of storeReport.assetBreakdown) {
                const name = categoryNames[item.category] || item.category;
                console.log(`\n  ${name}:`);
                console.log(`    数量: ${item.count} 个`);
                console.log(`    原值: ¥${item.originalCost.toFixed(2)}`);
                console.log(`    累计折旧: ¥${item.accumulatedDepreciation.toFixed(2)}`);
                console.log(`    净值: ¥${item.netBookValue.toFixed(2)}`);
            }
        }
        if (storeReport.anomalies.length > 0) {
            console.log(`\n【门店异常】`);
            for (const anomaly of storeReport.anomalies) {
                const icon = anomaly.type === 'error' ? '✗' : anomaly.type === 'warning' ? '⚠' : 'ℹ';
                console.log(`  ${icon} [${anomaly.code}] ${anomaly.message}`);
            }
        }
    }
    console.log('\n========================================');
    console.log('              业务闭环检查');
    console.log('========================================');
    const hasErrors = report.summary.anomalies.some(a => a.type === 'error');
    const hasWarnings = report.summary.anomalies.some(a => a.type === 'warning');
    if (hasErrors) {
        console.log('\n✗ 业务未完全闭环');
        console.log('   存在数据错误，请查看异常清单并修正');
    }
    else if (hasWarnings) {
        console.log('\n⚠ 业务基本闭环，但存在警告');
        console.log('   请查看异常清单，确认警告是否需要处理');
    }
    else {
        console.log('\n✓ 业务完全闭环');
        console.log('   所有数据验证通过，无异常');
    }
    console.log('');
}
function printHelp() {
    console.log(`
门店设备折旧 CLI v1.0.0

使用方法:
  store-dep <command> [options]

命令:
  init                         初始化数据目录
  import [--sample|--invalid|--file <path>]  导入数据
  check                        验证数据完整性
  detail <asset-id>            查看资产详情
  report [--year <year>] [--month <month>] [--store <store-id>]
                               生成财务报表

选项:
  --sample                     使用内置样例数据
  --invalid                    使用错误样例数据（演示失败路径）
  --file <path>                从指定JSON文件导入
  --year <year>                报表年份
  --month <month>              报表月份
  --store <store-id>           指定门店
  --data-dir <path>            数据目录（默认: ./data）
  --help, -h                   显示帮助

示例:
  store-dep init
  store-dep import --sample
  store-dep check
  store-dep detail FRE-0001
  store-dep report --year 2024
`);
}
//# sourceMappingURL=commands.js.map