import { randomUUID } from 'crypto';

const db = {
  customers: [],
  plans: [],
  subscriptions: [],
  usage_records: [],
  excess_records: [],
  audit_logs: []
};

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.orderBy = null;
    this.limitNum = null;
  }

  where(condition) {
    this.filters.push(condition);
    return this;
  }

  order(field, direction = 'ASC') {
    this.orderBy = { field, direction };
    return this;
  }

  limit(num) {
    this.limitNum = num;
    return this;
  }

  all() {
    let results = [...db[this.table]];
    
    for (const filter of this.filters) {
      results = results.filter(filter);
    }
    
    if (this.orderBy) {
      results.sort((a, b) => {
        const aVal = a[this.orderBy.field];
        const bVal = b[this.orderBy.field];
        if (this.orderBy.direction === 'DESC') {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      });
    }
    
    if (this.limitNum !== null) {
      results = results.slice(0, this.limitNum);
    }
    
    return results;
  }

  first() {
    const results = this.all();
    return results[0] || undefined;
  }

  get() {
    return this.first();
  }
}

function prepare(table) {
  return new QueryBuilder(table);
}

function insert(table, data) {
  const record = { ...data };
  if (!record.id) {
    record.id = randomUUID();
  }
  if (!record.created_at) {
    record.created_at = new Date().toISOString();
  }
  db[table].push(record);
  return record;
}

function update(table, filter, updates) {
  const records = db[table];
  let updated = 0;
  
  for (let i = 0; i < records.length; i++) {
    if (filter(records[i])) {
      records[i] = { ...records[i], ...updates };
      updated++;
    }
  }
  
  return { changes: updated };
}

export default {
  db,
  prepare,
  insert,
  update
};
