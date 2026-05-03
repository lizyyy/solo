const FileStore = require('./fileStore');

const stores = {};

function getStore(collectionName) {
  if (!stores[collectionName]) {
    stores[collectionName] = new FileStore(collectionName);
  }
  return stores[collectionName];
}

module.exports = {
  FileStore,
  getStore,
  boxes: () => getStore('boxes'),
  batches: () => getStore('batches'),
  stations: () => getStore('stations'),
  responsiblePersons: () => getStore('responsiblePersons'),
  temperatureLogs: () => getStore('temperatureLogs'),
  vehicleTrajectories: () => getStore('vehicleTrajectories'),
  handoverForms: () => getStore('handoverForms'),
  riskEvents: () => getStore('riskEvents'),
  auditEvents: () => getStore('auditEvents'),
  reviews: () => getStore('reviews')
};
