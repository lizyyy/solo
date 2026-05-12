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
exports.executeReport = executeReport;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const chalk_1 = __importDefault(require("chalk"));
const storage_1 = require("../utils/storage");
const calculation_service_1 = require("../services/calculation-service");
async function executeReport(options) {
    const dataDir = path.resolve(options.dataDir);
    const storage = new storage_1.StorageService(dataDir);
    if (!storage.exists()) {
        console.log(`❌ 项目不存在: ${dataDir}`);
        console.log('请先运行 ssc init 初始化项目。');
        return;
    }
    const config = storage.getConfig();
    console.log(`\n📊 生成社保基数申报报告...`);
    console.log(`   申报年度: ${config.declarationYear}年${config.declarationMonth}月`);
    const employees = storage.getEmployees();
    const salaries = storage.getSalaries();
    const employmentRecords = storage.getEmploymentRecords();
    const cityRules = storage.getCityRules();
    const historicalDeclarations = storage.getHistoricalDeclarations();
    const calcService = new calculation_service_1.CalculationService(employees, salaries, employmentRecords, cityRules, historicalDeclarations, config.declarationYear, config.declarationMonth);
    const results = calcService.calculateAll();
    const okResults = results.filter((r) => r.status === 'ok');
    const warningResults = results.filter((r) => r.status === 'warning');
    const errorResults = results.filter((r) => r.status === 'error');
    const supplementaryResults = results.filter((r) => r.needSupplementary);
    console.log(`\n${chalk_1.default.bgCyan.white(' 汇总统计 ')}`);
    console.log(`\n   员工总数: ${results.length}`);
    console.log(`   正常: ${chalk_1.default.green(okResults.length)}`);
    console.log(`   警告: ${chalk_1.default.yellow(warningResults.length)}`);
    console.log(`   错误: ${chalk_1.default.red(errorResults.length)}`);
    console.log(`   需要补缴: ${chalk_1.default.red.bold(supplementaryResults.length)} 人`);
    const totalSupplementary = supplementaryResults.reduce((sum, r) => sum + r.supplementaryAmount, 0);
    console.log(`   补缴总额: ${chalk_1.default.red.bold(`¥${totalSupplementary.toLocaleString()}`)}`);
    console.log(`\n${chalk_1.default.bgYellow.white(' 需要补缴人员 ')}`);
    if (supplementaryResults.length > 0) {
        const supTable = new cli_table3_1.default({
            head: ['工号', '姓名', '部门', '城市', '建议基数', '补缴月份', '补缴金额'],
            style: { head: ['yellow'] },
            colAligns: ['center', 'center', 'center', 'center', 'right', 'center', 'right'],
        });
        supplementaryResults.forEach((r) => {
            supTable.push([
                r.employeeNo,
                r.employeeName,
                r.department,
                r.currentCity,
                `¥${r.suggestedBase.toLocaleString()}`,
                r.supplementaryMonths.join(','),
                chalk_1.default.red.bold(`¥${r.supplementaryAmount.toLocaleString()}`),
            ]);
        });
        console.log(supTable.toString());
    }
    else {
        console.log(`\n   ${chalk_1.default.green('✅ 无需要补缴的人员')}`);
    }
    console.log(`\n${chalk_1.default.bgGreen.white(' 建议申报基数明细 ')}`);
    const detailTable = new cli_table3_1.default({
        head: [
            '工号',
            '姓名',
            '部门',
            '城市',
            '原始基数',
            '建议基数',
            '调整原因',
            '状态',
        ],
        style: { head: ['green'] },
        colAligns: [
            'center',
            'center',
            'center',
            'center',
            'right',
            'right',
            'left',
            'center',
        ],
        colWidths: [10, 8, 10, 8, 12, 12, 30, 8],
    });
    const statusChalk = {
        ok: chalk_1.default.green,
        warning: chalk_1.default.yellow,
        error: chalk_1.default.red,
    };
    results.forEach((r) => {
        const adjustmentDisplay = r.adjustmentReason.length > 20
            ? r.adjustmentReason.substring(0, 20) + '...'
            : r.adjustmentReason;
        detailTable.push([
            r.employeeNo,
            r.employeeName,
            r.department,
            r.currentCity,
            `¥${r.originalBase.toLocaleString()}`,
            chalk_1.default.bold.green(`¥${r.suggestedBase.toLocaleString()}`),
            adjustmentDisplay,
            statusChalk[r.status](r.status.toUpperCase()),
        ]);
    });
    console.log(detailTable.toString());
    console.log(`\n${chalk_1.default.bgBlue.white(' 调整原因分析 ')}`);
    const reasonStats = new Map();
    results.forEach((r) => {
        if (!reasonStats.has(r.adjustmentReason)) {
            reasonStats.set(r.adjustmentReason, 0);
        }
        reasonStats.set(r.adjustmentReason, reasonStats.get(r.adjustmentReason) + 1);
    });
    Array.from(reasonStats.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([reason, count]) => {
        console.log(`   • ${reason}: ${count} 人`);
    });
    console.log(`\n${chalk_1.default.bgMagenta.white(' 城市规则 ')}`);
    const ruleTable = new cli_table3_1.default({
        head: ['城市', '年度', '下限', '上限', '生效日期'],
        style: { head: ['magenta'] },
        colAligns: ['center', 'center', 'right', 'right', 'center'],
    });
    cityRules.forEach((rule) => {
        ruleTable.push([
            rule.city,
            rule.year,
            `¥${rule.minBase.toLocaleString()}`,
            `¥${rule.maxBase.toLocaleString()}`,
            rule.effectiveDate,
        ]);
    });
    console.log(ruleTable.toString());
    if (options.output) {
        const outputPath = path.resolve(options.output);
        exportReport(results, totalSupplementary, outputPath);
        console.log(`\n✅ 报告已导出: ${outputPath}`);
    }
    storage.addOperationLog({
        command: 'report',
        operator: options.operator,
        parameters: {
            dataDir,
            output: options.output,
        },
        status: errorResults.length > 0 ? 'failed' : 'success',
        message: `生成报告 - ${okResults.length}正常/${warningResults.length}警告/${errorResults.length}错误`,
    });
    console.log(`\n💡 提示:`);
    console.log(`   • 查看单个员工详情: ssc detail --employee <工号/姓名> --data-dir ${dataDir}`);
    console.log(`   • 导出报告到文件: ssc report --output report.json --data-dir ${dataDir}`);
}
function exportReport(results, totalSupplementary, outputPath) {
    const report = {
        generatedAt: new Date().toISOString(),
        summary: {
            total: results.length,
            ok: results.filter((r) => r.status === 'ok').length,
            warning: results.filter((r) => r.status === 'warning').length,
            error: results.filter((r) => r.status === 'error').length,
            needSupplementary: results.filter((r) => r.needSupplementary).length,
            totalSupplementary,
        },
        details: results.map((r) => ({
            employeeId: r.employeeId,
            employeeNo: r.employeeNo,
            employeeName: r.employeeName,
            department: r.department,
            city: r.currentCity,
            originalBase: r.originalBase,
            suggestedBase: r.suggestedBase,
            adjustmentReason: r.adjustmentReason,
            needSupplementary: r.needSupplementary,
            supplementaryMonths: r.supplementaryMonths,
            supplementaryAmount: r.supplementaryAmount,
            warnings: r.warnings,
            status: r.status,
        })),
    };
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
}
