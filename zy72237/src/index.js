const DataStore = require('./stores/DataStore');
const { ValuationAnomaly } = require('./models/ValuationAnomaly');
const SelfCheckService = require('./services/SelfCheckService');
const WorkflowService = require('./services/WorkflowService');
const ValuationService = require('./services/ValuationService');

class MarketValuationAnomalyAlert {
  constructor() {
    this.dataStore = new DataStore();
    this.selfCheckService = new SelfCheckService(this.dataStore);
    this.workflowService = new WorkflowService(this.dataStore, this.selfCheckService);
    this.valuationService = new ValuationService(this.dataStore);
  }

  async importEmail(emailData, operator) {
    return await this.workflowService.step1_importEmail(emailData, operator);
  }

  async importBatch(anomalyId, batchData, operator) {
    return await this.workflowService.step2_importBatch(anomalyId, batchData, operator);
  }

  async resolveConflict(anomalyId, conflictType, resolution, operator) {
    return await this.workflowService.resolveConflict(anomalyId, conflictType, resolution, operator);
  }

  async generateSummary(anomalyId, summaryData, operator) {
    return await this.workflowService.step3_generateSummary(anomalyId, summaryData, operator);
  }

  async confirmByRisk(anomalyId, decision, operator) {
    return await this.workflowService.confirmByRisk(anomalyId, decision, operator);
  }

  getWorkflowStatus(anomalyId) {
    return this.workflowService.getWorkflowStatus(anomalyId);
  }

  runSelfCheck(anomalyId) {
    return this.selfCheckService.runAllChecks(anomalyId);
  }

  getViewData(anomalyId) {
    return this.dataStore.getUnifiedViewData(anomalyId);
  }

  getExportData(anomalyId, format) {
    return this.dataStore.getExportData(anomalyId, format);
  }

  getApiResponse(anomalyId) {
    return this.dataStore.getApiResponse(anomalyId);
  }

  setCalculation(anomalyId, marketData, version) {
    return this.valuationService.setAnomalyCalculation(anomalyId, marketData, version);
  }

  getCalculationDetails(anomalyId) {
    return this.valuationService.getCalculationWithDetails(anomalyId);
  }

  getVersionInfo(version) {
    return this.valuationService.getVersionInfo(version);
  }

  getSummary() {
    return this.dataStore.exportAllSummary();
  }

  getAllAnomalies() {
    return this.dataStore.getAll().map(a => a.toJSON());
  }

  getAnomalyById(anomalyId) {
    const anomaly = this.dataStore.getById(anomalyId);
    return anomaly ? anomaly.toJSON() : null;
  }
}

module.exports = MarketValuationAnomalyAlert;
