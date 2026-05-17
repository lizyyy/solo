import express from 'express';
import { Parser } from 'json2csv';
import * as milestoneService from '../services/milestoneService';
import * as extensionService from '../services/extensionService';
import * as historyService from '../services/historyService';
import { getDB } from '../db';

const router = express.Router();

router.get('/milestones', async (req, res) => {
  try {
    const projectId = req.query.project_id ? Number(req.query.project_id) : null;
    let milestones;
    if (projectId) {
      milestones = await milestoneService.getMilestonesByProject(projectId);
    } else {
      const db = await getDB();
      milestones = await db.all('SELECT * FROM milestones ORDER BY planned_date');
    }
    
    const csv = new Parser().parse(milestones);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=milestones.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/extensions', async (req, res) => {
  try {
    const extensions = await extensionService.getAllExtensions();
    const csv = new Parser().parse(extensions);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=extensions.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const history = await historyService.getAllHistory();
    const csv = new Parser().parse(history);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=history.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
