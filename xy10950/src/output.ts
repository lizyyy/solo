import * as fs from 'fs';
import * as path from 'path';
import { stringify } from 'csv-stringify/sync';
import chalk from 'chalk';
import Table from 'cli-table3';
import { AnalysisResult, AbnormalLevel } from './types';

const levelColors: Record<AbnormalLevel, chalk.Chalk> = {
  [AbnormalLevel.NORMAL]: chalk.green,
  [AbnormalLevel.WARNING]: chalk.yellow,
  [AbnormalLevel.SEVERE]: chalk.magenta,
  [AbnormalLevel.CRITICAL]: chalk.red
};

const levelLabels: Record<AbnormalLevel, string> = {
  [AbnormalLevel.NORMAL]: '正常',
  [AbnormalLevel.WARNING]: '警告',
  [AbnormalLevel.SEVERE]: '严重',
  [AbnormalLevel.CRITICAL]: '危急'
};

export function printConsoleSummary(result: AnalysisResult): void {
  console.log(chalk.bold.blue('\n' + '='.repeat(60)));
  console.log(chalk.bold.blue('🚚 货车油耗异常检测报告'));
  console.log(chalk.bold.blue('='.repeat(60) + '\n'));

  console.log(chalk.bold('📊 总体统计'));
  const summaryTable = new Table({
    head: ['指标', '数值'],
    colWidths: [40, 15]
  });
  summaryTable.push(
    ['车辆总数', result.summary.totalVehicles],
    ['油卡流水记录数', result.summary.totalFuelRecords],
    ['GPS里程记录数', result.summary.totalMileageRecords],
    ['数据解析错误数', result.summary.totalBadRecords],
    ['异常车辆数', chalk.red(result.summary.abnormalVehicles)],
    ['平均百公里油耗', `${result.summary.averageFuelConsumption.toFixed(2)} L`]
  );
  console.log(summaryTable.toString());
  console.log('');

  if (result.badRecords.length > 0) {
    console.log(chalk.bold.yellow('⚠️  数据解析错误记录'));
    const badTable = new Table({
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
    console.log(chalk.bold.red('🚨 异常车辆明细'));
    const abnormalTable = new Table({
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
    console.log(chalk.bold.green('🛣️  路线分组统计'));
    const routeTable = new Table({
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

  console.log(chalk.bold.green('✅ 分析完成!'));
}

export function writeCsvResults(result: AnalysisResult, outputDir: string): void {
  const badRecordsCsv = stringify(
    result.badRecords.map(r => ({
      type: r.type,
      originalRow: r.originalRow,
      error: r.error,
      rawData: r.rawData
    })),
    { header: true }
  );
  fs.writeFileSync(path.join(outputDir, 'bad_records.csv'), badRecordsCsv);

  const summaryCsv = stringify(
    result.vehicleSummaries.map(s => ({
      vehicleId: s.vehicleId,
      plateNumber: s.plateNumber,
      driverName: s.driverName,
      totalFuel: s.totalFuel.toFixed(2),
      totalDistance: s.totalDistance.toFixed(2),
      fuelConsumptionPer100km: s.fuelConsumptionPer100km.toFixed(2),
      standardFuelConsumption: s.standardFuelConsumption.toFixed(2),
      deviation: s.deviation.toFixed(2),
      deviationPercent: s.deviationPercent.toFixed(2)
    })),
    { header: true }
  );
  fs.writeFileSync(path.join(outputDir, 'vehicle_summary.csv'), summaryCsv);

  const abnormalCsv = stringify(
    result.abnormalRecords.map(r => ({
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
    })),
    { header: true }
  );
  fs.writeFileSync(path.join(outputDir, 'abnormal_records.csv'), abnormalCsv);

  const routeData: any[] = [];
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
  const routeCsv = stringify(routeData, { header: true });
  fs.writeFileSync(path.join(outputDir, 'route_analysis.csv'), routeCsv);
}

export function writeMarkdownReport(result: AnalysisResult, outputDir: string, outputPath: string): void {
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
    
    const criticalCount = result.abnormalRecords.filter(r => r.level === AbnormalLevel.CRITICAL).length;
    const severeCount = result.abnormalRecords.filter(r => r.level === AbnormalLevel.SEVERE).length;
    const warningCount = result.abnormalRecords.filter(r => r.level === AbnormalLevel.WARNING).length;

    md += `### 异常级别统计\n\n`;
    md += `- 🔴 危急: ${criticalCount} 辆\n`;
    md += `- 🟣 严重: ${severeCount} 辆\n`;
    md += `- 🟡 警告: ${warningCount} 辆\n\n`;

    md += '### 异常车辆列表\n\n';
    md += '| 序号 | 车牌号 | 司机 | 异常类型 | 级别 | 实际油耗 | 标准油耗 | 偏差 | 路线 | 说明 |\n';
    md += '|------|--------|------|----------|------|----------|----------|------|------|------|\n';
    
    let idx = 1;
    for (const record of result.abnormalRecords) {
      const levelEmoji = record.level === AbnormalLevel.CRITICAL ? '🔴' :
                         record.level === AbnormalLevel.SEVERE ? '🟣' : '🟡';
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
