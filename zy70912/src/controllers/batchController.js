const { createBatch, importClaimCSV, importFlightJSON, importPhotoIndex } = require('../services/importService');
const { getBatches, getBatchDetail } = require('../services/queryService');

async function createBatchHandler(req, res) {
  try {
    const { batch_no, name, created_by } = req.body;
    
    if (!batch_no || !name || !created_by) {
      return res.status(400).json({ error: '批次号、名称和创建人不能为空' });
    }

    const batchId = await createBatch(batch_no, name, created_by);
    res.json({ success: true, batch_id: batchId, batch_no });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function importCSVHandler(req, res) {
  try {
    const { batch_id } = req.body;
    const file = req.file;

    if (!batch_id || !file) {
      return res.status(400).json({ error: '批次ID和CSV文件不能为空' });
    }

    const claims = await importClaimCSV(file.path, batch_id);
    res.json({ success: true, imported: claims.length, claims });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function importFlightHandler(req, res) {
  try {
    const { batch_id, flight_data } = req.body;

    if (!batch_id || !flight_data) {
      return res.status(400).json({ error: '批次ID和航班数据不能为空' });
    }

    await importFlightJSON(flight_data, batch_id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function importPhotoHandler(req, res) {
  try {
    const { batch_id, photo_data } = req.body;

    if (!batch_id || !photo_data) {
      return res.status(400).json({ error: '批次ID和照片索引不能为空' });
    }

    await importPhotoIndex(photo_data, batch_id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function listBatchesHandler(req, res) {
  try {
    const batches = await getBatches();
    res.json({ success: true, data: batches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getBatchHandler(req, res) {
  try {
    const { id } = req.params;
    const batch = await getBatchDetail(id);
    
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    
    res.json({ success: true, data: batch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  createBatchHandler,
  importCSVHandler,
  importFlightHandler,
  importPhotoHandler,
  listBatchesHandler,
  getBatchHandler
};
