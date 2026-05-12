const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/customs.db');
const db = new sqlite3.Database(dbPath);

const DOCUMENT_TYPES = [
  'contract', 'invoice', 'packing_list', 'bill_of_lading',
  'certificate_of_origin', 'inspection_certificate', 'customs_declaration',
  'power_of_attorney', 'other'
];

const STATUS_TYPES = {
  PENDING: 'pending',
  DOCUMENTS_CHECKING: 'documents_checking',
  SUPPLEMENT_REQUESTED: 'supplement_requested',
  INSPECTION: 'inspection',
  PAYMENT_PENDING: 'payment_pending',
  RELEASED: 'released',
  CLOSED: 'closed'
};

function initDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS declarations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_of_lading TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      port TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      next_responsible TEXT,
      notes TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      declaration_id INTEGER NOT NULL,
      document_type TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      received BOOLEAN DEFAULT 0,
      received_at DATETIME,
      missing_reason TEXT,
      FOREIGN KEY (declaration_id) REFERENCES declarations(id),
      UNIQUE(declaration_id, document_type)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS status_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      declaration_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      changed_by TEXT,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (declaration_id) REFERENCES declarations(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      declaration_id INTEGER NOT NULL,
      amount REAL,
      paid BOOLEAN DEFAULT 0,
      paid_at DATETIME,
      payment_method TEXT,
      notes TEXT,
      FOREIGN KEY (declaration_id) REFERENCES declarations(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      declaration_id INTEGER NOT NULL,
      inspection_type TEXT,
      result TEXT,
      returned BOOLEAN DEFAULT 0,
      returned_reason TEXT,
      inspector TEXT,
      inspection_date DATETIME,
      notes TEXT,
      FOREIGN KEY (declaration_id) REFERENCES declarations(id)
    )`);
  });
}

function getDeclarations(filters = {}) {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM declarations WHERE 1=1';
    const params = [];
    
    if (filters.customer_name) {
      query += ' AND customer_name LIKE ?';
      params.push(`%${filters.customer_name}%`);
    }
    if (filters.port) {
      query += ' AND port LIKE ?';
      params.push(`%${filters.port}%`);
    }
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getDeclarationById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM declarations WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getDeclarationByBillOfLading(billOfLading) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM declarations WHERE bill_of_lading = ?', [billOfLading], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function createDeclaration(data) {
  return new Promise(async (resolve, reject) => {
    const existing = await getDeclarationByBillOfLading(data.bill_of_lading);
    if (existing) {
      return reject(new Error('该提单号已存在，不能重复建单'));
    }

    db.run(
      `INSERT INTO declarations (bill_of_lading, customer_name, port, next_responsible, notes) 
       VALUES (?, ?, ?, ?, ?)`,
      [data.bill_of_lading, data.customer_name, data.port, data.next_responsible || '', data.notes || ''],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        
        const declarationId = this.lastID;
        
        const docValues = DOCUMENT_TYPES.map(docType => 
          `(${declarationId}, '${docType}', 1, 0, NULL, NULL)`
        ).join(',');
        
        db.run(
          `INSERT INTO documents (declaration_id, document_type, version, received, received_at, missing_reason)
           VALUES ${docValues}`,
          (docErr) => {
            if (docErr) reject(docErr);
            else resolve({ id: declarationId, ...data });
          }
        );
      }
    );
  });
}

function updateDeclarationStatus(id, status, reason, changedBy) {
  return new Promise(async (resolve, reject) => {
    const declaration = await getDeclarationById(id);
    if (!declaration) {
      return reject(new Error('委托单不存在'));
    }

    if (status === 'released') {
      const payment = await getPaymentByDeclarationId(id);
      if (!payment || !payment.paid) {
        return reject(new Error('未缴费不能放行'));
      }
    }

    db.run(
      `UPDATE declarations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, id],
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        db.run(
          `INSERT INTO status_logs (declaration_id, status, changed_by, reason)
           VALUES (?, ?, ?, ?)`,
          [id, status, changedBy || '', reason || ''],
          (logErr) => {
            if (logErr) reject(logErr);
            else resolve({ id, status });
          }
        );
      }
    );
  });
}

function updateDeclaration(id, data) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE declarations 
       SET customer_name = ?, port = ?, next_responsible = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [data.customer_name, data.port, data.next_responsible || '', data.notes || '', id],
      (err) => {
        if (err) reject(err);
        else resolve({ id, ...data });
      }
    );
  });
}

function getDocumentsByDeclarationId(declarationId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM documents WHERE declaration_id = ?', [declarationId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function updateDocument(declarationId, documentType, data) {
  return new Promise(async (resolve, reject) => {
    const doc = await new Promise((res, rej) => {
      db.get(
        'SELECT * FROM documents WHERE declaration_id = ? AND document_type = ?',
        [declarationId, documentType],
        (err, row) => err ? rej(err) : res(row)
      );
    });

    if (!doc) {
      return reject(new Error('资料不存在'));
    }

    const newVersion = data.received && !doc.received ? doc.version + 1 : doc.version;
    
    db.run(
      `UPDATE documents 
       SET received = ?, received_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE received_at END,
           missing_reason = ?, version = ?
       WHERE declaration_id = ? AND document_type = ?`,
      [data.received ? 1 : 0, data.received ? 1 : 0, data.missing_reason || '', newVersion, declarationId, documentType],
      (err) => {
        if (err) reject(err);
        else resolve({ declarationId, documentType, received: data.received, version: newVersion });
      }
    );
  });
}

function getPaymentByDeclarationId(declarationId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM payments WHERE declaration_id = ?', [declarationId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function createOrUpdatePayment(declarationId, data) {
  return new Promise(async (resolve, reject) => {
    const existing = await getPaymentByDeclarationId(declarationId);
    
    if (existing) {
      db.run(
        `UPDATE payments 
         SET amount = ?, paid = ?, paid_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE paid_at END,
             payment_method = ?, notes = ?
         WHERE declaration_id = ?`,
        [data.amount, data.paid ? 1 : 0, data.paid ? 1 : 0, data.payment_method || '', data.notes || '', declarationId],
        (err) => {
          if (err) reject(err);
          else resolve({ declarationId, ...data });
        }
      );
    } else {
      db.run(
        `INSERT INTO payments (declaration_id, amount, paid, payment_method, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [declarationId, data.amount, data.paid ? 1 : 0, data.payment_method || '', data.notes || ''],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, declarationId, ...data });
        }
      );
    }
  });
}

function getInspectionByDeclarationId(declarationId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM inspections WHERE declaration_id = ?', [declarationId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function createOrUpdateInspection(declarationId, data) {
  return new Promise(async (resolve, reject) => {
    const existing = await getInspectionByDeclarationId(declarationId);
    
    if (existing) {
      db.run(
        `UPDATE inspections 
         SET inspection_type = ?, result = ?, returned = ?, returned_reason = ?,
             inspector = ?, inspection_date = ?, notes = ?
         WHERE declaration_id = ?`,
        [
          data.inspection_type || '', data.result || '', data.returned ? 1 : 0,
          data.returned_reason || '', data.inspector || '', data.inspection_date || null,
          data.notes || '', declarationId
        ],
        (err) => {
          if (err) reject(err);
          else resolve({ declarationId, ...data });
        }
      );
    } else {
      db.run(
        `INSERT INTO inspections (declaration_id, inspection_type, result, returned, returned_reason, inspector, inspection_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          declarationId, data.inspection_type || '', data.result || '', data.returned ? 1 : 0,
          data.returned_reason || '', data.inspector || '', data.inspection_date || null, data.notes || ''
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, declarationId, ...data });
        }
      );
    }
  });
}

function getStatusLogsByDeclarationId(declarationId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM status_logs WHERE declaration_id = ? ORDER BY created_at DESC', [declarationId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getDistinctCustomers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT DISTINCT customer_name FROM declarations ORDER BY customer_name', (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(r => r.customer_name));
    });
  });
}

function getDistinctPorts() {
  return new Promise((resolve, reject) => {
    db.all('SELECT DISTINCT port FROM declarations ORDER BY port', (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(r => r.port));
    });
  });
}

module.exports = {
  initDatabase,
  getDeclarations,
  getDeclarationById,
  createDeclaration,
  updateDeclarationStatus,
  updateDeclaration,
  getDocumentsByDeclarationId,
  updateDocument,
  createOrUpdatePayment,
  getPaymentByDeclarationId,
  createOrUpdateInspection,
  getInspectionByDeclarationId,
  getStatusLogsByDeclarationId,
  getDistinctCustomers,
  getDistinctPorts,
  STATUS_TYPES,
  DOCUMENT_TYPES
};
