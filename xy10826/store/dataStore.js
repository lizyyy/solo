const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

class DataStore {
  constructor() {
    this.data = {
      externalIdentities: [],
      masterCustomers: [],
      mergeEvidences: [],
      conflictFields: [],
      undoRecords: [],
      impactScopes: [],
      auditLogs: [],
      mergeTransactions: []
    };
    this.init();
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        this.data = JSON.parse(raw);
      } catch (e) {
        console.error('数据文件损坏，使用空数据');
      }
    }
  }

  save() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2));
  }

  generateId() {
    return uuidv4();
  }

  addExternalIdentity(identity) {
    const record = {
      id: this.generateId(),
      ...identity,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.data.externalIdentities.push(record);
    this.save();
    return record;
  }

  getExternalIdentities(filter = {}) {
    let results = [...this.data.externalIdentities];
    if (filter.source) {
      results = results.filter(i => i.source === filter.source);
    }
    if (filter.masterCustomerId) {
      results = results.filter(i => i.masterCustomerId === filter.masterCustomerId);
    }
    if (filter.search) {
      const s = filter.search.toLowerCase();
      results = results.filter(i => 
        (i.externalId && i.externalId.toLowerCase().includes(s)) ||
        (i.email && i.email.toLowerCase().includes(s)) ||
        (i.phone && i.phone.toLowerCase().includes(s)) ||
        (i.name && i.name.toLowerCase().includes(s))
      );
    }
    return results;
  }

  getExternalIdentityById(id) {
    return this.data.externalIdentities.find(i => i.id === id);
  }

  updateExternalIdentity(id, updates) {
    const idx = this.data.externalIdentities.findIndex(i => i.id === id);
    if (idx !== -1) {
      this.data.externalIdentities[idx] = {
        ...this.data.externalIdentities[idx],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.save();
      return this.data.externalIdentities[idx];
    }
    return null;
  }

  addMasterCustomer(customer) {
    const record = {
      id: this.generateId(),
      masterNumber: customer.masterNumber || 'MC' + Date.now(),
      profile: customer.profile || {},
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.data.masterCustomers.push(record);
    this.save();
    return record;
  }

  getMasterCustomers(filter = {}) {
    let results = [...this.data.masterCustomers];
    if (filter.status) {
      results = results.filter(c => c.status === filter.status);
    }
    if (filter.search) {
      const s = filter.search.toLowerCase();
      results = results.filter(c => 
        (c.masterNumber && c.masterNumber.toLowerCase().includes(s)) ||
        (c.profile && c.profile.name && c.profile.name.toLowerCase().includes(s))
      );
    }
    return results;
  }

  getMasterCustomerById(id) {
    return this.data.masterCustomers.find(c => c.id === id);
  }

  updateMasterCustomer(id, updates) {
    const idx = this.data.masterCustomers.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.data.masterCustomers[idx] = {
        ...this.data.masterCustomers[idx],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.save();
      return this.data.masterCustomers[idx];
    }
    return null;
  }

  addMergeEvidence(evidence) {
    const record = {
      id: this.generateId(),
      ...evidence,
      score: evidence.score || 0,
      createdAt: new Date().toISOString()
    };
    this.data.mergeEvidences.push(record);
    this.save();
    return record;
  }

  getMergeEvidences(filter = {}) {
    let results = [...this.data.mergeEvidences];
    if (filter.identityId) {
      results = results.filter(e => e.identityIds && e.identityIds.includes(filter.identityId));
    }
    if (filter.transactionId) {
      results = results.filter(e => e.transactionId === filter.transactionId);
    }
    return results;
  }

  addConflictField(conflict) {
    const record = {
      id: this.generateId(),
      ...conflict,
      resolved: false,
      createdAt: new Date().toISOString()
    };
    this.data.conflictFields.push(record);
    this.save();
    return record;
  }

  getConflictFields(filter = {}) {
    let results = [...this.data.conflictFields];
    if (filter.transactionId) {
      results = results.filter(c => c.transactionId === filter.transactionId);
    }
    if (filter.resolved !== undefined) {
      results = results.filter(c => c.resolved === filter.resolved);
    }
    return results;
  }

  updateConflictField(id, updates) {
    const idx = this.data.conflictFields.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.data.conflictFields[idx] = {
        ...this.data.conflictFields[idx],
        ...updates,
        resolvedAt: updates.resolved ? new Date().toISOString() : undefined
      };
      this.save();
      return this.data.conflictFields[idx];
    }
    return null;
  }

  addMergeTransaction(transaction) {
    const record = {
      id: this.generateId(),
      ...transaction,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.data.mergeTransactions.push(record);
    this.save();
    return record;
  }

  getMergeTransactions(filter = {}) {
    let results = [...this.data.mergeTransactions];
    if (filter.status) {
      results = results.filter(t => t.status === filter.status);
    }
    if (filter.search) {
      const s = filter.search.toLowerCase();
      results = results.filter(t => 
        (t.id && t.id.toLowerCase().includes(s)) ||
        (t.identityIds && t.identityIds.some(id => id.toLowerCase().includes(s))
      ));
    }
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getMergeTransactionById(id) {
    return this.data.mergeTransactions.find(t => t.id === id);
  }

  updateMergeTransaction(id, updates) {
    const idx = this.data.mergeTransactions.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.data.mergeTransactions[idx] = {
        ...this.data.mergeTransactions[idx],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.save();
      return this.data.mergeTransactions[idx];
    }
    return null;
  }

  addUndoRecord(record) {
    const undo = {
      id: this.generateId(),
      ...record,
      createdAt: new Date().toISOString()
    };
    this.data.undoRecords.push(undo);
    this.save();
    return undo;
  }

  getUndoRecords(filter = {}) {
    let results = [...this.data.undoRecords];
    if (filter.transactionId) {
      results = results.filter(r => r.transactionId === filter.transactionId);
    }
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  addImpactScope(impact) {
    const record = {
      id: this.generateId(),
      ...impact,
      createdAt: new Date().toISOString()
    };
    this.data.impactScopes.push(record);
    this.save();
    return record;
  }

  getImpactScopes(filter = {}) {
    let results = [...this.data.impactScopes];
    if (filter.transactionId) {
      results = results.filter(i => i.transactionId === filter.transactionId);
    }
    return results;
  }

  addAuditLog(log) {
    const record = {
      id: this.generateId(),
      ...log,
      timestamp: new Date().toISOString()
    };
    this.data.auditLogs.push(record);
    this.save();
    return record;
  }

  getAuditLogs(filter = {}) {
    let results = [...this.data.auditLogs];
    if (filter.entityId) {
      results = results.filter(l => l.entityId === filter.entityId);
    }
    if (filter.action) {
      results = results.filter(l => l.action === filter.action);
    }
    return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  exportAllData() {
    return { ...this.data };
  }
}

module.exports = new DataStore();