const express = require('express');
const router = express.Router();
const exportService = require('../services/exportService');

router.get('/handover/:artworkId', async (req, res) => {
  try {
    const { artworkId } = req.params;
    const { format } = req.query;
    
    const markdown = await exportService.generateMarkdownHandover(artworkId);
    
    if (format === 'download') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="handover-${artworkId}.md"`);
      res.send(markdown);
    } else {
      res.json({ success: true, data: { content: markdown } });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/handover-all', async (req, res) => {
  try {
    const { format } = req.query;
    
    const markdown = await exportService.generateAllHandoverNotes();
    
    if (format === 'download') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="handover-all.md"`);
      res.send(markdown);
    } else {
      res.json({ success: true, data: { content: markdown } });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/audit', async (req, res) => {
  try {
    const { artwork_id, format } = req.query;
    
    const auditPackage = await exportService.generateAuditPackage(artwork_id);
    
    if (format === 'download') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      const filename = artwork_id ? `audit-${artwork_id}.json` : 'audit-all.json';
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(JSON.stringify(auditPackage, null, 2));
    } else {
      res.json({ success: true, data: auditPackage });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
