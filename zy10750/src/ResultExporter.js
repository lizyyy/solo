const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const xlsx = require('xlsx');

class ResultExporter {
  constructor(outputDir, force = false) {
    this.outputDir = outputDir;
    this.force = force;
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (fs.existsSync(this.outputDir)) {
      if (!this.force) {
        throw new Error(`输出目录已存在，使用 --force 覆盖: ${this.outputDir}`);
      }
      this.clearDirectory(this.outputDir);
    } else {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  clearDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      if (fs.lstatSync(filePath).isDirectory()) {
        this.clearDirectory(filePath);
        fs.rmdirSync(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    }
  }

  async export(results) {
    await this.exportSummary(results);
    await this.exportMatched(results);
    await this.exportPriceChanges(results);
    await this.exportSpecialCases(results);
    await this.exportOnlyOldNew(results);
  }

  async exportSummary(results) {
    const summaryData = [
      { category: '供应商报价表二次议价比对 - 基础统计', item: '旧报价记录数', value: results.stats.oldCount },
      { category: '供应商报价表二次议价比对 - 基础统计', item: '新报价记录数', value: results.stats.newCount },
      { category: '供应商报价表二次议价比对 - 基础统计', item: '成功匹配数', value: results.stats.matchedCount },
      { category: '供应商报价表二次议价比对 - 基础统计', item: '仅旧报价数', value: results.stats.onlyOldCount },
      { category: '供应商报价表二次议价比对 - 基础统计', item: '仅新报价数', value: results.stats.onlyNewCount },
      { category: '', item: '', value: '' },
      { category: '供应商报价表二次议价比对 - 特殊情况', item: '币种不同记录数', value: results.specialCases.differentCurrency.length },
      { category: '供应商报价表二次议价比对 - 特殊情况', item: '阶梯价记录数', value: results.specialCases.tieredPricing.length },
      { category: '供应商报价表二次议价比对 - 特殊情况', item: '过期报价记录数', value: results.specialCases.expiredQuotes.length },
      { category: '供应商报价表二次议价比对 - 特殊情况', item: '重复行记录数', value: results.specialCases.duplicateRows.length },
      { category: '供应商报价表二次议价比对 - 特殊情况', item: '数据异常行', value: results.specialCases.badRows.length }
    ];

    const csvWriter = createObjectCsvWriter({
      path: path.join(this.outputDir, '01_比对汇总.csv'),
      header: [
        { id: 'category', title: '分类' },
        { id: 'item', title: '项目' },
        { id: 'value', title: '数值' }
      ]
    });
    await csvWriter.writeRecords(summaryData);
  }

  async exportMatched(results) {
    const records = results.matched.map((m, idx) => ({
      序号: idx + 1,
      供应商名称: m.supplierName,
      产品编码: m.productCode,
      产品名称: m.productName,
      旧报价单价: m.oldPrice,
      新报价单价: m.newPrice,
      差价: m.changeAmount,
      差价百分比: m.changePercent !== null ? `${m.changePercent}%` : '',
      旧报价币种: m.oldCurrency,
      新报价币种: m.newCurrency,
      旧报价有效期: m.oldValidUntil || '',
      新报价有效期: m.newValidUntil || ''
    }));

    const csvWriter = createObjectCsvWriter({
      path: path.join(this.outputDir, '02_成功匹配报价.csv'),
      header: Object.keys(records[0] || {}).map(k => ({ id: k, title: k }))
    });
    if (records.length > 0) {
      await csvWriter.writeRecords(records);
    }
  }

  async exportPriceChanges(results) {
    const records = results.priceChanges.map((m, idx) => ({
      序号: idx + 1,
      供应商名称: m.supplierName,
      产品编码: m.productCode,
      产品名称: m.productName,
      旧报价单价: m.oldPrice,
      新报价单价: m.newPrice,
      差价: m.changeAmount,
      差价百分比: `${m.changePercent}%`,
      变动类型: m.changePercent < 0 ? '降价' : '涨价'
    }));

    const csvWriter = createObjectCsvWriter({
      path: path.join(this.outputDir, '03_价格变动明细.csv'),
      header: Object.keys(records[0] || {}).map(k => ({ id: k, title: k }))
    });
    if (records.length > 0) {
      await csvWriter.writeRecords(records);
    }
  }

  async exportSpecialCases(results) {
    if (results.specialCases.differentCurrency.length > 0) {
      await this.exportToCsv(
        '04_币种不一致.csv',
        results.specialCases.differentCurrency,
        ['supplierName', 'productCode', 'productName', 'oldPrice', 'newPrice', 'oldCurrency', 'newCurrency', 'description']
      );
    }

    if (results.specialCases.tieredPricing.length > 0) {
      await this.exportToCsv(
        '05_阶梯价记录.csv',
        results.specialCases.tieredPricing,
        ['source', 'rowIndex', 'quote.supplierName', 'quote.productCode', 'quote.productName', 'minQuantity', 'maxQuantity', 'description']
      );
    }

    if (results.specialCases.expiredQuotes.length > 0) {
      await this.exportToCsv(
        '06_过期报价.csv',
        results.specialCases.expiredQuotes,
        ['source', 'rowIndex', 'quote.supplierName', 'quote.productCode', 'quote.productName', 'validUntil', 'description']
      );
    }

    if (results.specialCases.duplicateRows.length > 0) {
      await this.exportToCsv(
        '07_重复行.csv',
        results.specialCases.duplicateRows,
        ['source', 'firstRow', 'duplicateRow', 'key', 'description']
      );
    }

    if (results.specialCases.badRows.length > 0) {
      await this.exportToCsv(
        '08_数据异常行.csv',
        results.specialCases.badRows,
        ['source', 'rowIndex', 'missingFields', 'description']
      );
    }
  }

  async exportOnlyOldNew(results) {
    if (results.onlyOld.length > 0) {
      await this.exportToCsv(
        '09_仅旧报价存在.csv',
        results.onlyOld,
        ['key', 'description']
      );
    }

    if (results.onlyNew.length > 0) {
      await this.exportToCsv(
        '10_仅新报价存在.csv',
        results.onlyNew,
        ['key', 'description']
      );
    }
  }

  async exportToCsv(filename, data, fields) {
    const records = data.map((item, idx) => {
      const record = { 序号: idx + 1 };
      for (const field of fields) {
        const parts = field.split('.');
        let value = item;
        for (const part of parts) {
          value = value ? value[part] : '';
        }
        record[field] = Array.isArray(value) ? value.join(', ') : (value || '');
      }
      return record;
    });

    const csvWriter = createObjectCsvWriter({
      path: path.join(this.outputDir, filename),
      header: Object.keys(records[0] || {}).map(k => ({ id: k, title: k }))
    });
    if (records.length > 0) {
      await csvWriter.writeRecords(records);
    }
  }
}

module.exports = ResultExporter;
