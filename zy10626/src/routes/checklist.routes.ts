import express from 'express';
import { Readable } from 'stream';
import csvParser from 'csv-parser';
import {
  createChecklist,
  getChecklistById,
  queryChecklists,
  updateStatusToPendingRelease,
  releaseChecklist,
  rescheduleChecklist,
  getChecklistHistory,
  batchImport
} from '../services/checklist.service';
import { exportChecklistsToCSV, getExportTemplate } from '../services/export.service';
import { CheckListStatus, ReleaseReason } from '../types';

const router = express.Router();

router.use(express.json());

router.post('/', async (req, res) => {
  try {
    const checklist = await createChecklist(req.body);
    res.json({ success: true, data: checklist });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const checklist = await getChecklistById(req.params.id);
    if (!checklist) {
      return res.status(404).json({ success: false, error: '检查单不存在' });
    }
    res.json({ success: true, data: checklist });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await queryChecklists(req.query);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.patch('/:id/pending-release', async (req, res) => {
  try {
    const { operator, remark } = req.body;
    const checklist = await updateStatusToPendingRelease(req.params.id, operator, remark);
    res.json({ success: true, data: checklist });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.patch('/:id/release', async (req, res) => {
  try {
    const { releaseReason, operator, remark } = req.body;
    if (!Object.values(ReleaseReason).includes(releaseReason)) {
      return res.status(400).json({ success: false, error: '无效的释放原因' });
    }
    const checklist = await releaseChecklist(req.params.id, releaseReason, operator, remark);
    res.json({ success: true, data: checklist });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.patch('/:id/reschedule', async (req, res) => {
  try {
    const { newTimeSlotId, operator } = req.body;
    const checklist = await rescheduleChecklist(req.params.id, newTimeSlotId, operator);
    res.json({ success: true, data: checklist });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const history = await getChecklistHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/import', async (req, res) => {
  try {
    const { operator } = req.query;
    const result = await batchImport(req.body, operator as string);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/export/template', async (req, res) => {
  try {
    const csv = getExportTemplate();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=import_template.csv');
    res.send('\uFEFF' + csv);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/export/data', async (req, res) => {
  try {
    const csv = await exportChecklistsToCSV(req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=checklists_export.csv');
    res.send('\uFEFF' + csv);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
