class InMemoryStore {
  constructor() {
    this.files = new Map();
    this.tasks = new Map();
    this.rules = new Map();
    this.failedRows = new Map();
    this.publishRequests = new Map();
    this.summaries = new Map();
    this.idempotencyKeys = new Map();
  }

  saveFile(file) {
    this.files.set(file.id, file);
    return file;
  }

  getFile(id) {
    return this.files.get(id);
  }

  getAllFiles() {
    return Array.from(this.files.values());
  }

  saveTask(task) {
    this.tasks.set(task.id, task);
    return task;
  }

  getTask(id) {
    return this.tasks.get(id);
  }

  getTasksByFileId(fileId) {
    return Array.from(this.tasks.values()).filter(t => t.fileId === fileId);
  }

  saveRule(rule) {
    this.rules.set(rule.id, rule);
    return rule;
  }

  getRule(id) {
    return this.rules.get(id);
  }

  getAllRules() {
    return Array.from(this.rules.values()).filter(r => r.isActive);
  }

  saveFailedRow(failedRow) {
    this.failedRows.set(failedRow.id, failedRow);
    return failedRow;
  }

  getFailedRow(id) {
    return this.failedRows.get(id);
  }

  getFailedRowsByTaskId(taskId) {
    return Array.from(this.failedRows.values()).filter(fr => fr.taskId === taskId);
  }

  getFailedRowsByFileId(fileId) {
    return Array.from(this.failedRows.values()).filter(fr => fr.fileId === fileId);
  }

  savePublishRequest(request) {
    this.publishRequests.set(request.id, request);
    return request;
  }

  getPublishRequest(id) {
    return this.publishRequests.get(id);
  }

  getPublishRequestsByFileId(fileId) {
    return Array.from(this.publishRequests.values()).filter(pr => pr.fileId === fileId);
  }

  saveSummary(summary) {
    this.summaries.set(summary.id, summary);
    return summary;
  }

  getSummary(id) {
    return this.summaries.get(id);
  }

  getSummariesByFileId(fileId) {
    return Array.from(this.summaries.values()).filter(s => s.fileId === fileId);
  }

  getSummariesByTaskId(taskId) {
    return Array.from(this.summaries.values()).filter(s => s.taskId === taskId);
  }

  checkIdempotency(key) {
    if (this.idempotencyKeys.has(key)) {
      return this.idempotencyKeys.get(key);
    }
    return null;
  }

  setIdempotency(key, result) {
    this.idempotencyKeys.set(key, result);
  }
}

module.exports = new InMemoryStore();
