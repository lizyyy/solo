const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadData(filename) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`加载数据失败 ${filename}:`, error);
    return [];
  }
}

function saveData(filename, data) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`保存数据失败 ${filename}:`, error);
    return false;
  }
}

class ContractStore {
  constructor() {
    this.filename = 'contracts.json';
    this.contracts = loadData(this.filename);
  }

  findAll() {
    return this.contracts;
  }

  findByContractNo(contractNo) {
    return this.contracts.find(c => c.contractNo === contractNo);
  }

  save(contract) {
    const existingIndex = this.contracts.findIndex(
      c => c.contractNo === contract.contractNo
    );
    if (existingIndex >= 0) {
      this.contracts[existingIndex] = contract;
    } else {
      this.contracts.push(contract);
    }
    saveData(this.filename, this.contracts);
    return contract;
  }

  delete(contractNo) {
    this.contracts = this.contracts.filter(c => c.contractNo !== contractNo);
    saveData(this.filename, this.contracts);
  }

  exists(contractNo) {
    return this.contracts.some(c => c.contractNo === contractNo);
  }
}

class ExceptionStore {
  constructor() {
    this.filename = 'exceptions.json';
    this.exceptions = loadData(this.filename);
  }

  findAll() {
    return this.exceptions;
  }

  findById(id) {
    return this.exceptions.find(e => e.id === id);
  }

  findByContractNo(contractNo) {
    return this.exceptions.filter(e => e.contractNo === contractNo);
  }

  save(exception) {
    this.exceptions.push(exception);
    saveData(this.filename, this.exceptions);
    return exception;
  }

  markResolved(id, handler, note) {
    const exception = this.findById(id);
    if (exception) {
      exception.resolved = true;
      exception.handler = handler;
      exception.resolutionNote = note;
      exception.resolvedAt = new Date().toISOString();
      saveData(this.filename, this.exceptions);
    }
    return exception;
  }
}

module.exports = {
  ContractStore,
  ExceptionStore,
  loadData,
  saveData,
  ensureDataDir
};