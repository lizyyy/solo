const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const { v4: uuidv4 } = require("uuid");
const { Parser } = require("json2csv");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const dbPath = path.join(__dirname, "../data/cold-chain.db");
const db = new sqlite3.Database(dbPath);
db.run("PRAGMA foreign_keys = ON");

const STATUS_FLOW = {
  CREATED: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["ARRIVED", "EXCEPTION"],
  ARRIVED: ["SIGNED_OFF", "EXCEPTION"],
  SIGNED_OFF: ["COMPLETED", "EXCEPTION"],
  EXCEPTION: ["UNDER_REVIEW", "RESOLVED"],
  UNDER_REVIEW: ["COMPENSATED", "RESOLVED"],
  COMPENSATED: ["COMPLETED"],
  RESOLVED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: []
};

const STATUS_NAMES = {
  CREATED: "已创建",
  IN_TRANSIT: "运输中",
  ARRIVED: "已到店",
  SIGNED_OFF: "已签收",
  EXCEPTION: "异常待处理",
  UNDER_REVIEW: "复核中",
  COMPENSATED: "已赔付",
  RESOLVED: "已解决",
  COMPLETED: "已完成",
  CANCELLED: "已取消"
};

function validateTemperature(temp, min, max) {
  return temp >= min && temp <= max;
}

function generateHash(content) {
  return crypto.createHash("md5").update(JSON.stringify(content)).digest("hex");
}

function writeExceptionLog(apiPath, originalInput, errorType, errorMessage, processingResult = null) {
  return new Promise((resolve) => {
    db.run(
      "INSERT INTO exception_logs VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        uuidv4(),
        uuidv4(),
        apiPath,
        JSON.stringify(originalInput),
        errorType,
        errorMessage,
        processingResult ? JSON.stringify(processingResult) : null,
        new Date().toISOString()
      ],
      () => resolve()
    );
  });
}

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/boxes", async (req, res) => {
  try {
    const { batchNo, productType, targetTempMin, targetTempMax } = req.body;
    if (!batchNo || !productType) {
      await writeExceptionLog(
        "/api/boxes",
        { batchNo, productType },
        "MISSING_REQUIRED_FIELDS",
        "缺少必填字段: batchNo, productType"
      );
      return res.status(400).json({ error: "缺少必填字段: batchNo, productType" });
    }
    const existing = await new Promise(r => 
      db.get("SELECT box_id FROM cold_chain_boxes WHERE batch_no = ?", [batchNo], (e, row) => r(row))
    );
    if (existing) {
      db.get("SELECT * FROM cold_chain_boxes WHERE batch_no = ?", [batchNo], (e, row) => {
        res.json({ message: "批次已存在，幂等返回", data: row, isDuplicate: true });
      });
      return;
    }
    const boxId = uuidv4();
    const now = new Date().toISOString();
    await new Promise(r => 
      db.run("INSERT INTO cold_chain_boxes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [boxId, batchNo, productType, targetTempMin || 2, targetTempMax || 8, "", "", "", "CREATED", now, now], r)
    );
    db.get("SELECT * FROM cold_chain_boxes WHERE box_id = ?", [boxId], (e, row) => {
      res.status(201).json({ message: "创建成功", data: row });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/boxes", (req, res) => {
  db.all("SELECT * FROM cold_chain_boxes ORDER BY created_at DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows, total: rows.length });
  });
});

app.get("/api/boxes/:boxId", (req, res) => {
  const { boxId } = req.params;
  db.get("SELECT * FROM cold_chain_boxes WHERE box_id = ?", [boxId], (err, box) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!box) return res.status(404).json({ error: "冷链箱不存在" });
    db.all("SELECT * FROM temperature_samples WHERE box_id = ? ORDER BY sample_time DESC", [boxId], (e, temps) => {
      db.all("SELECT * FROM photo_credentials WHERE box_id = ? ORDER BY upload_time DESC", [boxId], (e2, photos) => {
        db.get("SELECT * FROM store_signoffs WHERE box_id = ?", [boxId], (e3, signoff) => {
          db.all("SELECT * FROM status_history WHERE box_id = ? ORDER BY created_at DESC", [boxId], (e4, history) => {
            db.all("SELECT * FROM exception_reviews WHERE box_id = ? ORDER BY created_at DESC", [boxId], (e5, reviews) => {
              db.get("SELECT * FROM compensation_conclusions WHERE box_id = ?", [boxId], (e6, compensation) => {
                res.json({ 
                  data: { 
                    box, 
                    temperatureSamples: temps, 
                    photos, 
                    signoff, 
                    statusHistory: history,
                    exceptionReviews: reviews,
                    compensationConclusion: compensation
                  } 
                });
              });
            });
          });
        });
      });
    });
  });
});

app.post("/api/boxes/:boxId/status", async (req, res) => {
  try {
    const { boxId } = req.params;
    const { newStatus, operator, remark } = req.body;
    if (!newStatus) {
      await writeExceptionLog(
        "/api/boxes/:boxId/status",
        { boxId, newStatus, operator },
        "MISSING_REQUIRED_FIELDS",
        "缺少必填字段: newStatus"
      );
      return res.status(400).json({ error: "缺少必填字段: newStatus" });
    }
    const box = await new Promise(r => 
      db.get("SELECT current_status FROM cold_chain_boxes WHERE box_id = ?", [boxId], (e, row) => r(row))
    );
    if (!box) {
      await writeExceptionLog(
        "/api/boxes/:boxId/status",
        { boxId, newStatus, operator },
        "BOX_NOT_FOUND",
        `冷链箱不存在: ${boxId}`
      );
      return res.status(404).json({ error: "冷链箱不存在" });
    }
    const fromStatus = box.current_status;
    const allowedTransitions = STATUS_FLOW[fromStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      await writeExceptionLog(
        "/api/boxes/:boxId/status",
        { boxId, fromStatus, newStatus, operator },
        "INVALID_STATUS_TRANSITION",
        `状态转移不允许: ${fromStatus} → ${newStatus}`,
        { allowedTransitions }
      );
      return res.status(400).json({
        error: "状态转移不允许",
        fromStatus,
        toStatus: newStatus,
        allowed: allowedTransitions
      });
    }
    const now = new Date().toISOString();
    await new Promise(r => 
      db.run("UPDATE cold_chain_boxes SET current_status = ?, updated_at = ? WHERE box_id = ?", 
        [newStatus, now, boxId], r)
    );
    await new Promise(r => 
      db.run("INSERT INTO status_history VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [uuidv4(), boxId, fromStatus, newStatus, "STATUS_CHANGE", operator, remark, now], r)
    );
    res.json({ message: "状态更新成功", data: { boxId, fromStatus, toStatus: newStatus } });
  } catch (error) {
    await writeExceptionLog(
      "/api/boxes/:boxId/status",
      { boxId: req.params.boxId, newStatus: req.body.newStatus, operator: req.body.operator },
      "DATABASE_ERROR",
      error.message
    );
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/boxes/:boxId/temperature", async (req, res) => {
  try {
    const { boxId } = req.params;
    const { probeId, temperature } = req.body;
    if (!probeId || temperature === undefined) {
      await writeExceptionLog(
        "/api/boxes/:boxId/temperature",
        { boxId, probeId, temperature },
        "MISSING_REQUIRED_FIELDS",
        "缺少必填字段: probeId, temperature"
      );
      return res.status(400).json({ error: "缺少必填字段: probeId, temperature" });
    }
    const box = await new Promise(r => 
      db.get("SELECT * FROM cold_chain_boxes WHERE box_id = ?", [boxId], (e, row) => r(row))
    );
    if (!box) {
      await writeExceptionLog(
        "/api/boxes/:boxId/temperature",
        { boxId, probeId, temperature },
        "BOX_NOT_FOUND",
        `冷链箱不存在: ${boxId}`
      );
      return res.status(404).json({ error: "冷链箱不存在" });
    }
    const isTempValid = validateTemperature(temperature, box.target_temp_min, box.target_temp_max);
    const now = new Date().toISOString();
    await new Promise(r => 
      db.run("INSERT INTO temperature_samples VALUES (?, ?, ?, ?, ?, ?, ?)",
        [uuidv4(), boxId, probeId, temperature, now, "门店", now], r)
    );
    if (!isTempValid && box.current_status !== "EXCEPTION") {
      await new Promise(r => 
        db.run("UPDATE cold_chain_boxes SET current_status = ?, updated_at = ? WHERE box_id = ?", 
          ["EXCEPTION", now, boxId], r)
      );
      await new Promise(r => 
        db.run("INSERT INTO status_history VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [uuidv4(), boxId, box.current_status, "EXCEPTION", "TEMP_EXCEPTION", 
           "SYSTEM", `温度异常: ${temperature}°C，正常范围 ${box.target_temp_min}-${box.target_temp_max}°C`, now], r)
      );
      await writeExceptionLog(
        "/api/boxes/:boxId/temperature",
        { boxId, probeId, temperature },
        "TEMPERATURE_ABNORMAL",
        `温度采样 ${temperature}°C 超出范围 [${box.target_temp_min}, ${box.target_temp_max}]°C`,
        { newStatus: "EXCEPTION", tempRange: { min: box.target_temp_min, max: box.target_temp_max } }
      );
    }
    res.json({
      message: "温度采样上传成功",
      data: { isTempValid, temperatureRange: `${box.target_temp_min}-${box.target_temp_max}°C` }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/boxes/:boxId/signoff", async (req, res) => {
  try {
    const { boxId } = req.params;
    const { storeId, storeName, signoffPerson, actualTemp, arrivalTime, signoffRemark } = req.body;
    if (!storeId || !storeName || !signoffPerson) {
      await writeExceptionLog(
        "/api/boxes/:boxId/signoff",
        { boxId, storeId, storeName, signoffPerson },
        "MISSING_REQUIRED_FIELDS",
        "缺少必填字段: storeId, storeName, signoffPerson"
      );
      return res.status(400).json({ error: "缺少必填字段: storeId, storeName, signoffPerson" });
    }
    const box = await new Promise(r => 
      db.get("SELECT * FROM cold_chain_boxes WHERE box_id = ?", [boxId], (e, row) => r(row))
    );
    if (!box) {
      await writeExceptionLog(
        "/api/boxes/:boxId/signoff",
        { boxId, storeId, storeName, signoffPerson },
        "BOX_NOT_FOUND",
        `冷链箱不存在: ${boxId}`
      );
      return res.status(404).json({ error: "冷链箱不存在" });
    }
    
    if (box.current_status !== "ARRIVED" && box.current_status !== "EXCEPTION") {
      await writeExceptionLog(
        "/api/boxes/:boxId/signoff",
        { boxId, storeId, storeName, signoffPerson, actualTemp },
        "STATUS_VALIDATION_FAILED",
        `当前状态 ${box.current_status} 不允许签收`,
        { allowedStatuses: ["ARRIVED", "EXCEPTION"] }
      );
      return res.status(400).json({ 
        error: "当前状态不允许签收",
        currentStatus: box.current_status,
        currentStatusName: STATUS_NAMES[box.current_status],
        requiredStatus: ["ARRIVED", "EXCEPTION"]
      });
    }
    
    const existingSignoff = await new Promise(r => 
      db.get("SELECT * FROM store_signoffs WHERE box_id = ?", [boxId], (e, row) => r(row))
    );
    if (existingSignoff) {
      return res.json({ message: "已签收，幂等返回", data: existingSignoff, isDuplicate: true });
    }
    const isTempValid = actualTemp !== undefined ? 
      validateTemperature(actualTemp, box.target_temp_min, box.target_temp_max) : true;
    const now = new Date().toISOString();
    await new Promise(r => 
      db.run("INSERT INTO store_signoffs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [uuidv4(), boxId, storeId, storeName, signoffPerson, now, arrivalTime || now, actualTemp, signoffRemark || "", now], r)
    );
    const newStatus = isTempValid ? "SIGNED_OFF" : "EXCEPTION";
    if (box.current_status !== newStatus) {
      await new Promise(r => 
        db.run("UPDATE cold_chain_boxes SET current_status = ?, updated_at = ? WHERE box_id = ?", 
          [newStatus, now, boxId], r)
      );
      await new Promise(r => 
        db.run("INSERT INTO status_history VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [uuidv4(), boxId, box.current_status, newStatus, "SIGN_OFF", signoffPerson,
           isTempValid ? "正常签收" : `签收温度异常: ${actualTemp}°C`, now], r)
      );
    }
    if (!isTempValid) {
      await writeExceptionLog(
        "/api/boxes/:boxId/signoff",
        { boxId, storeId, storeName, signoffPerson, actualTemp },
        "TEMPERATURE_ABNORMAL",
        `签收温度 ${actualTemp}°C 超出范围 [${box.target_temp_min}, ${box.target_temp_max}]°C`,
        { newStatus: "EXCEPTION", tempRange: { min: box.target_temp_min, max: box.target_temp_max } }
      );
    }
    res.json({ message: "签收成功", data: { isTempValid, newStatus } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/boxes/:boxId/photo", async (req, res) => {
  try {
    const { boxId } = req.params;
    const { photoType, photoUrl, uploader, remark } = req.body;
    if (!photoType || !photoUrl) {
      await writeExceptionLog(
        "/api/boxes/:boxId/photo",
        { boxId, photoType, photoUrl },
        "MISSING_REQUIRED_FIELDS",
        "缺少必填字段: photoType, photoUrl"
      );
      return res.status(400).json({ error: "缺少必填字段: photoType, photoUrl" });
    }
    const box = await new Promise(r => 
      db.get("SELECT * FROM cold_chain_boxes WHERE box_id = ?", [boxId], (e, row) => r(row))
    );
    if (!box) {
      await writeExceptionLog(
        "/api/boxes/:boxId/photo",
        { boxId, photoType, photoUrl },
        "BOX_NOT_FOUND",
        `冷链箱不存在: ${boxId}`
      );
      return res.status(404).json({ error: "冷链箱不存在" });
    }
    const photoHash = generateHash({ photoUrl, photoType, boxId });
    const existingPhoto = await new Promise(r => 
      db.get("SELECT * FROM photo_credentials WHERE photo_hash = ?", [photoHash], (e, row) => r(row))
    );
    if (existingPhoto) {
      return res.json({ message: "照片已存在，幂等返回", data: existingPhoto, isDuplicate: true });
    }
    const now = new Date().toISOString();
    const insertResult = await new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO photo_credentials VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [uuidv4(), boxId, photoType, photoUrl, photoHash, now, uploader || "", remark || "", now],
        (err) => {
          if (err) reject(err);
          else resolve(true);
        }
      );
    });
    res.json({ message: "照片凭证上传成功", data: { photoHash } });
  } catch (error) {
    await writeExceptionLog(
      "/api/boxes/:boxId/photo",
      { boxId: req.params.boxId, photoType: req.body.photoType, photoUrl: req.body.photoUrl },
      "DATABASE_ERROR",
      error.message
    );
    res.status(500).json({ error: error.message });
  }
});

const MANUAL_CORRECT_ALLOWED_STATUSES = ["EXCEPTION", "UNDER_REVIEW", "RESOLVED", "SIGNED_OFF", "ARRIVED"];

app.put("/api/boxes/:boxId/manual-correct", async (req, res) => {
  try {
    const { boxId } = req.params;
    const { newStatus, operator, reason, targetTempMin, targetTempMax } = req.body;
    
    if (!operator) {
      await writeExceptionLog(
        "/api/boxes/:boxId/manual-correct",
        { boxId, newStatus, operator, reason },
        "MISSING_REQUIRED_FIELDS",
        "缺少必填字段: operator（操作人）"
      );
      return res.status(400).json({ error: "缺少必填字段: operator（操作人）" });
    }
    if (!reason) {
      await writeExceptionLog(
        "/api/boxes/:boxId/manual-correct",
        { boxId, newStatus, operator, reason },
        "MISSING_REQUIRED_FIELDS",
        "缺少必填字段: reason（修正原因）"
      );
      return res.status(400).json({ error: "缺少必填字段: reason（修正原因）" });
    }
    
    const box = await new Promise(r => 
      db.get("SELECT * FROM cold_chain_boxes WHERE box_id = ?", [boxId], (e, row) => r(row))
    );
    if (!box) {
      await writeExceptionLog(
        "/api/boxes/:boxId/manual-correct",
        { boxId, newStatus, operator, reason },
        "BOX_NOT_FOUND",
        `冷链箱不存在: ${boxId}`
      );
      return res.status(404).json({ error: "冷链箱不存在" });
    }
    
    const now = new Date().toISOString();
    const correctedFields = [];
    
    if (targetTempMin !== undefined || targetTempMax !== undefined) {
      const updates = [];
      const params = [];
      if (targetTempMin !== undefined) {
        updates.push("target_temp_min = ?");
        params.push(targetTempMin);
        correctedFields.push("target_temp_min");
      }
      if (targetTempMax !== undefined) {
        updates.push("target_temp_max = ?");
        params.push(targetTempMax);
        correctedFields.push("target_temp_max");
      }
      updates.push("updated_at = ?");
      params.push(now, boxId);
      await new Promise(r => 
        db.run(`UPDATE cold_chain_boxes SET ${updates.join(", ")} WHERE box_id = ?`, params, r)
      );
    }
    
    if (newStatus) {
      if (!MANUAL_CORRECT_ALLOWED_STATUSES.includes(newStatus)) {
        await writeExceptionLog(
          "/api/boxes/:boxId/manual-correct",
          { boxId, newStatus, operator, reason },
          "MANUAL_CORRECT_DENIED",
          `人工修正不允许设置状态: ${newStatus}`,
          { allowedStatuses: MANUAL_CORRECT_ALLOWED_STATUSES }
        );
        return res.status(400).json({ 
          error: "人工修正不允许设置该状态",
          requestedStatus: newStatus,
          allowedStatuses: MANUAL_CORRECT_ALLOWED_STATUSES
        });
      }
      
      await new Promise(r => 
        db.run("UPDATE cold_chain_boxes SET current_status = ?, updated_at = ? WHERE box_id = ?", 
          [newStatus, now, boxId], r)
      );
      await new Promise(r => 
        db.run("INSERT INTO status_history VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [uuidv4(), boxId, box.current_status, newStatus, "MANUAL_CORRECT", 
           operator, reason, now], r)
      );
      correctedFields.push("current_status");
    }
    
    if (correctedFields.length === 0) {
      return res.status(400).json({ error: "没有指定要修正的字段" });
    }
    
    res.json({ 
      message: "人工修正成功", 
      data: { boxId, correctedFields, operator, reason, correctedAt: now }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/boxes/:boxId/review", async (req, res) => {
  try {
    const { boxId } = req.params;
    const { exceptionType, exceptionDescription, detectedTime, reviewer, operator } = req.body;
    
    if (!exceptionType || !exceptionDescription) {
      await writeExceptionLog(
        "/api/boxes/:boxId/review",
        { boxId, exceptionType, exceptionDescription, reviewer },
        "MISSING_REQUIRED_FIELDS",
        "缺少必填字段: exceptionType, exceptionDescription"
      );
      return res.status(400).json({ error: "缺少必填字段: exceptionType, exceptionDescription" });
    }
    
    const box = await new Promise(r => 
      db.get("SELECT * FROM cold_chain_boxes WHERE box_id = ?", [boxId], (e, row) => r(row))
    );
    if (!box) {
      await writeExceptionLog(
        "/api/boxes/:boxId/review",
        { boxId, exceptionType, exceptionDescription, reviewer },
        "BOX_NOT_FOUND",
        `冷链箱不存在: ${boxId}`
      );
      return res.status(404).json({ error: "冷链箱不存在" });
    }
    
    const reviewId = uuidv4();
    const now = new Date().toISOString();
    
    await new Promise(r => 
      db.run(`INSERT INTO exception_reviews 
        (review_id, box_id, exception_type, exception_description, detected_time, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [reviewId, boxId, exceptionType, exceptionDescription, detectedTime || now, now, now], r)
    );
    
    if (box.current_status !== "EXCEPTION" && box.current_status !== "UNDER_REVIEW") {
      await new Promise(r => 
        db.run("UPDATE cold_chain_boxes SET current_status = ?, updated_at = ? WHERE box_id = ?", 
          ["EXCEPTION", now, boxId], r)
      );
      await new Promise(r => 
        db.run("INSERT INTO status_history VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [uuidv4(), boxId, box.current_status, "EXCEPTION", "MANUAL_EXCEPTION", 
           operator || reviewer, exceptionDescription, now], r)
      );
    }
    
    res.json({ 
      message: "异常复核登记成功", 
      data: { reviewId, boxId, exceptionType }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/reviews/:reviewId/approve", async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reviewResult, reviewRemark, reviewer } = req.body;
    
    if (!reviewResult || !reviewer) {
      await writeExceptionLog(
        "/api/reviews/:reviewId/approve",
        { reviewId, reviewResult, reviewer },
        "MISSING_REQUIRED_FIELDS",
        "缺少必填字段: reviewResult, reviewer"
      );
      return res.status(400).json({ error: "缺少必填字段: reviewResult, reviewer" });
    }
    
    if (reviewResult !== "COMPENSATE" && reviewResult !== "DISMISS") {
      await writeExceptionLog(
        "/api/reviews/:reviewId/approve",
        { reviewId, reviewResult, reviewer },
        "INVALID_REVIEW_RESULT",
        `无效的复核结果: ${reviewResult}`,
        { allowedResults: ["COMPENSATE", "DISMISS"] }
      );
      return res.status(400).json({ 
        error: "无效的复核结果",
        allowedResults: ["COMPENSATE", "DISMISS"] 
      });
    }
    
    const review = await new Promise(r => 
      db.get("SELECT * FROM exception_reviews WHERE review_id = ?", [reviewId], (e, row) => r(row))
    );
    if (!review) {
      await writeExceptionLog(
        "/api/reviews/:reviewId/approve",
        { reviewId, reviewResult, reviewer },
        "REVIEW_NOT_FOUND",
        `复核记录不存在: ${reviewId}`
      );
      return res.status(404).json({ error: "复核记录不存在" });
    }
    
    const box = await new Promise(r => 
      db.get("SELECT * FROM cold_chain_boxes WHERE box_id = ?", [review.box_id], (e, row) => r(row))
    );
    
    const now = new Date().toISOString();
    await new Promise(r => 
      db.run(`UPDATE exception_reviews 
        SET review_result = ?, review_remark = ?, reviewer = ?, review_time = ?, updated_at = ?
        WHERE review_id = ?`,
        [reviewResult, reviewRemark, reviewer, now, now, reviewId], r)
    );
    
    let newStatus = box.current_status;
    if (reviewResult === "COMPENSATE") {
      newStatus = "UNDER_REVIEW";
    } else if (reviewResult === "DISMISS") {
      newStatus = "RESOLVED";
    }
    
    if (box.current_status !== newStatus) {
      await new Promise(r => 
        db.run("UPDATE cold_chain_boxes SET current_status = ?, updated_at = ? WHERE box_id = ?", 
          [newStatus, now, review.box_id], r)
      );
      await new Promise(r => 
        db.run("INSERT INTO status_history VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [uuidv4(), review.box_id, box.current_status, newStatus, "REVIEW_APPROVE", 
           reviewer, reviewRemark || `复核结果: ${reviewResult}`, now], r)
      );
    }
    
    res.json({ 
      message: "复核审批完成", 
      data: { reviewId, reviewResult, newStatus }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/boxes/:boxId/reviews", (req, res) => {
  const { boxId } = req.params;
  db.all("SELECT * FROM exception_reviews WHERE box_id = ? ORDER BY created_at DESC", [boxId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

app.post("/api/reviews/:reviewId/compensation", async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { compensationType, compensationAmount, responsibleParty, conclusionRemark, approvedBy } = req.body;
    
    if (!compensationType || compensationAmount === undefined) {
      await writeExceptionLog(
        "/api/reviews/:reviewId/compensation",
        { reviewId, compensationType, compensationAmount, approvedBy },
        "MISSING_REQUIRED_FIELDS",
        "缺少必填字段: compensationType, compensationAmount"
      );
      return res.status(400).json({ error: "缺少必填字段: compensationType, compensationAmount" });
    }
    
    const review = await new Promise(r => 
      db.get("SELECT * FROM exception_reviews WHERE review_id = ?", [reviewId], (e, row) => r(row))
    );
    if (!review) {
      await writeExceptionLog(
        "/api/reviews/:reviewId/compensation",
        { reviewId, compensationType, compensationAmount, approvedBy },
        "REVIEW_NOT_FOUND",
        `复核记录不存在: ${reviewId}`
      );
      return res.status(404).json({ error: "复核记录不存在" });
    }
    
    const existingConclusion = await new Promise(r => 
      db.get("SELECT * FROM compensation_conclusions WHERE review_id = ?", [reviewId], (e, row) => r(row))
    );
    if (existingConclusion) {
      await writeExceptionLog(
        "/api/reviews/:reviewId/compensation",
        { reviewId, compensationType, compensationAmount, approvedBy },
        "DUPLICATE_COMPENSATION",
        `该复核已存在赔付结论: ${reviewId}`
      );
      return res.status(400).json({ error: "该复核已存在赔付结论", data: existingConclusion });
    }
    
    const conclusionId = uuidv4();
    const now = new Date().toISOString();
    
    await new Promise(r => 
      db.run(`INSERT INTO compensation_conclusions 
        (conclusion_id, box_id, review_id, compensation_type, compensation_amount, 
         responsible_party, conclusion_remark, approved_by, approval_time, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [conclusionId, review.box_id, reviewId, compensationType, compensationAmount,
         responsibleParty || "", conclusionRemark || "", approvedBy || "", now, now], r)
    );
    
    const box = await new Promise(r => 
      db.get("SELECT current_status FROM cold_chain_boxes WHERE box_id = ?", [review.box_id], (e, row) => r(row))
    );
    
    if (box.current_status !== "COMPENSATED") {
      await new Promise(r => 
        db.run("UPDATE cold_chain_boxes SET current_status = ?, updated_at = ? WHERE box_id = ?", 
          ["COMPENSATED", now, review.box_id], r)
      );
      await new Promise(r => 
        db.run("INSERT INTO status_history VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [uuidv4(), review.box_id, box.current_status, "COMPENSATED", "COMPENSATION", 
           approvedBy, `赔付类型: ${compensationType}, 金额: ${compensationAmount}`, now], r)
      );
    }
    
    res.json({ 
      message: "赔付结论生成成功", 
      data: { conclusionId, compensationType, compensationAmount }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/boxes/:boxId/compensation", (req, res) => {
  const { boxId } = req.params;
  db.get("SELECT * FROM compensation_conclusions WHERE box_id = ?", [boxId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: row });
  });
});

app.get("/api/export/exceptions", (req, res) => {
  const sql = `
    SELECT b.batch_no, b.product_type, b.current_status, 
           s.store_name, s.signoff_person, s.actual_temp
    FROM cold_chain_boxes b
    LEFT JOIN store_signoffs s ON b.box_id = s.box_id
    WHERE b.current_status = 'EXCEPTION' OR b.current_status = 'UNDER_REVIEW'
    ORDER BY b.updated_at DESC
  `;
  db.all(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const data = rows.map(row => ({
      ...row,
      当前状态: STATUS_NAMES[row.current_status] || row.current_status
    }));
    try {
      const parser = new Parser();
      const csv = parser.parse(data);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send("\uFEFF" + csv);
    } catch (e) {
      res.json({ data });
    }
  });
});

app.get("/api/boxes/:boxId/history", (req, res) => {
  db.all("SELECT * FROM status_history WHERE box_id = ? ORDER BY created_at DESC", 
    [req.params.boxId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      data: rows.map(h => ({
        ...h,
        from_status_name: STATUS_NAMES[h.from_status],
        to_status_name: STATUS_NAMES[h.to_status]
      }))
    });
  });
});

function initDatabase() {
  return new Promise((resolve) => {
    const tables = [
      "CREATE TABLE IF NOT EXISTS cold_chain_boxes (box_id TEXT PRIMARY KEY, batch_no TEXT NOT NULL UNIQUE, product_type TEXT NOT NULL, target_temp_min REAL NOT NULL DEFAULT 2, target_temp_max REAL NOT NULL DEFAULT 8, departure_warehouse TEXT, departure_time TEXT, estimated_arrival TEXT, current_status TEXT NOT NULL DEFAULT 'CREATED', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS temperature_samples (sample_id TEXT PRIMARY KEY, box_id TEXT NOT NULL, probe_id TEXT NOT NULL, temperature REAL NOT NULL, sample_time TEXT NOT NULL, location TEXT, created_at TEXT NOT NULL, FOREIGN KEY (box_id) REFERENCES cold_chain_boxes(box_id))",
      "CREATE TABLE IF NOT EXISTS store_signoffs (signoff_id TEXT PRIMARY KEY, box_id TEXT NOT NULL UNIQUE, store_id TEXT NOT NULL, store_name TEXT NOT NULL, signoff_person TEXT NOT NULL, signoff_time TEXT NOT NULL, arrival_time TEXT NOT NULL, actual_temp REAL, signoff_remark TEXT, created_at TEXT NOT NULL, FOREIGN KEY (box_id) REFERENCES cold_chain_boxes(box_id))",
      "CREATE TABLE IF NOT EXISTS photo_credentials (photo_id TEXT PRIMARY KEY, box_id TEXT NOT NULL, photo_type TEXT NOT NULL, photo_url TEXT NOT NULL, photo_hash TEXT NOT NULL, upload_time TEXT NOT NULL, uploader TEXT, remark TEXT, created_at TEXT NOT NULL, FOREIGN KEY (box_id) REFERENCES cold_chain_boxes(box_id))",
      "CREATE TABLE IF NOT EXISTS exception_reviews (review_id TEXT PRIMARY KEY, box_id TEXT NOT NULL, exception_type TEXT NOT NULL, exception_description TEXT NOT NULL, detected_time TEXT NOT NULL, reviewer TEXT, review_time TEXT, review_result TEXT, review_remark TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (box_id) REFERENCES cold_chain_boxes(box_id))",
      "CREATE TABLE IF NOT EXISTS compensation_conclusions (conclusion_id TEXT PRIMARY KEY, box_id TEXT NOT NULL UNIQUE, review_id TEXT NOT NULL, compensation_type TEXT NOT NULL, compensation_amount REAL DEFAULT 0, responsible_party TEXT, conclusion_remark TEXT, approved_by TEXT, approval_time TEXT, created_at TEXT NOT NULL, FOREIGN KEY (box_id) REFERENCES cold_chain_boxes(box_id), FOREIGN KEY (review_id) REFERENCES exception_reviews(review_id))",
      "CREATE TABLE IF NOT EXISTS status_history (history_id TEXT PRIMARY KEY, box_id TEXT NOT NULL, from_status TEXT NOT NULL, to_status TEXT NOT NULL, operation_type TEXT NOT NULL, operator TEXT, remark TEXT, created_at TEXT NOT NULL, FOREIGN KEY (box_id) REFERENCES cold_chain_boxes(box_id))",
      "CREATE TABLE IF NOT EXISTS exception_logs (log_id TEXT PRIMARY KEY, request_id TEXT NOT NULL, api_path TEXT NOT NULL, original_input TEXT NOT NULL, error_type TEXT NOT NULL, error_message TEXT NOT NULL, processing_result TEXT, created_at TEXT NOT NULL)"
    ];
    let completed = 0;
    tables.forEach(sql => db.run(sql, () => {
      if (++completed === tables.length) resolve();
    }));
  });
}

async function seedSampleData() {
  console.log("正在创建样例数据...");
  const samples = [
    { batchNo: "CC-2024-001", productType: "疫苗", min: 2, max: 8 },
    { batchNo: "CC-2024-002", productType: "生鲜食品", min: -18, max: -10 }
  ];
  for (const s of samples) {
    try {
      const boxId = uuidv4();
      const now = new Date().toISOString();
      await new Promise(r => 
        db.run("INSERT OR IGNORE INTO cold_chain_boxes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [boxId, s.batchNo, s.productType, s.min, s.max, "", "", "", "ARRIVED", now, now], r)
      );
      await new Promise(r => 
        db.run("INSERT OR IGNORE INTO temperature_samples VALUES (?, ?, ?, ?, ?, ?, ?)",
          [uuidv4(), boxId, "PROBE-001", 5.5, now, "门店", now], r)
      );
      console.log(`  ✓ 样例数据: ${s.batchNo}`);
    } catch(e) {
      console.log(`  - 已存在: ${s.batchNo}`);
    }
  }
}

initDatabase().then(() => seedSampleData()).then(() => {
  app.listen(PORT, () => {
    console.log("\n冷链温控签收 API 服务已启动");
    console.log(`服务地址: http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/api/health`);
    console.log("\n核心 API 接口列表:");
    console.log("  POST   /api/boxes                    - 创建冷链箱");
    console.log("  GET    /api/boxes                    - 查询冷链箱列表");
    console.log("  GET    /api/boxes/:id                - 查询冷链箱详情");
    console.log("  POST   /api/boxes/:id/status         - 状态推进");
    console.log("  POST   /api/boxes/:id/temperature    - 温度采样上传");
    console.log("  POST   /api/boxes/:id/signoff        - 门店签收(状态机校验)");
    console.log("  POST   /api/boxes/:id/photo          - 照片凭证上传");
    console.log("  PUT    /api/boxes/:id/manual-correct - 人工修正(白名单限制)");
    console.log("  GET    /api/boxes/:id/history        - 状态历史");
    console.log("\n异常复核 & 赔付流程:");
    console.log("  POST   /api/boxes/:id/review         - 登记异常复核");
    console.log("  GET    /api/boxes/:id/reviews        - 查询复核记录");
    console.log("  POST   /api/reviews/:id/approve      - 复核审批(COMPENSATE/DISMISS)");
    console.log("  POST   /api/reviews/:id/compensation - 生成赔付结论");
    console.log("  GET    /api/boxes/:id/compensation   - 查询赔付结论");
    console.log("  GET    /api/export/exceptions        - 导出异常报告(CSV)");
    console.log("\n状态流转: CREATED → IN_TRANSIT → ARRIVED → SIGNED_OFF → COMPLETED");
    console.log("  异常链路: → EXCEPTION → [登记复核] → UNDER_REVIEW → [复核审批] →");
    console.log("           → COMPENSATED → [生成赔付] → COMPLETED");
    console.log("           → 或 DISMISS → RESOLVED → COMPLETED");
  });
});