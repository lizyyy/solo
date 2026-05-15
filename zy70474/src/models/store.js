const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class DataStore {
  constructor() {
    this.acceptanceForms = new Map();
    this.taskDetails = new Map();
    this.rerunRecords = new Map();
    this.inspectionReports = new Map();
    this._initSampleData();
  }

  _initSampleData() {
  }

  generateId() {
    return uuidv4();
  }

  createAcceptanceForm(data) {
    const formId = this.generateId();
    const form = {
      id: formId,
      batchNo: data.batchNo || `AC${moment().format('YYYYMMDDHHmmss')}`,
      department: data.department,
      submitter: data.submitter,
      submitTime: data.submitTime || new Date().toISOString(),
      totalAmount: data.totalAmount,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.acceptanceForms.set(formId, form);
    return form;
  }

  getAcceptanceForm(formId) {
    return this.acceptanceForms.get(formId);
  }

  updateAcceptanceForm(formId, updates) {
    const form = this.acceptanceForms.get(formId);
    if (!form) return null;
    const updated = { ...form, ...updates, updatedAt: new Date().toISOString() };
    this.acceptanceForms.set(formId, updated);
    return updated;
  }

  listAcceptanceForms(filters = {}) {
    let results = Array.from(this.acceptanceForms.values());
    if (filters.status) {
      results = results.filter(f => f.status === filters.status);
    }
    if (filters.department) {
      results = results.filter(f => f.department === filters.department);
    }
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  createTaskDetail(data) {
    const detailId = this.generateId();
    const detail = {
      id: detailId,
      formId: data.formId,
      itemNo: data.itemNo,
      projectName: data.projectName,
      outsourcingVendor: data.outsourcingVendor,
      workContent: data.workContent,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      subtotal: data.subtotal,
      signAlgorithm: data.signAlgorithm,
      signature: data.signature,
      status: 'pending',
      errorMessage: null,
      rerunCount: 0,
      lastRerunId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.taskDetails.set(detailId, detail);
    return detail;
  }

  getTaskDetail(detailId) {
    return this.taskDetails.get(detailId);
  }

  updateTaskDetail(detailId, updates) {
    const detail = this.taskDetails.get(detailId);
    if (!detail) return null;
    const updated = { ...detail, ...updates, updatedAt: new Date().toISOString() };
    this.taskDetails.set(detailId, updated);
    return updated;
  }

  listTaskDetails(filters = {}) {
    let results = Array.from(this.taskDetails.values());
    if (filters.formId) {
      results = results.filter(d => d.formId === filters.formId);
    }
    if (filters.status) {
      results = results.filter(d => d.status === filters.status);
    }
    if (filters.hasError) {
      results = results.filter(d => d.errorMessage !== null);
    }
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  createRerunRecord(data) {
    const rerunId = this.generateId();
    const record = {
      id: rerunId,
      taskDetailId: data.taskDetailId,
      previousStatus: data.previousStatus,
      action: data.action,
      operator: data.operator,
      inputSnapshot: data.inputSnapshot,
      conclusion: null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      completedAt: null
    };
    this.rerunRecords.set(rerunId, record);
    return record;
  }

  updateRerunRecord(rerunId, updates) {
    const record = this.rerunRecords.get(rerunId);
    if (!record) return null;
    const updated = { ...record, ...updates, completedAt: new Date().toISOString() };
    this.rerunRecords.set(rerunId, updated);
    return updated;
  }

  listRerunRecords(filters = {}) {
    let results = Array.from(this.rerunRecords.values());
    if (filters.taskDetailId) {
      results = results.filter(r => r.taskDetailId === filters.taskDetailId);
    }
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  createInspectionReport(data) {
    const reportId = this.generateId();
    const report = {
      id: reportId,
      inspectionDate: data.inspectionDate || moment().format('YYYY-MM-DD'),
      inspector: data.inspector,
      items: data.items || [],
      status: data.status || 'draft',
      reviewComment: null,
      reviewer: null,
      reviewedAt: null,
      createdAt: new Date().toISOString()
    };
    this.inspectionReports.set(reportId, report);
    return report;
  }

  getInspectionReport(reportId) {
    return this.inspectionReports.get(reportId);
  }

  updateInspectionReport(reportId, updates) {
    const report = this.inspectionReports.get(reportId);
    if (!report) return null;
    const updated = { ...report, ...updates };
    this.inspectionReports.set(reportId, updated);
    return updated;
  }

  listInspectionReports() {
    return Array.from(this.inspectionReports.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

module.exports = new DataStore();