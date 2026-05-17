import express from 'express';
import * as milestoneService from '../services/milestoneService';
import * as historyService from '../services/historyService';
import { getDB } from '../db';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const projectId = req.query.project_id ? Number(req.query.project_id) : null;
    let milestones;
    if (projectId) {
      milestones = await milestoneService.getMilestonesByProject(projectId);
    } else {
      const db = await getDB();
      milestones = await db.all('SELECT * FROM milestones ORDER BY planned_date');
    }
    res.json({ success: true, data: milestones });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const milestone = await milestoneService.getMilestoneById(Number(req.params.id));
    if (!milestone) {
      return res.status(404).json({ success: false, error: '里程碑不存在' });
    }
    const children = await milestoneService.getChildMilestones(Number(req.params.id));
    const history = await historyService.getHistoryByEntity('milestone', Number(req.params.id));
    res.json({ success: true, data: { ...milestone, children, history } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const history = await historyService.getHistoryByEntity('milestone', Number(req.params.id));
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/', async (req, res) => {
  try {
    const id = await milestoneService.createMilestone(req.body);
    res.json({ success: true, data: { id } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const operator = req.headers['x-operator'] as string || 'system';
    await milestoneService.updateMilestoneStatus(
      Number(req.params.id),
      req.body.status,
      operator,
      req.body.comment
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
