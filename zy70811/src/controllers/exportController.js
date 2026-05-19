const { exportReport } = require('../services/exportService');
const path = require('path');
const fs = require('fs');

const exportBatchReport = async (req, res) => {
  const { batch_id, format } = req.query;

  if (!batch_id) {
    return res.status(400).json({ error: '批次ID不能为空' });
  }

  try {
    const result = await exportReport(batch_id, format || 'csv');
    res.json({
      success: true,
      message: '导出成功',
      filename: result.filename,
      download_url: `/api/exports/download/${result.filename}`,
      count: result.count,
      statistics: result.statistics
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const downloadReport = (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '../../exports', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '文件不存在' });
  }

  res.download(filePath, filename);
};

module.exports = {
  exportBatchReport,
  downloadReport
};
