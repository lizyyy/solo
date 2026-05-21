const fs = require("fs");
const csv = require("csv-parser");
const moment = require("moment");
const db = require("../models/database");

class ImportService {
  async createBatch(batchType, sourceFile, createdBy, remark) {
    const batchNo = "BATCH" + moment().format("YYYMMDDHHmmss") + Math.floor(Math.random() * 1000);
    const result = await db.run(
      "INSERT INTO batches (batch_no, batch_type, source_file, created_by, remark) VALUES (?, ?, ?, ?, ?)",
      [batchNo, batchType, sourceFile, createdBy, remark || ""]
    );
    return { batchId: result.lastID, batchNo };
  }

  async updateBatchCount(batchId, count) {
    await db.run(
      "UPDATE batches SET total_count = ?, status = ? WHERE id = ?",
      [count, "completed", batchId]
    );
  }

  async addProcessingHistory(itemId, action, reason, operator, oldStatus, newStatus, remark) {
    await db.run(
      "INSERT INTO processing_history (item_id, action, action_reason, operator, old_status, new_status, remark) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [itemId, action, reason, operator, oldStatus, newStatus, remark || ""]
    );
  }

  async listBatches(page, pageSize) {
    const offset = (page - 1) * pageSize;
    const batches = await db.all(
      "SELECT * FROM batches ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [pageSize, offset]
    );
    const totalResult = await db.get("SELECT COUNT(*) as count FROM batches");
    return {
      list: batches,
      total: totalResult.count,
      page,
      pageSize
    };
  }

  async validateRouteSchedule(routeNo, shiftNo) {
    if (!routeNo || !shiftNo) {
      return { valid: true, warning: "未提供线路号或班次号，跳过校验" };
    }
    const schedule = await db.get(
      "SELECT * FROM route_schedules WHERE route_no = ? AND shift_no = ? LIMIT 1",
      [routeNo, shiftNo]
    );
    if (!schedule) {
      return {
        valid: false,
        warning: "线路 " + routeNo + " 班次 " + shiftNo + " 未在系统中登记"
      };
    }
    return { valid: true, schedule };
  }
}

module.exports = new ImportService();

          successCount++;
        } catch (rowError) {
          failCount++;
          warnings.push(`导入图片索引失败: ${imageData.image_code || 'unknown'} - ${rowError.message}`);
        }
      }

      await db.commit();

      return {
        success: true,
        total: imageDataList.length,
        successCount,
        failCount,
        warnings
      };
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }
}

module.exports = new ImportService();
