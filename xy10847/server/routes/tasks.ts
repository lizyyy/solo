import express from 'express';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import * as taskService from '../services/taskService';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const task = await taskService.createTask(req.body);
    res.json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const status = req.query.status as any;
    const tasks = await taskService.listTasks(status);
    res.json({ success: true, data: tasks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/failed', async (req, res) => {
  try {
    const tasks = await taskService.getFailedTasks();
    res.json({ success: true, data: tasks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:taskId', async (req, res) => {
  try {
    const task = await taskService.getTaskDetail(req.params.taskId);
    res.json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:taskId/status', async (req, res) => {
  try {
    const { status, operator, remark } = req.body;
    await taskService.updateTaskStatus(req.params.taskId, status, operator, remark);
    const task = await taskService.getTaskDetail(req.params.taskId);
    res.json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:taskId/advance', async (req, res) => {
  try {
    const result = await taskService.advanceStage(req.params.taskId);
    const task = await taskService.getTaskDetail(req.params.taskId);
    res.json({ success: true, data: { ...task, advance_result: result } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:taskId/complete-stage', async (req, res) => {
  try {
    const { stage_name } = req.body;
    await taskService.completeStage(req.params.taskId, stage_name);
    const task = await taskService.getTaskDetail(req.params.taskId);
    res.json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:taskId/update-progress', async (req, res) => {
  try {
    const { stage_name, progress } = req.body;
    await taskService.updateStageProgress(req.params.taskId, stage_name, progress);
    const task = await taskService.getTaskDetail(req.params.taskId);
    res.json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:taskId/fragments', async (req, res) => {
  try {
    const { fragments } = req.body;
    await taskService.saveTextFragments(req.params.taskId, fragments);
    const task = await taskService.getTaskDetail(req.params.taskId);
    res.json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/demo/fragments', async (_req, res) => {
  try {
    const fragments = taskService.getDemoFragments();
    res.json({ success: true, data: fragments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:taskId/fragments/demo', async (req, res) => {
  try {
    const fragments = taskService.getDemoFragments();
    await taskService.saveTextFragments(req.params.taskId, fragments);
    const task = await taskService.getTaskDetail(req.params.taskId);
    res.json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:taskId/callback', async (req, res) => {
  try {
    const { demo_mode = true } = req.body;
    const result = await taskService.executeCallback(req.params.taskId, demo_mode);
    const task = await taskService.getTaskDetail(req.params.taskId);
    res.json({ success: true, data: { ...task, callback_result: result } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:taskId/retry', async (req, res) => {
  try {
    const { demo_mode = true } = req.body;
    const result = await taskService.retryCallback(req.params.taskId, demo_mode);
    const task = await taskService.getTaskDetail(req.params.taskId);
    res.json({ success: true, data: { ...task, retry_result: result } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:taskId/export', async (req, res) => {
  try {
    const data = await taskService.exportTaskData(req.params.taskId);
    
    const exportDir = path.join(__dirname, '../../exports');
    const fileName = `task_${req.params.taskId}_${Date.now()}.json`;
    const filePath = path.join(exportDir, fileName);
    
    const fs = require('fs');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    res.json({ success: true, data: { ...data, download_url: `/exports/${fileName}` } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:taskId/export/csv', async (req, res) => {
  try {
    const data = await taskService.exportTaskData(req.params.taskId);
    
    const exportDir = path.join(__dirname, '../../exports');
    const fileName = `task_${req.params.taskId}_${Date.now()}.csv`;
    const filePath = path.join(exportDir, fileName);
    
    const fs = require('fs');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'time', title: '时间' },
        { id: 'speaker', title: '说话人' },
        { id: 'content', title: '内容' },
        { id: 'confidence', title: '置信度' }
      ]
    });

    const records = data.transcription.map((f: any) => ({
      time: `${f.start_time}-${f.end_time}`,
      speaker: f.speaker || '',
      content: f.content,
      confidence: f.confidence || ''
    }));

    await csvWriter.writeRecords(records);
    
    res.json({ success: true, data: { download_url: `/exports/${fileName}` } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
