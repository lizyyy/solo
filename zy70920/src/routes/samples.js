const express = require("express");
const router = express.Router();
const { runQuery, getQuery, allQuery } = require("../models/database");

router.get("/", async (req, res) => {
  try {
    const { sampleNo, sampleName, status, recheckResult } = req.query;
    let sql = "SELECT s.*, b.batch_no FROM samples s LEFT JOIN batches b ON s.batch_id = b.id WHERE 1=1";
    const params = [];
    if (sampleNo) { sql += " AND s.sample_no LIKE ?"; params.push("%"+sampleNo+"%"); }
    if (sampleName) { sql += " AND s.sample_name LIKE ?"; params.push("%"+sampleName+"%"); }
    if (status) { sql += " AND s.status = ?"; params.push(status); }
    if (recheckResult) { sql += " AND s.recheck_result = ?"; params.push(recheckResult); }
    sql += " ORDER BY s.created_at DESC";
    const samples = await allQuery(sql, params);
    res.json({ success: true, data: samples, count: samples.length });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const sample = await getQuery("SELECT * FROM samples WHERE id = ?", [req.params.id]);
    if (!sample) return res.status(404).json({ success: false, error: "Not found" });
    const logs = await allQuery("SELECT * FROM operation_logs WHERE sample_id = ? ORDER BY operation_time DESC", [req.params.id]);
    res.json({ success: true, data: { sample, logs } });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/:id/mixed", async (req, res) => {
  try {
    const { reason, handler, relatedSamples } = req.body;
    await runQuery("UPDATE samples SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", ["mixed", req.params.id]);
    const detail = "Sample mixed: " + reason + ". Related samples: " + (relatedSamples || "none");
    await runQuery(
      "INSERT INTO operation_logs (sample_id, operation_type, reason, handler, old_status, new_status, detail) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [req.params.id, "sample_mixed", reason, handler || "system", "pending", "mixed", detail]
    );
    res.json({ success: true, data: { sampleId: req.params.id, status: "mixed" } });
  } catch(e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post("/:id/recheck", async (req, res) => {
  try {
    const { reason, handler } = req.body;
    await runQuery("UPDATE samples SET status = ?, recheck_count = recheck_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", ["rechecking", req.params.id]);
    await runQuery(
      "INSERT INTO operation_logs (sample_id, operation_type, reason, handler, new_status, detail) VALUES (?, ?, ?, ?, ?, ?)",
      [req.params.id, "recheck_request", reason, handler || "system", "rechecking", "Recheck requested: "+reason]
    );
    res.json({ success: true, data: { sampleId: req.params.id, status: "rechecking" } });
  } catch(e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post("/:id/recheck-result", async (req, res) => {
  try {
    const { result, handler, detail } = req.body;
    const newStatus = result === "passed" ? "passed" : "failed";
    await runQuery("UPDATE samples SET status = ?, recheck_result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [newStatus, result, req.params.id]);
    await runQuery(
      "INSERT INTO operation_logs (sample_id, operation_type, reason, handler, new_status, detail) VALUES (?, ?, ?, ?, ?, ?)",
      [req.params.id, "recheck_result", "Recheck completed", handler || "system", newStatus, detail || ""]
    );
    res.json({ success: true, data: { sampleId: req.params.id, recheckResult: result } });
  } catch(e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get("/:id/logs", async (req, res) => {
  try {
    const logs = await allQuery("SELECT * FROM operation_logs WHERE sample_id = ? ORDER BY operation_time DESC", [req.params.id]);
    res.json({ success: true, data: logs, count: logs.length });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
