import { Router } from 'express';
import { ExportService } from '../services/exportService.js';

const router = Router();

router.get('/duty-sheet', (req, res) => {
  try {
    const result = ExportService.exportMarkdownDutySheet();
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.send(result.content);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/ship-list', (req, res) => {
  try {
    const { batch_id } = req.query;
    const result = ExportService.exportCsvShipList(batch_id || null);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.send('\uFEFF' + result.content);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/audit-package', (req, res) => {
  try {
    const result = ExportService.exportJsonAuditPackage();
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.send(result.content);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/preview/duty-sheet', (req, res) => {
  try {
    const result = ExportService.exportMarkdownDutySheet();
    res.json({ 
      success: true, 
      data: {
        content: result.content,
        filename: result.filename
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/preview/ship-list', (req, res) => {
  try {
    const { batch_id } = req.query;
    const result = ExportService.exportCsvShipList(batch_id || null);
    res.json({ 
      success: true, 
      data: {
        content: result.content,
        filename: result.filename,
        message: result.message
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/preview/audit-package', (req, res) => {
  try {
    const result = ExportService.exportJsonAuditPackage();
    res.json({ 
      success: true, 
      data: {
        content: result.content,
        filename: result.filename,
        data: result.data
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
