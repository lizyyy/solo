const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROCESSED_BATCHES_FILE = path.join(__dirname, '../../data/processed_batches.json');

let processedBatches = {};

function ensureDataDir() {
  const dir = path.dirname(PROCESSED_BATCHES_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadProcessedBatches() {
  ensureDataDir();
  if (fs.existsSync(PROCESSED_BATCHES_FILE)) {
    try {
      const data = fs.readFileSync(PROCESSED_BATCHES_FILE, 'utf8');
      processedBatches = JSON.parse(data);
    } catch (e) {
      processedBatches = {};
    }
  }
}

function saveProcessedBatches() {
  ensureDataDir();
  fs.writeFileSync(PROCESSED_BATCHES_FILE, JSON.stringify(processedBatches, null, 2));
}

async function isBatchProcessed(batchId) {
  loadProcessedBatches();
  return !!processedBatches[batchId];
}

async function markBatchProcessed(batchId, metadata = {}) {
  loadProcessedBatches();
  processedBatches[batchId] = {
    processedAt: new Date().toISOString(),
    ...metadata
  };
  saveProcessedBatches();
}

function generateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

module.exports = {
  isBatchProcessed,
  markBatchProcessed,
  generateFileHash
};
