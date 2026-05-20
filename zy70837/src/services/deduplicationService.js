const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROCESSED_BATCHES_FILE = path.join(__dirname, '../../data/processed_batches.json');
const FILE_HASH_INDEX_FILE = path.join(__dirname, '../../data/file_hash_index.json');

let processedBatches = {};
let fileHashIndex = {};

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

function loadFileHashIndex() {
  ensureDataDir();
  if (fs.existsSync(FILE_HASH_INDEX_FILE)) {
    try {
      const data = fs.readFileSync(FILE_HASH_INDEX_FILE, 'utf8');
      fileHashIndex = JSON.parse(data);
    } catch (e) {
      fileHashIndex = {};
    }
  }
}

function saveFileHashIndex() {
  ensureDataDir();
  fs.writeFileSync(FILE_HASH_INDEX_FILE, JSON.stringify(fileHashIndex, null, 2));
}

function generateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

function generateBatchFileHash(files) {
  const allFiles = [];
  
  if (files.borrowReturnCsv) {
    files.borrowReturnCsv.forEach(f => allFiles.push({ type: 'borrowReturnCsv', path: f.path }));
  }
  if (files.vehiclesJson) {
    files.vehiclesJson.forEach(f => allFiles.push({ type: 'vehiclesJson', path: f.path }));
  }
  if (files.violationReceipts) {
    files.violationReceipts.forEach(f => allFiles.push({ type: 'violationReceipts', path: f.path }));
  }
  
  const hashes = allFiles
    .sort((a, b) => `${a.type}:${a.path}`.localeCompare(`${b.type}:${b.path}`))
    .map(f => `${f.type}:${generateFileHash(f.path)}`);
  
  const hashSum = crypto.createHash('sha256');
  hashSum.update(hashes.join('|'));
  return hashSum.digest('hex');
}

async function isBatchProcessed(batchId) {
  loadProcessedBatches();
  return !!processedBatches[batchId];
}

async function isFileContentProcessed(fileHash) {
  loadFileHashIndex();
  return fileHashIndex[fileHash];
}

async function checkDuplicate(batchId, files) {
  if (batchId) {
    const batchDuplicate = await isBatchProcessed(batchId);
    if (batchDuplicate) {
      return { 
        isDuplicate: true, 
        type: 'batchId', 
        batchId: batchId,
        processedAt: processedBatches[batchId]?.processedAt 
      };
    }
  }
  
  const fileHash = generateBatchFileHash(files);
  const existingBatch = await isFileContentProcessed(fileHash);
  if (existingBatch) {
    return { 
      isDuplicate: true, 
      type: 'fileContent', 
      fileHash: fileHash,
      existingBatchId: existingBatch.batchId,
      processedAt: existingBatch.processedAt 
    };
  }
  
  return { isDuplicate: false, fileHash: fileHash };
}

async function markBatchProcessed(batchId, fileHash, metadata = {}) {
  loadProcessedBatches();
  loadFileHashIndex();
  
  processedBatches[batchId] = {
    processedAt: new Date().toISOString(),
    fileHash: fileHash,
    ...metadata
  };
  
  fileHashIndex[fileHash] = {
    batchId: batchId,
    processedAt: new Date().toISOString()
  };
  
  saveProcessedBatches();
  saveFileHashIndex();
}

module.exports = {
  isBatchProcessed,
  isFileContentProcessed,
  checkDuplicate,
  markBatchProcessed,
  generateFileHash,
  generateBatchFileHash
};
