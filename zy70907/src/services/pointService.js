const { v4: uuidv4 } = require("uuid");
const db = require("../database");
const ValidationService = require("./validationService");
const BatchService = require("./batchService");

class PointService {
  static async createRawMaterial(batchId, lineNumber, rawData, fileName = "") {
    const rawId = uuidv4();
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO raw_materials (id, batch_id, line_number, raw_data, file_name) VALUES (?, ?, ?, ?, ?)",
        [rawId, batchId, lineNumber, JSON.stringify(rawData), fileName],
        (err) => {
          if (err) reject(err);
          else resolve({ id: rawId, batch_id: batchId, line_number: lineNumber });
        }
      );
    });
  }

  static async createPointDetail(batchId, rawMaterialId, data, isIntraBatchDuplicate = false) {
    const detailId = uuidv4();
    const validation = ValidationService.validatePointData(data);
    
    let isDuplicate = false;
    let duplicateReason = "";
    
    if (data.transaction_no) {
      const crossBatchDuplicate = await ValidationService.checkDuplicateTransaction(data.transaction_no, batchId);
      if (crossBatchDuplicate) {
        isDuplicate = true;
        duplicateReason = "交易编号与其他批次重复";
      } else if (isIntraBatchDuplicate) {
        isDuplicate = true;
        duplicateReason = "交易编号在本批次内重复";
      }
    }
    
    if (isDuplicate) {
      validation.status = "blocked";
      validation.reasons.push(duplicateReason);
      validation.nextAction = "resolve_duplicate";
      validation.hasError = true;
    }
    
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO point_details (id, batch_id, raw_material_id, member_phone, member_name, member_card_no, transaction_no, transaction_time, transaction_amount, points, product_name, product_category, sales_staff, status, status_reason, next_action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [detailId, batchId, rawMaterialId, data.member_phone || null, data.member_name || null, data.member_card_no || null, data.transaction_no || null, data.transaction_time || null, data.transaction_amount || null, data.points || null, data.product_name || null, data.product_category || null, data.sales_staff || null, validation.status, validation.reasons.join("; "), validation.nextAction],
        (err) => {
          if (err) reject(err);
          else resolve({ id: detailId, status: validation.status, reasons: validation.reasons });
        }
      );
    });
  }

  static detectIntraBatchDuplicates(dataList) {
    const transactionNos = new Set();
    const duplicates = new Set();
    
    for (let i = 0; i < dataList.length; i++) {
      const data = dataList[i];
      if (data.transaction_no && String(data.transaction_no).trim() !== "") {
        const txNo = String(data.transaction_no).trim();
        if (transactionNos.has(txNo)) {
          duplicates.add(i);
          
        } else {
          transactionNos.add(txNo);
        }
      }
    }
    
    return duplicates;
  }

  static async addTrace(detailId, batchId, action, operator, oldStatus, newStatus, reason, remark = "") {
    const traceId = uuidv4();
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO processing_traces (id, detail_id, batch_id, action, operator, old_status, new_status, reason, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [traceId, detailId, batchId, action, operator, oldStatus, newStatus, reason, remark],
        (err) => {
          if (err) reject(err);
          else resolve({ id: traceId });
        }
      );
    });
  }

  static async processBatchData(batchId, dataList, fileName = "") {
    const results = { total: dataList.length, normal: 0, pending: 0, blocked: 0, details: [] };
    
    const intraBatchDuplicateIndices = this.detectIntraBatchDuplicates(dataList);
    
    for (let i = 0; i < dataList.length; i++) {
      const rawData = dataList[i];
      const isIntraBatchDuplicate = intraBatchDuplicateIndices.has(i);
      
      const rawMaterial = await this.createRawMaterial(batchId, i + 1, rawData, fileName);
      const detail = await this.createPointDetail(batchId, rawMaterial.id, rawData, isIntraBatchDuplicate);
      
      await this.addTrace(detail.id, batchId, "import_data", "system", null, detail.status, detail.reasons.join("; "), "原始行号: " + (i + 1));
      
      results[detail.status]++;
      results.details.push({ line_number: i + 1, detail_id: detail.id, status: detail.status, reasons: detail.reasons });
    }
    
    await BatchService.updateBatchStats(batchId);
    await BatchService.updateBatchStatus(batchId, "processed");
    return results;
  }

  static async getDetailById(detailId) {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM point_details WHERE id = ?", [detailId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getDetailTraces(detailId) {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM processing_traces WHERE detail_id = ? ORDER BY created_at ASC", [detailId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getDetailWithRawMaterial(detailId) {
    return new Promise((resolve, reject) => {
      db.get("SELECT pd.*, rm.raw_data, rm.line_number, rm.file_name FROM point_details pd JOIN raw_materials rm ON pd.raw_material_id = rm.id WHERE pd.id = ?", [detailId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getDetailsByBatch(batchId, status = null) {
    let sql = "SELECT * FROM point_details WHERE batch_id = ?";
    let params = [batchId];
    if (status) { sql += " AND status = ?"; params.push(status); }
    sql += " ORDER BY created_at ASC";
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = PointService;
