const express = require("express");
const router = express.Router();
const { runQuery, getQuery, allQuery } = require("../models/database");

router.get("/", async (req, res) => {
  try {
    const batches = await allQuery("SELECT * FROM batches ORDER BY created_at DESC");
    res.json({ success: true, data: batches, count: batches.length });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { batchNo, sender, receiveDate, remark, handler } = req.body;
    const result = await runQuery(
      "INSERT INTO batches (batch_no, sender, receive_date, remark, status) VALUES (?, ?, ?, ?, ?)",
      [batchNo, sender, receiveDate, remark, "pending"]
    );
    res.json({ success: true, data: { id: result.lastID, batchNo } });
  } catch(e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const batch = await getQuery("SELECT * FROM batches WHERE id = ?", [req.params.id]);
    if (!batch) return res.status(404).json({ success: false, error: "Not found" });
    const samples = await allQuery("SELECT * FROM samples WHERE batch_id = ?", [req.params.id]);
    const logs = await allQuery("SELECT * FROM operation_logs WHERE batch_id = ? ORDER BY operation_time DESC", [req.params.id]);
    res.json({ success: true, data: { batch, samples, logs } });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/:id/process", async (req, res) => {
  try {
    const { handler, remark } = req.body;
    await runQuery("UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", ["completed", req.params.id]);
    await runQuery(
      "INSERT INTO operation_logs (batch_id, operation_type, reason, handler, old_status, new_status, detail) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [req.params.id, "batch_process", "Processing completed", handler || "system", "pending", "completed", remark || ""]
    );
    res.json({ success: true, data: { batchId: req.params.id, status: "completed" } });
  } catch(e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post("/:id/return", async (req, res) => {
  try {
    const { reason, handler } = req.body;
    await runQuery("UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", ["returned", req.params.id]);
    await runQuery(
      "INSERT INTO operation_logs (batch_id, operation_type, reason, handler, old_status, new_status, detail) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [req.params.id, "batch_return", reason, handler || "system", "pending", "returned", reason]
    );
    res.json({ success: true, data: { batchId: req.params.id, status: "returned" } });
  } catch(e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post("/:id/withdraw", async (req, res) => {
  try {
    const { reason, handler } = req.body;
    await runQuery("UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", ["withdrawn", req.params.id]);
    await runQuery(
      "INSERT INTO operation_logs (batch_id, operation_type, reason, handler, old_status, new_status, detail) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [req.params.id, "batch_withdraw", reason, handler || "system", "pending", "withdrawn", reason]
    );
    res.json({ success: true, data: { batchId: req.params.id, status: "withdrawn" } });
  } catch(e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get("/:id/logs", async (req, res) => {
  try {
    const logs = await allQuery("SELECT * FROM operation_logs WHERE batch_id = ? ORDER BY operation_time DESC", [req.params.id]);
    res.json({ success: true, data: logs, count: logs.length });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
