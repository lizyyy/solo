const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

const FILES = {
  parkingSpots: 'parking-spots.json',
  orders: 'orders.json',
  payments: 'payments.json',
  refunds: 'refunds.json'
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function initDataFiles() {
  ensureDataDir();
  
  const spotsFile = path.join(DATA_DIR, FILES.parkingSpots);
  if (!fs.existsSync(spotsFile)) {
    const initialSpots = [
      { id: 'P001', owner: '张业主', area: 'A区', pricePerHour: 10, overnightPrice: 50, maxDays: 30, status: 'available' },
      { id: 'P002', owner: '李业主', area: 'A区', pricePerHour: 12, overnightPrice: 60, maxDays: 15, status: 'available' },
      { id: 'P003', owner: '王业主', area: 'B区', pricePerHour: 8, overnightPrice: 40, maxDays: 7, status: 'available' },
      { id: 'P004', owner: '赵业主', area: 'B区', pricePerHour: 15, overnightPrice: 80, maxDays: 60, status: 'available' },
      { id: 'P005', owner: '孙业主', area: 'C区', pricePerHour: 10, overnightPrice: 50, maxDays: 30, status: 'available' }
    ];
    fs.writeFileSync(spotsFile, JSON.stringify(initialSpots, null, 2), 'utf-8');
  }
  
  ['orders.json', 'payments.json', 'refunds.json'].forEach(file => {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf-8');
    }
  });
}

function readFile(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return content ? JSON.parse(content) : [];
}

function writeFile(fileName, data) {
  const filePath = path.join(DATA_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function generateId(prefix = 'ORD') {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
}

module.exports = {
  initDataFiles,
  readFile,
  writeFile,
  generateId,
  FILES
};