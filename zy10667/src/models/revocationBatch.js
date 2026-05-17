const { v4: uuidv4 } = require('uuid');

const BATCH_STATUSES = {
  CREATED: '已创建',
  PROCESSING: '处理中',
  COMPLETED: '已完成',
  PARTIAL_FAILED: '部分失败'
};

class RevocationBatch {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.batchName = data.batchName;
    this.operatorName = data.operatorName;
    this.revocationReason = data.revocationReason;
    this.status = data.status || BATCH_STATUSES.CREATED;
    this.totalCount = data.totalCount || 0;
    this.successCount = data.successCount || 0;
    this.failedCount = data.failedCount || 0;
    this.items = [];
    this.evidenceFiles = data.evidenceFiles || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  addItem(item) {
    this.items.push({
      id: uuidv4(),
      visitorId: item.visitorId,
      visitorName: item.visitorName,
      visitorPhone: item.visitorPhone,
      hostName: item.hostName,
      qrCode: item.qrCode,
      originalStatus: item.originalStatus,
      resultStatus: item.resultStatus || null,
      success: item.success || false,
      errorMessage: item.errorMessage || null,
      processedAt: item.processedAt || null
    });
    this.totalCount = this.items.length;
    this.updatedAt = new Date().toISOString();
  }

  updateItem(itemId, result) {
    const item = this.items.find(i => i.id === itemId);
    if (item) {
      Object.assign(item, result, { processedAt: new Date().toISOString() });
      this.successCount = this.items.filter(i => i.success).length;
      this.failedCount = this.items.filter(i => !i.success && i.processedAt).length;
      this.updatedAt = new Date().toISOString();
    }
  }

  updateStatus(newStatus) {
    this.status = newStatus;
    this.updatedAt = new Date().toISOString();
  }

  addEvidenceFile(fileInfo) {
    this.evidenceFiles.push({
      id: uuidv4(),
      fileName: fileInfo.fileName,
      fileType: fileInfo.fileType,
      fileSize: fileInfo.fileSize,
      uploadedAt: new Date().toISOString()
    });
    this.updatedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      batchName: this.batchName,
      operatorName: this.operatorName,
      revocationReason: this.revocationReason,
      status: this.status,
      totalCount: this.totalCount,
      successCount: this.successCount,
      failedCount: this.failedCount,
      items: this.items,
      evidenceFiles: this.evidenceFiles,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

const batchStore = new Map();

function createBatch(data) {
  const batch = new RevocationBatch(data);
  batchStore.set(batch.id, batch);
  return batch;
}

function getBatch(id) {
  return batchStore.get(id);
}

function updateBatch(id, data) {
  const batch = batchStore.get(id);
  if (!batch) return null;
  Object.assign(batch, data, { updatedAt: new Date().toISOString() });
  return batch;
}

function listBatches(filters = {}) {
  let result = Array.from(batchStore.values());
  return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function clearBatches() {
  batchStore.clear();
}

module.exports = {
  RevocationBatch,
  BATCH_STATUSES,
  createBatch,
  getBatch,
  updateBatch,
  listBatches,
  clearBatches
};
