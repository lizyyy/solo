const { v4: uuidv4 } = require("uuid");
const db = require("../database");
const PointService = require("./pointService");
const BatchService = require("./batchService");

class WriteBackService {
  static async simulateExternalSystemWrite(detail) {
    const delay = Math.random() * 200 + 50;
    await new Promise(resolve => setTimeout(resolve, delay));
    const successRate = 0.9;
    if (Math.random() < successRate) {
      return { success: true, externalId: "EXT-" + uuidv4().slice(0, 8), message: "积分回写成功" };
    } else {
      return { success: false, errorCode: "E" + Math.floor(Math.random() * 1000), message: "外部系统暂时不可用，请稍后重试" };
    }
  }

  static async writeBackDetail(detailId, operator = "system") {
    const detail = await PointService.getDetailById(detailId);
    if (!detail) throw new Error("明细不存在");
    if (detail.status !== "normal") throw new Error("只有状态为normal的明细才能回写");
    const result = await this.simulateExternalSystemWrite(detail);
    const recordId = uuidv4();
    const writeBackStatus = result.success ? "success" : "failed";
    await new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO write_back_records (id, detail_id, batch_id, external_system, write_back_status, write_back_time, response_data, error_message, retry_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [recordId, detailId, detail.batch_id, "member_points_system", writeBackStatus, new Date().toISOString(), result.success ? JSON.stringify({ externalId: result.externalId }) : null, result.success ? null : result.errorCode + ": " + result.message, 0],
        (err) => { if (err) reject(err); else resolve(); }
      );
    });
    await PointService.addTrace(detailId, detail.batch_id, "write_back", operator, detail.status, result.success ? "written_back" : "normal", result.success ? "回写成功，外部ID: " + result.externalId : "回写失败: " + result.message);
    if (result.success) {
      await new Promise((resolve, reject) => {
        db.run("UPDATE point_details SET status = \"written_back\", updated_at = CURRENT_TIMESTAMP WHERE id = ?", [detailId], (err) => { if (err) reject(err); else resolve(); });
      });
      await BatchService.updateBatchStats(detail.batch_id);
    }
    return { success: result.success, message: result.message, recordId: recordId };
  }

  static async triggerBatchWriteBack(batchId, operator = "system") {
    const details = await PointService.getDetailsByBatch(batchId, "normal");
    const results = { total: details.length, success: 0, failed: 0, items: [] };
    for (const detail of details) {
      try {
        const result = await this.writeBackDetail(detail.id, operator);
        if (result.success) results.success++; else results.failed++;
        results.items.push({ detail_id: detail.id, success: result.success, message: result.message });
      } catch (error) { results.failed++; results.items.push({ detail_id: detail.id, success: false, message: error.message }); }
    }
    await BatchService.updateBatchStatus(batchId, "write_back_completed");
    return results;
  }
}

module.exports = WriteBackService;
