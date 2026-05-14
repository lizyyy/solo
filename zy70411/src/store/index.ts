import { v4 as uuidv4 } from 'uuid';
import {
  HandoverForm,
  Rule,
  Report,
  AnomalySample,
  HistoryRecord,
  BatchValidationResult,
} from '../types';

class DataStore {
  private handoverForms: Map<string, HandoverForm> = new Map();
  private rules: Map<string, Rule> = new Map();
  private reports: Map<string, Report> = new Map();
  private anomalies: Map<string, AnomalySample> = new Map();
  private history: Map<string, HistoryRecord> = new Map();
  private validationResults: Map<string, BatchValidationResult> = new Map();

  saveHandoverForm(form: HandoverForm): void {
    this.handoverForms.set(form.id, form);
  }

  getHandoverForm(id: string): HandoverForm | undefined {
    return this.handoverForms.get(id);
  }

  getHandoverFormByBatchId(batchId: string): HandoverForm | undefined {
    return Array.from(this.handoverForms.values()).find((f) => f.batchId === batchId);
  }

  getAllHandoverForms(): HandoverForm[] {
    return Array.from(this.handoverForms.values());
  }

  saveRule(rule: Rule): void {
    this.rules.set(rule.id, rule);
  }

  getRule(id: string): Rule | undefined {
    return this.rules.get(id);
  }

  getRulesByVersion(version: string): Rule[] {
    return Array.from(this.rules.values()).filter((r) => r.version === version);
  }

  getActiveRules(): Rule[] {
    return Array.from(this.rules.values()).filter((r) => r.isActive);
  }

  getAllRules(): Rule[] {
    return Array.from(this.rules.values());
  }

  saveReport(report: Report): void {
    this.reports.set(report.id, report);
  }

  getReport(id: string): Report | undefined {
    return this.reports.get(id);
  }

  getAllReports(): Report[] {
    return Array.from(this.reports.values());
  }

  saveAnomaly(anomaly: AnomalySample): void {
    this.anomalies.set(anomaly.id, anomaly);
  }

  getAnomaly(id: string): AnomalySample | undefined {
    return this.anomalies.get(id);
  }

  getAnomaliesByBatch(batchId: string): AnomalySample[] {
    return Array.from(this.anomalies.values()).filter((a) => a.batchId === batchId);
  }

  getAllAnomalies(): AnomalySample[] {
    return Array.from(this.anomalies.values());
  }

  saveHistoryRecord(record: HistoryRecord): void {
    this.history.set(record.id, record);
  }

  getHistoryByResource(resourceType: string, resourceId: string): HistoryRecord[] {
    return Array.from(this.history.values()).filter(
      (r) => r.resourceType === resourceType && r.resourceId === resourceId
    );
  }

  getHistoryByScope(resourceScope: string): HistoryRecord[] {
    return Array.from(this.history.values()).filter((r) => r.resourceScope === resourceScope);
  }

  getAllHistory(): HistoryRecord[] {
    return Array.from(this.history.values());
  }

  saveValidationResult(result: BatchValidationResult): void {
    this.validationResults.set(result.batchId, result);
  }

  getValidationResult(batchId: string): BatchValidationResult | undefined {
    return this.validationResults.get(batchId);
  }

  getAllValidationResults(): BatchValidationResult[] {
    return Array.from(this.validationResults.values());
  }

  generateId(): string {
    return uuidv4();
  }
}

export const store = new DataStore();
