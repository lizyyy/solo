const crypto = require('crypto');

const generateMaterialHash = (material) => {
  const sortedShips = material.ships
    .map(ship => ({ ...ship }))
    .sort((a, b) => a.imo_no.localeCompare(b.imo_no));
  
  const normalized = {
    batch_no: material.batch_no,
    ships: sortedShips,
    schedule_date: material.schedule_date
  };
  
  return crypto
    .createHash('md5')
    .update(JSON.stringify(normalized))
    .digest('hex');
};

module.exports = {
  generateMaterialHash
};
