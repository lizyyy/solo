const crypto = require("crypto");
const Discrepancy = require("../models/discrepancy");
const ReconciliationTask = require("../models/reconciliationTask");
const ReviewLog = require("../models/reviewLog");
const Report = require("../models/report");
const ReportGenerator = require("../utils/reportGenerator");

const ReportService = {
  getTaskStatistics: (taskId) => {
    return new Promise((resolve, reject) => {
      Discrepancy.findByTaskId(taskId, (err, discrepancies) => {
        if (err) return reject(err);
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
        resolve({ statistics, discrepancies });
      });
    });
  },

  getReviewLogsMap: (discrepancies) => {
    return new Promise((resolve, reject) => {
      const discrepancyIds = discrepancies.map(d => d.discrepancy_id);
      const reviewLogsMap = {};
      let completed = 0;
      if (discrepancyIds.length === 0) {
        resolve({});
        return;
      }
      discrepancyIds.forEach(dId => {
        ReviewLog.findByDiscrepancyId(dId, (err, logs) => {
          if (!err) {
            reviewLogsMap[dId] = logs;
          }
          completed++;
          if (completed === discrepancyIds.length) {
            resolve(reviewLogsMap);
          }
        });
      });
    });
  },

  generateDetailReport: (taskId) => {
    return new Promise((resolve, reject) => {
      ReconciliationTask.findById(taskId, async (taskErr, task) => {
        if (taskErr) return reject(taskErr);
        if (!task) return reject(new Error("任务不存在"));
        try {
          const { statistics, discrepancies } = await ReportService.getTaskStatistics(taskId);
          const reviewLogsMap = await ReportService.getReviewLogsMap(discrepancies);
          const content = ReportGenerator.buildReportContent("DETAIL", task, statistics, discrepancies, reviewLogsMap);
          const reportId = "REPORT_" + Date.now() + "_" + crypto.randomBytes(8).toString("hex");
          const report = {
            report_id: reportId,
            task_id: taskId,
            report_type: "DETAIL",
            content: content,
            generated_at: new Date().toISOString(),
            file_path: null
          };
          Report.create(report, (createErr) => {
            if (createErr) return reject(createErr);
            resolve({ reportId, content });
          });
        } catch (err) {
          reject(err);
        }
      });
    });
  },

  generateSummaryReport: (taskId) => {
    return new Promise((resolve, reject) => {
      ReconciliationTask.findById(taskId, async (taskErr, task) => {
        if (taskErr) return reject(taskErr);
        if (!task) return reject(new Error("任务不存在"));
        try {
          const { statistics, discrepancies } = await ReportService.getTaskStatistics(taskId);
          const content = ReportGenerator.buildReportContent("SUMMARY", task, statistics, discrepancies, {});
          const reportId = "REPORT_" + Date.now() + "_" + crypto.randomBytes(8).toString("hex");
          const report = {
            report_id: reportId,
            task_id: taskId,
            report_type: "SUMMARY",
            content: content,
            generated_at: new Date().toISOString(),
            file_path: null
          };
          Report.create(report, (createErr) => {
            if (createErr) return reject(createErr);
            resolve({ reportId, content });
          });
        } catch (err) {
          reject(err);
        }
      });
    });
  },

  exportToCSV: (taskId, reportType) => {
    return new Promise((resolve, reject) => {
      const type = reportType === "SUMMARY" ? "SUMMARY" : "DETAIL";
      ReconciliationTask.findById(taskId, async (taskErr, task) => {
        if (taskErr) return reject(taskErr);
        if (!task) return reject(new Error("任务不存在"));
        try {
          const { statistics, discrepancies } = await ReportService.getTaskStatistics(taskId);
          const reviewLogsMap = type === "DETAIL" ? await ReportService.getReviewLogsMap(discrepancies) : {};
          if (type === "SUMMARY") {
            const columns = [
              { key: "typeName", title: "差异类型" },
              { key: "total", title: "总数" },
              { key: "pending", title: "待处理" },
              { key: "approved", title: "已放行" },
              { key: "rejected", title: "已退回" }
            ];
            const byTypeData = Object.keys(statistics.byType || {}).map(t => ({
              typeName: ReportGenerator.getDiscrepancyTypeName(t),
              ...statistics.byType[t]
            }));
            const summaryRows = [
              { typeName: "合计", total: statistics.total, pending: statistics.pending, approved: statistics.approved, rejected: statistics.rejected },
              ...byTypeData
            ];
            const csv = ReportGenerator.generateCSVContent(summaryRows, columns);
            resolve({ csv, filename: "summary_report_" + taskId + ".csv" });
          } else {
            const columns = [
              { key: "discrepancyId", title: "差异ID" },
              { key: "orderId", title: "订单ID" },
              { key: "typeName", title: "差异类型" },
              { key: "statusName", title: "状态" },
              { key: "descriptionText", title: "详情" },
              { key: "handlingJustification", title: "处理说明" }
            ];
            const detailData = discrepancies.map(d => {
              const formatted = ReportGenerator.formatDiscrepancyForReport(d);
              const auditTrail = ReportGenerator.generateAuditTrail(reviewLogsMap[d.discrepancy_id] || []);
              return {
                ...formatted,
                handlingJustification: ReportGenerator.generateHandlingJustification(formatted, auditTrail)
              };
            });
            const csv = ReportGenerator.generateCSVContent(detailData, columns);
            resolve({ csv, filename: "detail_report_" + taskId + ".csv" });
          }
        } catch (err) {
          reject(err);
        }
      });
    });
  },

  exportToJSON: (taskId, reportType) => {
    return new Promise((resolve, reject) => {
      const type = reportType === "SUMMARY" ? "SUMMARY" : "DETAIL";
      ReconciliationTask.findById(taskId, async (taskErr, task) => {
        if (taskErr) return reject(taskErr);
        if (!task) return reject(new Error("任务不存在"));
        try {
          const { statistics, discrepancies } = await ReportService.getTaskStatistics(taskId);
          const reviewLogsMap = type === "DETAIL" ? await ReportService.getReviewLogsMap(discrepancies) : {};
          const content = ReportGenerator.buildReportContent(type, task, statistics, discrepancies, reviewLogsMap);
          const json = JSON.stringify(content, null, 2);
          resolve({ json, filename: (type === "SUMMARY" ? "summary" : "detail") + "_report_" + taskId + ".json" });
        } catch (err) {
          reject(err);
        }
      });
    });
  }
};

module.exports = ReportService;
