const express = require('express');
const router = express.Router();
const exportService = require('../services/exportService');

router.post('/:formId', async (req, res) => {
  try {
    const exportResult = await exportService.exportSubmissions(
      req.params.formId,
      {
        mode: req.body.mode || req.query.mode,
        targetVersion: req.body.targetVersion ? parseInt(req.body.targetVersion) : undefined,
        submissionVersion: req.body.submissionVersion ? parseInt(req.body.submissionVersion) : undefined
      }
    );

    const format = req.query.format || req.body.format || 'json';

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="form_${req.params.formId}_export.csv"`
      );
      
      const csv = convertToCsv(exportResult.rawData);
      res.send(csv);
    } else {
      res.json(exportResult);
    }
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
});

router.post('/:formId/compare', async (req, res) => {
  try {
    const originalExport = await exportService.exportSubmissions(
      req.params.formId,
      { mode: 'original' }
    );

    const latestExport = await exportService.exportSubmissions(
      req.params.formId,
      { mode: 'latest' }
    );

    res.json({
      originalExport,
      latestExport,
      comparison: {
        totalSubmissions: originalExport.exportInfo.summary.totalSubmissions,
        originalMode: {
          criticalGaps: originalExport.exportInfo.summary.issues.criticalGaps,
          errors: originalExport.exportInfo.summary.issues.errors,
          warnings: originalExport.exportInfo.summary.issues.warnings
        },
        latestMode: {
          criticalGaps: latestExport.exportInfo.summary.issues.criticalGaps,
          errors: latestExport.exportInfo.summary.issues.errors,
          warnings: latestExport.exportInfo.summary.issues.warnings
        },
        fieldDifferencesCount: {
          allGaps: latestExport.migrationGaps.length,
          criticalGaps: latestExport.migrationGaps.filter(g => 
            g.gaps.some(gap => gap.severity === 'critical')
          ).length
        }
      }
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
});

function convertToCsv(rawData) {
  const { headers, rows } = rawData;
  
  const escapeCsv = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.map(h => escapeCsv(h)).join(',');
  const dataRows = rows.map(row => 
    headers.map(h => escapeCsv(row[h])).join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}

module.exports = router;