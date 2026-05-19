const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), '.reagent-data');
const FILES = {
  reagents: path.join(DATA_DIR, 'reagents.json'),
  inventory: path.join(DATA_DIR, 'inventory.json'),
  applications: path.join(DATA_DIR, 'applications.json'),
  approvals: path.join(DATA_DIR, 'approvals.json'),
  batches: path.join(DATA_DIR, 'batches.json'),
  history: path.join(DATA_DIR, 'history.json')
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return defaultValue;
  }
}

function writeJsonFile(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function addHistory(action, details, success = true, error = null) {
  const history = readJsonFile(FILES.history, []);
  history.unshift({
    id: generateId(),
    timestamp: new Date().toISOString(),
    action,
    details,
    success,
    error
  });
  writeJsonFile(FILES.history, history);
}

module.exports = {
  DATA_DIR,
  FILES,
  ensureDataDir,
  readJsonFile,
  writeJsonFile,
  generateId,
  addHistory,

  init() {
    ensureDataDir();
    const defaultReagents = [
      { id: 'R001', name: '无水乙醇', dangerLevel: 1, unit: '瓶', description: '分析纯' },
      { id: 'R002', name: '浓硫酸', dangerLevel: 3, unit: '瓶', description: '98% 腐蚀性' },
      { id: 'R003', name: '氢氧化钠', dangerLevel: 2, unit: '瓶', description: '粒状' },
      { id: 'R004', name: '蒸馏水', dangerLevel: 0, unit: '桶', description: '去离子水' },
      { id: 'R005', name: '丙酮', dangerLevel: 2, unit: '瓶', description: '易挥发' }
    ];
    const defaultInventory = {
      R001: 50,
      R002: 20,
      R003: 30,
      R004: 100,
      R005: 25
    };
    writeJsonFile(FILES.reagents, defaultReagents);
    writeJsonFile(FILES.inventory, defaultInventory);
    writeJsonFile(FILES.applications, []);
    writeJsonFile(FILES.approvals, []);
    writeJsonFile(FILES.batches, []);
    writeJsonFile(FILES.history, []);
    addHistory('init', '初始化数据存储');
  },

  getReagents() {
    return readJsonFile(FILES.reagents, []);
  },

  getReagent(id) {
    const reagents = this.getReagents();
    return reagents.find(r => r.id === id);
  },

  getInventory() {
    return readJsonFile(FILES.inventory, {});
  },

  updateInventory(reagentId, quantity) {
    const inventory = this.getInventory();
    inventory[reagentId] = (inventory[reagentId] || 0) + quantity;
    writeJsonFile(FILES.inventory, inventory);
  },

  getApplications() {
    return readJsonFile(FILES.applications, []);
  },

  addApplication(application) {
    const applications = this.getApplications();
    const newApp = {
      id: generateId(),
      ...application,
      status: 'pending',
      createdAt: new Date().toISOString(),
      approvalHistory: []
    };
    applications.push(newApp);
    writeJsonFile(FILES.applications, applications);
    return newApp;
  },

  updateApplication(id, updates) {
    const applications = this.getApplications();
    const index = applications.findIndex(a => a.id === id);
    if (index === -1) return null;
    applications[index] = { ...applications[index], ...updates, updatedAt: new Date().toISOString() };
    writeJsonFile(FILES.applications, applications);
    return applications[index];
  },

  getApprovals() {
    return readJsonFile(FILES.approvals, []);
  },

  addApproval(approval) {
    const approvals = this.getApprovals();
    const newApproval = {
      id: generateId(),
      ...approval,
      createdAt: new Date().toISOString()
    };
    approvals.push(newApproval);
    writeJsonFile(FILES.approvals, approvals);
    return newApproval;
  },

  getBatches() {
    return readJsonFile(FILES.batches, []);
  },

  addBatch(batch) {
    const batches = this.getBatches();
    const newBatch = {
      id: generateId(),
      ...batch,
      createdAt: new Date().toISOString()
    };
    batches.push(newBatch);
    writeJsonFile(FILES.batches, batches);
    return newBatch;
  },

  updateBatch(id, updates) {
    const batches = this.getBatches();
    const index = batches.findIndex(b => b.id === id);
    if (index === -1) return null;
    batches[index] = { ...batches[index], ...updates, updatedAt: new Date().toISOString() };
    writeJsonFile(FILES.batches, batches);
    return batches[index];
  },

  getHistory(limit = 10) {
    const history = readJsonFile(FILES.history, []);
    return history.slice(0, limit);
  }
};
