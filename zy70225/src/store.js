const { v4: uuidv4 } = require('uuid');

const store = {
  batches: new Map(),
  ponds: new Map(),
  transfers: new Map(),
  survivalRecords: new Map(),
  reports: new Map(),
  requestIdCache: new Map()
};

const batchStatus = {
  HATCHING: 'HATCHING',
  READY_FOR_TRANSFER: 'READY_FOR_TRANSFER',
  IN_TRANSFER: 'IN_TRANSFER',
  TRANSFERRED: 'TRANSFERRED',
  GROWING: 'GROWING',
  HARVESTED: 'HARVESTED',
  INVALID: 'INVALID'
};

const pondTypes = {
  HATCHERY: 'HATCHERY',
  NURSERY: 'NURSERY',
  GROWOUT: 'GROWOUT'
};

const transferStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CORRECTED: 'CORRECTED'
};

function generateId() {
  return uuidv4();
}

function saveBatch(batch) {
  store.batches.set(batch.id, batch);
  return batch;
}

function getBatch(id) {
  return store.batches.get(id);
}

function getAllBatches() {
  return Array.from(store.batches.values());
}

function savePond(pond) {
  store.ponds.set(pond.id, pond);
  return pond;
}

function getPond(id) {
  return store.ponds.get(id);
}

function getAllPonds() {
  return Array.from(store.ponds.values());
}

function saveTransfer(transfer) {
  store.transfers.set(transfer.id, transfer);
  return transfer;
}

function getTransfer(id) {
  return store.transfers.get(id);
}

function getAllTransfers() {
  return Array.from(store.transfers.values());
}

function findTransfersByBatch(batchId) {
  return Array.from(store.transfers.values()).filter(t => t.batchId === batchId);
}

function findTransfersByRequestId(requestId) {
  return Array.from(store.transfers.values()).filter(t => t.requestId === requestId);
}

function saveSurvivalRecord(record) {
  store.survivalRecords.set(record.id, record);
  return record;
}

function getSurvivalRecord(id) {
  return store.survivalRecords.get(id);
}

function getAllSurvivalRecords() {
  return Array.from(store.survivalRecords.values());
}

function findSurvivalRecordsByBatch(batchId) {
  return Array.from(store.survivalRecords.values()).filter(r => r.batchId === batchId);
}

function saveReport(report) {
  store.reports.set(report.id, report);
  return report;
}

function getReport(id) {
  return store.reports.get(id);
}

function getAllReports() {
  return Array.from(store.reports.values());
}

function findReportsByBatch(batchId) {
  return Array.from(store.reports.values()).filter(r => r.batchId === batchId);
}

function checkRequestId(requestId) {
  if (store.requestIdCache.has(requestId)) {
    return true;
  }
  store.requestIdCache.set(requestId, Date.now());
  return false;
}

function clearStore() {
  store.batches.clear();
  store.ponds.clear();
  store.transfers.clear();
  store.survivalRecords.clear();
  store.reports.clear();
  store.requestIdCache.clear();
}

module.exports = {
  store,
  batchStatus,
  pondTypes,
  transferStatus,
  generateId,
  saveBatch,
  getBatch,
  getAllBatches,
  savePond,
  getPond,
  getAllPonds,
  saveTransfer,
  getTransfer,
  getAllTransfers,
  findTransfersByBatch,
  findTransfersByRequestId,
  saveSurvivalRecord,
  getSurvivalRecord,
  getAllSurvivalRecords,
  findSurvivalRecordsByBatch,
  saveReport,
  getReport,
  getAllReports,
  findReportsByBatch,
  checkRequestId,
  clearStore
};