const { runAsync, allAsync } = require('../config/database');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const { Readable } = require('stream');

const bulkImport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const results = [];
    const errors = [];
    let successCount = 0;

    const stream = Readable.from(req.file.buffer.toString());
    
    await new Promise((resolve) => {
      stream.pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve);
    });

    for (let i = 0; i < results.length; i++) {
      const row = results[i];
      try {
        if (!row.name || !row.endpoint || !row.method) {
          errors.push({ row: i + 1, error: 'Missing required fields (name, endpoint, method)' });
          continue;
        }

        await runAsync(
          `INSERT INTO api_entries (name, description, endpoint, method, status, permission_level, version)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            row.name,
            row.description || '',
            row.endpoint,
            row.method.toUpperCase(),
            row.status || 'draft',
            row.permission_level || 'internal',
            row.version || '1.0.0'
          ]
        );
        successCount++;
      } catch (error) {
        errors.push({ row: i + 1, error: error.message });
      }
    }

    res.json({
      success: true,
      data: {
        successCount,
        errorCount: errors.length,
        errors
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to process bulk import',
      details: error.message
    });
  }
};

const exportReport = async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    const apis = await allAsync(`
      SELECT a.*, o.name as owner_name, o.email as owner_email,
             (SELECT COUNT(*) FROM change_logs WHERE api_id = a.id) as change_count,
             (SELECT COUNT(*) FROM example_requests WHERE api_id = a.id AND is_active = 1) as example_count
      FROM api_entries a 
      LEFT JOIN owners o ON a.owner_id = o.id
      ORDER BY a.created_at DESC
    `);

    const reportData = {
      generatedAt: new Date().toISOString(),
      totalApis: apis.length,
      statusBreakdown: {
        draft: apis.filter(a => a.status === 'draft').length,
        reviewing: apis.filter(a => a.status === 'reviewing').length,
        active: apis.filter(a => a.status === 'active').length,
        deprecated: apis.filter(a => a.status === 'deprecated').length,
        archived: apis.filter(a => a.status === 'archived').length
      },
      apis
    };

    if (format === 'csv') {
      const fields = ['id', 'name', 'endpoint', 'method', 'status', 'owner_name', 'permission_level', 'version', 'created_at'];
      const json2csvParser = new Parser({ fields });
      const csvData = json2csvParser.parse(apis);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=api_catalog_report.csv');
      res.send(csvData);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=api_catalog_report.json');
      res.json(reportData);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate report',
      details: error.message
    });
  }
};

module.exports = {
  bulkImport,
  exportReport
};
