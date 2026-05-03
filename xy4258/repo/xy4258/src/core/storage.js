const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

const STORAGE_DIR = path.join(__dirname, '../../storage');

class StateStorage {
  constructor() {
    this.ensureStorageDir();
    this.dispatchResultsPath = path.join(STORAGE_DIR, 'dispatch_results.json');
    this.sessionStatePath = path.join(STORAGE_DIR, 'session_state.json');
  }

  ensureStorageDir() {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  }

  async loadDispatchResults() {
    try {
      if (!fs.existsSync(this.dispatchResultsPath)) {
        return [];
      }
      const content = await fs.promises.readFile(this.dispatchResultsPath, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.error('加载调度结果失败:', e);
      return [];
    }
  }

  async saveDispatchResult(result) {
    const results = await this.loadDispatchResults();
    
    const newResult = {
      id: `dispatch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: Date.now(),
      created_at_readable: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      ...result,
      status: 'pending'
    };
    
    results.push(newResult);
    
    await fs.promises.writeFile(
      this.dispatchResultsPath,
      JSON.stringify(results, null, 2),
      'utf-8'
    );
    
    return newResult;
  }

  async updateDispatchResult(id, updates) {
    const results = await this.loadDispatchResults();
    const index = results.findIndex(r => r.id === id);
    
    if (index === -1) {
      throw new Error(`调度结果 ${id} 不存在`);
    }
    
    results[index] = {
      ...results[index],
      ...updates,
      updated_at: Date.now(),
      updated_at_readable: dayjs().format('YYYY-MM-DD HH:mm:ss')
    };
    
    await fs.promises.writeFile(
      this.dispatchResultsPath,
      JSON.stringify(results, null, 2),
      'utf-8'
    );
    
    return results[index];
  }

  async markDispatchComplete(id, operator, notes = '') {
    return this.updateDispatchResult(id, {
      status: 'completed',
      completed_at: Date.now(),
      completed_at_readable: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      operator: operator,
      notes: notes
    });
  }

  async getDispatchResults(filters = {}) {
    const results = await this.loadDispatchResults();
    
    return results.filter(r => {
      if (filters.status && r.status !== filters.status) return false;
      if (filters.type && r.type !== filters.type) return false;
      if (filters.date) {
        const resultDate = dayjs(r.created_at).format('YYYY-MM-DD');
        if (resultDate !== filters.date) return false;
      }
      return true;
    }).sort((a, b) => b.created_at - a.created_at);
  }

  async getTodayDispatchResults() {
    const today = dayjs().format('YYYY-MM-DD');
    return this.getDispatchResults({ date: today });
  }

  async loadSessionState() {
    try {
      if (!fs.existsSync(this.sessionStatePath)) {
        return {
          current_dataset: null,
          loaded_at: null,
          analysis_results: null
        };
      }
      const content = await fs.promises.readFile(this.sessionStatePath, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.error('加载会话状态失败:', e);
      return {
        current_dataset: null,
        loaded_at: null,
        analysis_results: null
      };
    }
  }

  async saveSessionState(state) {
    const currentState = await this.loadSessionState();
    
    const newState = {
      ...currentState,
      ...state,
      updated_at: Date.now()
    };
    
    await fs.promises.writeFile(
      this.sessionStatePath,
      JSON.stringify(newState, null, 2),
      'utf-8'
    );
    
    return newState;
  }

  async saveAnalysisResults(results) {
    return this.saveSessionState({
      analysis_results: results,
      analysis_at: Date.now(),
      analysis_at_readable: dayjs().format('YYYY-MM-DD HH:mm:ss')
    });
  }

  async getAnalysisResults() {
    const state = await this.loadSessionState();
    return state.analysis_results;
  }

  async saveDataSnapshot(data, name = 'current') {
    const snapshotPath = path.join(STORAGE_DIR, `snapshot_${name}_${Date.now()}.json`);
    
    await fs.promises.writeFile(
      snapshotPath,
      JSON.stringify({
        name,
        saved_at: Date.now(),
        saved_at_readable: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        data: data
      }, null, 2),
      'utf-8'
    );
    
    return snapshotPath;
  }

  async listSnapshots() {
    const files = fs.readdirSync(STORAGE_DIR);
    const snapshotFiles = files.filter(f => f.startsWith('snapshot_') && f.endsWith('.json'));
    
    return snapshotFiles.map(f => {
      const matches = f.match(/snapshot_(.+)_(\d+)\.json/);
      if (matches) {
        return {
          filename: f,
          name: matches[1],
          timestamp: parseInt(matches[2]),
          path: path.join(STORAGE_DIR, f)
        };
      }
      return null;
    }).filter(Boolean).sort((a, b) => b.timestamp - a.timestamp);
  }

  async loadSnapshot(filename) {
    const snapshotPath = path.join(STORAGE_DIR, filename);
    if (!fs.existsSync(snapshotPath)) {
      throw new Error(`快照文件 ${filename} 不存在`);
    }
    
    const content = await fs.promises.readFile(snapshotPath, 'utf-8');
    return JSON.parse(content);
  }

  async clearOldSnapshots(daysToKeep = 7) {
    const snapshots = await this.listSnapshots();
    const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    
    const deleted = [];
    for (const snapshot of snapshots) {
      if (snapshot.timestamp < cutoff) {
        await fs.promises.unlink(snapshot.path);
        deleted.push(snapshot.filename);
      }
    }
    
    return deleted;
  }
}

module.exports = new StateStorage();
