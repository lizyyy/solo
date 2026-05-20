const crypto = require('crypto');

function generateMaterialFingerprint(materials) {
  const sorted = materials
    .map(m => `${m.child_name}|${m.child_id_card}|${m.phone}|${m.target_vaccine || ''}`)
    .sort()
    .join('||');
  
  return crypto
    .createHash('md5')
    .update(sorted)
    .digest('hex');
}

function generateBatchId() {
  return 'BATCH_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

function generateMaterialId() {
  return 'MAT_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

module.exports = {
  generateMaterialFingerprint,
  generateBatchId,
  generateMaterialId
};
