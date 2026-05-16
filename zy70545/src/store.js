const crypto = require('crypto');
const {
  ImportBatch,
  OriginalRow,
  CorrectionRecord,
  ConflictRecord,
  ProcessedRow,
  ImportStatus
} = require('./models');

class DataStore {
  constructor() {
    this.batches = new Map();
    this.originalRows = new Map();
    this.corrections = new Map();
    this.conflicts = new Map();
    this.processedRows = new Map();
    this.fileHashIndex = new Map();
  }

  computeHash(data) {
    return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  }

  findBatchByFileHash(fileHash) {
    return this.fileHashIndex.get(fileHash) || null;
  }

  createBatch(batchData) {
    const existingBatch = this.findBatchByFileHash(batchData.fileHash);
    if (existingBatch) {
      return { batch: existingBatch, isNew: false };
    }

    const batch = new ImportBatch(batchData);
    this.batches.set(batch.id, batch);
    this.fileHashIndex.set(batch.fileHash, batch);
    return { batch, isNew: true };
  }

  getBatch(batchId) {
    return this.batches.get(batchId) || null;
  }

  listBatches(filters = {}) {
    let batches = Array.from(this.batches.values());
    
    if (filters.status) {
      batches = batches.filter(b => b.status === filters.status);
    }
    if (filters.operator) {
      batches = batches.filter(b => b.operator === filters.operator);
    }
    
    return batches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  updateBatchStatus(batchId, status, operator, note = '') {
    const batch = this.getBatch(batchId);
    if (!batch) return null;
    batch.updateStatus(status, operator, note);
    return batch;
  }

  addOriginalRow(rowData) {
    const row = new OriginalRow(rowData);
    this.originalRows.set(row.id, row);
    return row;
  }

  addOriginalRows(rowsData) {
    return rowsData.map(data => this.addOriginalRow(data));
  }

  getOriginalRowsByBatch(batchId) {
    return Array.from(this.originalRows.values())
      .filter(row => row.batchId === batchId)
      .sort((a, b) => a.rowNumber - b.rowNumber);
  }

  getOriginalRow(rowId) {
    return this.originalRows.get(rowId) || null;
  }

  updateRowStatus(rowId, status) {
    const row = this.getOriginalRow(rowId);
    if (!row) return null;
    row.status = status;
    return row;
  }

  addCorrection(correctionData) {
    const correction = new CorrectionRecord(correctionData);
    this.corrections.set(correction.id, correction);
    return correction;
  }

  getCorrectionsByRow(rowId) {
    return Array.from(this.corrections.values())
      .filter(c => c.rowId === rowId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  getCorrectionsByBatch(batchId) {
    const batchRowIds = new Set(
      this.getOriginalRowsByBatch(batchId).map(r => r.id)
    );
    return Array.from(this.corrections.values())
      .filter(c => batchRowIds.has(c.rowId))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  addConflict(conflictData) {
    const conflict = new ConflictRecord(conflictData);
    this.conflicts.set(conflict.id, conflict);
    return conflict;
  }

  getConflictsByBatch(batchId) {
    const batchRowIds = new Set(
      this.getOriginalRowsByBatch(batchId).map(r => r.id)
    );
    return Array.from(this.conflicts.values())
      .filter(c => batchRowIds.has(c.rowId));
  }

  getConflictsByRow(rowId) {
    return Array.from(this.conflicts.values())
      .filter(c => c.rowId === rowId);
  }

  getConflict(conflictId) {
    return this.conflicts.get(conflictId) || null;
  }

  resolveConflict(conflictId, resolution, operator) {
    const conflict = this.getConflict(conflictId);
    if (!conflict) return null;
    conflict.resolve(resolution, operator);
    return conflict;
  }

  addProcessedRow(processedData) {
    const processed = new ProcessedRow(processedData);
    this.processedRows.set(processed.id, processed);
    return processed;
  }

  getProcessedRowsByBatch(batchId) {
    const batchRowIds = new Set(
      this.getOriginalRowsByBatch(batchId).map(r => r.id)
    );
    return Array.from(this.processedRows.values())
      .filter(p => batchRowIds.has(p.rowId));
  }

  getProcessedRowByRowId(rowId) {
    return Array.from(this.processedRows.values())
      .find(p => p.rowId === rowId) || null;
  }

  generateReport(batchId) {
    const batch = this.getBatch(batchId);
    if (!batch) return null;

    const rows = this.getOriginalRowsByBatch(batchId);
    const conflicts = this.getConflictsByBatch(batchId);
    const corrections = this.getCorrectionsByBatch(batchId);
    const processed = this.getProcessedRowsByBatch(batchId);

    const successCount = processed.filter(p => p.success).length;
    const failedCount = processed.filter(p => !p.success).length;
    const pendingConflicts = conflicts.filter(c => c.resolution === 'PENDING').length;

    const rowDetails = rows.map(row => {
      const rowConflicts = conflicts.filter(c => c.rowId === row.id);
      const rowCorrections = corrections.filter(c => c.rowId === row.id);
      const rowProcessed = processed.find(p => p.rowId === row.id);

      return {
        rowNumber: row.rowNumber,
        rowId: row.id,
        status: row.status,
        originalData: row.rawData,
        finalData: rowProcessed?.finalData || null,
        success: rowProcessed?.success || null,
        errors: rowProcessed?.errors || [],
        conflicts: rowConflicts.map(c => ({
          type: c.type,
          field: c.fieldName,
          message: c.message,
          resolution: c.resolution,
          resolvedBy: c.resolvedBy
        })),
        corrections: rowCorrections.map(c => ({
          field: c.fieldName,
          oldValue: c.oldValue,
          newValue: c.newValue,
          operator: c.operator,
          reason: c.reason,
          timestamp: c.timestamp
        }))
      };
    });

    return {
      batchId: batch.id,
      fileName: batch.fileName,
      operator: batch.operator,
      status: batch.status,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      summary: {
        totalRows: rows.length,
        processed: processed.length,
        success: successCount,
        failed: failedCount,
        totalConflicts: conflicts.length,
        pendingConflicts,
        totalCorrections: corrections.length
      },
      statusHistory: batch.statusHistory,
      rowDetails
    };
  }
}

module.exports = new DataStore();
