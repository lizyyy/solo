import express from 'express';
import { createObjectCsvWriter } from 'csv-writer';
import * as reviewService from '../services/reviewService';
import { ViolationStatus } from '../types';

const router = express.Router();

router.post('/fragments', async (req, res) => {
  try {
    const { data, operatorId, operatorName, source } = req.body;
    const fragment = await reviewService.createFragment(
      data,
      operatorId,
      operatorName,
      source
    );
    res.json({ success: true, data: fragment });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/fragments', async (req, res) => {
  try {
    const { status, roomId, hasConflict, page, pageSize } = req.query;
    const result = await reviewService.listFragments({
      status: status as ViolationStatus,
      roomId: roomId as string,
      hasConflict: hasConflict === 'true' ? true : hasConflict === 'false' ? false : undefined,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/fragments/:id', async (req, res) => {
  try {
    const fragment = await reviewService.getFragmentById(req.params.id);
    if (!fragment) {
      return res.status(404).json({ success: false, error: 'Fragment not found' });
    }
    res.json({ success: true, data: fragment });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.patch('/fragments/:id/status', async (req, res) => {
  try {
    const { status, operatorId, operatorName, source, comment } = req.body;
    const fragment = await reviewService.updateStatus(
      req.params.id,
      status,
      operatorId,
      operatorName,
      source,
      comment
    );
    res.json({ success: true, data: fragment });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/fragments/:id/history', async (req, res) => {
  try {
    const history = await reviewService.getFragmentHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const { status, roomId } = req.query;
    const fragments = await reviewService.exportFragments({
      status: status as ViolationStatus,
      roomId: roomId as string,
    });

    const csvWriter = createObjectCsvWriter({
      path: 'export.csv',
      header: [
        { id: 'id', title: 'ID' },
        { id: 'roomId', title: '直播间ID' },
        { id: 'roomName', title: '直播间名称' },
        { id: 'anchorName', title: '主播名称' },
        { id: 'fragmentStartTime', title: '片段开始时间' },
        { id: 'fragmentEndTime', title: '片段结束时间' },
        { id: 'violationTag', title: '违规标签' },
        { id: 'violationDescription', title: '违规描述' },
        { id: 'detectModel', title: '检测模型' },
        { id: 'confidence', title: '置信度' },
        { id: 'status', title: '状态' },
        { id: 'reviewerName', title: '复核人' },
        { id: 'reviewComment', title: '复核意见' },
        { id: 'hasConflict', title: '是否冲突' },
        { id: 'createdAt', title: '创建时间' },
      ],
    });

    await csvWriter.writeRecords(fragments.map(f => ({
      ...f,
      fragmentStartTime: new Date(f.fragmentStartTime).toISOString(),
      fragmentEndTime: new Date(f.fragmentEndTime).toISOString(),
      createdAt: new Date(f.createdAt).toISOString(),
    })));

    res.download('export.csv', 'violation-fragments.csv');
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/import', async (req, res) => {
  try {
    const { records, operatorId, operatorName } = req.body;
    const result = await reviewService.batchImport(records, operatorId, operatorName);
    res.json({ success: true, ...result });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

export default router;
