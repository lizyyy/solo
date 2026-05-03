import { Router } from 'express';
import { auditService } from '../services/auditService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { entityType, action, limit, offset } = req.query;
    
    const options = {};
    if (entityType) options.entityType = entityType;
    if (action) options.action = action;
    if (limit) options.limit = parseInt(limit);
    if (offset) options.offset = parseInt(offset);
    
    const result = await auditService.getLogs(options);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/entity/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    
    const logs = await auditService.getLogsForEntity(entityType, entityId);
    
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/', async (req, res) => {
  try {
    await auditService.clearLogs();
    
    res.json({ success: true, message: 'Audit logs cleared' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
