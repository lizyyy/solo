const fs = require('fs');

const content = `const express = require("express");
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
    await runQuery("UPDATE samples SET status = ?, mixed_note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", ["mixed", reason, req.params.id]);
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

router.post("/:id/withdraw", async (req, res) => {
  try {
    const { reason, handler } = req.body;
    await runQuery("UPDATE samples SET status = ?, recheck_result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", ["withdrawn", "withdrawn", req.params.id]);
    await runQuery(
      "INSERT INTO operation_logs (sample_id, operation_type, reason, handler, new_status, detail) VALUES (?, ?, ?, ?, ?, ?)",
      [req.params.id, "report_withdraw", reason, handler || "system", "withdrawn", "Sample withdrawn: " + reason]
    );
    res.json({ success: true, data: { sampleId: req.params.id, status: "withdrawn" } });
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

module.exports = router;`;
const logService = require('./logService');

const BATCH_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  RETURNED: 'returned',
  WITHDRAWN: 'withdrawn'
};

async function createBatch({batchNo, sender, receiveDate, remark, handler}) {
  const existing = await getQuery('SELECT id FROM batches WHERE batch_no = ?', [batchNo]);
  if (existing) {
    throw new Error(\`Batch number \${batchNo} already exists\`);
  }

  const sql = \`INSERT INTO batches (batch_no, sender, receive_date, remark, status) 
    VALUES (?, ?, ?, ?, ?)\`;
  
  const result = await runQuery(sql, [batchNo, sender, receiveDate, remark, BATCH_STATUS.PENDING]);
  
  await logService.createLog({
    batchId: result.lastID,
    operationType: logService.OPERATION_TYPES.BATCH_CREATE,
    reason: 'Create new batch',
    handler,
    newStatus: BATCH_STATUS.PENDING,
    detail: \`Sender: \${sender}, Receive date: \${receiveDate}\`
  });

  return { id: result.lastID, batchNo };
}

async function getBatchById(id) {
  return getQuery('SELECT * FROM batches WHERE id = ?', [id]);
}

async function getAllBatches({ status, keyword } = {}) {
  let sql = 'SELECT * FROM batches WHERE 1=1';
  const params = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (keyword) {
    sql += ' AND (batch_no LIKE ? OR sender LIKE ?)';
    params.push(\`\${keyword}%\`, \`%\${keyword}%\`);
  }

  sql += ' ORDER BY created_at DESC';
  return allQuery(sql, params);
}

async function updateBatchStatus(batchId, newStatus, { reason, handler, detail }) {
  const batch = await getBatchById(batchId);
  if (!batch) {
    throw new Error('Batch not found');
  }

  const oldStatus = batch.status;
  
  await runQuery(
    'UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newStatus, batchId]
  );

  let operationType;
  switch (newStatus) {
    case BATCH_STATUS.COMPLETED:
      operationType = logService.OPERATION_TYPES.BATCH_PROCESS;
      break;
    case BATCH_STATUS.RETURNED:
      operationType = logService.OPERATION_TYPES.BATCH_RETURN;
      break;
    case BATCH_STATUS.WITHDRAWN:
      operationType = logService.OPERATION_TYPES.BATCH_WITHDRAW;
      break;
    default:
      operationType = logService.OPERATION_TYPES.REMARK;
  }

  await logService.createLog({
    batchId,
    operationType,
    reason: reason || 'Status updated',
    handler,
    oldStatus,
    newStatus,
    detail: detail || 'Batch status updated successfully'
  });
}

async function markBatchProcessed(batchId, { reason, handler }) {
  return updateBatchStatus(batchId, BATCH_STATUS.COMPLETED, {
    reason,
    handler,
    detail: 'All samples tested and completed'
  });
}

async function returnBatchForRevision(batchId, { reason, handler }) {
  return updateBatchStatus(batchId, BATCH_STATUS.RETURNED, {
    reason,
    handler,
    detail: 'Batch returned for revision'
  });
}

async function withdrawBatch(batchId, { reason, handler }) {
  return updateBatchStatus(batchId, BATCH_STATUS.WITHDRAWN, {
    reason,
    handler,
    detail: 'Batch withdrawn'
  });
}

function getStatusDescription(status) {
  const descriptions = {
    'pending': 'Pending',
    'processing': 'Processing',
    'completed': 'Completed',
    'returned': 'Returned',
    'withdrawn': 'Withdrawn'
  };
  return descriptions[status] || status;
}

module.exports = {
  BATCH_STATUS,
  createBatch,
  getBatchById,
  getAllBatches,
  updateBatchStatus,
  markBatchProcessed,
  returnBatchForRevision,
  withdrawBatch,
  getStatusDescription
};`;

fs.writeFileSync('src/services/batchService.js', content);
console.log('batchService.js written successfully');
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
    await runQuery("UPDATE samples SET status = ?, mixed_note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", ["mixed", reason, req.params.id]);
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

router.post("/:id/withdraw", async (req, res) => {
  try {
    const { reason, handler } = req.body;
    await runQuery("UPDATE samples SET status = ?, recheck_result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", ["withdrawn", "withdrawn", req.params.id]);
    await runQuery(
      "INSERT INTO operation_logs (sample_id, operation_type, reason, handler, new_status, detail) VALUES (?, ?, ?, ?, ?, ?)",
      [req.params.id, "report_withdraw", reason, handler || "system", "withdrawn", "Sample withdrawn: " + reason]
    );
    res.json({ success: true, data: { sampleId: req.params.id, status: "withdrawn" } });
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
`;

fs.writeFileSync('src/routes/samples.js', content);
console.log('samples.js written successfully');
