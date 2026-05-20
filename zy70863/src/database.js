const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.db');
const db = new sqlite3.Database(dbPath);

const TASK_STATUS = {
  PROCESSING: '处理中',
  FAILED: '处理失败',
  MANUAL_CONFIRM: '人工确认',
  EXPORTED: '已导出'
};

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS material_tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_hash TEXT UNIQUE NOT NULL,
          repair_team TEXT NOT NULL,
          repair_time TEXT NOT NULL,
          is_night_repair INTEGER DEFAULT 0,
          fittings TEXT,
          valves TEXT,
          tools TEXT,
          status TEXT NOT NULL DEFAULT '处理中',
          last_handler TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function generateTaskHash(repairTeam, repairTime, fittings, valves, tools) {
  const data = JSON.stringify({
    repairTeam,
    repairTime,
    fittings: sortAndDeduplicate(fittings),
    valves: sortAndDeduplicate(valves),
    tools: sortAndDeduplicate(tools)
  });
  return crypto.createHash('md5').update(data).digest('hex');
}

function sortAndDeduplicate(arr) {
  if (!arr || !Array.isArray(arr)) return [];
  return [...new Set(arr)].sort();
}

function createTask(taskData) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const taskHash = generateTaskHash(
      taskData.repairTeam,
      taskData.repairTime,
      taskData.fittings,
      taskData.valves,
      taskData.tools
    );
    
    db.get('SELECT * FROM material_tasks WHERE task_hash = ?', [taskHash], (err, existingRow) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (existingRow) {
        resolve({
          isDuplicate: true,
          task: rowToTask(existingRow)
        });
        return;
      }
      
      db.run(`
        INSERT INTO material_tasks (
          task_hash, repair_team, repair_time, is_night_repair,
          fittings, valves, tools, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        taskHash,
        taskData.repairTeam,
        taskData.repairTime,
        taskData.isNightRepair ? 1 : 0,
        JSON.stringify(taskData.fittings || []),
        JSON.stringify(taskData.valves || []),
        JSON.stringify(taskData.tools || []),
        TASK_STATUS.PROCESSING,
        now,
        now
      ], function(err) {
        if (err) {
          reject(err);
          return;
        }
        
        db.get('SELECT * FROM material_tasks WHERE id = ?', [this.lastID], (err, row) => {
          if (err) reject(err);
          else resolve({
            isDuplicate: false,
            task: rowToTask(row)
          });
        });
      });
    });
  });
}

function updateTaskStatus(id, status, handler) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.run(`
      UPDATE material_tasks 
      SET status = ?, last_handler = ?, updated_at = ?
      WHERE id = ?
    `, [status, handler, now, id], function(err) {
      if (err) {
        reject(err);
        return;
      }
      
      if (this.changes === 0) {
        resolve(null);
        return;
      }
      
      db.get('SELECT * FROM material_tasks WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(rowToTask(row));
      });
    });
  });
}

function getTaskById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM material_tasks WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row ? rowToTask(row) : null);
    });
  });
}

function getAllTasks(filters = {}) {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM material_tasks WHERE 1=1';
    const params = [];
    
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    
    if (filters.repairTeam) {
      query += ' AND repair_team = ?';
      params.push(filters.repairTeam);
    }
    
    query += ' ORDER BY created_at DESC';
    
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(rowToTask));
    });
  });
}

function getStatistics() {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        status,
        COUNT(*) as count,
        is_night_repair,
        repair_team
      FROM material_tasks
      GROUP BY status, is_night_repair, repair_team
    `, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      db.get('SELECT COUNT(*) as total FROM material_tasks', [], (err, totalRow) => {
        if (err) {
          reject(err);
          return;
        }
        
        const stats = {
          total: totalRow.total,
          byStatus: {},
          nightRepairCount: 0,
          byTeam: {}
        };
        
        rows.forEach(row => {
          if (!stats.byStatus[row.status]) {
            stats.byStatus[row.status] = 0;
          }
          stats.byStatus[row.status] += row.count;
          
          if (row.is_night_repair === 1) {
            stats.nightRepairCount += row.count;
          }
          
          if (!stats.byTeam[row.repair_team]) {
            stats.byTeam[row.repair_team] = 0;
          }
          stats.byTeam[row.repair_team] += row.count;
        });
        
        resolve(stats);
      });
    });
  });
}

function getExportData() {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM material_tasks 
      ORDER BY created_at DESC
    `, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(rowToTask));
    });
  });
}

function rowToTask(row) {
  return {
    id: row.id,
    taskHash: row.task_hash,
    repairTeam: row.repair_team,
    repairTime: row.repair_time,
    isNightRepair: row.is_night_repair === 1,
    fittings: JSON.parse(row.fittings || '[]'),
    valves: JSON.parse(row.valves || '[]'),
    tools: JSON.parse(row.tools || '[]'),
    status: row.status,
    lastHandler: row.last_handler,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = {
  initDatabase,
  createTask,
  updateTaskStatus,
  getTaskById,
  getAllTasks,
  getStatistics,
  getExportData,
  TASK_STATUS
};
