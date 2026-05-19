const { exportRecords } = require('../utils/exporter');

async function exportRecordsCSV(req, res) {
  try {
    const filters = req.query;
    const result = await exportRecords(filters);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=port_scheduling_records_${Date.now()}.csv`);
    
    res.send(result.csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getExportSummary(req, res) {
  try {
    const filters = req.query;
    const result = await exportRecords(filters);
    
    res.json({
      success: true,
      count: result.count,
      message: `Found ${result.count} records matching the criteria`,
      filters
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  exportRecordsCSV,
  getExportSummary
};
