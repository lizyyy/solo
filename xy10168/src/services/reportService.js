const path = require('path');
const dayjs = require('dayjs');
const ExcelJS = require('exceljs');
const { ensureDir, writeJSON } = require('../utils/fileUtils');

class ReportService {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }
  
  async generateDailyReport(options = {}) {
    const reportDate = options.date || dayjs().format('YYYY-MM-DD');
    const outputDir = options.outputDir || './reports';
    ensureDir(outputDir);
    
    const inventory = this.dataStore.getInventory();
    const temperature = this.dataStore.getTemperature();
    const exceptions = this.dataStore.getExceptions();
    const importHistory = this.dataStore.getImportHistory();
    
    const report = {
      reportId: `RPT-${dayjs().format('YYYYMMDDHHmmss')}`,
      reportDate,
      generatedAt: dayjs().toISOString(),
      summary: {
        totalLots: inventory.lots.length,
        totalTemperatureRecords: temperature.records.length,
        totalExceptions: exceptions.records.length,
        openExceptions: exceptions.records.filter(e => e.status === 'open').length,
        importCountToday: importHistory.filter(h => 
          dayjs(h.timestamp).format('YYYY-MM-DD') === reportDate
        ).length
      },
      inventoryOverview: this.getInventoryOverview(inventory),
      temperatureOverview: this.getTemperatureOverview(temperature),
      exceptionsOverview: this.getExceptionsOverview(exceptions),
      importAuditTrail: this.getImportAuditTrail(importHistory, reportDate),
      dataSources: {
        inventorySource: 'inventory.json',
        temperatureSource: 'temperature.json',
        exceptionsSource: 'exceptions.json',
        importHistorySource: 'import-history.jsonl'
      }
    };
    
    const jsonReportPath = path.join(outputDir, `daily-report-${reportDate}.json`);
    const excelReportPath = path.join(outputDir, `daily-report-${reportDate}.xlsx`);
    
    writeJSON(jsonReportPath, report);
    await this.generateExcelReport(excelReportPath, report);
    
    return {
      reportDate,
      jsonReportPath,
      excelReportPath,
      summary: report.summary
    };
  }
  
  getInventoryOverview(inventory) {
    const zoneStats = {};
    
    for (const zone of ['冷冻区', '冷藏区', '保鲜区', '常温区']) {
      const zoneLots = inventory.lots.filter(l => l.zone === zone);
      zoneStats[zone] = {
        lotCount: zoneLots.length,
        totalQuantity: zoneLots.reduce((sum, l) => sum + (l.quantity || 0), 0),
        lotsPendingCount: zoneLots.filter(l => !l.lastCounted).length,
        lotsWithDifference: zoneLots.filter(l => 
          l.lastCounted && l.lastCounted.quantity !== l.quantity
        ).length
      };
    }
    
    const crossZoneMovements = inventory.crossZoneMovements.filter(m => 
      m.movementType === 'wms_update'
    ).length;
    
    return {
      byZone: zoneStats,
      totalCrossZoneMovements: crossZoneMovements,
      lotsWithHistory: inventory.lots.filter(l => l.history && l.history.length > 0).length
    };
  }
  
  getTemperatureOverview(temperature) {
    const tempByLot = new Map();
    for (const record of temperature.records) {
      if (!tempByLot.has(record.lotNumber)) {
        tempByLot.set(record.lotNumber, []);
      }
      tempByLot.get(record.lotNumber).push(record);
    }
    
    const lotsWithContinuousMonitoring = [];
    const lotsWithGaps = [];
    
    for (const [lotNumber, records] of tempByLot) {
      records.sort((a, b) => dayjs(a.recordTime).valueOf() - dayjs(b.recordTime).valueOf());
      let hasGap = false;
      for (let i = 1; i < records.length; i++) {
        const gapMinutes = dayjs(records[i].recordTime).diff(dayjs(records[i - 1].recordTime), 'minute');
        if (gapMinutes > 120) {
          hasGap = true;
          break;
        }
      }
      if (hasGap) {
        lotsWithGaps.push(lotNumber);
      } else {
        lotsWithContinuousMonitoring.push(lotNumber);
      }
    }
    
    return {
      lotsMonitored: tempByLot.size,
      lotsWithContinuousMonitoring: lotsWithContinuousMonitoring.length,
      lotsWithGaps: lotsWithGaps.length,
      totalRecords: temperature.records.length,
      averageRecordsPerLot: (temperature.records.length / Math.max(1, tempByLot.size)).toFixed(1)
    };
  }
  
  getExceptionsOverview(exceptions) {
    const byType = {};
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
    const openExceptions = exceptions.records.filter(e => e.status === 'open');
    const resolvedExceptions = exceptions.records.filter(e => e.status === 'resolved');
    
    for (const exception of exceptions.records) {
      if (!byType[exception.type]) {
        byType[exception.type] = 0;
      }
      byType[exception.type]++;
      bySeverity[exception.severity]++;
    }
    
    return {
      byType,
      bySeverity,
      open: openExceptions.length,
      resolved: resolvedExceptions.length,
      resolutionRate: exceptions.records.length > 0 
        ? ((resolvedExceptions.length / exceptions.records.length) * 100).toFixed(1)
        : '0.0'
    };
  }
  
  getImportAuditTrail(importHistory, reportDate) {
    const todayImports = importHistory.filter(h => 
      dayjs(h.timestamp).format('YYYY-MM-DD') === reportDate
    );
    
    return {
      totalImports: todayImports.length,
      imports: todayImports.map(h => ({
        timestamp: h.timestamp,
        type: h.type,
        fileName: h.fileName,
        totalRows: h.totalRows,
        successCount: h.successCount,
        errorCount: h.errors?.length || 0
      }))
    };
  }
  
  async generateExcelReport(filePath, report) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '冷库温区盘点 CLI';
    workbook.created = new Date();
    
    await this.addSummarySheet(workbook, report);
    await this.addInventorySheet(workbook, report);
    await this.addTemperatureSheet(workbook, report);
    await this.addExceptionsSheet(workbook, report);
    await this.addImportAuditSheet(workbook, report);
    
    await workbook.xlsx.writeFile(filePath);
  }
  
  async addSummarySheet(workbook, report) {
    const ws = workbook.addWorksheet('报告概览');
    
    ws.addRow(['冷库温区盘点日报']);
    ws.getCell('A1').font = { size: 16, bold: true };
    ws.mergeCells('A1:F1');
    
    ws.addRow([]);
    ws.addRow(['报告日期', report.reportDate]);
    ws.addRow(['生成时间', report.generatedAt]);
    ws.addRow(['报告ID', report.reportId]);
    
    ws.addRow([]);
    ws.addRow(['【数据来源】']);
    ws.addRow(['库存数据', report.dataSources.inventorySource]);
    ws.addRow(['温度数据', report.dataSources.temperatureSource]);
    ws.addRow(['异常数据', report.dataSources.exceptionsSource]);
    ws.addRow(['导入历史', report.dataSources.importHistorySource]);
    
    ws.addRow([]);
    ws.addRow(['【核心指标】']);
    const headerRow = ws.addRow(['指标', '数值']);
    headerRow.font = { bold: true };
    ws.addRow(['库存批号总数', report.summary.totalLots]);
    ws.addRow(['温度记录总数', report.summary.totalTemperatureRecords]);
    ws.addRow(['异常记录总数', report.summary.totalExceptions]);
    ws.addRow(['未处理异常', report.summary.openExceptions]);
    ws.addRow(['今日导入次数', report.summary.importCountToday]);
    
    ws.addRow([]);
    ws.addRow(['【温区统计】']);
    const zoneHeader = ws.addRow(['温区', '批号数', '总数量', '待盘点', '数量差异']);
    zoneHeader.font = { bold: true };
    for (const [zone, stats] of Object.entries(report.inventoryOverview.byZone)) {
      ws.addRow([
        zone,
        stats.lotCount,
        stats.totalQuantity,
        stats.lotsPendingCount,
        stats.lotsWithDifference
      ]);
    }
    
    ws.addRow([]);
    ws.addRow(['【异常严重度分布】']);
    const severityHeader = ws.addRow(['严重度', '数量']);
    severityHeader.font = { bold: true };
    ws.addRow(['Critical (紧急)', report.exceptionsOverview.bySeverity.critical]);
    ws.addRow(['High (高)', report.exceptionsOverview.bySeverity.high]);
    ws.addRow(['Medium (中)', report.exceptionsOverview.bySeverity.medium]);
    ws.addRow(['Low (低)', report.exceptionsOverview.bySeverity.low]);
    ws.addRow(['处理率', `${report.exceptionsOverview.resolutionRate}%`]);
    
    ws.columns = [
      { width: 25 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 }
    ];
  }
  
  async addInventorySheet(workbook, report) {
    const ws = workbook.addWorksheet('库存明细');
    
    const inventory = this.dataStore.getInventory();
    
    const header = ws.addRow([
      '批号', '商品名称', '温区', 'WMS数量', '单位', '入库日期', '保质期',
      '盘点数量', '盘点温区', '盘点人', '盘点时间', '版本', '更新来源'
    ]);
    header.font = { bold: true };
    
    for (const lot of inventory.lots) {
      ws.addRow([
        lot.lotNumber,
        lot.productName,
        lot.zone,
        lot.quantity,
        lot.unit,
        lot.entryDate,
        lot.expiryDate || '-',
        lot.lastCounted?.quantity || '-',
        lot.lastCounted?.zone || '-',
        lot.lastCounted?.countedBy || '-',
        lot.lastCounted?.countedAt || '-',
        lot.version || 1,
        lot.updateSource || '-'
      ]);
    }
    
    ws.columns = [
      { width: 20 }, { width: 20 }, { width: 12 }, { width: 12 }, { width: 10 },
      { width: 20 }, { width: 20 }, { width: 12 }, { width: 12 }, { width: 12 },
      { width: 25 }, { width: 8 }, { width: 15 }
    ];
  }
  
  async addTemperatureSheet(workbook, report) {
    const ws = workbook.addWorksheet('温度记录');
    
    const temperature = this.dataStore.getTemperature();
    
    const header = ws.addRow(['批号', '温区', '温度(°C)', '记录时间', '传感器ID', '导入时间']);
    header.font = { bold: true };
    
    for (const record of temperature.records) {
      ws.addRow([
        record.lotNumber,
        record.zone,
        record.temperature,
        record.recordTime,
        record.sensorId || '-',
        record.timestamp
      ]);
    }
    
    ws.columns = [
      { width: 20 }, { width: 12 }, { width: 12 }, { width: 25 },
      { width: 15 }, { width: 25 }
    ];
  }
  
  async addExceptionsSheet(workbook, report) {
    const ws = workbook.addWorksheet('异常明细');
    
    const exceptions = this.dataStore.getExceptions();
    
    const header = ws.addRow([
      '异常ID', '批号', '类型', '严重度', '状态', '原因', '来源',
      '证据摘要', '创建时间', '处理人', '处理方式', '处理时间'
    ]);
    header.font = { bold: true };
    
    for (const exception of exceptions.records) {
      let evidenceSummary = '-';
      if (exception.evidence) {
        evidenceSummary = JSON.stringify(exception.evidence).substring(0, 100);
      }
      
      ws.addRow([
        exception.id,
        exception.lotNumber,
        exception.type,
        exception.severity,
        exception.status,
        exception.reason,
        exception.source,
        evidenceSummary,
        exception.timestamp,
        exception.resolvedBy || '-',
        exception.resolution || '-',
        exception.resolvedAt || '-'
      ]);
    }
    
    ws.columns = [
      { width: 40 }, { width: 20 }, { width: 20 }, { width: 15 }, { width: 10 },
      { width: 50 }, { width: 20 }, { width: 50 }, { width: 25 },
      { width: 15 }, { width: 20 }, { width: 25 }
    ];
  }
  
  async addImportAuditSheet(workbook, report) {
    const ws = workbook.addWorksheet('导入审计');
    
    const importHistory = this.dataStore.getImportHistory();
    
    const header = ws.addRow([
      '导入时间', '类型', '文件名', '总行数', '成功', '更新', '跳过', '错误数', '错误摘要'
    ]);
    header.font = { bold: true };
    
    for (const imp of importHistory) {
      const errorSummary = imp.errors && imp.errors.length > 0
        ? imp.errors.slice(0, 3).map(e => `行${e.row}: ${e.reason}`).join('; ')
        : '-';
      
      ws.addRow([
        imp.importTime || imp.timestamp,
        imp.type,
        imp.fileName,
        imp.totalRows,
        imp.successCount,
        imp.updatedCount || 0,
        imp.skippedCount || 0,
        (imp.errors?.length || 0),
        errorSummary
      ]);
    }
    
    ws.columns = [
      { width: 25 }, { width: 15 }, { width: 30 }, { width: 10 },
      { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 60 }
    ];
  }
}

module.exports = ReportService;
