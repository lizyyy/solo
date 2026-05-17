import express from 'express';
import * as extensionService from '../services/extensionService';
import * as historyService from '../services/historyService';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const extensions = await extensionService.getAllExtensions();
    res.json({ success: true, data: extensions });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const extension = await extensionService.getExtensionById(Number(req.params.id));
    if (!extension) {
      return res.status(404).json({ success: false, error: '延期申请不存在' });
    }
    const history = await historyService.getHistoryByEntity('extension_request', Number(req.params.id));
    res.json({ success: true, data: { ...extension, history } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await extensionService.createExtensionRequest(req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.errors });
    }
    res.json({ success: true, data: { id: result.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/:id/review', async (req, res) => {
  try {
    const operator = req.headers['x-operator'] as string || 'system';
    const result = await extensionService.reviewExtensionRequest(
      Number(req.params.id),
      req.body.status,
      operator,
      req.body.comment
    );
    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.errors });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/validate', async (req, res) => {
  try {
    const errors = await extensionService.validateExtensionRequest(req.body);
    res.json({ success: errors.length === 0, errors });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
