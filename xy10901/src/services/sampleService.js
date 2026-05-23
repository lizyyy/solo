const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { logException } = require('../middleware/validation');

class SampleService {
  static async createBarcode(data) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id FROM sample_barcodes WHERE barcode = ?', [data.barcode], (err, row) => {
        if (err) {
          logException('/api/barcodes', data, err.message, '条码唯一性检查失败');
          return reject(err);
        }
        if (row) {
          logException('/api/barcodes', data, '条码已存在', '创建失败');
          return reject(new Error('条码已存在，必须唯一'));
        }

        const id = uuidv4();
        db.run(
          `INSERT INTO sample_barcodes (id, barcode, sample_type, patient_info, created_by)
           VALUES (?, ?, ?, ?, ?)`,
          [id, data.barcode, data.sample_type, data.patient_info || '', data.created_by],
          function(err) {
            if (err) {
              logException('/api/barcodes', data, err.message, '创建条码失败');
              return reject(err);
            }
            resolve({ id, ...data });
          }
        );
      });
    });
  }

  static async createSamplingRecord(data) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id, sample_type FROM sample_barcodes WHERE barcode = ? AND status = "active"', [data.barcode], (err, barcode) => {
        if (err) {
          logException('/api/sampling', data, err.message, '查询条码失败');
          return reject(err);
        }
        if (!barcode) {
          logException('/api/sampling', data, '无效条码或条码未激活', '创建采样记录失败');
          return reject(new Error('无效条码或条码未激活'));
        }

        const id = uuidv4();
        db.run(
          `INSERT INTO sampling_records 
           (id, barcode_id, barcode, sampling_time, sampler, clinic_name, patient_name, patient_id, sample_type, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, barcode.id, data.barcode, data.sampling_time, data.sampler,
            data.clinic_name, data.patient_name || '', data.patient_id || '',
            data.sample_type || barcode.sample_type, data.notes || ''
          ],
          function(err) {
            if (err) {
              logException('/api/sampling', data, err.message, '创建采样记录失败');
              return reject(err);
            }
            resolve({ id, ...data, barcode_id: barcode.id });
          }
        );
      });
    });
  }

  static async createTransportBatch(data) {
    return new Promise((resolve, reject) => {
      const batchId = uuidv4();
      const batchCode = `BATCH-${Date.now()}`;
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run(
          `INSERT INTO transport_batches 
           (id, batch_code, transporter, departure_time, expected_arrival_time, origin_clinic, destination_lab, sample_count, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'in_transit')`,
          [
            batchId, batchCode, data.transporter, data.departure_time,
            data.expected_arrival_time || null, data.origin_clinic,
            data.destination_lab, data.sample_barcodes.length
          ],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              logException('/api/transport', data, err.message, '创建运输批次失败');
              return reject(err);
            }

            const stmt = db.prepare(
              `INSERT INTO batch_samples (id, batch_id, sampling_record_id, barcode)
               VALUES (?, ?, ?, ?)`
            );

            let completed = 0;
            let hasError = false;

            data.sample_barcodes.forEach((barcode) => {
              db.get(
                'SELECT id FROM sampling_records WHERE barcode = ? ORDER BY created_at DESC LIMIT 1',
                [barcode],
                (err, sampling) => {
                  if (err || !sampling) {
                    hasError = true;
                    logException('/api/transport', data, 
                      err ? err.message : `采样记录不存在: ${barcode}`, 
                      '添加样本到批次失败');
                  } else {
                    stmt.run(uuidv4(), batchId, sampling.id, barcode);
                  }
                  completed++;
                  
                  if (completed === data.sample_barcodes.length) {
                    stmt.finalize();
                    if (hasError) {
                      db.run('ROLLBACK');
                      reject(new Error('部分样本添加失败，已回滚'));
                    } else {
                      db.run('COMMIT');
                      resolve({ id: batchId, batch_code: batchCode, ...data });
                    }
                  }
                }
              );
            });
          }
        );
      });
    });
  }

  static async receiveSample(data) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM sampling_records WHERE barcode = ? ORDER BY created_at DESC LIMIT 1',
        [data.barcode],
        (err, sampling) => {
          if (err) {
            logException('/api/receive', data, err.message, '查询采样记录失败');
            return reject(err);
          }
          if (!sampling) {
            logException('/api/receive', data, '采样记录不存在', '接收样本失败');
            return reject(new Error('采样记录不存在'));
          }

          const labName = data.receiving_lab || '中心检验室';
          this.checkReceivingWindow(data.received_time, labName)
            .then((windowOk) => {
              if (!windowOk.ok) {
                logException('/api/receive', data, windowOk.message, '非接收时段，拒收');
                return reject(new Error(windowOk.message));
              }

              const transferId = uuidv4();
              db.run(
                `INSERT INTO transfer_records 
                 (id, sampling_record_id, batch_id, barcode, received_time, receiver, receiving_lab, status)
                 VALUES (?, ?, (SELECT id FROM transport_batches WHERE batch_code = ?), ?, ?, ?, ?, 'received')`,
                [transferId, sampling.id, data.batch_code || '', data.barcode, data.received_time, data.receiver, labName],
                function(err) {
                  if (err) {
                    logException('/api/receive', data, err.message, '接收样本失败');
                    return reject(err);
                  }
                  resolve({ id: transferId, ...data, status: 'received' });
                }
              );
            })
            .catch(reject);
        }
      );
    });
  }

  static async checkReceivingWindow(receiveTime, labName) {
    return new Promise((resolve) => {
      const date = new Date(receiveTime);
      const dayOfWeek = date.getDay();
      const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      
      db.all(
        `SELECT * FROM receiving_windows 
         WHERE lab_name = ? AND is_active = 1 AND days_of_week LIKE ?`,
        [labName || '中心检验室', `%${dayOfWeek}%`],
        (err, windows) => {
          if (err || windows.length === 0) {
            resolve({ ok: true, message: '无接收窗口限制' });
            return;
          }

          for (const window of windows) {
            if (timeStr >= window.start_time && timeStr <= window.end_time) {
              resolve({ ok: true, message: '在接收窗口内' });
              return;
            }
          }
          resolve({ ok: false, message: `当前时间 ${timeStr} 不在接收窗口内` });
        }
      );
    });
  }

  static async rejectSample(data) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM sampling_records WHERE barcode = ? ORDER BY created_at DESC LIMIT 1',
        [data.barcode],
        (err, sampling) => {
          if (err) {
            logException('/api/reject', data, err.message, '查询采样记录失败');
            return reject(err);
          }
          if (!sampling) {
            logException('/api/reject', data, '采样记录不存在', '拒收样本失败');
            return reject(new Error('采样记录不存在'));
          }

          db.get(
            'SELECT id FROM rejection_reasons WHERE code = ?',
            [data.rejection_reason_code],
            (err, reason) => {
              if (err || !reason) {
                logException('/api/reject', data, '拒收原因代码无效', '拒收样本失败');
                return reject(new Error('拒收原因代码无效'));
              }

              const transferId = uuidv4();
              db.run(
                `INSERT INTO transfer_records 
                 (id, sampling_record_id, barcode, status, rejection_reason_id, rejection_note)
                 VALUES (?, ?, ?, 'rejected', ?, ?)`,
                [transferId, sampling.id, data.barcode, reason.id, data.rejection_note || ''],
                function(err) {
                  if (err) {
                    logException('/api/reject', data, err.message, '拒收样本失败');
                    return reject(err);
                  }
                  resolve({ id: transferId, barcode: data.barcode, status: 'rejected' });
                }
              );
            }
          );
        }
      );
    });
  }

  static async requestAmendment(data) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM transfer_records WHERE id = ?',
        [data.transfer_record_id],
        (err, record) => {
          if (err) {
            logException('/api/amendment', data, err.message, '查询交接记录失败');
            return reject(err);
          }
          if (!record) {
            logException('/api/amendment', data, '交接记录不存在', '申请补录失败');
            return reject(new Error('交接记录不存在'));
          }

          const amendmentId = uuidv4();
          db.run(
            `INSERT INTO amendment_requests 
             (id, transfer_record_id, requester, original_data, requested_changes, reason, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [
              amendmentId, data.transfer_record_id, data.requester,
              JSON.stringify(record), JSON.stringify(data.requested_changes), data.reason
            ],
            function(err) {
              if (err) {
                logException('/api/amendment', data, err.message, '申请补录失败');
                return reject(err);
              }
              resolve({ id: amendmentId, status: 'pending' });
            }
          );
        }
      );
    });
  }

  static async approveAmendment(data) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM amendment_requests WHERE id = ?',
        [data.amendment_id],
        (err, amendment) => {
          if (err) {
            logException('/api/amendment/approve', data, err.message, '查询补录申请失败');
            return reject(err);
          }
          if (!amendment) {
            logException('/api/amendment/approve', data, '补录申请不存在', '审批失败');
            return reject(new Error('补录申请不存在'));
          }
          if (amendment.status !== 'pending') {
            logException('/api/amendment/approve', data, '补录申请已处理', '审批失败');
            return reject(new Error('补录申请已处理'));
          }

          db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            db.run(
              `UPDATE amendment_requests 
               SET status = ?, approver = ?, approved_at = CURRENT_TIMESTAMP, approval_notes = ?
               WHERE id = ?`,
              [data.approved ? 'approved' : 'rejected', data.approver, data.approval_notes || '', data.amendment_id],
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }

                if (data.approved) {
                  const changes = JSON.parse(amendment.requested_changes);
                  const setClauses = Object.keys(changes).map(k => `${k} = ?`).join(', ');
                  const values = Object.values(changes);
                  
                  db.run(
                    `UPDATE transfer_records SET ${setClauses}, is_amended = 1, amendment_request_id = ? WHERE id = ?`,
                    [...values, data.amendment_id, amendment.transfer_record_id],
                    function(err) {
                      if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                      }
                      db.run('COMMIT');
                      resolve({ status: 'approved', message: '补录已生效' });
                    }
                  );
                } else {
                  db.run('COMMIT');
                  resolve({ status: 'rejected', message: '补录申请已驳回' });
                }
              }
            );
          });
        }
      );
    });
  }

  static async getTransferReport(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          tr.id,
          tr.barcode,
          tr.status,
          tr.received_time,
          tr.receiver,
          tr.is_amended,
          sr.sampling_time,
          sr.sampler,
          sr.clinic_name,
          sr.patient_name,
          tb.batch_code,
          tb.transporter,
          tb.departure_time,
          rr.name as rejection_reason,
          tr.rejection_note
        FROM transfer_records tr
        LEFT JOIN sampling_records sr ON tr.sampling_record_id = sr.id
        LEFT JOIN transport_batches tb ON tr.batch_id = tb.id
        LEFT JOIN rejection_reasons rr ON tr.rejection_reason_id = rr.id
        WHERE 1=1
      `;
      
      const params = [];
      if (filters.start_date) {
        query += ' AND tr.created_at >= ?';
        params.push(filters.start_date);
      }
      if (filters.end_date) {
        query += ' AND tr.created_at <= ?';
        params.push(filters.end_date);
      }
      if (filters.status) {
        query += ' AND tr.status = ?';
        params.push(filters.status);
      }
      if (filters.clinic_name) {
        query += ' AND sr.clinic_name = ?';
        params.push(filters.clinic_name);
      }
      
      query += ' ORDER BY tr.created_at DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
}

module.exports = SampleService;
