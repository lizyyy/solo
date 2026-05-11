const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'schedule.json');

const DEFAULT_DATA = {
  iceRinks: [
    {
      id: 'rink-1',
      name: '主冰场 1 号',
      status: 'active'
    },
    {
      id: 'rink-2',
      name: '主冰场 2 号',
      status: 'active'
    }
  ],
  courses: [
    {
      id: 'course-1',
      rinkId: 'rink-1',
      name: '花样滑冰训练班 A 组',
      startTime: '2026-05-12T09:00:00',
      endTime: '2026-05-12T10:30:00',
      priority: 'normal'
    },
    {
      id: 'course-2',
      rinkId: 'rink-1',
      name: '速度滑冰训练',
      startTime: '2026-05-12T14:00:00',
      endTime: '2026-05-12T15:30:00',
      priority: 'normal'
    }
  ],
  competitions: [
    {
      id: 'comp-1',
      rinkId: 'rink-1',
      name: '市级花样滑冰锦标赛',
      startTime: '2026-05-12T19:00:00',
      endTime: '2026-05-12T22:00:00',
      priority: 'high'
    }
  ],
  iceMaintenance: [
    {
      id: 'maintenance-1',
      rinkId: 'rink-1',
      name: '例行制冰维护',
      startTime: '2026-05-12T04:00:00',
      endTime: '2026-05-12T07:00:00',
      type: 'regular',
      recoveryHours: 2
    }
  ],
  resurfacingTasks: [],
  idempotencyKeys: {}
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function initDataStore() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2), 'utf8');
  }
}

function readData() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
  const content = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(content);
}

function writeData(data) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function resetData() {
  writeData(JSON.parse(JSON.stringify(DEFAULT_DATA)));
}

module.exports = {
  readData,
  writeData,
  initDataStore,
  resetData
};
