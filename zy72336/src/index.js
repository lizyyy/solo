const { DataManager } = require('./data/data-manager');
const NuclearDensityCalculator = require('./core/nuclear-density');
const UnifiedExporter = require('./export/unified-export');

class NuclearDensityPeakAnalysis {
  constructor(options = {}) {
    this.dataDir = options.dataDir || './data';
    this.dataManager = new DataManager(this.dataDir);
    this.calculator = new NuclearDensityCalculator(options.calculator || {});
    this.exporter = new UnifiedExporter(this.dataManager);
  }

  async importData(filePath, sourceName) {
    return await this.dataManager.importCSV(filePath, sourceName);
  }

  analyze(valueField = 'flow', options = {}) {
    const validRecords = this.dataManager.rawRecords.filter(r => {
      const value = parseFloat(r[valueField]);
      return !isNaN(value) && value >= 0;
    });

    const values = validRecords.map(r => parseFloat(r[valueField]));
    const results = this.calculator.analyzeFlow(values);
    
    this.dataManager.setCalculationResults({
      ...results,
      valueField,
      validRecordCount: validRecords.length,
      excludedRecordCount: this.dataManager.rawRecords.length - validRecords.length
    });

    return results;
  }

  recalculateAfterSupplement() {
    return this.analyze();
  }

  applyManualEdit(recordIndex, field, newValue, reason, operator) {
    return this.dataManager.applyManualEdit(recordIndex, field, newValue, reason, operator);
  }

  export(exportDir) {
    return this.exporter.exportAll(exportDir);
  }

  getConsistencyCheck() {
    return this.exporter.verifyExportConsistency();
  }

  getAPIResponse() {
    return this.exporter.getAPIResponse();
  }

  getPageDisplayData() {
    return this.exporter.getPageDisplayData();
  }

  getBoundaryCases() {
    return this.dataManager.getBoundaryCases();
  }

  getNegativeSamples() {
    return this.dataManager.getNegativeSamples();
  }

  getManualCalculationExamples() {
    return this.dataManager.getManualCalculationExamples();
  }
}

module.exports = NuclearDensityPeakAnalysis;
