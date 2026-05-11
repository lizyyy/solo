const crypto = require('crypto');

const generateId = (prefix = 'id') => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${timestamp}_${random}`;
};

const generateEquipmentId = () => generateId('EQ');
const generatePlanId = () => generateId('PL');
const generateRecordId = () => generateId('REC');
const generateHourReportId = () => generateId('HR');
const generateSkipRequestId = () => generateId('SKIP');
const generateImpactId = () => generateId('IMP');

module.exports = {
  generateId,
  generateEquipmentId,
  generatePlanId,
  generateRecordId,
  generateHourReportId,
  generateSkipRequestId,
  generateImpactId
};
