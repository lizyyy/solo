const crypto = require('crypto');
const db = require('./database');

class SignatureService {
  static generateSignature(payload, secretKey, algorithm = 'HMAC-SHA256') {
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secretKey);
    return hmac.update(payloadStr).digest('hex');
  }

  static verifyTimeWindow(timestamp, windowSeconds = 300) {
    const now = Math.floor(Date.now() / 1000);
    const diff = Math.abs(now - timestamp);
    return {
      valid: diff <= windowSeconds,
      diff,
      window: windowSeconds,
      currentTime: now,
      requestTime: timestamp
    };
  }

  static async checkReplayAttack(nonce, merchantId) {
    return new Promise((resolve) => {
      db.get(
        'SELECT COUNT(*) as count FROM signature_records WHERE nonce = ? AND merchant_id = ?',
        [nonce, merchantId],
        (err, row) => {
          if (err) resolve({ isReplay: false });
          resolve({ isReplay: row.count > 0 });
        }
      );
    });
  }

  static async verifySignature(recordId, merchantConfig) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM signature_records WHERE record_id = ?',
        [recordId],
        async (err, record) => {
          if (err) return reject(err);
          if (!record) return reject(new Error('Record not found'));

          const errors = [];
          const timeCheck = this.verifyTimeWindow(record.timestamp, merchantConfig.time_window);
          
          if (!timeCheck.valid) {
            errors.push(`时间戳超出窗口: 请求时间=${timeCheck.requestTime}, 当前时间=${timeCheck.currentTime}, 偏差=${timeCheck.diff}秒, 窗口=${timeCheck.window}秒`);
          }

          if (record.nonce) {
            const replayCheck = await this.checkReplayAttack(record.nonce, record.merchant_id);
            if (replayCheck.isReplay) {
              errors.push('检测到重放攻击: nonce已存在');
            }
          }

          const expectedSignature = this.generateSignature(
            record.original_payload,
            merchantConfig.secret_key,
            merchantConfig.algorithm
          );

          const signatureMatch = record.signature === expectedSignature;
          if (!signatureMatch) {
            errors.push(`签名不匹配: 期望=${expectedSignature.substring(0, 20)}..., 实际=${record.signature.substring(0, 20)}...`);
          }

          const verifyResult = errors.length === 0 ? 'SUCCESS' : 'FAILED';
          const errorMessage = errors.join('; ');

          db.run(
            'UPDATE signature_records SET status = ?, verify_result = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE record_id = ?',
            [verifyResult, verifyResult, errorMessage, recordId],
            (updateErr) => {
              if (updateErr) return reject(updateErr);
              
              db.run(
                'INSERT INTO verification_history (record_id, status_before, status_after, action) VALUES (?, ?, ?, ?)',
                [recordId, record.status, verifyResult, 'VERIFY'],
                (historyErr) => {
                  if (historyErr) return reject(historyErr);
                  resolve({
                    recordId,
                    success: verifyResult === 'SUCCESS',
                    errors,
                    expectedSignature,
                    actualSignature: record.signature,
                    timeCheck
                  });
                }
              );
            }
          );
        }
      );
    });
  }

  static async saveToSampleLibrary(recordId, notes = '') {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM signature_records WHERE record_id = ?',
        [recordId],
        (err, record) => {
          if (err) return reject(err);
          if (!record) return reject(new Error('Record not found'));

          const sampleId = `SAMPLE-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          
          db.get(
            'SELECT secret_key, algorithm FROM merchant_configs WHERE merchant_id = ?',
            [record.merchant_id],
            (configErr, config) => {
              if (configErr) return reject(configErr);
              
              const expectedSignature = this.generateSignature(
                record.original_payload,
                config.secret_key,
                config.algorithm
              );

              db.run(
                `INSERT INTO sample_library 
                 (sample_id, record_id, merchant_id, payload, signature, timestamp, expected_signature, is_success, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  sampleId,
                  recordId,
                  record.merchant_id,
                  record.original_payload,
                  record.signature,
                  record.timestamp,
                  expectedSignature,
                  record.verify_result === 'SUCCESS' ? 1 : 0,
                  notes
                ],
                (insertErr) => {
                  if (insertErr) return reject(insertErr);
                  resolve({ sampleId, recordId, success: true });
                }
              );
            }
          );
        }
      );
    });
  }
}

module.exports = SignatureService;
