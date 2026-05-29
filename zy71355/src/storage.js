const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(process.cwd(), 'data');
const RETURNS_DIR = path.join(DATA_DIR, 'returns');
const RENTALS_DIR = path.join(DATA_DIR, 'rentals');

function ensureDirs() {
  [DATA_DIR, RETURNS_DIR, RENTALS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function getReturnPath(returnId) {
  return path.join(RETURNS_DIR, `${returnId}.json`);
}

function getRentalPath(rentalId) {
  return path.join(RENTALS_DIR, `${rentalId}.json`);
}

function saveReturn(returnData) {
  ensureDirs();
  const returnId = returnData.id || uuidv4();
  const data = {
    id: returnId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...returnData
  };
  fs.writeFileSync(getReturnPath(returnId), JSON.stringify(data, null, 2), 'utf8');
  return data;
}

function loadReturn(returnId) {
  const filePath = getReturnPath(returnId);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listReturns() {
  ensureDirs();
  const files = fs.readdirSync(RETURNS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(RETURNS_DIR, f), 'utf8'));
    return { id: data.id, rentalId: data.rentalId, createdAt: data.createdAt, status: data.status };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function findReturnByRentalId(rentalId) {
  const returns = listReturns();
  return returns.find(r => r.rentalId === rentalId);
}

function saveRental(rentalData) {
  ensureDirs();
  const rentalId = rentalData.id || uuidv4();
  const data = {
    id: rentalId,
    createdAt: new Date().toISOString(),
    ...rentalData
  };
  fs.writeFileSync(getRentalPath(rentalId), JSON.stringify(data, null, 2), 'utf8');
  return data;
}

function loadRental(rentalId) {
  const filePath = getRentalPath(rentalId);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function checkDuplicateImport(rentalId, fileHash) {
  const returns = listReturns();
  for (const ret of returns) {
    const full = loadReturn(ret.id);
    if (full && full.rentalId === rentalId && full.importHash === fileHash) {
      return full;
    }
  }
  return null;
}

function handleConflict(existingReturn, mode) {
  switch (mode) {
    case 'skip':
      return { action: 'skipped', existing: existingReturn };
    case 'overwrite':
      return { action: 'overwrite', existing: existingReturn };
    case 'append':
      return { action: 'append', existing: existingReturn };
    default:
      return { action: 'prompt', existing: existingReturn };
  }
}

module.exports = {
  saveReturn,
  loadReturn,
  listReturns,
  findReturnByRentalId,
  saveRental,
  loadRental,
  checkDuplicateImport,
  handleConflict,
  DATA_DIR,
  RETURNS_DIR,
  RENTALS_DIR
};
