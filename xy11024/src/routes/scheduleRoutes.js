const express = require('express');
const csv = require('csv-parser');
const { Readable } = require('stream');
const dataStore = require('../store/dataStore');
const { v4: uuidv4 } = require('uuid');

const parseContraindications = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return lower === 'true' || lower === '是' || lower === '1';
  }
  return Boolean(value);
};

module.exports = (upload) => {
  const router = express.Router();

  router.post('/import', upload.single('file'), async (req, res) => {
    try {
      const batch = dataStore.createImportBatch();
      const batchId = batch.id;

      let results = [];
      let successCount = 0;
      let errorCount = 0;
      let warningCount = 0;

      if (req.file) {
        const fileContent = req.file.buffer.toString('utf8');
        results = await parseCsvStream(fileContent);
      } else if (req.body && Array.isArray(req.body.data)) {
        results = req.body.data.map((item, index) => ({
          ...item,
          rowNumber: index + 2
        }));
      } else if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
        results = [{ ...req.body, rowNumber: 2 }];
      } else {
        return res.status(400).json({
          success: false,
          message: '请上传CSV文件或在请求体中提供data数组'
        });
      }

      const importResults = [];

      for (const row of results) {
        const scheduleData = {
          ...row,
          importBatchId: batchId,
          rowNumber: row.rowNumber,
          contraindications: parseContraindications(row.contraindications),
          contraindicationsResolved: parseBoolean(row.contraindicationsResolved),
          reminderEnabled: parseBoolean(row.reminderEnabled)
        };

        const result = dataStore.addSchedule(scheduleData);
        
        const hasWarnings = result.errors && result.errors.some(e => e.severity === 'warning');
        const hasErrors = !result.success;

        if (hasErrors) {
          errorCount++;
        } else if (hasWarnings) {
          warningCount++;
          successCount++;
        } else {
          successCount++;
        }

        importResults.push({
          rowNumber: row.rowNumber,
          originalData: row,
          success: result.success,
          schedule: result.schedule,
          errors: result.errors,
          needsManualReview: result.schedule?.needsManualReview || false
        });
      }

      dataStore.updateImportBatch(batchId, {
        totalRows: results.length,
        successRows: successCount,
        errorRows: errorCount,
        warningRows: warningCount
      });

      res.json({
        success: true,
        batchId: batchId,
        summary: {
          total: results.length,
          success: successCount,
          error: errorCount,
          warning: warningCount
        },
        results: importResults
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: '导入失败',
        error: error.message
      });
    }
  });

  router.post('/review', (req, res) => {
    try {
      const { scheduleData, manualNotes } = req.body;

      if (!scheduleData) {
        return res.status(400).json({
          success: false,
          message: '请提供排程数据'
        });
      }

      if (!manualNotes || manualNotes.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: '请填写人工审核备注'
        });
      }

      const result = dataStore.addScheduleWithReview(scheduleData, manualNotes);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: '审核后导入失败',
          errors: result.errors
        });
      }

      res.json({
        success: true,
        message: '人工审核通过，已成功导入',
        schedule: result.schedule
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: '审核处理失败',
        error: error.message
      });
    }
  });

  router.get('/batch/:batchId', (req, res) => {
    const { batchId } = req.params;
    const batch = dataStore.getBatch(batchId);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '批次不存在'
      });
    }

    const schedules = dataStore.getSchedulesByBatch(batchId);
    
    res.json({
      success: true,
      batch,
      schedules
    });
  });

  router.get('/export', (req, res) => {
    const { batchId } = req.query;
    const schedules = dataStore.exportSchedules(batchId);
    
    res.json({
      success: true,
      total: schedules.length,
      data: schedules
    });
  });

  router.get('/:id', (req, res) => {
    const schedule = dataStore.getSchedule(req.params.id);
    
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: '排程记录不存在'
      });
    }
    
    res.json({
      success: true,
      data: schedule
    });
  });

  router.patch('/:id/status', (req, res) => {
    const { status } = req.body;
    const result = dataStore.updateScheduleStatus(req.params.id, status);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  });

  router.get('/', (req, res) => {
    const schedules = dataStore.getAllSchedules();
    res.json({
      success: true,
      total: schedules.length,
      data: schedules
    });
  });

  return router;
};

function parseCsvStream(content) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(content);
    
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        resolve(results.map((row, index) => ({
          ...row,
          rowNumber: index + 2
        })));
      })
      .on('error', reject);
  });
}
