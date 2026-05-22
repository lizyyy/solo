const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const csv = require("csv-parser");
const { Parser } = require("json2csv");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const { initDatabase, runQuery, runInsert, runUpdate } = require("./database/database");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const uploadDir = path.join(__dirname, "../uploads");
try { if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true }); } catch(e) {}

const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, uploadDir); },
  filename: (req, file, cb) => { cb(null, Date.now() + "-" + file.originalname); }
});
const upload = multer({ storage: storage });

async function logOperation(operator, operation, targetType, targetId, detail) {
  const id = uuidv4();
  await runInsert("INSERT INTO operation_logs (id, operator, operation, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?, ?)", [id, operator, operation, targetType, targetId, detail]);
}

app.post("/api/batches", async (req, res) => {
  try {
    const { batch_no, name, handler, remark, operator } = req.body;
    const id = uuidv4();
    await runInsert("INSERT INTO batches (id, batch_no, name, handler, remark) VALUES (?, ?, ?, ?, ?)", [id, batch_no, name, handler, remark]);
    await logOperation(operator || "system", "create_batch", "batch", id, "创建批次: " + batch_no);
    res.json({ success: true, data: { id, batch_no, name, status: "pending" } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/batches", async (req, res) => {
  try {
    const { status, handler, page = 1, pageSize = 20 } = req.query;
    let sql = "SELECT * FROM batches WHERE 1=1";
    let params = [];
    if (status) { sql += " AND status = ?"; params.push(status); }
    if (handler) { sql += " AND handler = ?"; params.push(handler); }
    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    const batches = await runQuery(sql, params);
    const countSql = "SELECT COUNT(*) as total FROM batches WHERE 1=1" + (status ? " AND status = ?" : "") + (handler ? " AND handler = ?" : "");
    const countParams = [];
    if (status) countParams.push(status);
    if (handler) countParams.push(handler);
    const countResult = await runQuery(countSql, countParams);
    res.json({ success: true, data: batches, total: countResult[0].total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/batches/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const batches = await runQuery("SELECT * FROM batches WHERE id = ?", [id]);
    if (batches.length === 0) {
      return res.status(404).json({ success: false, error: "批次不存在" });
    }
    res.json({ success: true, data: batches[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put("/api/batches/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, operator } = req.body;
    const validStatuses = ["pending", "processing", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: "无效的状态值" });
    }
    const changes = await runUpdate("UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [status, id]);
    if (changes === 0) {
      return res.status(404).json({ success: false, error: "批次不存在" });
    }
    await logOperation(operator || "system", "update_batch_status", "batch", id, "更新状态为: " + status);
    res.json({ success: true, message: "状态更新成功" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/import/orders", upload.single("file"), async (req, res) => {
  try {
    const { batch_id, operator } = req.body;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: "请上传文件" });
    }
    const results = [];
    const errors = [];
    let successCount = 0;
    fs.createReadStream(file.path)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        for (const row of results) {
          try {
            const id = uuidv4();
            await runInsert("INSERT INTO orders (id, batch_id, order_no, charger_id, start_time, end_time, duration, electricity, amount, payment_channel, platform, user_id, car_no, raw_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
              id, batch_id, row.order_no || row["订单编号"], 
              row.charger_id || row["桩编号"], row.start_time || row["开始时间"], 
              row.end_time || row["结束时间"], parseInt(row.duration || row["时长"] || 0),
              parseFloat(row.electricity || row["电量"] || 0), 
              parseFloat(row.amount || row["金额"] || 0),
              row.payment_channel || row["支付渠道"], 
              row.platform || row["平台"],
              row.user_id || row["用户ID"], 
              row.car_no || row["车牌号"],
              JSON.stringify(row)
            ]);
            successCount++;
          } catch (err) {
            errors.push({ row, error: err.message });
          }
        }
        fs.unlinkSync(file.path);
        await logOperation(operator || "system", "import_orders", "batch", batch_id, "导入订单: 成功" + successCount + "条, 失败" + errors.length + "条");
        res.json({ success: true, message: "导入完成，成功" + successCount + "条", successCount, errorCount: errors.length, errors });
      });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/import/charger-logs", upload.single("file"), async (req, res) => {
  try {
    const { batch_id, operator } = req.body;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: "请上传文件" });
    }
    const content = fs.readFileSync(file.path, "utf8");
    const logs = JSON.parse(content);
    let successCount = 0;
    const errors = [];
    for (const log of Array.isArray(logs) ? logs : [logs]) {
      try {
        const id = uuidv4();
        await runInsert("INSERT INTO charger_logs (id, batch_id, log_no, charger_id, event_type, event_time, gun_no, start_kwh, end_kwh, status, error_code, raw_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
          id, batch_id, log.log_no || log["日志编号"], 
          log.charger_id || log["桩编号"], log.event_type || log["事件类型"],
          log.event_time || log["事件时间"], log.gun_no || log["枪号"],
          parseFloat(log.start_kwh || log["起始电量"] || 0),
          parseFloat(log.end_kwh || log["结束电量"] || 0),
          log.status || log["状态"], log.error_code || log["错误码"],
          JSON.stringify(log)
        ]);
        successCount++;
      } catch (err) {
        errors.push({ log, error: err.message });
      }
    }
    fs.unlinkSync(file.path);
    await logOperation(operator || "system", "import_charger_logs", "batch", batch_id, "导入桩端日志: 成功" + successCount + "条, 失败" + errors.length + "条");
    res.json({ success: true, message: "导入完成，成功" + successCount + "条", successCount, errorCount: errors.length, errors });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/import/payment-receipts", upload.single("file"), async (req, res) => {
  try {
    const { batch_id, operator } = req.body;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: "请上传文件" });
    }
    const results = [];
    let successCount = 0;
    const errors = [];
    fs.createReadStream(file.path)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        for (const row of results) {
          try {
            const id = uuidv4();
            await runInsert("INSERT INTO payment_receipts (id, batch_id, receipt_no, order_no, transaction_id, amount, payment_method, payment_time, status, raw_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
              id, batch_id, row.receipt_no || row["回执编号"], 
              row.order_no || row["订单编号"], row.transaction_id || row["交易流水号"],
              parseFloat(row.amount || row["金额"] || 0),
              row.payment_method || row["支付方式"], 
              row.payment_time || row["支付时间"],
              row.status || row["状态"],
              JSON.stringify(row)
            ]);
            successCount++;
          } catch (err) {
            errors.push({ row, error: err.message });
          }
        }
        fs.unlinkSync(file.path);
        await logOperation(operator || "system", "import_payment_receipts", "batch", batch_id, "导入支付回执: 成功" + successCount + "条, 失败" + errors.length + "条");
        res.json({ success: true, message: "导入完成，成功" + successCount + "条", successCount, errorCount: errors.length, errors });
      });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/orders/:id/process", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, handler, reason, remark, operator } = req.body;
    const processId = uuidv4();
    await runInsert("INSERT INTO processing_records (id, order_id, status, handler, reason, remark) VALUES (?, ?, ?, ?, ?, ?)", [processId, id, status, handler, reason, remark]);
    await logOperation(operator || handler || "system", "process_order", "order", id, "标记处理状态: " + status + ", 处理人: " + handler);
    res.json({ success: true, data: { id: processId, status, handler } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/orders/:id/exception", async (req, res) => {
  try {
    const { id } = req.params;
    const { batch_id, exception_type, description, handler, operator } = req.body;
    const exceptionId = uuidv4();
    await runInsert("INSERT INTO exception_records (id, order_id, batch_id, exception_type, description, handler) VALUES (?, ?, ?, ?, ?, ?)", [exceptionId, id, batch_id, exception_type, description, handler]);
    await logOperation(operator || handler || "system", "record_exception", "order", id, "记录异常: " + exception_type + ", 描述: " + description);
    res.json({ success: true, data: { id: exceptionId, exception_type, description } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/orders", async (req, res) => {
  try {
    const { charger_id, payment_channel, platform, handler, batch_id, start_date, end_date, page = 1, pageSize = 20 } = req.query;
    let sql = "SELECT o.*, (SELECT status FROM processing_records WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) as process_status, (SELECT handler FROM processing_records WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) as process_handler FROM orders o WHERE 1=1";
    let params = [];
    if (charger_id) { sql += " AND o.charger_id = ?"; params.push(charger_id); }
    if (payment_channel) { sql += " AND o.payment_channel = ?"; params.push(payment_channel); }
    if (platform) { sql += " AND o.platform = ?"; params.push(platform); }
    if (batch_id) { sql += " AND o.batch_id = ?"; params.push(batch_id); }
    if (start_date) { sql += " AND o.created_at >= ?"; params.push(start_date); }
    if (end_date) { sql += " AND o.created_at <= ?"; params.push(end_date); }
    const countSql = sql.replace("SELECT o.*, (SELECT status FROM processing_records WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) as process_status, (SELECT handler FROM processing_records WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) as process_handler FROM orders o", "SELECT COUNT(*) as total FROM orders o");
    const countResult = await runQuery(countSql, params);
    sql += " ORDER BY o.created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    const orders = await runQuery(sql, params);
    res.json({ success: true, data: orders, total: countResult[0].total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/export/orders", async (req, res) => {
  try {
    const { charger_id, payment_channel, platform, handler, batch_id, start_date, end_date } = req.query;
    let sql = "SELECT o.*, (SELECT status FROM processing_records WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) as process_status, (SELECT handler FROM processing_records WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) as process_handler FROM orders o WHERE 1=1";
    let params = [];
    if (charger_id) { sql += " AND o.charger_id = ?"; params.push(charger_id); }
    if (payment_channel) { sql += " AND o.payment_channel = ?"; params.push(payment_channel); }
    if (platform) { sql += " AND o.platform = ?"; params.push(platform); }
    if (batch_id) { sql += " AND o.batch_id = ?"; params.push(batch_id); }
    if (start_date) { sql += " AND o.created_at >= ?"; params.push(start_date); }
    if (end_date) { sql += " AND o.created_at <= ?"; params.push(end_date); }
    sql += " ORDER BY o.created_at DESC";
    const orders = await runQuery(sql, params);
    const fields = ["order_no", "charger_id", "start_time", "end_time", "duration", "electricity", "amount", "payment_channel", "platform", "user_id", "car_no", "process_status", "process_handler", "created_at"];
    const json2csvParser = new Parser({ fields });
    const csvData = json2csvParser.parse(orders);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=orders_" + Date.now() + ".csv");
    res.send("\uFEFF" + csvData);
    await logOperation("system", "export_orders", "order", null, "导出订单: " + orders.length + "条");
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/operation-logs", async (req, res) => {
  try {
    const { operator, operation, target_type, page = 1, pageSize = 20 } = req.query;
    let sql = "SELECT * FROM operation_logs WHERE 1=1";
    let params = [];
    if (operator) { sql += " AND operator = ?"; params.push(operator); }
    if (operation) { sql += " AND operation = ?"; params.push(operation); }
    if (target_type) { sql += " AND target_type = ?"; params.push(target_type); }
    const countSql = sql.replace("SELECT * FROM operation_logs", "SELECT COUNT(*) as total FROM operation_logs");
    const countResult = await runQuery(countSql, params);
    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    const logs = await runQuery(sql, params);
    res.json({ success: true, data: logs, total: countResult[0].total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/charger-logs", async (req, res) => {
  try {
    const { charger_id, batch_id, page = 1, pageSize = 20 } = req.query;
    let sql = "SELECT * FROM charger_logs WHERE 1=1";
    let params = [];
    if (charger_id) { sql += " AND charger_id = ?"; params.push(charger_id); }
    if (batch_id) { sql += " AND batch_id = ?"; params.push(batch_id); }
    const countSql = sql.replace("SELECT * FROM charger_logs", "SELECT COUNT(*) as total FROM charger_logs");
    const countResult = await runQuery(countSql, params);
    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    const logs = await runQuery(sql, params);
    res.json({ success: true, data: logs, total: countResult[0].total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/payment-receipts", async (req, res) => {
  try {
    const { order_no, batch_id, page = 1, pageSize = 20 } = req.query;
    let sql = "SELECT * FROM payment_receipts WHERE 1=1";
    let params = [];
    if (order_no) { sql += " AND order_no = ?"; params.push(order_no); }
    if (batch_id) { sql += " AND batch_id = ?"; params.push(batch_id); }
    const countSql = sql.replace("SELECT * FROM payment_receipts", "SELECT COUNT(*) as total FROM payment_receipts");
    const countResult = await runQuery(countSql, params);
    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    const receipts = await runQuery(sql, params);
    res.json({ success: true, data: receipts, total: countResult[0].total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/exception-records", async (req, res) => {
  try {
    const { status, batch_id, page = 1, pageSize = 20 } = req.query;
    let sql = "SELECT * FROM exception_records WHERE 1=1";
    let params = [];
    if (status) { sql += " AND status = ?"; params.push(status); }
    if (batch_id) { sql += " AND batch_id = ?"; params.push(batch_id); }
    const countSql = sql.replace("SELECT * FROM exception_records", "SELECT COUNT(*) as total FROM exception_records");
    const countResult = await runQuery(countSql, params);
    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    const exceptions = await runQuery(sql, params);
    res.json({ success: true, data: exceptions, total: countResult[0].total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "新能源客服后端服务运行正常" });
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log("新能源客服后端服务已启动，端口: " + PORT);
    console.log("健康检查: http://localhost:" + PORT + "/api/health");
  });
}).catch(err => {
  console.error("数据库初始化失败:", err);
});