const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const config = require('../config');

const mkdirAsync = promisify(fs.mkdir);
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const accessAsync = promisify(fs.access);

class Storage {
  constructor() {
    this.ensureDataDirs();
  }

  async ensureDataDirs() {
    const dirs = [config.DATA_DIR, config.UPLOAD_DIR];
    for (const dir of dirs) {
      try {
        await accessAsync(dir);
      } catch {
        await mkdirAsync(dir, { recursive: true });
      }
    }
  }

  getFilePath(filename) {
    return path.join(config.DATA_DIR, filename);
  }

  async readJSON(filename, defaultValue = []) {
    const filePath = this.getFilePath(filename);
    try {
      await accessAsync(filePath);
      const content = await readFileAsync(filePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return defaultValue;
    }
  }

  async writeJSON(filename, data) {
    const filePath = this.getFilePath(filename);
    await writeFileAsync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  async appendToArray(filename, item) {
    const data = await this.readJSON(filename, []);
    data.push(item);
    await this.writeJSON(filename, data);
    return data;
  }

  async updateArray(filename, predicate, updater) {
    const data = await this.readJSON(filename, []);
    const updated = data.map(item => predicate(item) ? updater(item) : item);
    await this.writeJSON(filename, updated);
    return updated;
  }
}

module.exports = new Storage();
