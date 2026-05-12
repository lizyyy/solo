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
      overwrite_reason TEXT,
      FOREIGN KEY (declaration_id) REFERENCES declarations(id),
      UNIQUE(declaration_id, document_type)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS document_version_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      declaration_id INTEGER NOT NULL,
      document_type TEXT NOT NULL,
      version INTEGER NOT NULL,
      received BOOLEAN NOT NULL,
      changed_by TEXT,
      change_reason TEXT,
      overwrite_reason TEXT,
      content_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id),
      FOREIGN KEY (declaration_id) REFERENCES declarations(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS status_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      declaration_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      changed_by TEXT,
      reason TEXT,
      request_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (declaration_id) REFERENCES declarations(id),
      UNIQUE(declaration_id, request_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      declaration_id INTEGER NOT NULL UNIQUE,
      amount REAL,
      paid BOOLEAN DEFAULT 0,
      paid_at DATETIME,
      payment_method TEXT,
      notes TEXT,
      last_updated_by TEXT,
      last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (declaration_id) REFERENCES declarations(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      declaration_id INTEGER NOT NULL UNIQUE,
      inspection_type TEXT,
      result TEXT,
      returned BOOLEAN DEFAULT 0,
      returned_reason TEXT,
      inspector TEXT,
      inspection_date DATETIME,
      notes TEXT,
      last_updated_by TEXT,
      last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (declaration_id) REFERENCES declarations(id)
    )`);

    migrateExistingData();
  });
}

function migrateExistingData() {
  db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'", (err, rows) => {
    if (rows.length > 0) {
      db.all("PRAGMA table_info(documents)", (err, columns) => {
        const hasOverwriteReason = columns.some(c => c.name === 'overwrite_reason');
        if (!hasOverwriteReason) {
          db.run("ALTER TABLE documents ADD COLUMN overwrite_reason TEXT", (err) => {
            if (!err) console.log('Added overwrite_reason column to documents table');
          });
        }
      });
    }
  });
  
  db.all("PRAGMA table_info(document_version_history)", (err, columns) => {
    if (columns && columns.length > 0) {
      const hasContentHash = columns.some(c => c.name === 'content_hash');
      if (!hasContentHash) {
        db.run("ALTER TABLE document_version_history ADD COLUMN content_hash TEXT", (err) => {
          if (!err) console.log('Added content_hash column to document_version_history table');
        });
      }
    }
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
          `(${declarationId}, '${docType}', 1, 0, NULL, NULL, NULL)`
        ).join(',');
        
        db.run(
          `INSERT INTO documents (declaration_id, document_type, version, received, received_at, missing_reason, overwrite_reason)
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

function calculateDocumentHash(received, missing_reason, overwrite_reason) {
  return `${received ? 1 : 0}|${missing_reason || ''}|${overwrite_reason || ''}`;
}

function updateDeclarationStatus(id, status, reason, changedBy, requestId = null) {
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

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.get(
        `SELECT id FROM status_logs 
         WHERE declaration_id = ? AND status = ?
         ORDER BY created_at DESC LIMIT 1`,
        [id, status],
        (err, recentLog) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return;
          }

          const shouldUpdateStatus = declaration.status !== status;
          const shouldInsertLog = declaration.status !== status || !recentLog;

          if (!shouldUpdateStatus && !shouldInsertLog) {
            db.run('COMMIT');
            resolve({ id, status, duplicate: true, skipped: true });
            return;
          }

          if (requestId) {
            db.get(
              'SELECT id FROM status_logs WHERE declaration_id = ? AND request_id = ?',
              [id, requestId],
              (err, existingLog) => {
                if (err) {
                  db.run('ROLLBACK');
                  reject(err);
                  return;
                }
                
                if (existingLog) {
                  db.run('COMMIT');
                  resolve({ id, status, duplicate: true });
                  return;
                }
                
                doUpdate();
              }
            );
          } else {
            doUpdate();
          }

          function doUpdate() {
            if (shouldUpdateStatus) {
              db.run(
                `UPDATE declarations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [status, id],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    reject(err);
                    return;
                  }
                  insertStatusLog();
                }
              );
            } else {
              insertStatusLog();
            }
          }

          function insertStatusLog() {
            if (shouldInsertLog) {
              db.run(
                `INSERT INTO status_logs (declaration_id, status, changed_by, reason, request_id)
                 VALUES (?, ?, ?, ?, ?)`,
                [id, status, changedBy || '', reason || '', requestId],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    reject(err);
                    return;
                  }
                  db.run('COMMIT');
                  resolve({ id, status });
                }
              );
            } else {
              db.run('COMMIT');
              resolve({ id, status, skipped: true });
            }
          }
        }
      );
    });
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

function getDocumentVersionHistory(declarationId, documentType) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM document_version_history 
       WHERE declaration_id = ? AND document_type = ? 
       ORDER BY version DESC, created_at DESC`,
      [declarationId, documentType],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function getAllDocumentVersionHistory(declarationId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM document_version_history 
       WHERE declaration_id = ? 
       ORDER BY document_type, version DESC, created_at DESC`,
      [declarationId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
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

    const wasReceived = doc.received;
    const isNowReceived = data.received;
    const newMissingReason = data.missing_reason || '';
    const newOverwriteReason = data.overwrite_reason || '';
    
    const oldHash = calculateDocumentHash(doc.received, doc.missing_reason, doc.overwrite_reason);
    const newHash = calculateDocumentHash(isNowReceived, newMissingReason, newOverwriteReason);
    
    if (oldHash === newHash && !data.change_reason) {
      resolve({ 
        declarationId, 
        documentType, 
        received: doc.received, 
        version: doc.version,
        skipped: true,
        message: '内容无变化，跳过保存' 
      });
      return;
    }
    
    let newVersion = doc.version;
    let changeReason = data.change_reason || '';
    
    if (data.force_new_version || data.force_record) {
      newVersion = doc.version + 1;
      changeReason = '更新资料版本';
    } else if (!wasReceived && isNowReceived) {
      changeReason = '首次收到资料';
    } else if (wasReceived && !isNowReceived) {
      changeReason = '资料退回/标记为未收到';
    } else if (doc.missing_reason !== newMissingReason) {
      changeReason = '更新缺件原因';
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run(
        `UPDATE documents 
         SET received = ?, 
             received_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE received_at END,
             missing_reason = ?, 
             overwrite_reason = ?,
             version = ?
         WHERE declaration_id = ? AND document_type = ?`,
        [
          isNowReceived ? 1 : 0, 
          isNowReceived ? 1 : 0, 
          newMissingReason, 
          newOverwriteReason,
          newVersion, 
          declarationId, 
          documentType
        ],
        (err) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return;
          }

          db.get(
            `SELECT id FROM document_version_history 
             WHERE document_id = ? AND content_hash = ?
             ORDER BY created_at DESC LIMIT 1`,
            [doc.id, newHash],
            (err, existingHistory) => {
              if (err) {
                db.run('ROLLBACK');
                reject(err);
                return;
              }

              if (existingHistory && !data.force_record) {
                db.run('COMMIT');
                resolve({ 
                  declarationId, 
                  documentType, 
                  received: isNowReceived, 
                  version: newVersion,
                  duplicate: true,
                  message: '相同内容的历史记录已存在，跳过'
                });
                return;
              }

              db.run(
                `INSERT INTO document_version_history 
                 (document_id, declaration_id, document_type, version, received, changed_by, change_reason, overwrite_reason, content_hash)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  doc.id,
                  declarationId,
                  documentType,
                  newVersion,
                  isNowReceived ? 1 : 0,
                  data.changed_by || '',
                  changeReason,
                  newOverwriteReason,
                  newHash
                ],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    reject(err);
                    return;
                  }
                  db.run('COMMIT');
                  resolve({ 
                    declarationId, 
                    documentType, 
                    received: isNowReceived, 
                    version: newVersion,
                    changeReason 
                  });
                }
              );
            }
          );
        }
      );
    });
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
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      if (existing) {
        db.run(
          `UPDATE payments 
           SET amount = ?, paid = ?, paid_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE paid_at END,
               payment_method = ?, notes = ?, last_updated_by = ?, last_updated_at = CURRENT_TIMESTAMP
           WHERE declaration_id = ?`,
          [
            data.amount, 
            data.paid ? 1 : 0, 
            data.paid ? 1 : 0, 
            data.payment_method || '', 
            data.notes || '',
            data.changed_by || '',
            declarationId
          ],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            db.run('COMMIT');
            resolve({ declarationId, ...data, updated: true });
          }
        );
      } else {
        db.run(
          `INSERT INTO payments (declaration_id, amount, paid, payment_method, notes, last_updated_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            declarationId, 
            data.amount, 
            data.paid ? 1 : 0, 
            data.payment_method || '', 
            data.notes || '',
            data.changed_by || ''
          ],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            db.run('COMMIT');
            resolve({ id: this.lastID, declarationId, ...data });
          }
        );
      }
    });
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
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      if (existing) {
        db.run(
          `UPDATE inspections 
           SET inspection_type = ?, result = ?, returned = ?, returned_reason = ?,
               inspector = ?, inspection_date = ?, notes = ?, 
               last_updated_by = ?, last_updated_at = CURRENT_TIMESTAMP
           WHERE declaration_id = ?`,
          [
            data.inspection_type || '', 
            data.result || '', 
            data.returned ? 1 : 0,
            data.returned_reason || '', 
            data.inspector || '', 
            data.inspection_date || null,
            data.notes || '',
            data.changed_by || '',
            declarationId
          ],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            db.run('COMMIT');
            resolve({ declarationId, ...data, updated: true });
          }
        );
      } else {
        db.run(
          `INSERT INTO inspections (declaration_id, inspection_type, result, returned, returned_reason, inspector, inspection_date, notes, last_updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            declarationId, 
            data.inspection_type || '', 
            data.result || '', 
            data.returned ? 1 : 0,
            data.returned_reason || '', 
            data.inspector || '', 
            data.inspection_date || null, 
            data.notes || '',
            data.changed_by || ''
          ],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            db.run('COMMIT');
            resolve({ id: this.lastID, declarationId, ...data });
          }
        );
      }
    });
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
  getDocumentVersionHistory,
  getAllDocumentVersionHistory,
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
