const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const Order = require("../models/order");
const PaymentRecord = require("../models/paymentRecord");
const ChargerLog = require("../models/chargerLog");
const DiffCalculator = require("../utils/diffCalculator");

const ImportService = {
  validateOrder: (order) => {
    const errors = [];
    if (!order.order_id) errors.push("缺少 order_id");
    if (!order.user_id) errors.push("缺少 user_id");
    if (!order.charger_id) errors.push("缺少 charger_id");
    if (!order.start_time) errors.push("缺少 start_time");
    if (!order.end_time) errors.push("缺少 end_time");
    if (order.charge_amount === undefined || order.charge_amount === null || isNaN(order.charge_amount)) {
      errors.push("charge_amount 必须是数字");
    }
    if (order.amount === undefined || order.amount === null || isNaN(order.amount)) {
      errors.push("amount 必须是数字");
    }
    if (!order.status) errors.push("缺少 status");
    if (!order.platform_source) errors.push("缺少 platform_source");
    
    return {
      valid: errors.length === 0,
      errors,
      cleaned: {
        order_id: String(order.order_id || "").trim(),
        user_id: String(order.user_id || "").trim(),
        charger_id: String(order.charger_id || "").trim(),
        start_time: order.start_time ? new Date(order.start_time).toISOString() : null,
        end_time: order.end_time ? new Date(order.end_time).toISOString() : null,
        charge_amount: parseFloat(order.charge_amount) || 0,
        amount: parseFloat(order.amount) || 0,
        status: String(order.status || "").trim(),
        platform_source: String(order.platform_source || "").trim()
      }
    };
  },

  validatePaymentRecord: (record) => {
    const errors = [];
    if (!record.payment_id) errors.push("缺少 payment_id");
    if (!record.order_id) errors.push("缺少 order_id");
    if (!record.payment_time) errors.push("缺少 payment_time");
    if (record.amount === undefined || record.amount === null || isNaN(record.amount)) {
      errors.push("amount 必须是数字");
    }
    if (!record.payment_status) errors.push("缺少 payment_status");
    
    return {
      valid: errors.length === 0,
      errors,
      cleaned: {
        payment_id: String(record.payment_id || "").trim(),
        order_id: String(record.order_id || "").trim(),
        payment_time: record.payment_time ? new Date(record.payment_time).toISOString() : null,
        amount: parseFloat(record.amount) || 0,
        payment_status: String(record.payment_status || "").trim(),
        refund_status: String(record.refund_status || "none").trim(),
        refund_amount: parseFloat(record.refund_amount) || 0,
        payment_channel: String(record.payment_channel || "").trim()
      }
    };
  },

  validateChargerLog: (log) => {
    const errors = [];
    if (!log.log_id) errors.push("缺少 log_id");
    if (!log.charger_id) errors.push("缺少 charger_id");
    if (!log.event_time) errors.push("缺少 event_time");
    if (!log.event_type) errors.push("缺少 event_type");
    
    return {
      valid: errors.length === 0,
      errors,
      cleaned: {
        log_id: String(log.log_id || "").trim(),
        charger_id: String(log.charger_id || "").trim(),
        order_id: String(log.order_id || "").trim(),
        event_time: log.event_time ? new Date(log.event_time).toISOString() : null,
        realtime_charge: parseFloat(log.realtime_charge) || 0,
        status: String(log.status || "").trim(),
        event_type: String(log.event_type || "").trim()
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
        .on("data", (data) => {
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
            results.push({ status: "success", recordTrace });
          } else {
            invalidRecords.push(recordTrace);
            results.push({ status: "failed", errors: validation.errors, recordTrace });
          }
        })
        .on("end", () => {
          if (validOrders.length > 0) {
            Order.bulkInsert(validOrders, (err) => {
              if (err) {
                reject({ traceId, error: err.message, successCount: 0, failureCount: results.length, results });
              } else {
                resolve({
                  traceId,
                  successCount: validOrders.length,
                  failureCount: invalidRecords.length,
                  totalProcessed: results.length,
                  results,
                  evidence: { type: "CSV_IMPORT", file: path.basename(filePath), timestamp: new Date().toISOString() }
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
              evidence: { type: "CSV_IMPORT", file: path.basename(filePath), timestamp: new Date().toISOString() }
            });
          }
        })
        .on("error", (error) => {
          reject({ traceId, error: error.message, successCount: validOrders.length, failureCount: invalidRecords.length, results });
        });
    });
  },

  importChargerLogsJSON: (filePath) => {
    return new Promise((resolve, reject) => {
      const traceId = DiffCalculator.generateTraceId();
      try {
        const content = fs.readFileSync(filePath, "utf8");
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
            results.push({ status: "success", recordTrace });
          } else {
            results.push({ status: "failed", errors: validation.errors, recordTrace });
          }
        });
        
        if (validLogs.length > 0) {
          ChargerLog.bulkInsert(validLogs, (err) => {
            if (err) {
              reject({ traceId, error: err.message, successCount: 0, failureCount: results.length, results });
            } else {
              resolve({
                traceId,
                successCount: validLogs.length,
                failureCount: results.length - validLogs.length,
                totalProcessed: results.length,
                results,
                evidence: { type: "JSON_IMPORT", file: path.basename(filePath), timestamp: new Date().toISOString() }
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
            evidence: { type: "JSON_IMPORT", file: path.basename(filePath), timestamp: new Date().toISOString() }
          });
        }
      } catch (error) {
        reject({ traceId, error: error.message, successCount: 0, failureCount: 0, results: [] });
      }
    });
  },

  importPaymentRecords: (filePath) => {
    return new Promise((resolve, reject) => {
      const traceId = DiffCalculator.generateTraceId();
      const ext = path.extname(filePath).toLowerCase();
      
      if (ext === ".csv") {
        const results = [];
        const validRecords = [];
        
        fs.createReadStream(filePath)
          .pipe(csv())
          .on("data", (data) => {
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
              results.push({ status: "success", recordTrace });
            } else {
              results.push({ status: "failed", errors: validation.errors, recordTrace });
            }
          })
          .on("end", () => {
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
                    evidence: { type: "PAYMENT_IMPORT", file: path.basename(filePath), timestamp: new Date().toISOString() }
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
                evidence: { type: "PAYMENT_IMPORT", file: path.basename(filePath), timestamp: new Date().toISOString() }
              });
            }
          })
          .on("error", (error) => {
            reject({ traceId, error: error.message, successCount: 0, failureCount: 0, results: [] });
          });
      } else if (ext === ".json") {
        try {
          const content = fs.readFileSync(filePath, "utf8");
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
              results.push({ status: "success", recordTrace });
            } else {
              results.push({ status: "failed", errors: validation.errors, recordTrace });
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
                  evidence: { type: "PAYMENT_IMPORT", file: path.basename(filePath), timestamp: new Date().toISOString() }
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
              evidence: { type: "PAYMENT_IMPORT", file: path.basename(filePath), timestamp: new Date().toISOString() }
            });
          }
        } catch (error) {
          reject({ traceId, error: error.message, successCount: 0, failureCount: 0, results: [] });
        }
      } else {
        reject({ traceId, error: "不支持的文件格式，仅支持 CSV 和 JSON", successCount: 0, failureCount: 0, results: [] });
      }
    });
  }
};

module.exports = ImportService;
