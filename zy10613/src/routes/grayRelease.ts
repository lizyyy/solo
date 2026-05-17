import { Router, Request, Response } from 'express';
import { grayReleaseService } from '../services/grayRelease';
import { GrayReleaseStatus } from '../types';
import { Parser } from 'json2csv';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const records = await grayReleaseService.getAllRecords();
    res.json({
      success: true,
      data: records,
      total: records.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取记录列表失败',
      error: (error as Error).message
    });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const record = await grayReleaseService.getRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取记录详情失败',
      error: (error as Error).message
    });
  }
});

router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const record = await grayReleaseService.getRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }
    res.json({
      success: true,
      data: record.history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取历史记录失败',
      error: (error as Error).message
    });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const record = await grayReleaseService.createRecord({
      ...req.body,
      status: req.body.status || GrayReleaseStatus.DRAFT
    });
    res.status(201).json({
      success: true,
      data: record,
      message: '创建成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '创建失败',
      error: (error as Error).message
    });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const operator = req.body.operator || 'system';
    const remark = req.body.remark || '更新记录';
    const updates = { ...req.body };
    delete updates.operator;

    const record = await grayReleaseService.updateRecord(
      req.params.id,
      updates,
      operator,
      remark
    );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }

    res.json({
      success: true,
      data: record,
      message: '更新成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '更新失败',
      error: (error as Error).message
    });
  }
});

router.post('/:id/start-gray', async (req: Request, res: Response) => {
  try {
    const operator = req.body.operator || 'system';
    const record = await grayReleaseService.startGrayRelease(req.params.id, operator);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }

    res.json({
      success: true,
      data: record,
      message: record.status === GrayReleaseStatus.PENDING_MANUAL
        ? '检测到冲突，已转为待人工处理状态'
        : '开始灰度发布成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '操作失败',
      error: (error as Error).message
    });
  }
});

router.post('/:id/full-release', async (req: Request, res: Response) => {
  try {
    const operator = req.body.operator || 'system';
    const record = await grayReleaseService.fullRelease(req.params.id, operator);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }

    res.json({
      success: true,
      data: record,
      message: '全量发布成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '操作失败',
      error: (error as Error).message
    });
  }
});

router.post('/:id/rollback', async (req: Request, res: Response) => {
  try {
    const operator = req.body.operator || 'system';
    const reason = req.body.reason || '手动回退';
    const record = await grayReleaseService.rollback(req.params.id, operator, reason);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }

    res.json({
      success: true,
      data: record,
      message: '回退成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '操作失败',
      error: (error as Error).message
    });
  }
});

router.post('/batch-import', async (req: Request, res: Response) => {
  try {
    const { records, operator } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        message: 'records 必须是数组格式'
      });
    }

    const result = await grayReleaseService.batchImport(records, operator || 'system');

    res.json({
      success: true,
      data: result,
      message: `批量导入完成，成功 ${result.success} 条，失败 ${result.failed} 条`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '批量导入失败',
      error: (error as Error).message
    });
  }
});

router.get('/export/csv', async (req: Request, res: Response) => {
  try {
    const records = await grayReleaseService.exportRecords();
    const fields = [
      'id',
      'robotId',
      'robotName',
      'templateVersion',
      'templateName',
      'grayGroups',
      'status',
      'remark',
      'conflictReason',
      'createdAt',
      'updatedAt',
      'createdBy'
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(records.map(r => ({
      ...r,
      grayGroups: r.grayGroups.join(', ')
    })));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=gray-release-export.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出失败',
      error: (error as Error).message
    });
  }
});

router.get('/export/json', async (req: Request, res: Response) => {
  try {
    const records = await grayReleaseService.exportRecords();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=gray-release-export.json');
    res.send(JSON.stringify(records, null, 2));
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出失败',
      error: (error as Error).message
    });
  }
});

router.post('/check-conflicts', async (req: Request, res: Response) => {
  try {
    const conflictInfo = await grayReleaseService.checkConflicts(req.body);
    res.json({
      success: true,
      data: conflictInfo
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '检查冲突失败',
      error: (error as Error).message
    });
  }
});

export default router;
