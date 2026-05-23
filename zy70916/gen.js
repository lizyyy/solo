const fs = require("fs");
const code = `const { run, get, all } = require("../models/database");
const helpers = require("../utils/helpers");
async function createBatch(name, createdBy) {
  const batchNo = helpers.generateBatchNo();
  const result = await run("INSERT INTO batches (batch_no, name, status, created_by) VALUES (?, ?, \"pending\", ?)", [batchNo, name, createdBy]);
  return getBatchById(result.lastID);
}
async function getBatchById(id) {
  return get("SELECT * FROM batches WHERE id = ?", [id]);
}
async function listBatches(filters = {}) {
  let query = "SELECT * FROM batches WHERE 1=1";
  const params = [];
  if (filters.status) { query += " AND status = ?"; params.push(filters.status); }
  query += " ORDER BY created_at DESC";
  return all(query, params);
}
module.exports = { createBatch, getBatchById, listBatches };
`;
fs.writeFileSync("src/services/batchService.js", code);
console.log("Done");