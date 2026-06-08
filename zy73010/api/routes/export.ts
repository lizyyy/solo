import express, { type Request, type Response } from 'express';
import * as XLSX from 'xlsx';
import { db } from '../data/db.js';

const router = express.Router();

function buildReportRows(includeTraces: boolean = true) {
  return db.boardingRecords.map((r, idx) => {
    const latestRemark = r.remarks[r.remarks.length - 1];
    const missingVaccines = r.vaccines.filter(v => v.isMissing).map(v => v.name).join('、');
    const weightAnomalyDates = r.weightPoints
      .filter(wp => wp.isCurrent && (wp.remark.includes('⚠️') || wp.remark.includes('异常') || wp.remark.includes('下降')))
      .map(wp => wp.date)
      .join('、');
    return {
      序号: idx + 1,
      记录编号: r.id,
      宠物姓名: r.petName,
      品种: r.petBreed,
      主人: r.ownerName,
      联系电话: r.ownerPhone,
      寄养开始: r.startDate,
      寄养结束: r.endDate,
      复核状态: r.reviewStatus,
      最终结论: r.conclusion,
      最新备注: latestRemark ? latestRemark.content : '',
      操作人: latestRemark ? latestRemark.operator : '',
      体重异常标记: r.hasWeightAnomaly ? `异常-${weightAnomalyDates || '存在'}` : '正常',
      疫苗缺失标记: r.hasVaccineMissing ? `缺失-${missingVaccines}` : '齐全',
      异常照片数: r.abnormalPhotos.length,
      补录备注数: r.remarks.filter(x => x.isSupplement).length,
      影响结论因素: includeTraces
        ? r.influenceTrace.filter(t => t.affectsConclusion).map(t => `[${t.type}]${t.content}`).join(' | ')
        : '',
    };
  });
}

function buildExceptionRows() {
  db.recheckAllConsistency();
  const typeMap: Record<string, string> = {
    weight: '体重异常',
    vaccine: '疫苗缺失',
    photo: '照片异常',
    verbal: '口头备注待确认',
    withdrawn: '撤回记录',
  };
  return db.exceptionQueue.map((e, idx) => ({
    序号: idx + 1,
    异常编号: e.id,
    关联记录: e.recordId,
    宠物姓名: e.petName,
    异常类型: typeMap[e.exceptionType] || e.exceptionType,
    处理状态: e.status,
    关联备注: e.remark,
    文件结论: e.fileConclusion,
    一致性校验: e.isConsistent ? '一致 ✓' : '不一致 ⚠',
    创建时间: e.createdAt,
  }));
}

router.post('/report', (req: Request, res: Response) => {
  const { includeTraces = true, operator = '寄养店长老周' } = req.body;
  const rows = buildReportRows(includeTraces);

  const now = new Date().toISOString();
  const exportId = 'EXP-RPT-' + Math.random().toString(36).slice(2, 6);
  db.exportHistory.unshift({
    id: exportId,
    exportType: 'report',
    operator,
    createdAt: now,
    changeSummary: `导出复核报告，共${rows.length}条记录`,
  });

  res.json({
    success: true,
    data: {
      exportId,
      rows,
      preview: rows.slice(0, 3),
      download: {
        fileName: `宠物寄养复核报告_${new Date().toISOString().slice(0, 10)}.xlsx`,
        format: 'xlsx',
      },
      message: '报告已生成，包含疫苗缺失和体重异常的痕迹标记',
      anomalyMarksIncluded: true,
    },
  });
});

router.post('/report/download', (req: Request, res: Response) => {
  const { includeTraces = true } = req.body;
  const rows = buildReportRows(includeTraces);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '复核报告');

  const exceptionSheet = XLSX.utils.json_to_sheet(buildExceptionRows());
  XLSX.utils.book_append_sheet(wb, exceptionSheet, '异常队列');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const fileName = `宠物寄养复核报告_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  res.send(Buffer.from(buf));
});

router.post('/exceptions', (req: Request, res: Response) => {
  const { operator = '寄养店长老周' } = req.body;
  db.recheckAllConsistency();
  const rows = buildExceptionRows();
  const inconsistent = db.exceptionQueue.filter(e => !e.isConsistent).length;

  const now = new Date().toISOString();
  const exportId = 'EXP-EXC-' + Math.random().toString(36).slice(2, 6);
  db.exportHistory.unshift({
    id: exportId,
    exportType: 'exceptions',
    operator,
    createdAt: now,
    changeSummary: `导出异常队列${rows.length}条，其中${inconsistent}条状态与备注/结论不一致`,
  });

  res.json({
    success: true,
    data: {
      exportId,
      rows,
      inconsistentCount: inconsistent,
      consistencyWarning: inconsistent > 0
        ? `⚠️ 存在${inconsistent}条状态、备注、文件结论不一致记录，请核对后处理`
        : '所有异常记录状态、备注、文件结论三者一致 ✓',
      download: {
        fileName: `异常队列_${new Date().toISOString().slice(0, 10)}.xlsx`,
      },
    },
  });
});

router.post('/exceptions/download', (_req: Request, res: Response) => {
  const rows = buildExceptionRows();
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '异常队列');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const fileName = `异常队列_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  res.send(Buffer.from(buf));
});

router.get('/history', (_req: Request, res: Response) => {
  res.json({ success: true, data: db.exportHistory });
});

router.get('/:id/diff', (req: Request, res: Response) => {
  const { id } = req.params;
  const diff = db.exportDiffs.get(id);
  const historyItem = db.exportHistory.find(h => h.id === id);
  if (!diff && !historyItem) {
    return res.status(404).json({ success: false, error: '导出版本不存在' });
  }
  res.json({
    success: true,
    data: {
      exportId: id,
      history: historyItem,
      diff: diff || [],
      hasChanges: diff && diff.length > 0,
      summary: diff && diff.length > 0
        ? `本次导出共变更${diff.length}处字段，涉及第${diff.map(d => d.rowIndex).filter((v, i, a) => a.indexOf(v) === i).join('、')}行`
        : '本次导出与上次无差异',
    },
  });
});

export default router;
