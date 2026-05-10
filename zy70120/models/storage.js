const fs = require('fs');
const path = require('path');
const config = require('../config');

class Storage {
  constructor() {
    this.dataDir = config.DATA_DIR;
    this.ensureDataDir();
    this.tablesFile = path.join(this.dataDir, 'tables.json');
    this.queueFile = path.join(this.dataDir, 'queue.json');
    this.historyFile = path.join(this.dataDir, 'history.json');
    this.notificationsFile = path.join(this.dataDir, 'notifications.json');
    this.initData();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  initData() {
    if (!fs.existsSync(this.tablesFile)) {
      fs.writeFileSync(this.tablesFile, JSON.stringify([
        { id: 'S1', type: 'SMALL', capacity: 4, status: 'AVAILABLE' },
        { id: 'S2', type: 'SMALL', capacity: 4, status: 'AVAILABLE' },
        { id: 'S3', type: 'SMALL', capacity: 4, status: 'AVAILABLE' },
        { id: 'M1', type: 'MEDIUM', capacity: 8, status: 'AVAILABLE' },
        { id: 'M2', type: 'MEDIUM', capacity: 8, status: 'AVAILABLE' },
        { id: 'L1', type: 'LARGE', capacity: 12, status: 'AVAILABLE' }
      ], null, 2));
    }
    if (!fs.existsSync(this.queueFile)) {
      fs.writeFileSync(this.queueFile, JSON.stringify([]));
    }
    if (!fs.existsSync(this.historyFile)) {
      fs.writeFileSync(this.historyFile, JSON.stringify([]));
    }
    if (!fs.existsSync(this.notificationsFile)) {
      fs.writeFileSync(this.notificationsFile, JSON.stringify([]));
    }
  }

  readFile(filePath) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  writeFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  getTables() {
    return this.readFile(this.tablesFile);
  }

  saveTables(tables) {
    this.writeFile(this.tablesFile, tables);
  }

  getQueue() {
    return this.readFile(this.queueFile);
  }

  saveQueue(queue) {
    this.writeFile(this.queueFile, queue);
  }

  getHistory() {
    return this.readFile(this.historyFile);
  }

  saveHistory(history) {
    this.writeFile(this.historyFile, history);
  }

  addHistory(event) {
    const history = this.getHistory();
    history.push(event);
    this.saveHistory(history);
  }

  getNotifications() {
    return this.readFile(this.notificationsFile);
  }

  saveNotifications(notifications) {
    this.writeFile(this.notificationsFile, notifications);
  }
}

module.exports = new Storage();
