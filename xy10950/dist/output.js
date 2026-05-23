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
exports.printConsoleSummary = printConsoleSummary;
exports.writeCsvResults = writeCsvResults;
exports.writeMarkdownReport = writeMarkdownReport;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sync_1 = require("csv-stringify/sync");
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const types_1 = require("./types");
const levelColors = {
    [types_1.AbnormalLevel.NORMAL]: chalk_1.default.green,
    [types_1.AbnormalLevel.WARNING]: chalk_1.default.yellow,
    [types_1.AbnormalLevel.SEVERE]: chalk_1.default.magenta,
    [types_1.AbnormalLevel.CRITICAL]: chalk_1.default.red
};
const levelLabels = {
    [types_1.AbnormalLevel.NORMAL]: '正常',
    [types_1.AbnormalLevel.WARNING]: '警告',
    [types_1.AbnormalLevel.SEVERE]: '严重',
    [types_1.AbnormalLevel.CRITICAL]: '危急'
};
function printConsoleSummary(result) {
    console.log(chalk_1.default.bold.blue('\n' + '='.repeat(60)));
    console.log(chalk_1.default.bold.blue('🚚 货车油耗异常检测报告'));
    console.log(chalk_1.default.bold.blue('='.repeat(60) + '\n'));
    console.log(chalk_1.default.bold('📊 总体统计'));
    const summaryTable = new cli_table3_1.default({
        head: ['指标', '数值'],
        colWidths: [40, 15]
    });
    summaryTable.push(['车辆总数', result.summary.totalVehicles], ['油卡流水记录数', result.summary.totalFuelRecords], ['GPS里程记录数', result.summary.totalMileageRecords], ['数据解析错误数', result.summary.totalBadRecords], ['异常车辆数', chalk_1.default.red(result.summary.abnormalVehicles)], ['平均百公里油耗', `${result.summary.averageFuelConsumption.toFixed(2)} L`]);
    console.log(summaryTable.toString());
    console.log('');
    if (result.badRecords.length > 0) {
        console.log(chalk_1.default.bold.yellow('⚠️  数据解析错误记录'));
        const badTable = new cli_table3_1.default({
            head: ['文件类型', '原始行号', '错误信息', '原始数据'],
            colWidths: [12, 10, 25, 30]
        });
        for (const record of result.badRecords) {
            badTable.push([
                record.type,
                record.originalRow,
                record.error,
                record.rawData.substring(0, 25) + '...'
            ]);
        }
        console.log(badTable.toString());
        console.log('');
    }
    if (result.abnormalRecords.length > 0) {
        console.log(chalk_1.default.bold.red('🚨 异常车辆明细'));
        const abnormalTable = new cli_table3_1.default({
            head: ['车牌号', '司机', '异常类型', '级别', '实际油耗', '标准油耗', '偏差%'],
            colWidths: [12, 10, 15, 8, 12, 12, 10]
        });
        for (const record of result.abnormalRecords) {
            const levelColor = levelColors[record.level];
            abnormalTable.push([
                record.plateNumber,
                record.driverName,
                record.abnormalType,
                levelColor(levelLabels[record.level]),
                `${record.fuelConsumptionPer100km.toFixed(2)} L`,
                `${record.standardFuelConsumption.toFixed(2)} L`,
                `${record.deviationPercent >= 0 ? '+' : ''}${record.deviationPercent.toFixed(1)}%`
            ]);
        }
        console.log(abnormalTable.toString());
        console.log('');
    }
    if (result.routeGroups.size > 0) {
        console.log(chalk_1.default.bold.green('🛣️  路线分组统计'));
        const routeTable = new cli_table3_1.default({
            head: ['路线名称', '车辆数', '平均油耗'],
            colWidths: [25, 10, 15]
        });
        for (const [routeId, group] of result.routeGroups) {
            routeTable.push([
                group.routeName,
                group.vehicles.length,
                `${group.averageFuelConsumption.toFixed(2)} L/100km`
            ]);
        }
        console.log(routeTable.toString());
        console.log('');
    }
    console.log(chalk_1.default.bold.green('✅ 分析完成!'));
}
function writeCsvResults(result, outputDir) {
    const badRecordsCsv = (0, sync_1.stringify)(result.badRecords.map(r => ({
        type: r.type,
        originalRow: r.originalRow,
        error: r.error,
        rawData: r.rawData
    })), { header: true });
    fs.writeFileSync(path.join(outputDir, 'bad_records.csv'), badRecordsCsv);
    const summaryCsv = (0, sync_1.stringify)(result.vehicleSummaries.map(s => ({
        vehicleId: s.vehicleId,
        plateNumber: s.plateNumber,
        driverName: s.driverName,
        totalFuel: s.totalFuel.toFixed(2),
        totalDistance: s.totalDistance.toFixed(2),
        fuelConsumptionPer100km: s.fuelConsumptionPer100km.toFixed(2),
        standardFuelConsumption: s.standardFuelConsumption.toFixed(2),
        deviation: s.deviation.toFixed(2),
        deviationPercent: s.deviationPercent.toFixed(2)
    })), { header: true });
    fs.writeFileSync(path.join(outputDir, 'vehicle_summary.csv'), summaryCsv);
    const abnormalCsv = (0, sync_1.stringify)(result.abnormalRecords.map(r => ({
        vehicleId: r.vehicleId,
        plateNumber: r.plateNumber,
        driverName: r.driverName,
        abnormalType: r.abnormalType,
        description: r.description,
        level: levelLabels[r.level],
        fuelConsumptionPer100km: r.fuelConsumptionPer100km.toFixed(2),
        standardFuelConsumption: r.standardFuelConsumption.toFixed(2),
        deviation: r.deviation.toFixed(2),
        deviationPercent: r.deviationPercent.toFixed(2),
        totalFuel: r.totalFuel.toFixed(2),
        totalDistance: r.totalDistance.toFixed(2),
        routeId: r.routeId || '',
        routeName: r.routeName || '',
        relatedFuelRows: r.relatedRecords.fuelRecords.join(';'),
        relatedMileageRows: r.relatedRecords.mileageRecords.join(';')
    })), { header: true });
    fs.writeFileSync(path.join(outputDir, 'abnormal_records.csv'), abnormalCsv);
    const routeData = [];
    for (const [routeId, group] of result.routeGroups) {
        for (const vehicle of group.vehicles) {
            routeData.push({
                routeId,
                routeName: group.routeName,
                vehicleId: vehicle.vehicleId,
                plateNumber: vehicle.plateNumber,
                fuelConsumptionPer100km: vehicle.fuelConsumptionPer100km.toFixed(2)
            });
        }
    }
    const routeCsv = (0, sync_1.stringify)(routeData, { header: true });
    fs.writeFileSync(path.join(outputDir, 'route_analysis.csv'), routeCsv);
}
function writeMarkdownReport(result, outputDir, outputPath) {
    let md = '# 货车油耗异常检测报告\n\n';
    md += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    md += '## 📊 总体统计\n\n';
    md += '| 指标 | 数值 |\n';
    md += '|------|------|\n';
    md += `| 车辆总数 | ${result.summary.totalVehicles} |\n`;
    md += `| 油卡流水记录数 | ${result.summary.totalFuelRecords} |\n`;
    md += `| GPS里程记录数 | ${result.summary.totalMileageRecords} |\n`;
    md += `| 数据解析错误数 | ${result.summary.totalBadRecords} |\n`;
    md += `| 异常车辆数 | **${result.summary.abnormalVehicles}** |\n`;
    md += `| 平均百公里油耗 | ${result.summary.averageFuelConsumption.toFixed(2)} L |\n\n`;
    if (result.badRecords.length > 0) {
        md += '## ⚠️ 数据解析错误记录\n\n';
        md += '| 文件类型 | 原始行号 | 错误信息 | 原始数据 |\n';
        md += '|----------|----------|----------|----------|\n';
        for (const record of result.badRecords) {
            md += `| ${record.type} | ${record.originalRow} | ${record.error} | \`${record.rawData}\` |\n`;
        }
        md += '\n';
    }
    if (result.abnormalRecords.length > 0) {
        md += '## 🚨 异常车辆明细\n\n';
        const criticalCount = result.abnormalRecords.filter(r => r.level === types_1.AbnormalLevel.CRITICAL).length;
        const severeCount = result.abnormalRecords.filter(r => r.level === types_1.AbnormalLevel.SEVERE).length;
        const warningCount = result.abnormalRecords.filter(r => r.level === types_1.AbnormalLevel.WARNING).length;
        md += `### 异常级别统计\n\n`;
        md += `- 🔴 危急: ${criticalCount} 辆\n`;
        md += `- 🟣 严重: ${severeCount} 辆\n`;
        md += `- 🟡 警告: ${warningCount} 辆\n\n`;
        md += '### 异常车辆列表\n\n';
        md += '| 序号 | 车牌号 | 司机 | 异常类型 | 级别 | 实际油耗 | 标准油耗 | 偏差 | 路线 | 说明 |\n';
        md += '|------|--------|------|----------|------|----------|----------|------|------|------|\n';
        let idx = 1;
        for (const record of result.abnormalRecords) {
            const levelEmoji = record.level === types_1.AbnormalLevel.CRITICAL ? '🔴' :
                record.level === types_1.AbnormalLevel.SEVERE ? '🟣' : '🟡';
            md += `| ${idx++} | ${record.plateNumber} | ${record.driverName} | ${record.abnormalType} | ${levelEmoji} ${levelLabels[record.level]} | ${record.fuelConsumptionPer100km.toFixed(2)} L | ${record.standardFuelConsumption.toFixed(2)} L | ${record.deviationPercent >= 0 ? '+' : ''}${record.deviationPercent.toFixed(1)}% | ${record.routeName || '-'} | ${record.description} |\n`;
        }
        md += '\n';
        md += '### 重点关注建议\n\n';
        md += '1. **危急级别车辆**(🔴): 立即约谈司机，核查加油记录和GPS数据，排查是否存在偷油行为\n';
        md += '2. **严重级别车辆**(🟣): 3个工作日内核实车辆状态和行驶路线，检查是否存在车辆故障\n';
        md += '3. **警告级别车辆**(🟡): 纳入日常监控，持续观察油耗变化趋势\n';
        md += '4. **数据错误记录**: 请相关人员补录或修正原始数据\n\n';
    }
    if (result.routeGroups.size > 0) {
        md += '## 🛣️ 路线分组分析\n\n';
        md += '| 路线名称 | 车辆数 | 路线平均油耗 |\n';
        md += '|----------|--------|--------------|\n';
        for (const [routeId, group] of result.routeGroups) {
            md += `| ${group.routeName} | ${group.vehicles.length} | ${group.averageFuelConsumption.toFixed(2)} L/100km |\n`;
        }
        md += '\n';
    }
    md += '## 📋 所有车辆油耗统计\n\n';
    md += '| 车牌号 | 司机 | 总加油量(L) | 总里程(km) | 实际油耗(L/100km) | 标准油耗 | 偏差% | 状态 |\n';
    md += '|--------|------|-------------|------------|-------------------|----------|-------|------|\n';
    for (const summary of result.vehicleSummaries) {
        const isAbnormal = result.abnormalRecords.some(r => r.vehicleId === summary.vehicleId);
        const statusEmoji = isAbnormal ? '⚠️' : '✅';
        md += `| ${summary.plateNumber} | ${summary.driverName} | ${summary.totalFuel.toFixed(2)} | ${summary.totalDistance.toFixed(2)} | ${summary.fuelConsumptionPer100km.toFixed(2)} | ${summary.standardFuelConsumption.toFixed(2)} | ${summary.deviationPercent >= 0 ? '+' : ''}${summary.deviationPercent.toFixed(1)}% | ${statusEmoji} |\n`;
    }
    md += '\n';
    md += '---\n\n';
    md += '**备注**: \n';
    md += '- 实际油耗 = 总加油量 / 总里程 × 100\n';
    md += `- 偏差% = (实际油耗 - 标准油耗) / 标准油耗 × 100\n`;
    md += `- 异常判定阈值: 警告±15% / 严重±30% / 危急±50%\n`;
    fs.writeFileSync(path.join(outputDir, 'report.md'), md);
}
