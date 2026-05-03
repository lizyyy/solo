import { Router } from 'express';
import { storageService } from '../services/storage.js';
import { evaluationEngine } from '../services/evaluationEngine.js';
import { auditService } from '../services/auditService.js';

const router = Router();

router.get('/export', async (req, res) => {
  try {
    const data = await storageService.exportAll();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=feature-flag-export-${Date.now()}.json`
    );
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/import', async (req, res) => {
  try {
    const data = req.body;
    
    if (!data.version || !data.exportedAt) {
      return res.status(400).json({ 
        error: 'Invalid import format. Missing version or exportedAt.' 
      });
    }

    await storageService.importAll(data);
    
    await auditService.log(
      'IMPORT',
      'SYSTEM',
      'all',
      null,
      { importedAt: new Date().toISOString() },
      '导入完整数据集'
    );
    
    res.json({ 
      success: true, 
      message: 'Import successful',
      imported: {
        users: data.users?.length || 0,
        segments: data.segments?.length || 0,
        flags: data.flags?.length || 0,
        audit: data.audit?.length || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
