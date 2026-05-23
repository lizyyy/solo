const crypto = require("crypto");
const Discrepancy = require("../models/discrepancy");
const ReviewLog = require("../models/reviewLog");
const ReconciliationTask = require("../models/reconciliationTask");

const REVIEW_OPERATIONS = {
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  REQUEST_INFO: "REQUEST_INFO"
};

const DISCREPANCY_STATUSES = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  INFO_REQUESTED: "INFO_REQUESTED"
};

const ReviewService = {
  createReviewLog: (discrepancyId, operator, operationType, previousStatus, nextStatus, remark) => {
    return new Promise((resolve, reject) => {
      const logId = "LOG_" + Date.now() + "_" + crypto.randomBytes(8).toString("hex");
      const log = {
        log_id: logId,
        discrepancy_id: discrepancyId,
        operator: operator,
        operation_type: operationType,
        previous_status: previousStatus,
        next_status: nextStatus,
        remark: remark || "",
        timestamp: new Date().toISOString()
      };
      ReviewLog.create(log, (err) => {
        if (err) reject(err);
        else resolve(logId);
      });
    });
  },

  approveDiscrepancy: (discrepancyId, operator, remark) => {
    return new Promise((resolve, reject) => {
      Discrepancy.findById(discrepancyId, async (err, discrepancy) => {
        if (err) return reject(err);
        if (!discrepancy) return reject(new Error("差异记录不存在"));

        const previousStatus = discrepancy.status;

        try {
          await ReviewService.createReviewLog(
            discrepancyId,
            operator,
            REVIEW_OPERATIONS.APPROVE,
            previousStatus,
            DISCREPANCY_STATUSES.APPROVED,
            remark
          );

          Discrepancy.updateStatus(discrepancyId, DISCREPANCY_STATUSES.APPROVED, "APPROVED", async (updateErr) => {
            if (updateErr) return reject(updateErr);

            await ReviewService.recalculateAfterReview(discrepancy.task_id);

            resolve({
              discrepancyId,
              status: DISCREPANCY_STATUSES.APPROVED,
              operator,
              timestamp: new Date().toISOString(),
              auditLogged: true
            });
          });
        } catch (logErr) {
          reject(logErr);
        }
      });
    });
  },

  rejectDiscrepancy: (discrepancyId, operator, remark) => {
    return new Promise((resolve, reject) => {
      Discrepancy.findById(discrepancyId, async (err, discrepancy) => {
        if (err) return reject(err);
        if (!discrepancy) return reject(new Error("差异记录不存在"));

        const previousStatus = discrepancy.status;

        try {
          await ReviewService.createReviewLog(
            discrepancyId,
            operator,
            REVIEW_OPERATIONS.REJECT,
            previousStatus,
            DISCREPANCY_STATUSES.REJECTED,
            remark
          );

          Discrepancy.updateStatus(discrepancyId, DISCREPANCY_STATUSES.REJECTED, "REJECTED", async (updateErr) => {
            if (updateErr) return reject(updateErr);

            await ReviewService.recalculateAfterReview(discrepancy.task_id);

            resolve({
              discrepancyId,
              status: DISCREPANCY_STATUSES.REJECTED,
              operator,
              timestamp: new Date().toISOString(),
              auditLogged: true
            });
          });
        } catch (logErr) {
          reject(logErr);
        }
      });
    });
  },

  requestMoreInfo: (discrepancyId, operator, remark) => {
    return new Promise((resolve, reject) => {
      Discrepancy.findById(discrepancyId, async (err, discrepancy) => {
        if (err) return reject(err);
        if (!discrepancy) return reject(new Error("差异记录不存在"));

        const previousStatus = discrepancy.status;

        try {
          await ReviewService.createReviewLog(
            discrepancyId,
            operator,
            REVIEW_OPERATIONS.REQUEST_INFO,
            previousStatus,
            DISCREPANCY_STATUSES.INFO_REQUESTED,
            remark
          );

          Discrepancy.updateStatus(discrepancyId, DISCREPANCY_STATUSES.INFO_REQUESTED, "PENDING", async (updateErr) => {
            if (updateErr) return reject(updateErr);

            await ReviewService.recalculateAfterReview(discrepancy.task_id);

            resolve({
              discrepancyId,
              status: DISCREPANCY_STATUSES.INFO_REQUESTED,
              operator,
              timestamp: new Date().toISOString(),
              auditLogged: true
            });
          });
        } catch (logErr) {
          reject(logErr);
        }
      });
    });
  },

  getReviewHistory: (discrepancyId) => {
    return new Promise((resolve, reject) => {
      Discrepancy.findById(discrepancyId, (discErr, discrepancy) => {
        if (discErr) return reject(discErr);
        if (!discrepancy) return reject(new Error("差异记录不存在"));

        ReviewLog.findByDiscrepancyId(discrepancyId, (logErr, logs) => {
          if (logErr) return reject(logErr);

          const auditTrail = logs.map(log => ({
            logId: log.log_id,
            operation: log.operation_type,
            operator: log.operator,
            previousStatus: log.previous_status,
            nextStatus: log.next_status,
            remark: log.remark,
            timestamp: log.timestamp
          }));

          resolve({
            discrepancyId,
            orderId: discrepancy.order_id,
            type: discrepancy.discrepancy_type,
            currentStatus: discrepancy.status,
            result: discrepancy.result,
            auditTrail: auditTrail,
            totalOperations: auditTrail.length
          });
        });
      });
    });
  },

  recalculateAfterReview: (taskId) => {
    return new Promise((resolve, reject) => {
      ReconciliationTask.findById(taskId, (taskErr, task) => {
        if (taskErr) return reject(taskErr);
        if (!task) return reject(new Error("任务不存在"));

        Discrepancy.findByTaskId(taskId, (discErr, discrepancies) => {
          if (discErr) return reject(discErr);

          const statistics = {
            total: discrepancies.length,
            pending: discrepancies.filter(d => d.status === "PENDING").length,
            approved: discrepancies.filter(d => d.status === "APPROVED").length,
            rejected: discrepancies.filter(d => d.status === "REJECTED").length,
            infoRequested: discrepancies.filter(d => d.status === "INFO_REQUESTED").length,
            byType: {}
          };

          discrepancies.forEach(d => {
            if (!statistics.byType[d.discrepancy_type]) {
              statistics.byType[d.discrepancy_type] = { total: 0, pending: 0, approved: 0, rejected: 0 };
            }
            statistics.byType[d.discrepancy_type].total++;
            if (d.status === "PENDING" || d.status === "INFO_REQUESTED") {
              statistics.byType[d.discrepancy_type].pending++;
            } else if (d.status === "APPROVED") {
              statistics.byType[d.discrepancy_type].approved++;
            } else if (d.status === "REJECTED") {
              statistics.byType[d.discrepancy_type].rejected++;
            }
          });

          const updatedTask = {
            ...task,
            statistics: JSON.stringify(statistics)
          };

          ReconciliationTask.create(updatedTask, (err) => {
            if (err) reject(err);
            else resolve(statistics);
          });
        });
      });
    });
  }
};

module.exports = ReviewService;
