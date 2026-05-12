const { readData, writeData } = require('../utils/storage');
const { getHazardById } = require('../utils/helpers');
const { logAmendment } = require('../utils/audit');

function amendHazard(hazardId, updates, operator) {
  const hazard = getHazardById(hazardId);
  
  if (!hazard) {
    return { success: false, message: '隐患不存在' };
  }

  const hazards = readData('hazards');
  const index = hazards.findIndex(h => h.id === hazardId);
  
  const oldValue = { ...hazard };
  const newValue = { ...hazard, ...updates, updatedAt: new Date().toISOString() };

  hazards[index] = newValue;
  writeData('hazards', hazards);

  const difference = {};
  for (const key of Object.keys(updates)) {
    if (JSON.stringify(oldValue[key]) !== JSON.stringify(updates[key])) {
      difference[key] = {
        old: oldValue[key],
        new: updates[key]
      };
    }
  }

  logAmendment('hazard', hazardId, difference, operator || 'system');

  return {
    success: true,
    hazard: newValue,
    changes: difference
  };
}

module.exports = {
  amendHazard
};
