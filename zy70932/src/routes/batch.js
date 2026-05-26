const express = require('express');
const router = express.Router();
const { importBatch } = require('../services/importService');

router.post('/', (req, res) => {
  try {
    const {
      batch_name,
      created_by,
      node_csv_path,
      photo_json_path,
      rectification_form_path,
      remark
    } = req.body;

    if (!batch_name) {
      return res.status(400).json({ error: '缺少必要参数: batch_name' });
    }
    if (!created_by) {
      return res.status(400).json({ error: '缺少必要参数: created_by' });
    }
    if (!node_csv_path) {
      return res.status(400).json({ error: '缺少必要参数: node_csv_path' });
    }
    if (!photo_json_path) {
      return res.status(400).json({ error: '缺少必要参数: photo_json_path' });
    }

    const result = importBatch({
      batchName: batch_name,
      createdBy: created_by,
      nodeCsvPath: node_csv_path,
      photoJsonPath: photo_json_path,
      rectificationFormPath: rectification_form_path,
      remark
    });

    res.json({
      success: true,
      batch_id: result.batchId,
      record_count: result.recordCount,
      record_ids: result.recordIds
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;