const { createBatch, getBatchList, getBatchDetail, getStatistics } = require('../services/batchService');
const { exportBatchToCsv, exportStatisticsToCsv, getExportFilePath } = require('../services/exportService');

async function submitBatch(req, res) {
  try {
    const { batch_no, store_id, store_name, region, submit_date, processor, remark, records } = req.body;

    if (!batch_no || !store_id || !store_name || !region || !submit_date || !processor || !records || !records.length) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段：batch_no、store_id、store_name、region、submit_date、processor、records'
      });
    }

    const result = await createBatch(req.body);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('提交批次失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
}

async function listBatches(req, res) {
  try {
    const { region, store_id, start_date, end_date, page, pageSize } = req.query;
    const result = await getBatchList({
      region,
      store_id,
      start_date,
      end_date,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('查询批次列表失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
}

async function getBatch(req, res) {
  try {
    const { batchNo } = req.params;
    const detail = await getBatchDetail(batchNo);

    if (!detail) {
      return res.status(404).json({
        success: false,
        message: '批次不存在'
      });
    }

    res.json({
      success: true,
      data: detail
    });
  } catch (error) {
    console.error('查询批次详情失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
}

async function getStats(req, res) {
  try {
    const { region, store_id, start_date, end_date } = req.query;
    const stats = await getStatistics({ region, store_id, start_date, end_date });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('查询统计失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
}

async function exportBatch(req, res) {
  try {
    const { batchNo } = req.params;
    const result = await exportBatchToCsv(batchNo);

    res.json({
      success: true,
      data: {
        filename: result.filename,
        download_url: `/api/export/download/${result.filename}`,
        batch: result.batch,
        stats: result.stats,
        recordCount: result.recordCount
      }
    });
  } catch (error) {
    console.error('导出批次失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '导出失败',
      error: error.message
    });
  }
}

async function exportStats(req, res) {
  try {
    const { region, store_id, start_date, end_date } = req.query;
    const result = await exportStatisticsToCsv({ region, store_id, start_date, end_date });

    res.json({
      success: true,
      data: {
        filename: result.filename,
        download_url: `/api/export/download/${result.filename}`
      }
    });
  } catch (error) {
    console.error('导出统计失败:', error);
    res.status(500).json({
      success: false,
      message: '导出失败',
      error: error.message
    });
  }
}

function downloadExport(req, res) {
  try {
    const { filename } = req.params;
    const filePath = getExportFilePath(filename);

    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('下载文件失败:', err);
        res.status(500).json({
          success: false,
          message: '下载失败'
        });
      }
    });
  } catch (error) {
    console.error('下载导出文件失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
}

module.exports = {
  submitBatch,
  listBatches,
  getBatch,
  getStats,
  exportBatch,
  exportStats,
  downloadExport
};
