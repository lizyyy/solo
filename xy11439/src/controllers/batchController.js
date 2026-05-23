const { getBatchById, getBatchList } = require('../models/batch');

function getBatch(req, res) {
  try {
    const { id } = req.params;
    const batch = getBatchById(id);
    if (!batch) {
      return res.status(404).json({ success: false, error: '批次不存在' });
    }
    res.json({ success: true, data: batch });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function listBatches(req, res) {
  try {
    const batches = getBatchList(req.query);
    res.json({ success: true, data: batches });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

module.exports = {
  getBatch,
  listBatches,
};
