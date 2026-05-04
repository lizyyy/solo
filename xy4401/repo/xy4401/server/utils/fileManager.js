const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '../../data');
const SCHEDULES_DIR = path.join(DATA_DIR, 'schedules');

fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(SCHEDULES_DIR);

class FileManager {
  static generateId() {
    return uuidv4();
  }

  static saveJsonData(filename, data) {
    const filePath = path.join(DATA_DIR, filename);
    fs.writeJsonSync(filePath, data, { spaces: 2 });
    return filePath;
  }

  static loadJsonData(filename) {
    const filePath = path.join(DATA_DIR, filename);
    if (fs.existsSync(filePath)) {
      return fs.readJsonSync(filePath);
    }
    return null;
  }

  static saveSchedule(scheduleData) {
    const id = scheduleData.id || this.generateId();
    const filename = `schedule_${id}.json`;
    const filePath = path.join(SCHEDULES_DIR, filename);
    fs.writeJsonSync(filePath, { ...scheduleData, id, updatedAt: new Date().toISOString() }, { spaces: 2 });
    return id;
  }

  static loadSchedule(id) {
    const filename = `schedule_${id}.json`;
    const filePath = path.join(SCHEDULES_DIR, filename);
    if (fs.existsSync(filePath)) {
      return fs.readJsonSync(filePath);
    }
    return null;
  }

  static listSchedules() {
    if (!fs.existsSync(SCHEDULES_DIR)) {
      return [];
    }
    const files = fs.readdirSync(SCHEDULES_DIR)
      .filter(file => file.startsWith('schedule_') && file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(SCHEDULES_DIR, file);
        const data = fs.readJsonSync(filePath);
        return {
          id: data.id,
          name: data.name || '未命名排程',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        };
      })
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return files;
  }

  static deleteSchedule(id) {
    const filename = `schedule_${id}.json`;
    const filePath = path.join(SCHEDULES_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.removeSync(filePath);
      return true;
    }
    return false;
  }

  static saveTideData(data) {
    return this.saveJsonData('tide_data.json', data);
  }

  static loadTideData() {
    return this.loadJsonData('tide_data.json');
  }

  static saveBerthData(data) {
    return this.saveJsonData('berth_data.json', data);
  }

  static loadBerthData() {
    return this.loadJsonData('berth_data.json');
  }

  static saveBargeData(data) {
    return this.saveJsonData('barge_data.json', data);
  }

  static loadBargeData() {
    return this.loadJsonData('barge_data.json');
  }
}

module.exports = FileManager;
