import { ProcessingOrder, ReworkReport, AxisConsistencyIssue } from '../types';

export class DataStore {
  private processingOrders: Map<string, ProcessingOrder> = new Map();
  private reworkReports: Map<string, ReworkReport> = new Map();
  private axisIssues: Map<string, AxisConsistencyIssue> = new Map();

  saveProcessingOrder(order: ProcessingOrder): void {
    this.processingOrders.set(order.id, order);
  }

  getProcessingOrder(id: string): ProcessingOrder | undefined {
    return this.processingOrders.get(id);
  }

  getProcessingOrderByNumber(orderNumber: string): ProcessingOrder | undefined {
    return Array.from(this.processingOrders.values()).find(
      o => o.orderNumber === orderNumber
    );
  }

  getAllProcessingOrders(): ProcessingOrder[] {
    return Array.from(this.processingOrders.values());
  }

  saveReworkReport(report: ReworkReport): void {
    this.reworkReports.set(report.id, report);
  }

  getReworkReport(id: string): ReworkReport | undefined {
    return this.reworkReports.get(id);
  }

  getReworkReportsByOrderId(processingOrderId: string): ReworkReport[] {
    return Array.from(this.reworkReports.values()).filter(
      r => r.processingOrderId === processingOrderId
    );
  }

  getAllReworkReports(): ReworkReport[] {
    return Array.from(this.reworkReports.values());
  }

  saveAxisIssue(issue: AxisConsistencyIssue): void {
    const key = `${issue.processingOrderId}-${issue.reworkReportId}-${issue.eye}`;
    this.axisIssues.set(key, issue);
  }

  getAxisIssuesByOrder(processingOrderId: string): AxisConsistencyIssue[] {
    return Array.from(this.axisIssues.values()).filter(
      i => i.processingOrderId === processingOrderId
    );
  }

  getAxisIssuesByRework(reworkReportId: string): AxisConsistencyIssue[] {
    return Array.from(this.axisIssues.values()).filter(
      i => i.reworkReportId === reworkReportId
    );
  }

  clearAxisIssues(processingOrderId: string, reworkReportId: string): void {
    const keysToDelete: string[] = [];
    for (const [key, issue] of this.axisIssues.entries()) {
      if (issue.processingOrderId === processingOrderId && 
          issue.reworkReportId === reworkReportId) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.axisIssues.delete(key));
  }

  getAllAxisIssues(): AxisConsistencyIssue[] {
    return Array.from(this.axisIssues.values());
  }

  clearAll(): void {
    this.processingOrders.clear();
    this.reworkReports.clear();
    this.axisIssues.clear();
  }
}

export const dataStore = new DataStore();
