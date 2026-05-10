const data = {
  animal_species: [],
  cage_locations: [],
  cages: [],
  care_levels: [],
  owners: [],
  pets: [],
  hospitalizations: [],
  cage_history: [],
  care_tasks: [],
  transfer_requests: [],
  alerts: []
};

const counters = {
  animal_species: 0,
  cage_locations: 0,
  cages: 0,
  care_levels: 0,
  owners: 0,
  pets: 0,
  hospitalizations: 0,
  cage_history: 0,
  care_tasks: 0,
  transfer_requests: 0,
  alerts: 0
};

function nextId(table) {
  counters[table]++;
  return counters[table];
}

function now() {
  return new Date().toISOString();
}

function initDatabase() {
  data.animal_species = [];
  data.cage_locations = [];
  data.cages = [];
  data.care_levels = [];
  data.owners = [];
  data.pets = [];
  data.hospitalizations = [];
  data.cage_history = [];
  data.care_tasks = [];
  data.transfer_requests = [];
  data.alerts = [];

  counters.animal_species = 0;
  counters.cage_locations = 0;
  counters.cages = 0;
  counters.care_levels = 0;
  counters.owners = 0;
  counters.pets = 0;
  counters.hospitalizations = 0;
  counters.cage_history = 0;
  counters.care_tasks = 0;
  counters.transfer_requests = 0;
  counters.alerts = 0;
}

class Statement {
  constructor(sql) {
    this.sql = sql;
  }

  run(...params) {
    const sql = this.sql;
    if (sql.startsWith('INSERT INTO')) {
      const tableMatch = sql.match(/INSERT INTO (\w+)/);
      if (!tableMatch) return { lastInsertRowid: 0 };

      const table = tableMatch[1];
      const columnsMatch = sql.match(/\(([^)]+)\)/);
      if (!columnsMatch) return { lastInsertRowid: 0 };

      const columns = columnsMatch[1].split(',').map(c => c.trim());
      const row = { id: nextId(table), created_at: now() };

      columns.forEach((col, idx) => {
        if (col !== 'id') {
          row[col] = params[idx] !== undefined ? params[idx] : null;
        }
      });

      if (!row.updated_at && sql.includes('hospitalizations')) {
        row.updated_at = now();
      }

      data[table].push(row);
      return { lastInsertRowid: row.id, changes: 1 };
    }

    if (sql.startsWith('UPDATE')) {
      const tableMatch = sql.match(/UPDATE (\w+)/);
      if (!tableMatch) return { changes: 0 };

      const table = tableMatch[1];
      const setMatch = sql.match(/SET (.+?) WHERE/);
      if (!setMatch) return { changes: 0 };

      const whereMatch = sql.match(/WHERE (.+)/);
      if (!whereMatch) return { changes: 0 };

      const setParts = setMatch[1].split(',').map(p => p.trim());
      const whereParts = whereMatch[1].split('AND').map(p => p.trim());

      let paramIndex = 0;
      const updates = {};

      setParts.forEach(part => {
        const [col, val] = part.split('=').map(s => s.trim());
        if (val === '?') {
          updates[col] = params[paramIndex++];
        } else if (val === "CURRENT_TIMESTAMP") {
          updates[col] = now();
        } else {
          updates[col] = val;
        }
      });

      let changes = 0;
      data[table].forEach(row => {
        let match = true;
        let wpIndex = paramIndex;

        whereParts.forEach(part => {
          const [col, op, val] = part.split(/\s+/);
          if (val === '?') {
            const paramVal = params[wpIndex++];
            if (row[col] !== paramVal) match = false;
          } else if (val === 'NULL' && op === 'IS') {
            if (row[col] !== null) match = false;
          }
        });

        if (match) {
          Object.assign(row, updates);
          changes++;
        }
      });

      return { changes };
    }

    if (sql.startsWith('DELETE FROM')) {
      const tableMatch = sql.match(/DELETE FROM (\w+)/);
      if (tableMatch) {
        const table = tableMatch[1];
        const oldLength = data[table].length;
        data[table] = [];
        return { changes: oldLength };
      }
    }

    return { lastInsertRowid: 0, changes: 0 };
  }

  get(...params) {
    const results = this.all(...params);
    return results[0] || undefined;
  }

  all(...params) {
    const sql = this.sql;
    let table = null;

    const fromMatch = sql.match(/FROM (\w+)/);
    if (fromMatch) table = fromMatch[1];

    const joinMatches = sql.match(/JOIN (\w+)/g) || [];
    const joins = joinMatches.map(m => m.replace('JOIN ', '').trim());

    const whereMatch = sql.match(/WHERE (.+?)(ORDER BY|LIMIT|$)/);
    const orderMatch = sql.match(/ORDER BY (.+?)(LIMIT|$)/);
    const limitMatch = sql.match(/LIMIT (\d+)/);

    let rows = [...data[table] || []];

    if (whereMatch && params.length > 0) {
      const whereStr = whereMatch[1].trim();
      let paramIndex = 0;

      const conditions = whereStr.split(/\s+AND\s+/i);

      rows = rows.filter(row => {
        let matches = true;

        conditions.forEach(cond => {
          if (cond.includes('?')) {
            const parts = cond.split(/\s*=\s*/);
            const colParts = parts[0].split('.');
            const col = colParts[colParts.length - 1];
            const val = params[paramIndex++];

            if (row[col] !== val) matches = false;
          } else if (cond.includes('IS NULL')) {
            const colParts = cond.split(' ')[0].split('.');
            const col = colParts[colParts.length - 1];
            if (row[col] !== null) matches = false;
          }
        });

        return matches;
      });
    }

    if (orderMatch) {
      const orderCol = orderMatch[1].split(' ')[0];
      const isDesc = orderMatch[1].toUpperCase().includes('DESC');
      rows.sort((a, b) => {
        if (a[orderCol] < b[orderCol]) return isDesc ? 1 : -1;
        if (a[orderCol] > b[orderCol]) return isDesc ? -1 : 1;
        return 0;
      });
    }

    if (limitMatch) {
      rows = rows.slice(0, parseInt(limitMatch[1]));
    }

    return rows;
  }
}

class Database {
  constructor() {}

  exec(sql) {
    const statements = sql.split(';').filter(s => s.trim());
    statements.forEach(stmt => {
      if (stmt.trim().startsWith('CREATE')) return;
      if (stmt.trim().startsWith('DELETE')) {
        const match = stmt.trim().match(/DELETE FROM (\w+)/);
        if (match && data[match[1]]) {
          data[match[1]] = [];
        }
      }
    });
  }

  prepare(sql) {
    return new Statement(sql);
  }

  pragma() {}
}

function getDb() {
  return {
    prepare: (sql) => new Statement(sql),
    exec: (sql) => {
      const statements = sql.split(';').filter(s => s.trim());
      statements.forEach(stmt => {
        if (stmt.trim().startsWith('CREATE')) return;
        if (stmt.trim().startsWith('DELETE')) {
          const match = stmt.trim().match(/DELETE FROM (\w+)/);
          if (match && data[match[1]]) {
            data[match[1]] = [];
          }
        }
      });
    }
  };
}

function getData() {
  return data;
}

module.exports = {
  initDatabase,
  getDb,
  getData,
  nextId,
  now
};
