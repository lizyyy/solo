const express = require("express");
const router = express.Router();
const BatchService = require("../services/batchService");

router.post("/", async (req, res) => {
  try {
    const { store_code, store_name, operator, remark } = req.body;
    if (!store_code || !store_name || !operator) {
      return res.status(400).json({ error: "缺少必填字段", required: ["store_code", "store_name", "operator"] });
    }
    const batch = await BatchService.createBatch({ store_code, store_name, operator, remark });
    res.status(201).json({ success: true, data: batch, message: "批次创建成功" });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.page_size) || 20;
    const batches = await BatchService.getBatchList(page, pageSize);
    res.json({ success: true, data: batches, pagination: { page, page_size: pageSize } });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get("/:batchId", async (req, res) => {
  try {
    const batch = await BatchService.getBatchById(req.params.batchId);
    if (!batch) { return res.status(404).json({ success: false, error: "批次不存在" }); }
    res.json({ success: true, data: batch });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

module.exports = router;
