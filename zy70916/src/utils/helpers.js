const crypto = require('crypto');

function generateBatchNo() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return 'BATCH-' + dateStr + '-' + random;
}

function generateRecordNo() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return 'REC-' + timestamp + '-' + random;
}

function generateOrderNo() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return 'SO-' + dateStr + '-' + random;
}

function checkSkillMatch(nurseSkills, requiredSkills) {
  if (!nurseSkills || !requiredSkills) return { matched: true, missing: [] };
  const nurseSkillList = String(nurseSkills).split(',').map(s => s.trim().toLowerCase());
  const requiredList = String(requiredSkills).split(',').map(s => s.trim().toLowerCase());
  const missing = requiredList.filter(s => !nurseSkillList.includes(s));
  return { matched: missing.length === 0, missing };
}

function checkDistrictMatch(nurseDistrict, serviceDistrict) {
  return nurseDistrict && serviceDistrict && nurseDistrict === serviceDistrict;
}

function calculateDistance(district1, address) {
  if (!district1 || !address) return 0;
  const combined = district1 + '|' + address;
  const hash = crypto.createHash('md5').update(combined).digest('hex');
  return (parseInt(hash.slice(0, 6), 16) % 500) / 10 + 0.5;
}

module.exports = {
  generateBatchNo,
  generateRecordNo,
  generateOrderNo,
  checkSkillMatch,
  checkDistrictMatch,
  calculateDistance
};
