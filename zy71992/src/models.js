const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const CHANGE_ORDER_FILE = path.join(DATA_DIR, 'change-order.json');
const LEDGER_FILE = path.join(DATA_DIR, 'ledger.json');
const PENDING_FILE = path.join(DATA_DIR, 'pending.json');

const ITEM_STATUS = {
  PENDING: 'pending',
  REVIEWED: 'reviewed',
  APPROVED: 'approved',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  ROLLED_BACK: 'rolled_back',
  NEEDS_FIX: 'needs_fix'
};

const RUN_STATUS = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  PARTIAL: 'partial',
  FAILED: 'failed',
  ROLLED_BACK: 'rolled_back'
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson(filePath, defaultValue = null) {
  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return defaultValue;
  }
}

function writeJson(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function createChangeOrder(batchName, items, importedAt = new Date().toISOString()) {
  return {
    id: `CO-${generateId()}`,
    batchName,
    importedAt,
    status: 'imported',
    items: items.map((item, idx) => ({
      id: `ITEM-${generateId()}`,
      seq: idx + 1,
      originalName: item.originalName,
      newName: item.newName,
      note: item.note || '',
      status: ITEM_STATUS.PENDING,
      history: [{
        timestamp: importedAt,
        action: 'imported',
        status: ITEM_STATUS.PENDING,
        detail: '从变更单导入'
      }]
    }))
  };
}

function createRunRecord(changeOrderId, operator, itemsToRun) {
  return {
    id: `RUN-${generateId()}`,
    changeOrderId,
    operator: operator || 'unknown',
    startedAt: new Date().toISOString(),
    status: RUN_STATUS.RUNNING,
    items: itemsToRun.map(item => ({
      itemId: item.id,
      originalName: item.originalName,
      newName: item.newName,
      status: ITEM_STATUS.RUNNING,
      startedAt: null,
      completedAt: null,
      error: null,
      rollbackInfo: null
    })),
    summary: {
      total: itemsToRun.length,
      success: 0,
      failed: 0,
      skipped: 0
    }
  };
}

function getChangeOrder() {
  return readJson(CHANGE_ORDER_FILE, null);
}

function saveChangeOrder(changeOrder) {
  writeJson(CHANGE_ORDER_FILE, changeOrder);
}

function getLedger() {
  return readJson(LEDGER_FILE, { runs: [] });
}

function saveLedger(ledger) {
  writeJson(LEDGER_FILE, ledger);
}

function addRunToLedger(runRecord) {
  const ledger = getLedger();
  ledger.runs.unshift(runRecord);
  saveLedger(ledger);
  return ledger;
}

function updateRunInLedger(runId, updates) {
  const ledger = getLedger();
  const idx = ledger.runs.findIndex(r => r.id === runId);
  if (idx !== -1) {
    ledger.runs[idx] = { ...ledger.runs[idx], ...updates };
    saveLedger(ledger);
  }
  return ledger;
}

function getPending() {
  return readJson(PENDING_FILE, null);
}

function savePending(pending) {
  writeJson(PENDING_FILE, pending);
}

function clearPending() {
  if (fs.existsSync(PENDING_FILE)) {
    fs.unlinkSync(PENDING_FILE);
  }
}

function updateItemStatus(changeOrder, itemId, status, detail, error = null) {
  const item = changeOrder.items.find(i => i.id === itemId);
  if (item) {
    item.status = status;
    item.history.push({
      timestamp: new Date().toISOString(),
      action: status,
      status,
      detail,
      error: error ? error.message : undefined
    });
  }
  return changeOrder;
}

module.exports = {
  DATA_DIR,
  CHANGE_ORDER_FILE,
  LEDGER_FILE,
  PENDING_FILE,
  ITEM_STATUS,
  RUN_STATUS,
  ensureDataDir,
  readJson,
  writeJson,
  generateId,
  createChangeOrder,
  createRunRecord,
  getChangeOrder,
  saveChangeOrder,
  getLedger,
  saveLedger,
  addRunToLedger,
  updateRunInLedger,
  getPending,
  savePending,
  clearPending,
  updateItemStatus
};
