import { BoothApplication, CalendarEvent, ProcessReport, SubmissionRecord, DocumentInfo } from '../types';

class MemoryStore {
  private applications: Map<string, BoothApplication> = new Map();
  private calendarEvents: Map<string, CalendarEvent> = new Map();
  private reports: Map<string, ProcessReport> = new Map();
  private submissions: Map<string, SubmissionRecord> = new Map();
  private documents: Map<string, DocumentInfo & { companyName?: string; boothNumber?: string }> = new Map();

  saveApplication(app: BoothApplication): void {
    this.applications.set(app.id, app);
  }

  getApplication(id: string): BoothApplication | undefined {
    return this.applications.get(id);
  }

  getApplicationsByBatch(batchId: string): BoothApplication[] {
    return Array.from(this.applications.values()).filter(a => a.batchId === batchId);
  }

  getAllApplications(): BoothApplication[] {
    return Array.from(this.applications.values());
  }

  saveCalendarEvent(event: CalendarEvent): void {
    this.calendarEvents.set(event.id, event);
  }

  getCalendarEvents(): CalendarEvent[] {
    return Array.from(this.calendarEvents.values());
  }

  getCalendarEventsByBooth(boothNumber: string): CalendarEvent[] {
    return Array.from(this.calendarEvents.values())
      .filter(e => e.boothNumber === boothNumber && e.status !== 'cancelled');
  }

  saveReport(report: ProcessReport): void {
    this.reports.set(report.reportId, report);
  }

  getReport(id: string): ProcessReport | undefined {
    return this.reports.get(id);
  }

  getReportByBatch(batchId: string): ProcessReport | undefined {
    return Array.from(this.reports.values()).find(r => r.batchId === batchId);
  }

  getAllReports(): ProcessReport[] {
    return Array.from(this.reports.values());
  }

  saveSubmission(record: SubmissionRecord): void {
    this.submissions.set(record.batchId, record);
  }

  getSubmission(batchId: string): SubmissionRecord | undefined {
    return this.submissions.get(batchId);
  }

  isBatchEffective(batchId: string): boolean {
    const submission = this.submissions.get(batchId);
    return submission?.effective ?? false;
  }

  getAllSubmissions(): SubmissionRecord[] {
    return Array.from(this.submissions.values());
  }

  saveDocument(doc: DocumentInfo & { companyName?: string; boothNumber?: string }): void {
    this.documents.set(doc.id, doc);
  }

  getDocument(id: string): (DocumentInfo & { companyName?: string; boothNumber?: string }) | undefined {
    return this.documents.get(id);
  }

  getDocumentsByCompany(companyName: string): (DocumentInfo & { companyName?: string; boothNumber?: string })[] {
    return Array.from(this.documents.values()).filter(d => d.companyName === companyName);
  }

  getDocumentsByBooth(boothNumber: string): (DocumentInfo & { companyName?: string; boothNumber?: string })[] {
    return Array.from(this.documents.values()).filter(d => d.boothNumber === boothNumber);
  }

  getAllDocuments(): (DocumentInfo & { companyName?: string; boothNumber?: string })[] {
    return Array.from(this.documents.values());
  }

  importCalendarEvents(events: CalendarEvent[]): void {
    for (const event of events) {
      this.calendarEvents.set(event.id, event);
    }
  }

  clearAll(): void {
    this.applications.clear();
    this.calendarEvents.clear();
    this.reports.clear();
    this.submissions.clear();
    this.documents.clear();
  }
}

export const store = new MemoryStore();
