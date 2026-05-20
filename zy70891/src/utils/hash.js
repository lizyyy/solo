const crypto = require('crypto');

function generateBatchHash(records) {
  const sortedRecords = JSON.stringify(records.sort((a, b) => {
    const aKey = `${a.object_id}-${a.checkin_date}`;
    const bKey = `${b.object_id}-${b.checkin_date}`;
    return aKey.localeCompare(bKey);
  }));
  
  return crypto.createHash('sha256').update(sortedRecords).digest('hex');
}

function generateBatchId() {
  return 'BATCH-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

module.exports = {
  generateBatchHash,
  generateBatchId
};
