const db = require('./database');
const { v4: uuidv4 } = require('uuid');

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

const Equipment = {
  create: (data) => {
    const id = uuidv4();
    return runQuery(
      'INSERT INTO equipment (id, name, category, daily_rate, deposit_amount, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.name, data.category, data.daily_rate, data.deposit_amount, data.status || 'available']
    ).then(() => id);
  },
  getById: (id) => getQuery('SELECT * FROM equipment WHERE id = ?', [id]),
  getAll: () => allQuery('SELECT * FROM equipment'),
  updateStatus: (id, status) => runQuery('UPDATE equipment SET status = ? WHERE id = ?', [status, id])
};

const Rental = {
  create: (data) => {
    const id = uuidv4();
    const rentalNo = 'RN' + Date.now();
    return runQuery(
      'INSERT INTO rentals (id, rental_no, customer_id, customer_name, equipment_id, start_date, end_date, total_deposit, remaining_deposit, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, rentalNo, data.customer_id, data.customer_name, data.equipment_id, data.start_date, data.end_date, data.total_deposit, data.total_deposit, data.status || 'pending', data.created_by]
    ).then(() => ({ id, rental_no: rentalNo }));
  },
  getById: (id) => getQuery('SELECT * FROM rentals WHERE id = ?', [id]),
  getByNo: (rentalNo) => getQuery('SELECT * FROM rentals WHERE rental_no = ?', [rentalNo]),
  getAll: (status = null) => {
    if (status) {
      return allQuery('SELECT * FROM rentals WHERE status = ? ORDER BY created_at DESC', [status]);
    }
    return allQuery('SELECT * FROM rentals ORDER BY created_at DESC');
  },
  updateStatus: (id, status) => runQuery(
    'UPDATE rentals SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, id]
  ),
  updateEndDate: (id, newEndDate) => runQuery(
    'UPDATE rentals SET end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newEndDate, id]
  ),
  updateRemainingDeposit: (id, remaining) => runQuery(
    'UPDATE rentals SET remaining_deposit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [remaining, id]
  ),
  complete: (id, actualEndDate) => runQuery(
    'UPDATE rentals SET status = ?, actual_end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['completed', actualEndDate, id]
  )
};

const DepositTransaction = {
  create: (data) => {
    const id = uuidv4();
    return runQuery(
      'INSERT INTO deposit_transactions (id, rental_id, transaction_type, amount, request_id, operator, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, data.rental_id, data.transaction_type, data.amount, data.request_id, data.operator, data.remark]
    ).then(() => id);
  },
  getByRequestId: (requestId) => getQuery('SELECT * FROM deposit_transactions WHERE request_id = ?', [requestId]),
  getByRentalId: (rentalId) => allQuery('SELECT * FROM deposit_transactions WHERE rental_id = ? ORDER BY created_at DESC', [rentalId])
};

const Damage = {
  create: (data) => {
    const id = uuidv4();
    return runQuery(
      'INSERT INTO damages (id, rental_id, damage_type, description, deduction_amount, reported_by) VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.rental_id, data.damage_type, data.description, data.deduction_amount, data.reported_by]
    ).then(() => id);
  },
  getByRentalId: (rentalId) => allQuery('SELECT * FROM damages WHERE rental_id = ?', [rentalId]),
  verify: (id, verifiedBy) => runQuery(
    'UPDATE damages SET status = ?, verified_by = ?, verified_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['verified', verifiedBy, id]
  )
};

const Renewal = {
  create: (data) => {
    const id = uuidv4();
    return runQuery(
      'INSERT INTO renewals (id, rental_id, request_id, original_end_date, new_end_date, extension_days, extension_fee, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.rental_id, data.request_id, data.original_end_date, data.new_end_date, data.extension_days, data.extension_fee, data.operator]
    ).then(() => id);
  },
  getByRequestId: (requestId) => getQuery('SELECT * FROM renewals WHERE request_id = ?', [requestId]),
  getByRentalId: (rentalId) => allQuery('SELECT * FROM renewals WHERE rental_id = ? ORDER BY created_at DESC', [rentalId])
};

const Settlement = {
  create: (data) => {
    const id = uuidv4();
    const settlementNo = 'ST' + Date.now();
    return runQuery(
      'INSERT INTO settlements (id, rental_id, settlement_no, total_deposit, damage_deduction, overdue_fee, renewal_fee, refund_amount, generated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.rental_id, settlementNo, data.total_deposit, data.damage_deduction || 0, data.overdue_fee || 0, data.renewal_fee || 0, data.refund_amount, data.generated_by]
    ).then(() => ({ id, settlement_no: settlementNo }));
  },
  getByRentalId: (rentalId) => getQuery('SELECT * FROM settlements WHERE rental_id = ?', [rentalId]),
  getAll: () => allQuery('SELECT * FROM settlements ORDER BY generated_at DESC')
};

const ExceptionLog = {
  create: (data) => {
    const id = uuidv4();
    return runQuery(
      'INSERT INTO exception_logs (id, api_path, request_method, raw_input, error_message, processing_result, operator) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, data.api_path, data.request_method, data.raw_input, data.error_message, data.processing_result, data.operator]
    ).then(() => id);
  },
  getAll: () => allQuery('SELECT * FROM exception_logs ORDER BY created_at DESC')
};

module.exports = {
  Equipment,
  Rental,
  DepositTransaction,
  Damage,
  Renewal,
  Settlement,
  ExceptionLog,
  runQuery,
  getQuery,
  allQuery
};
