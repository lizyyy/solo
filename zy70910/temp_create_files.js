const fs = require('fs');

const importServiceContent = `const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Order = require('../models/order');
const PaymentRecord = require('../models/paymentRecord');
const ChargerLog = require('../models/chargerLog');
const DiffCalculator = require('../utils/diffCalculator');

const ImportService = {
  validateOrder: (order) => {
    const errors = [];
    if (!order.order_id) errors.push('缺少 order_id');
    if (!order.user_id) errors.push('缺少 user_id');
    if (!order.charger_id) errors.push('缺少 charger_id');
    if (!order.start_time) errors.push('缺少 start_time');
    if (!order.end_time) errors.push('缺少 end_time');
    if (order.charge_amount === undefined || order.charge_amount === null || isNaN(order.charge_amount)) {
      errors.push('charge_amount 必须是数字');
    }
    if (order.amount === undefined || order.amount === null || isNaN(order.amount)) {
      errors.push('amount 必须是数字');
    }
    if (!order.status) errors.push('缺少 status');
    if (!order.platform_source) errors.push('缺少 platform_source');
    
    return {
      valid: errors.length === 0,
      errors,
      cleaned: {
        order_id: String(order.order_id || '').trim(),
        user_id: String(order.user_id || '').trim(),
        charger_id: String(order.charger_id || '').trim(),
        start_time: order.start_time ? new Date(order.start_time).toISOString() : null,
        end_time: order.end_time ? new Date(order.end_time).toISOString() : null,
        charge_amount: parseFloat(order.charge_amount) || 0,
        amount: parseFloat(order.amount) || 0,
        status: String(order.status || '').trim(),
        platform_source: String(order.platform_source || '').trim()
      }
    };
  },

  validatePaymentRecord: (record) => {
    const errors = [];
    if (!record.payment_id) errors.push('缺少 payment_id');
    if (!record.order_id) errors.push('缺少 order_id');
    if (!record.payment_time) errors.push('缺少 payment_time');
    if (record.amount === undefined || record.amount === null || isNaN(record.amount)) {
      errors.push('amount 必须是数字');
    }
    if (!record.payment_status) errors.push('缺少 payment_status');
    
    return {
      valid: errors.length === 0,
      errors,
      cleaned: {
        payment_id: String(record.payment_id || '').trim(),
        order_id: String(record.order_id || '').trim(),
        payment_time: record.payment_time ? new Date(record.payment_time).toISOString() : null,
        amount: parseFloat(record.amount) || 0,
        payment_status: String(record.payment_status || '').trim(),
        refund_status: String(record.refund_status || 'none').trim(),
        refund_amount: parseFloat(record.refund_amount) || 0,
        payment_channel: String(record.payment_channel || '').trim()
      }
    };
  },

  validateChargerLog: (log) => {
    const errors = [];
    if (!log.log_id) errors.push('缺少 log_id');
    if (!log.charger_id) errors.push('缺少 charger_id');
    if (!log.event_time) errors.push('缺少 event_time');
    if (!log.event_type) errors.push('缺少 event_type');
    
    return {
      valid: errors.length === 0,
      errors,
      cleaned: {
        log_id: String(log.log_id || '').trim(),
        charger_id: String(log.charger_id || '').trim(),
        order_id: String(log.order_id || '').trim(),
        event_time: log.event_time ? new Date(log.event_time).toISOString() : null,
        realtime_charge: parseFloat(log.realtime_charge) || 0,
        status: String(log.status || '').trim(),
        event_type: String(log.event_type || '').trim()
      }
    };
  },

  importOrdersCSV: (filePath) => {
    return new Promise((resolve, reject) => {
      const results = [];
      const validOrders = [];
      const invalidRecords = [];
      const traceId = DiffCalculator.generateTraceId();
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          const validation = ImportService.validateOrder(data);
          const recordTrace = {
            traceId,
            recordNumber: results.length + 1,
            rawData: Object.assign({}, data),
            validation,
            timestamp: new Date().toISOString()
          };
          
          if (validation.valid) {
            validOrders.push(validation.cleaned);
            results.push({
              status: 'success',
              recordTrace
            });
          } else {
            invalidRecords.push(recordTrace);
            results.push({
              status: 'failed',
              errors: validation.errors,
              recordTrace
            });
          }
        })
        .on('end', () => {
          if (validOrders.length > 0) {
            Order.bulkInsert(validOrders, (err) => {
              if (err) {
                reject({
                  traceId,
                  error: err.message,
                  successCount: 0,
                  failureCount: results.length,
                  results
                });
              } else {
                resolve({
                  traceId,
                  successCount: validOrders.length,
                  failureCount: invalidRecords.length,
                  totalProcessed: results.length,
                  results,
                  evidence: {
                    type: 'CSV_IMPORT',
                    file: path.basename(filePath),
                    timestamp: new Date().toISOString()
                  }
                });
              }
            });
          } else {
            resolve({
              traceId,
              successCount: 0,
              failureCount: invalidRecords.length,
              totalProcessed: results.length,
              results,
              evidence: {
                type: 'CSV_IMPORT',
                file: path.basename(filePath),
                timestamp: new Date().toISOString()
              }
            });
          }
        })
        .on('error', (error) => {
          reject({
            traceId,
            error: error.message,
            successCount: validOrders.length,
            failureCount: invalidRecords.length,
            results
          });
        });
    });
  },

  importChargerLogsJSON: (filePath) => {
    return new Promise((resolve, reject) => {
      const traceId = DiffCalculator.generateTraceId();
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const logs = JSON.parse(content);
        const validLogs = [];
        const results = [];
        
        logs.forEach((log, index) => {
          const validation = ImportService.validateChargerLog(log);
          const recordTrace = {
            traceId,
            recordNumber: index + 1,
            rawData: Object.assign({}, log),
            validation,
            timestamp: new Date().toISOString()
          };
          
          if (validation.valid) {
            validLogs.push(validation.cleaned);
            results.push({
              status: 'success',
              recordTrace
            });
          } else {
            results.push({
              status: 'failed',
              errors: validation.errors,
              recordTrace
            });
          }
        });
        
        if (validLogs.length > 0) {
          ChargerLog.bulkInsert(validLogs, (err) => {
            if (err) {
              reject({
                traceId,
                error: err.message,
                successCount: 0,
                failureCount: results.length,
                results
              });
            } else {
              resolve({
                traceId,
                successCount: validLogs.length,
                failureCount: results.length - validLogs.length,
                totalProcessed: results.length,
                results,
                evidence: {
                  type: 'JSON_IMPORT',
                  file: path.basename(filePath),
                  timestamp: new Date().toISOString()
                }
              });
            }
          });
        } else {
          resolve({
            traceId,
            successCount: 0,
            failureCount: results.length,
            totalProcessed: results.length,
            results,
            evidence: {
              type: 'JSON_IMPORT',
              file: path.basename(filePath),
              timestamp: new Date().toISOString()
            }
          });
        }
      } catch (error) {
        reject({
          traceId,
          error: error.message,
          successCount: 0,
          failureCount: 0,
          results: []
        });
      }
    });
  },

  importPaymentRecords: (filePath) => {
    return new Promise((resolve, reject) => {
      const traceId = DiffCalculator.generateTraceId();
      const ext = path.extname(filePath).toLowerCase();
      
      if (ext === '.csv') {
        const results = [];
        const validRecords = [];
        
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => {
            const validation = ImportService.validatePaymentRecord(data);
            const recordTrace = {
              traceId,
              recordNumber: results.length + 1,
              rawData: Object.assign({}, data),
              validation,
              timestamp: new Date().toISOString()
            };
            
            if (validation.valid) {
              validRecords.push(validation.cleaned);
              results.push({ status: 'success', recordTrace });
            } else {
              results.push({ status: 'failed', errors: validation.errors, recordTrace });
            }
          })
          .on('end', () => {
            if (validRecords.length > 0) {
              PaymentRecord.bulkInsert(validRecords, (err) => {
                if (err) {
                  reject({ traceId, error: err.message, successCount: 0, failureCount: results.length, results });
                } else {
                  resolve({
                    traceId,
                    successCount: validRecords.length,
                    failureCount: results.length - validRecords.length,
                    totalProcessed: results.length,
                    results,
                    evidence: { type: 'PAYMENT_IMPORT', file: path.basename(filePath), timestamp: new Date().toISOString() }
                  });
                }
              });
            } else {
              resolve({
                traceId,
                successCount: 0,
                failureCount: results.length,
                totalProcessed: results.length,
                results,
                evidence: { type: 'PAYMENT_IMPORT', file: path.basename(filePath), timestamp: new Date().toISOString() }
              });
            }
          })
          .on('error', (error) => {
            reject({ traceId, error: error.message, successCount: 0, failureCount: 0, results: [] });
          });
      } else if (ext === '.json') {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const records = JSON.parse(content);
          const validRecords = [];
          const results = [];
          
          records.forEach((record, index) => {
            const validation = ImportService.validatePaymentRecord(record);
            const recordTrace = {
              traceId,
              recordNumber: index + 1,
              rawData: Object.assign({}, record),
              validation,
              timestamp: new Date().toISOString()
            };
            
            if (validation.valid) {
              validRecords.push(validation.cleaned);
              results.push({ status: 'success', recordTrace });
            } else {
              results.push({ status: 'failed', errors: validation.errors, recordTrace });
            }
          });
          
          if (validRecords.length > 0) {
            PaymentRecord.bulkInsert(validRecords, (err) => {
              if (err) {
                reject({ traceId, error: err.message, successCount: 0, failureCount: results.length, results });
              } else {
                resolve({
                  traceId,
                  successCount: validRecords.length,
                  failureCount: results.length - validRecords.length,
                  totalProcessed: results.length,
                  results,
                  evidence: { type: 'PAYMENT_IMPORT', file: path.basename(filePath), timestamp: new Date().toISOString() }
                });
              }
            });
          } else {
            resolve({
              traceId,
              successCount: 0,
              failureCount: results.length,
              totalProcessed: results.length,
              results,
              evidence: { type: 'PAYMENT_IMPORT', file: path.basename(filePath), timestamp: new Date().toISOString() }
            });
          }
        } catch (error) {
          reject({ traceId, error: error.message, successCount: 0, failureCount: 0, results: [] });
        }
      } else {
        reject({ traceId, error: '不支持的文件格式，仅支持 CSV 和 JSON', successCount: 0, failureCount: 0, results: [] });
      }
    });
  }
};

module.exports = ImportService;
`;

const reconciliationServiceContent = `const crypto = require('crypto');
const Order = require('../models/order');
const PaymentRecord = require('../models/paymentRecord');
const ChargerLog = require('../models/chargerLog');
const Discrepancy = require('../models/discrepancy');
const ReconciliationTask = require('../models/reconciliationTask');
const DiffCalculator = require('../utils/diffCalculator');

const DISCREPANCY_TYPES = {
  UNDEDUCTED: 'UNDEDUCTED',
  DUPLICATE_REFUND: 'DUPLICATE_REFUND',
  CROSS_PLATFORM: 'CROSS_PLATFORM',
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
  TIME_MISMATCH: 'TIME_MISMATCH',
  STATUS_MISMATCH: 'STATUS_MISMATCH'
};

const ReconciliationService = {
  createReconciliationTask: (name, dateRange) => {
    return new Promise((resolve, reject) => {
      const taskId = 'TASK_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
      const task = {
        task_id: taskId,
        name: name || '对账任务_' + new Date().toISOString().split('T')[0],
        status: 'PENDING',
        created_at: new Date().toISOString(),
        completed_at: null,
        statistics: JSON.stringify({
          dateRange: dateRange,
          totalOrders: 0,
          totalPayments: 0,
          totalChargerLogs: 0,
          discrepancies: 0,
          matched: 0
        })
      };
      
      ReconciliationTask.create(task, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            taskId,
            task,
            traceId: DiffCalculator.generateTraceId()
          });
        }
      });
    });
  },

  matchOrdersWithPayments: (taskId, orders, payments) => {
    const paymentMap = new Map();
    payments.forEach(p => {
      if (!paymentMap.has(p.order_id)) {
        paymentMap.set(p.order_id, []);
      }
      paymentMap.get(p.order_id).push(p);
    });

    const matched = [];
    const unmatched = [];
    const evidenceChain = [];

    orders.forEach(order => {
      const orderPayments = paymentMap.get(order.order_id) || [];
      
      if (orderPayments.length > 0) {
        const evidence = DiffCalculator.buildEvidenceChain(
          { type: 'ORDER_PAYMENT_MATCH', id: order.order_id, data: { order, payments: orderPayments } },
          { field: 'order_id', expected: order.order_id, actual: orderPayments[0].order_id },
          { hasDiscrepancy: false, discrepancyType: null, severity: 'info' }
        );
        evidenceChain.push(evidence);
        matched.push({
          order,
          payments: orderPayments,
          matchId: 'MATCH_' + crypto.randomBytes(8).toString('hex'),
          evidence
        });
      } else {
        unmatched.push({
          order,
          reason: 'NO_PAYMENT_RECORD',
          evidence: DiffCalculator.buildEvidenceChain(
            { type: 'ORDER_PAYMENT_MATCH', id: order.order_id, data: { order } },
            { field: 'payment_exists', expected: true, actual: false },
            { hasDiscrepancy: true, discrepancyType: DISCREPANCY_TYPES.UNDEDUCTED, severity: 'high' }
          )
        });
      }
    });

    return { matched, unmatched, evidenceChain };
  },

  matchWithChargerLogs: (taskId, orders, chargerLogs) => {
    const logMap = new Map();
    chargerLogs.forEach(log => {
      if (log.order_id) {
        if (!logMap.has(log.order_id)) {
          logMap.set(log.order_id, []);
        }
        logMap.get(log.order_id).push(log);
      }
    });

    const matched = [];
    const unmatched = [];
    const evidenceChain = [];

    orders.forEach(order => {
      const orderLogs = logMap.get(order.order_id) || [];
      
      if (orderLogs.length > 0) {
        const hasChargeEnd = orderLogs.some(log => log.event_type === 'CHARGE_END' || log.status === 'completed');
        if (hasChargeEnd) {
          const evidence = DiffCalculator.buildEvidenceChain(
            { type: 'CHARGER_LOG_MATCH', id: order.order_id, data: { order, logs: orderLogs } },
            { field: 'charge_completed', expected: true, actual: true },
            { hasDiscrepancy: false, discrepancyType: null, severity: 'info' }
          );
          evidenceChain.push(evidence);
          matched.push({
            order,
            logs: orderLogs,
            matchId: 'LOG_MATCH_' + crypto.randomBytes(8).toString('hex'),
            evidence
          });
        } else {
          unmatched.push({
            order,
            logs: orderLogs,
            reason: 'CHARGE_NOT_COMPLETED',
            evidence: DiffCalculator.buildEvidenceChain(
              { type: 'CHARGER_LOG_MATCH', id: order.order_id, data: { order, logs: orderLogs } },
              { field: 'charge_completed', expected: true, actual: false },
              { hasDiscrepancy: true, discrepancyType: DISCREPANCY_TYPES.UNDEDUCTED, severity: 'medium' }
            )
          });
        }
      } else {
        unmatched.push({
          order,
          reason: 'NO_CHARGER_LOG',
          evidence: DiffCalculator.buildEvidenceChain(
            { type: 'CHARGER_LOG_MATCH', id: order.order_id, data: { order } },
            { field: 'log_exists', expected: true, actual: false },
            { hasDiscrepancy: true, discrepancyType: DISCREPANCY_TYPES.UNDEDUCTED, severity: 'high' }
          )
        });
      }
    });

    return { matched, unmatched, evidenceChain };
  },

  detectDiscrepancies: (taskId, orders, payments, chargerLogs) => {
    return new Promise((resolve, reject) => {
      const discrepancies = [];
      const evidenceChain = [];
      const paymentMap = new Map();
      const logMap = new Map();

      payments.forEach(p => {
        if (!paymentMap.has(p.order_id)) {
          paymentMap.set(p.order_id, []);
        }
        paymentMap.get(p.order_id).push(p);
      });

      chargerLogs.forEach(log => {
        if (log.order_id) {
          if (!logMap.has(log.order_id)) {
            logMap.set(log.order_id, []);
          }
          logMap.get(log.order_id).push(log);
        }
      });

      orders.forEach(order => {
        const orderPayments = paymentMap.get(order.order_id) || [];
        const orderLogs = logMap.get(order.order_id) || [];
        const hasChargeEnd = orderLogs.some(log => log.event_type === 'CHARGE_END' || log.status === 'completed');

        if (hasChargeEnd && orderPayments.length === 0) {
          const discrepancyId = 'DISCR_' + crypto.randomBytes(12).toString('hex');
          const evidence = DiffCalculator.buildEvidenceChain(
            { type: 'UNDEDUCTED_DETECTION', id: order.order_id, data: { order, logs: orderLogs } },
            { field: 'payment_exists', expected: true, actual: false },
            { hasDiscrepancy: true, discrepancyType: DISCREPANCY_TYPES.UNDEDUCTED, severity: 'high' }
          );
          evidenceChain.push(evidence);
          discrepancies.push({
            discrepancy_id: discrepancyId,
            task_id: taskId,
            order_id: order.order_id,
            discrepancy_type: DISCREPANCY_TYPES.UNDEDUCTED,
            description: JSON.stringify({
              order: { amount: order.amount, status: order.status },
              logs: orderLogs.map(l => ({ event_type: l.event_type, status: l.status })),
              evidenceId: evidence.chainId
            }),
            status: 'PENDING',
            result: null
          });
        }

        if (orderPayments.length > 1) {
          const refundCount = orderPayments.filter(p => 
            p.refund_status === 'refunded' || p.refund_amount > 0
          ).length;
          
          if (refundCount > 1) {
            const discrepancyId = 'DISCR_' + crypto.randomBytes(12).toString('hex');
            const evidence = DiffCalculator.buildEvidenceChain(
              { type: 'DUPLICATE_REFUND_DETECTION', id: order.order_id, data: { order, payments: orderPayments } },
              { field: 'refund_count', expected: 1, actual: refundCount },
              { hasDiscrepancy: true, discrepancyType: DISCREPANCY_TYPES.DUPLICATE_REFUND, severity: 'critical' }
            );
            evidenceChain.push(evidence);
            discrepancies.push({
              discrepancy_id: discrepancyId,
              task_id: taskId,
              order_id: order.order_id,
              discrepancy_type: DISCREPANCY_TYPES.DUPLICATE_REFUND,
              description: JSON.stringify({
                order: { amount: order.amount },
                payments: orderPayments.map(p => ({ 
                  payment_id: p.payment_id, 
                  refund_status: p.refund_status, 
                  refund_amount: p.refund_amount 
                })),
                refundCount,
                evidenceId: evidence.chainId
              }),
              status: 'PENDING',
              result: null
            });
          }
        }

        orderPayments.forEach(payment => {
          if (order.platform_source && payment.payment_channel && 
              order.platform_source !== payment.payment_channel &&
              !order.platform_source.includes(payment.payment_channel) &&
              !payment.payment_channel.includes(order.platform_source)) {
            const discrepancyId = 'DISCR_' + crypto.randomBytes(12).toString('hex');
            const evidence = DiffCalculator.buildEvidenceChain(
              { type: 'CROSS_PLATFORM_DETECTION', id: order.order_id, data: { order, payment } },
              { field: 'platform', expected: order.platform_source, actual: payment.payment_channel },
              { hasDiscrepancy: true, discrepancyType: DISCREPANCY_TYPES.CROSS_PLATFORM, severity: 'medium' }
            );
            evidenceChain.push(evidence);
            discrepancies.push({
              discrepancy_id: discrepancyId,
              task_id: taskId,
              order_id: order.order_id,
              discrepancy_type: DISCREPANCY_TYPES.CROSS_PLATFORM,
              description: JSON.stringify({
                order: { platform_source: order.platform_source },
                payment: { payment_id: payment.payment_id, payment_channel: payment.payment_channel },
                evidenceId: evidence.chainId
              }),
              status: 'PENDING',
              result: null
            });
          }
        });

        orderPayments.forEach(payment => {
          const amountDiff = DiffCalculator.calculateAmountDiff(order.amount, payment.amount, 0.01);
          if (amountDiff.hasMismatch) {
            const discrepancyId = 'DISCR_' + crypto.randomBytes(12).toString('hex');
            const evidence = DiffCalculator.buildEvidenceChain(
              { type: 'AMOUNT_MISMATCH_DETECTION', id: order.order_id, data: { order, payment } },
              { field: 'amount', expected: order.amount, actual: payment.amount },
              { hasDiscrepancy: true, discrepancyType: DISCREPANCY_TYPES.AMOUNT_MISMATCH, severity: 'high' }
            );
            evidenceChain.push(evidence);
            discrepancies.push({
              discrepancy_id: discrepancyId,
              task_id: taskId,
              order_id: order.order_id,
              discrepancy_type: DISCREPANCY_TYPES.AMOUNT_MISMATCH,
              description: JSON.stringify({
                order: { amount: order.amount },
                payment: { payment_id: payment.payment_id, amount: payment.amount },
                diff: amountDiff.difference,
                evidenceId: evidence.chainId
              }),
              status: 'PENDING',
              result: null
            });
          }
        });

        orderPayments.forEach(payment => {
          const timeDiff = DiffCalculator.calculateTimeDiff(order.end_time, payment.payment_time, 300000);
          if (timeDiff.hasMismatch) {
            const discrepancyId = 'DISCR_' + crypto.randomBytes(12).toString('hex');
            const evidence = DiffCalculator.buildEvidenceChain(
              { type: 'TIME_MISMATCH_DETECTION', id: order.order_id, data: { order, payment } },
              { field: 'payment_time', expected: order.end_time, actual: payment.payment_time },
              { hasDiscrepancy: true, discrepancyType: DISCREPANCY_TYPES.TIME_MISMATCH, severity: 'low' }
            );
            evidenceChain.push(evidence);
            discrepancies.push({
              discrepancy_id: discrepancyId,
              task_id: taskId,
              order_id: order.order_id,
              discrepancy_type: DISCREPANCY_TYPES.TIME_MISMATCH,
              description: JSON.stringify({
                order: { end_time: order.end_time },
                payment: { payment_id: payment.payment_id, payment_time: payment.payment_time },
                diffMinutes: timeDiff.differenceMinutes,
                evidenceId: evidence.chainId
              }),
              status: 'PENDING',
              result: null
            });
          }
        });

        orderPayments.forEach(payment => {
          const orderStatus = String(order.status || '').toLowerCase();
          const paymentStatus = String(payment.payment_status || '').toLowerCase();
          
          let statusMismatch = false;
          if (orderStatus === 'completed' && !['success', 'completed', 'paid'].includes(paymentStatus)) {
            statusMismatch = true;
          } else if (orderStatus === 'refunded' && paymentStatus !== 'refunded') {
            statusMismatch = true;
          } else if (['cancelled', 'failed'].includes(orderStatus) && paymentStatus === 'success') {
            statusMismatch = true;
          }

          if (statusMismatch) {
            const discrepancyId = 'DISCR_' + crypto.randomBytes(12).toString('hex');
            const evidence = DiffCalculator.buildEvidenceChain(
              { type: 'STATUS_MISMATCH_DETECTION', id: order.order_id, data: { order, payment } },
              { field: 'status', expected: order.status, actual: payment.payment_status },
              { hasDiscrepancy: true, discrepancyType: DISCREPANCY_TYPES.STATUS_MISMATCH, severity: 'medium' }
            );
            evidenceChain.push(evidence);
            discrepancies.push({
              discrepancy_id: discrepancyId,
              task_id: taskId,
              order_id: order.order_id,
              discrepancy_type: DISCREPANCY_TYPES.STATUS_MISMATCH,
              description: JSON.stringify({
                order: { status: order.status },
                payment: { payment_id: payment.payment_id, payment_status: payment.payment_status },
                evidenceId: evidence.chainId
              }),
              status: 'PENDING',
              result: null
            });
          }
        });
      });

      if (discrepancies.length > 0) {
        Discrepancy.bulkInsert(discrepancies, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve({ discrepancies, evidenceChain });
          }
        });
      } else {
        resolve({ discrepancies, evidenceChain });
      }
    });
  },

  explainDiscrepancy: (discrepancy) => {
    const descriptions = {
      [DISCREPANCY_TYPES.UNDEDUCTED]: {
        title: '未扣费异常',
        explanation: '检测到该订单存在已完成的充电记录，但系统中没有对应的支付记录。这可能是由于支付系统故障、网络中断或扣费逻辑异常导致的。',
        action: '请核查该订单的支付状态，如确实未扣费，建议联系用户进行补扣或走坏账处理流程。',
        severity: '高'
      },
      [DISCREPANCY_TYPES.DUPLICATE_REFUND]: {
        title: '重复退款异常',
        explanation: '检测到该订单存在多次退款记录。这可能是由于退款操作重复执行、退款接口重试机制异常或人工操作失误导致的。',
        action: '请立即核查退款明细，联系用户协商退回多退款金额，并排查退款流程中的重复执行问题。',
        severity: '极高'
      },
      [DISCREPANCY_TYPES.CROSS_PLATFORM]: {
        title: '跨平台订单异常',
        explanation: '检测到订单来源平台与实际支付渠道不一致。这可能是由于订单导流、平台间数据同步问题或异常刷单行为导致的。',
        action: '请核查订单流转路径，确认是否为正常业务场景，如为异常情况需评估平台结算规则影响。',
        severity: '中'
      },
      [DISCREPANCY_TYPES.AMOUNT_MISMATCH]: {
        title: '金额不匹配异常',
        explanation: '检测到订单金额与实际支付金额存在差异。这可能是由于优惠券使用、服务费计算、汇率转换或计费规则异常导致的。',
        action: '请核查订单计费规则、优惠活动配置及支付渠道手续费设置，确认金额差异原因。',
        severity: '高'
      },
      [DISCREPANCY_TYPES.TIME_MISMATCH]: {
        title: '时间不匹配异常',
        explanation: '检测到充电结束时间与支付时间差异较大。这可能是由于延迟扣费、离线支付或系统时间不同步导致的。',
        action: '请核查支付延迟原因，如为系统时间问题建议同步各服务器时间。',
        severity: '低'
      },
      [DISCREPANCY_TYPES.STATUS_MISMATCH]: {
        title: '状态不匹配异常',
        explanation: '检测到订单状态与支付状态不一致。这可能是由于状态同步延迟、事务回滚不完整或状态机逻辑异常导致的。',
        action: '请核查订单状态流转记录，确认最终状态并进行数据修正。',
        severity: '中'
      }
    };

    const desc = descriptions[discrepancy.discrepancy_type] || {
      title: '未知异常',
      explanation: '该异常类型暂未定义详细解释。',
      action: '请联系技术支持进一步分析。',
      severity: '未知'
    };

    let detailData = {};
    try {
      detailData = JSON.parse(discrepancy.description);
    } catch (e) {
      detailData = { raw: discrepancy.description };
    }

    return {
      discrepancyId: discrepancy.discrepancy_id,
      orderId: discrepancy.order_id,
      type: discrepancy.discrepancy_type,
      typeName: desc.title,
      severity: desc.severity,
      explanation: desc.explanation,
      recommendedAction: desc.action,
      evidence: detailData,
      status: discrepancy.status,
      customerServiceScript: \`您好，关于订单号 \${discrepancy.order_id}，我们检测到\${desc.title}问题。\${desc.explanation} 我们正在积极处理此问题，给您带来的不便敬请谅解。如有疑问，请提供更多信息以便我们进一步核实。\`
    };
  }
};

module.exports = ReconciliationService;
`;

fs.writeFileSync('/Users/lzy/pro/solo/workspaces/zy70910/src/services/importService.js', importServiceContent);
console.log('importService.js created');

fs.writeFileSync('/Users/lzy/pro/solo/workspaces/zy70910/src/services/reconciliationService.js', reconciliationServiceContent);
console.log('reconciliationService.js created');

console.log('All files created successfully!');
