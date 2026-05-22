const { Parser } = require("json2csv");
const path = require("path");
const fs = require("fs");
const db = require("../database");
const ValidationService = require("./validationService");

class ReportService {
  static ensureReportDir() {
    const reportDir = path.join(__dirname, "../../reports");
    if (!fs.existsSync(reportDir)) { fs.mkdirSync(reportDir, { recursive: true }); }
    return reportDir;
  }

  static async generateBatchReport(batchId) {
    const batch = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM batches WHERE id = ?", [batchId], (err, row) => { if (err) reject(err); else resolve(row); });
    });
    if (!batch) throw new Error("批次不存在");
    const details = await new Promise((resolve, reject) => {
      db.all("SELECT pd.*, rm.raw_data, rm.line_number, rm.file_name FROM point_details pd JOIN raw_materials rm ON pd.raw_material_id = rm.id WHERE pd.batch_id = ? ORDER BY rm.line_number ASC", [batchId], (err, rows) => { if (err) reject(err); else resolve(rows); });
    });
    const traces = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM processing_traces WHERE batch_id = ? ORDER BY created_at ASC", [batchId], (err, rows) => { if (err) reject(err); else resolve(rows); });
    });
    const reportData = details.map(detail => {
      const detailTraces = traces.filter(t => t.detail_id === detail.id);
      return {
        line_number: detail.line_number,
        detail_id: detail.id,
        member_phone: detail.member_phone || "",
        member_name: detail.member_name || "",
        transaction_no: detail.transaction_no || "",
        transaction_time: detail.transaction_time || "",
        points: detail.points || 0,
        product_category: detail.product_category || "",
        status: detail.status,
        status_reason: detail.status_reason || "",
        next_action: detail.next_action || "",
        next_action_desc: ValidationService.getNextActionDescription(detail.next_action),
        trace_count: detailTraces.length,
        created_at: detail.created_at
      };
    });
    return {
      batch_info: batch,
      summary: { total: details.length, normal: details.filter(d => d.status === "normal").length, pending: details.filter(d => d.status === "pending").length, blocked: details.filter(d => d.status === "blocked").length, written_back: details.filter(d => d.status === "written_back").length },
      details: reportData
    };
  }

  static async generateCSVReport(batchId) {
    const report = await this.generateBatchReport(batchId);
    const reportDir = this.ensureReportDir();
    const fileName = "batch_report_" + report.batch_info.batch_no + "_" + Date.now() + ".csv";
    const filePath = path.join(reportDir, fileName);
    const fields = ["line_number", "detail_id", "member_phone", "member_name", "transaction_no", "transaction_time", "points", "product_category", "status", "status_reason", "next_action", "next_action_desc", "trace_count", "created_at"];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(report.details);
    fs.writeFileSync(filePath, "\\uFEFF" + csv, "utf8");
    return { file_name: fileName, file_path: filePath, batch_info: report.batch_info, summary: report.summary };
  }

  static async getReportFilePath(batchId) {
    return this.generateCSVReport(batchId);
  }

  static async getErrorReport(batchId) {
    const details = await new Promise((resolve, reject) => {
      db.all("SELECT pd.*, rm.raw_data, rm.line_number FROM point_details pd JOIN raw_materials rm ON pd.raw_material_id = rm.id WHERE pd.batch_id = ? AND pd.status IN (\"pending\", \"blocked\") ORDER BY rm.line_number ASC", [batchId], (err, rows) => { if (err) reject(err); else resolve(rows); });
    });
    return details.map(detail => ({
      line_number: detail.line_number,
      detail_id: detail.id,
      status: detail.status,
      status_reason: detail.status_reason,
      next_action: detail.next_action,
      next_action_desc: ValidationService.getNextActionDescription(detail.next_action),
      raw_data: JSON.parse(detail.raw_data),
      member_phone: detail.member_phone,
      transaction_no: detail.transaction_no
    }));
  }
}

module.exports = ReportService;
