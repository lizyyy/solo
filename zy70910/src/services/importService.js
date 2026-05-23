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
    return {
      valid: errors.length === 0,
      errors,
      cleaned: order
    };
  },

  validatePaymentRecord: (record) => {
    const errors = [];
    if (!record.payment_id) errors.push("缺少 payment_id");
    return { valid: errors.length === 0, errors, cleaned: record };
  },

  validateChargerLog: (log) => {
    const errors = [];
    if (!log.log_id) errors.push("缺少 log_id");
    return { valid: errors.length === 0, errors, cleaned: log };
  },

  importOrdersCSV: (filePath) => {
    return new Promise((resolve, reject) => {
      const results = [];
      const validOrders = [];
      const traceId = DiffCalculator.generateTraceId();
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (data) => {
          const validation = ImportService.validateOrder(data);
          if (validation.valid) validOrders.push(validation.cleaned);
          results.push({ status: validation.valid ? "success" : "failed", validation });
        })
        .on("end", () => {
          if (validOrders.length > 0) {
            Order.bulkInsert(validOrders, (err) => {
              if (err) reject(err);
              else resolve({ traceId, successCount: validOrders.length, results });
            });
          } else resolve({ traceId, successCount: 0, results });
        })
        .on("error", reject);
    });
  },

  importChargerLogsJSON: (filePath) => {
    return new Promise((resolve, reject) => {
      const traceId = DiffCalculator.generateTraceId();
      try {
        const logs = JSON.parse(fs.readFileSync(filePath, "utf8"));
        const validLogs = logs.filter(l => ImportService.validateChargerLog(l).valid);
        ChargerLog.bulkInsert(validLogs, (err) => {
          if (err) reject(err);
          else resolve({ traceId, successCount: validLogs.length });
        });
      } catch (e) { reject(e); }
    });
  },

  importPaymentRecords: (filePath) => {
    return new Promise((resolve, reject) => {
      const traceId = DiffCalculator.generateTraceId();
      const ext = path.extname(filePath).toLowerCase();
      try {
        let records = [];
        if (ext === ".json") records = JSON.parse(fs.readFileSync(filePath, "utf8"));
        const validRecords = records.filter(r => ImportService.validatePaymentRecord(r).valid);
        PaymentRecord.bulkInsert(validRecords, (err) => {
          if (err) reject(err);
          else resolve({ traceId, successCount: validRecords.length });
        });
      } catch (e) { reject(e); }
    });
  }
};

module.exports = ImportService;
