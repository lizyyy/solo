import { Router, type Request, type Response } from 'express';
import { recordService } from '../services/recordService.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const records = recordService.getAllRecords();
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取记录失败' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const record = recordService.getRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取记录失败' });
  }
});

router.post('/import', (req: Request, res: Response) => {
  try {
    const { redLineNo, communityName, communityNameOld, redLineRemark, operator } = req.body;
    if (!redLineNo || !communityName || !redLineRemark) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    const record = recordService.importRedLineRemark({
      redLineNo,
      communityName,
      communityNameOld,
      redLineRemark,
      operator: operator || '小付',
    });
    res.json({ success: true, data: record, message: '导入成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: '导入失败' });
  }
});

router.post('/:id/review', (req: Request, res: Response) => {
  try {
    const { gridInspection, operator } = req.body;
    if (!gridInspection) {
      return res.status(400).json({ success: false, error: '缺少网格员巡查表内容' });
    }
    const record = recordService.submitGridInspection(
      req.params.id,
      gridInspection,
      operator || '小付'
    );
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    res.json({ success: true, data: record, message: '复核提交成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: '提交失败' });
  }
});

router.post('/:id/conflict/confirm', (req: Request, res: Response) => {
  try {
    const { resolution, operator } = req.body;
    if (!resolution) {
      return res.status(400).json({ success: false, error: '请填写处理意见' });
    }
    const record = recordService.confirmConflict(
      req.params.id,
      resolution,
      operator || '小付'
    );
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    res.json({ success: true, data: record, message: '冲突已确认' });
  } catch (error) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

router.post('/:id/conflict/reject', (req: Request, res: Response) => {
  try {
    const { resolution, operator } = req.body;
    if (!resolution) {
      return res.status(400).json({ success: false, error: '请填写处理意见' });
    }
    const record = recordService.rejectConflict(
      req.params.id,
      resolution,
      operator || '小付'
    );
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    res.json({ success: true, data: record, message: '冲突已驳回' });
  } catch (error) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

router.post('/:id/name-review', (req: Request, res: Response) => {
  try {
    const { confirmedName, operator } = req.body;
    if (!confirmedName) {
      return res.status(400).json({ success: false, error: '请选择确认的名称' });
    }
    const record = recordService.confirmNameIssue(
      req.params.id,
      confirmedName,
      operator || '小付'
    );
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    res.json({ success: true, data: record, message: '小区名称已确认' });
  } catch (error) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

router.post('/:id/summary', (req: Request, res: Response) => {
  try {
    const { summary, operator } = req.body;
    if (!summary) {
      return res.status(400).json({ success: false, error: '请填写摘要内容' });
    }
    const record = recordService.updateStreetSummary(
      req.params.id,
      summary,
      operator || '小付'
    );
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    res.json({ success: true, data: record, message: '摘要更新成功，流程完成' });
  } catch (error) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

router.post('/:id/recalc', (req: Request, res: Response) => {
  try {
    const record = recordService.recalculateAfterSupplement(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    res.json({ success: true, data: record, message: '重算完成' });
  } catch (error) {
    res.status(500).json({ success: false, error: '重算失败' });
  }
});

export default router;
