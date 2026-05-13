const fs = require('fs');
const path = require('path');
const os = require('os');

const STATE_FILE = path.join(os.tmpdir(), 'log-scan-state.json');

class StateManager {
  constructor() {
    this.stateFile = STATE_FILE;
  }

  load() {
    if (!fs.existsSync(this.stateFile)) {
      return {
        loadedFiles: {},
        lastModified: {}
      };
    }

    try {
      const content = fs.readFileSync(this.stateFile, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      return {
        loadedFiles: {},
        lastModified: {}
      };
    }
  }

  save(state) {
    try {
      const dir = path.dirname(this.stateFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2), 'utf-8');
    } catch (e) {
    }
  }

  isRepeatLoad(filePath) {
    const state = this.load();
    const fullPath = path.resolve(filePath);
    return state.loadedFiles && state.loadedFiles[fullPath];
  }

  hasFileChanged(filePath) {
    const state = this.load();
    const fullPath = path.resolve(filePath);

    if (!state.loadedFiles || !state.loadedFiles[fullPath]) {
      return true;
    }

    if (!fs.existsSync(fullPath)) {
      return true;
    }

    const stat = fs.statSync(fullPath);
    return stat.mtimeMs !== state.lastModified[fullPath];
  }

  markLoaded(filePath) {
    const state = this.load();
    const fullPath = path.resolve(filePath);

    if (!state.loadedFiles) {
      state.loadedFiles = {};
    }
    if (!state.lastModified) {
      state.lastModified = {};
    }

    state.loadedFiles[fullPath] = true;

    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);
      state.lastModified[fullPath] = stat.mtimeMs;
    }

    this.save(state);
  }

  clear() {
    if (fs.existsSync(this.stateFile)) {
      fs.unlinkSync(this.stateFile);
    }
  }

  getStateFilePath() {
    return this.stateFile;
  }
}

module.exports = { StateManager };
