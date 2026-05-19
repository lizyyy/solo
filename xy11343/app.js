const express = require('express');
const { initDatabase } = require('./database');
const logger = require('./logger');
const { dataMaskingMiddleware } = require('./middleware/dataMasking');
const { getAuditLogs } = require('./services/auditService');
const { exportClaims, exportReturns, exportVendorClaims, exportAuditLogs, exportDir } = require('./services/exportService');

const baseRoutes = require('./routes/base');
const operationRoutes = require('./routes/operations');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(dataMaskingMiddleware);

app.use('/api/base', baseRoutes);
app.use('/api/operations', operationRoutes);

app.get('/api/audit-logs', async (req, res) => {
  try {
    const logs = await getAuditLogs(req.query);
    res.json({ success: true, data: logs });
  } catch (err) {
    logger.error('Failed to get audit logs', { error: err.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/api/export/claims', async (req, res) => {
  try {
    const result = await exportClaims(req.body);
    res.json({
      success: true,
      message: `Exported ${result.count} claims`,
      data: {
        filename: result.filename,
        download_url: `/exports/${result.filename}`
      }
    });
  } catch (err) {
    logger.error('Failed to export claims', { error: err.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/api/export/returns', async (req, res) => {
  try {
    const result = await exportReturns(req.body);
    res.json({
      success: true,
      message: `Exported ${result.count} returns`,
      data: {
        filename: result.filename,
        download_url: `/exports/${result.filename}`
      }
    });
  } catch (err) {
    logger.error('Failed to export returns', { error: err.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/api/export/vendor-claims', async (req, res) => {
  try {
    const result = await exportVendorClaims(req.body);
    res.json({
      success: true,
      message: `Exported ${result.count} vendor claims`,
      data: {
        filename: result.filename,
        download_url: `/exports/${result.filename}`
      }
    });
  } catch (err) {
    logger.error('Failed to export vendor claims', { error: err.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/api/export/audit-logs', async (req, res) => {
  try {
    const result = await exportAuditLogs(req.body);
    res.json({
      success: true,
      message: `Exported ${result.count} audit logs`,
      data: {
        filename: result.filename,
        download_url: `/exports/${result.filename}`
      }
    });
  } catch (err) {
    logger.error('Failed to export audit logs', { error: err.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.use('/exports', express.static(exportDir));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

app.get('/api/docs', (req, res) => {
  res.json({
    success: true,
    data: {
      base_url: `http://localhost:${PORT}/api`,
      endpoints: {
        base: {
          'POST /base/parts': 'Create a new part (requires request_id)',
          'GET /base/parts': 'List parts with optional filters (part_code, part_name, limit)',
          'POST /base/engineers': 'Create a new engineer (requires request_id)',
          'GET /base/engineers': 'List engineers with optional filters (engineer_code, engineer_name, limit)'
        },
        operations: {
          'POST /operations/claim': 'Create a new claim (idempotent, requires request_id)',
          'POST /operations/installation': 'Create installation record (idempotent, requires request_id)',
          'POST /operations/return': 'Create return record (idempotent, requires request_id)',
          'POST /operations/vendor-claim': 'Create vendor claim (idempotent, requires request_id)',
          'POST /operations/write-off': 'Create write-off record (idempotent, requires request_id)',
          'GET /operations/claims': 'List claims with optional filters',
          'GET /operations/returns': 'List returns with optional filters',
          'GET /operations/vendor-claims': 'List vendor claims with optional filters'
        },
        audit: {
          'GET /audit-logs': 'List audit logs with optional filters'
        },
        export: {
          'POST /export/claims': 'Export claims to CSV (with optional filters)',
          'POST /export/returns': 'Export returns to CSV',
          'POST /export/vendor-claims': 'Export vendor claims to CSV',
          'POST /export/audit-logs': 'Export audit logs to CSV'
        }
      },
      notes: {
        idempotency: 'All POST operations require request_id in body or X-Request-Id header. Same request_id with same action will return cached result.',
        data_masking: 'Sensitive fields (phone, name, id_card, address) are automatically masked in all responses and exports.',
        local_persistence: 'All data is stored in local SQLite database file (warehouse.db) for persistence across server restarts.'
      }
    }
  });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const startServer = async () => {
  try {
    await initDatabase();
    logger.info('Database initialized successfully');
    
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`API Documentation: http://localhost:${PORT}/api/docs`);
      logger.info(`Health Check: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
};

startServer();
