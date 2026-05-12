const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'database.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function initData() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      trips: {},
      drivers: {},
      departments: {},
      settlements: {},
      idempotentRequests: {},
      historyRecords: [],
      corrections: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
  }
}

function readData() {
  initData();
  const data = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(data);
}

function writeData(data) {
  initData();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getTrips() {
  return readData().trips;
}

function getTrip(tripId) {
  return getTrips()[tripId];
}

function saveTrip(trip) {
  const data = readData();
  data.trips[trip.id] = trip;
  writeData(data);
  return trip;
}

function getDrivers() {
  return readData().drivers;
}

function getDriver(driverId) {
  return getDrivers()[driverId];
}

function saveDriver(driver) {
  const data = readData();
  data.drivers[driver.id] = driver;
  writeData(data);
  return driver;
}

function getDepartments() {
  return readData().departments;
}

function getDepartment(deptCode) {
  return getDepartments()[deptCode];
}

function saveDepartment(dept) {
  const data = readData();
  data.departments[dept.code] = dept;
  writeData(data);
  return dept;
}

function getSettlements() {
  return readData().settlements;
}

function getSettlement(settlementId) {
  return getSettlements()[settlementId];
}

function saveSettlement(settlement) {
  const data = readData();
  data.settlements[settlement.id] = settlement;
  writeData(data);
  return settlement;
}

function getIdempotentRequest(requestKey) {
  const data = readData();
  return data.idempotentRequests[requestKey];
}

function saveIdempotentRequest(requestKey, response) {
  const data = readData();
  data.idempotentRequests[requestKey] = {
    key: requestKey,
    response,
    timestamp: new Date().toISOString()
  };
  writeData(data);
}

function addHistoryRecord(record) {
  const data = readData();
  data.historyRecords.push({
    ...record,
    timestamp: new Date().toISOString()
  });
  writeData(data);
}

function getHistoryRecords(tripId) {
  const data = readData();
  return data.historyRecords.filter(r => r.tripId === tripId);
}

function addCorrection(correction) {
  const data = readData();
  data.corrections.push({
    ...correction,
    timestamp: new Date().toISOString()
  });
  writeData(data);
}

function getCorrections(tripId) {
  const data = readData();
  return data.corrections.filter(c => c.tripId === tripId);
}

function resetData() {
  const initialData = {
    trips: {},
    drivers: {},
    departments: {},
    settlements: {},
    idempotentRequests: {},
    historyRecords: [],
    corrections: []
  };
  writeData(initialData);
}

module.exports = {
  getTrips,
  getTrip,
  saveTrip,
  getDrivers,
  getDriver,
  saveDriver,
  getDepartments,
  getDepartment,
  saveDepartment,
  getSettlements,
  getSettlement,
  saveSettlement,
  getIdempotentRequest,
  saveIdempotentRequest,
  addHistoryRecord,
  getHistoryRecords,
  addCorrection,
  getCorrections,
  resetData
};
