const fs = require('fs');
const path = require('path');
const { Task } = require('./Task');

class DataStore {
  constructor(baseDir) {
    this.baseDir = baseDir || path.join(process.cwd(), 'data');
    this.tasksFile = path.join(this.baseDir, 'tasks.json');
    this.historyDir = path.join(this.baseDir, 'history');
    this.init();
  }

  init() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    if (!fs.existsSync(this.historyDir)) {
      fs.mkdirSync(this.historyDir, { recursive: true });
    }
    if (!fs.existsSync(this.tasksFile)) {
      fs.writeFileSync(this.tasksFile, JSON.stringify({
        version: '1.0',
        createdAt: new Date().toISOString(),
        tasks: [],
        importSessions: [],
        isFrozen: false,
        frozenAt: null,
        frozenBy: null
      }, null, 2));
    }
  }

  load() {
    const data = JSON.parse(fs.readFileSync(this.tasksFile, 'utf8'));
    data.tasks = data.tasks.map(t => Task.fromJSON(t));
    return data;
  }

  save(data) {
    const exportData = {
      ...data,
      tasks: data.tasks.map(t => t.toJSON())
    };
    fs.writeFileSync(this.tasksFile, JSON.stringify(exportData, null, 2));
  }

  saveSnapshot(operator, reason) {
    const data = this.load();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotFile = path.join(this.historyDir, `snapshot-${timestamp}.json`);
    const snapshot = {
      timestamp: new Date().toISOString(),
      operator,
      reason,
      data: data
    };
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));
    return snapshotFile;
  }

  listSnapshots() {
    const files = fs.readdirSync(this.historyDir)
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort()
      .reverse();
    return files.map(f => {
      const content = JSON.parse(fs.readFileSync(path.join(this.historyDir, f), 'utf8'));
      return {
        file: f,
        timestamp: content.timestamp,
        operator: content.operator,
        reason: content.reason,
        taskCount: content.data.tasks.length
      };
    });
  }

  loadSnapshot(filename) {
    const filePath = path.join(this.historyDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Snapshot ${filename} not found`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  addTask(task, operator) {
    const data = this.load();
    if (data.isFrozen) {
      throw new Error('Data is frozen for export, cannot add tasks');
    }
    data.tasks.push(task);
    this.save(data);
    this.saveSnapshot(operator, `added_task_${task.id}`);
    return task;
  }

  updateTask(taskId, updater, operator) {
    const data = this.load();
    if (data.isFrozen) {
      throw new Error('Data is frozen for export, cannot update tasks');
    }
    const taskIndex = data.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      throw new Error(`Task ${taskId} not found`);
    }
    updater(data.tasks[taskIndex]);
    this.save(data);
    this.saveSnapshot(operator, `updated_task_${taskId}`);
    return data.tasks[taskIndex];
  }

  findTask(roomNumber, date, type) {
    const data = this.load();
    return data.tasks.find(t => 
      t.roomNumber === roomNumber && 
      t.date === date && 
      t.type === type
    );
  }

  getTasksByDate(date) {
    const data = this.load();
    return data.tasks.filter(t => t.date === date);
  }

  getFailedTasks() {
    const data = this.load();
    return data.tasks.filter(t => t.status === 'failed' && !t.isFrozen);
  }

  freezeAll(operator) {
    const data = this.load();
    data.isFrozen = true;
    data.frozenAt = new Date().toISOString();
    data.frozenBy = operator;
    data.tasks.forEach(t => t.freeze(operator));
    this.save(data);
    this.saveSnapshot(operator, 'full_freeze_for_export');
  }

  unfreezeAll(operator) {
    const data = this.load();
    data.isFrozen = false;
    data.frozenAt = null;
    data.frozenBy = null;
    data.tasks.forEach(t => t.unfreeze(operator));
    this.save(data);
    this.saveSnapshot(operator, 'full_unfreeze');
  }

  isFrozen() {
    const data = this.load();
    return data.isFrozen;
  }

  addImportSession(session, operator) {
    const data = this.load();
    data.importSessions.push({
      ...session,
      operator,
      importedAt: new Date().toISOString()
    });
    this.save(data);
  }

  getImportSessions() {
    const data = this.load();
    return data.importSessions;
  }

  reset(operator) {
    this.saveSnapshot(operator, 'before_reset');
    const initialData = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      tasks: [],
      importSessions: [],
      isFrozen: false,
      frozenAt: null,
      frozenBy: null
    };
    this.save(initialData);
    this.saveSnapshot(operator, 'after_reset');
  }
}

module.exports = { DataStore };
