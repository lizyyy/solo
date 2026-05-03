const STATUS_TRANSITIONS = {
  in_stock: ['borrowed', 'scrapped', 'inspecting'],
  borrowed: ['in_stock', 'scrapped'],
  inspecting: ['in_stock', 'scrapped'],
  scrapped: []
};

const TRANSACTION_TYPES = {
  borrow: {
    from: ['in_stock', 'inspecting'],
    to: 'borrowed',
    description: '借出'
  },
  return: {
    from: ['borrowed'],
    to: 'in_stock',
    description: '归还'
  },
  scrap: {
    from: ['in_stock', 'borrowed', 'inspecting'],
    to: 'scrapped',
    description: '报废'
  }
};

function canTransition(fromStatus, toStatus) {
  const allowedTransitions = STATUS_TRANSITIONS[fromStatus] || [];
  return allowedTransitions.includes(toStatus);
}

function validateTransactionType(type) {
  return TRANSACTION_TYPES.hasOwnProperty(type);
}

function getTransactionInfo(type) {
  return TRANSACTION_TYPES[type];
}

async function processTransaction(db, cylinder, transaction) {
  return new Promise((resolve, reject) => {
    const { type, department, person, notes } = transaction;
    const currentStatus = cylinder.status;

    if (!validateTransactionType(type)) {
      reject(new Error(`无效的交易类型: ${type}`));
      return;
    }

    const transactionInfo = getTransactionInfo(type);
    
    if (!transactionInfo.from.includes(currentStatus)) {
      reject(new Error(`状态转换无效: 无法从 ${currentStatus} 执行 ${transactionInfo.description}`));
      return;
    }

    const newStatus = transactionInfo.to;

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run(`
        INSERT INTO transactions (cylinder_id, type, department, person, notes)
        VALUES (?, ?, ?, ?, ?)
      `, [cylinder.id, type, department, person, notes], function(err) {
        if (err) {
          db.run('ROLLBACK');
          reject(err);
          return;
        }

        const transactionId = this.lastID;

        db.run(`
          UPDATE cylinders 
          SET status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [newStatus, cylinder.id], (updateErr) => {
          if (updateErr) {
            db.run('ROLLBACK');
            reject(updateErr);
            return;
          }

          db.run('COMMIT', (commitErr) => {
            if (commitErr) {
              db.run('ROLLBACK');
              reject(commitErr);
              return;
            }

            resolve({
              success: true,
              transactionId,
              cylinderId: cylinder.id,
              serialNumber: cylinder.serial_number,
              fromStatus: currentStatus,
              toStatus: newStatus,
              transactionType: type,
              department,
              person,
              timestamp: new Date().toISOString()
            });
          });
        });
      });
    });
  });
}

async function getCylinderStatus(db, cylinderId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT id, serial_number, status, updated_at 
      FROM cylinders 
      WHERE id = ?
    `, [cylinderId], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

async function getTransactionHistory(db, cylinderId, limit = 20) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM transactions 
      WHERE cylinder_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `, [cylinderId, limit], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

const STATUS_DISPLAY = {
  in_stock: '在库',
  borrowed: '借出',
  inspecting: '检验中',
  scrapped: '已报废'
};

function getStatusDisplay(status) {
  return STATUS_DISPLAY[status] || status;
}

const GAS_TYPES = ['氧气', '笑气', '氮气', '二氧化碳', '其他'];

module.exports = {
  STATUS_TRANSITIONS,
  TRANSACTION_TYPES,
  STATUS_DISPLAY,
  GAS_TYPES,
  canTransition,
  validateTransactionType,
  getTransactionInfo,
  processTransaction,
  getCylinderStatus,
  getTransactionHistory,
  getStatusDisplay
};
