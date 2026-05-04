const express = require('express');
const exportService = require('../services/exportService');

const router = express.Router();

router.get('/markdown', async (req, res) => {
  try {
    const { date, download } = req.query;
    const result = await exportService.exportMarkdown(date);

    if (!result.success) {
      return res.status(500).json(result);
    }

    if (download === 'true') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${result.fileName}`);
      res.send(result.content);
    } else {
      res.json({
        success: true,
        fileName: result.fileName,
        filePath: result.filePath,
        content: result.content
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/json', async (req, res) => {
  try {
    const { date, download } = req.query;
    const result = await exportService.exportJsonAudit(date);

    if (!result.success) {
      return res.status(500).json(result);
    }

    if (download === 'true') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${result.fileName}`);
      res.json(result.content);
    } else {
      res.json({
        success: true,
        fileName: result.fileName,
        filePath: result.filePath,
        content: result.content
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/both', async (req, res) => {
  try {
    const { date } = req.query;
    const result = await exportService.exportBoth(date);

    res.json({
      success: result.success,
      markdown: {
        fileName: result.markdown.fileName,
        filePath: result.markdown.filePath
      },
      json: {
        fileName: result.json.fileName,
        filePath: result.json.filePath
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/release-decision', async (req, res) => {
  try {
    const auditPackage = exportService.generateJsonAuditPackage();
    const releaseDecision = auditPackage.releaseDecision;

    res.json({
      success: true,
      ...releaseDecision
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
