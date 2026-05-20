const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const batchStorePath = path.join(__dirname, '../../data/batches.json');

function ensureStoreExists() {
  const dir = path.dirname(batchStorePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(batchStorePath)) {
    fs.writeFileSync(batchStorePath, JSON.stringify({}));
  }
}

function generateBatchId(files, body) {
  ensureStoreExists();
  
  let hashContent = '';
  
  if (files) {
    Object.keys(files).forEach(key => {
      if (files[key] && files[key][0]) {
        const file = files[key][0];
        const fileContent = fs.readFileSync(file.path);
        hashContent += file.originalname + fileContent.toString('base64');
      }
    });
  }
  
  if (body) {
    hashContent += JSON.stringify(body);
  }
  
  return crypto.createHash('md5').update(hashContent).digest('hex');
}

function isBatchProcessed(batchId) {
  ensureStoreExists();
  const store = JSON.parse(fs.readFileSync(batchStorePath, 'utf8'));
  return store[batchId] || null;
}

function markBatchAsProcessed(batchId, result) {
  ensureStoreExists();
  const store = JSON.parse(fs.readFileSync(batchStorePath, 'utf8'));
  store[batchId] = {
    processedAt: new Date().toISOString(),
    result
  };
  fs.writeFileSync(batchStorePath, JSON.stringify(store, null, 2));
}

module.exports = {
  generateBatchId,
  isBatchProcessed,
  markBatchAsProcessed
};
