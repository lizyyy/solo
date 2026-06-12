import { Router, Request, Response } from 'express';
import { CardService } from './services/cardService';
import { ImportService } from './services/importService';
import { ConflictService } from './services/conflictService';
import { SelfCheckService } from './services/selfCheckService';
import { RevenueService } from './services/revenueService';
import { WithdrawService } from './services/withdrawService';
import { AttendanceStatus, ConflictResolution } from './types';

const router = Router();

const cardService = new CardService();
const importService = new ImportService();
const conflictService = new ConflictService();
const selfCheckService = new SelfCheckService();
const revenueService = new RevenueService();
const withdrawService = new WithdrawService();

router.post('/cards', (req: Request, res: Response) => {
  try {
    const { playlistName, createdBy } = req.body;
    if (!playlistName || !createdBy) {
      return res.status(400).json({ error: 'playlistName 和 createdBy 必填' });
    }
    const card = cardService.createCard(playlistName, createdBy);
    res.json(card);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cards', (req: Request, res: Response) => {
  try {
    const cards = cardService.listCards();
    res.json(cards);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cards/:cardId', (req: Request, res: Response) => {
  try {
    const card = cardService.getCard(req.params.cardId);
    if (!card) {
      return res.status(404).json({ error: '卡片不存在' });
    }
    res.json(card);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cards/:cardId/import-attendance', (req: Request, res: Response) => {
  try {
    const { records, importedBy } = req.body;
    if (!records || !importedBy) {
      return res.status(400).json({ error: 'records 和 importedBy 必填' });
    }
    const result = importService.importAttendance(req.params.cardId, records, importedBy);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cards/:cardId/supplement-tickets', (req: Request, res: Response) => {
  try {
    const { records, supplementedBy } = req.body;
    if (!records || !supplementedBy) {
      return res.status(400).json({ error: 'records 和 supplementedBy 必填' });
    }
    const result = importService.supplementTickets(req.params.cardId, records, supplementedBy);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cards/:cardId/attendance', (req: Request, res: Response) => {
  try {
    const records = importService.getAttendanceByCardId(req.params.cardId);
    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cards/:cardId/tickets', (req: Request, res: Response) => {
  try {
    const records = importService.getTicketsByCardId(req.params.cardId);
    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cards/:cardId/detect-conflicts', (req: Request, res: Response) => {
  try {
    const conflicts = conflictService.detectConflicts(req.params.cardId);
    res.json({ conflicts, count: conflicts.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cards/:cardId/conflicts', (req: Request, res: Response) => {
  try {
    const conflicts = conflictService.getConflictsByCardId(req.params.cardId);
    res.json(conflicts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/conflicts/:conflictId/resolve', (req: Request, res: Response) => {
  try {
    const { resolution, resolvedBy, resolutionNote } = req.body;
    if (!resolution || !resolvedBy) {
      return res.status(400).json({ error: 'resolution 和 resolvedBy 必填' });
    }
    
    let note = resolutionNote;
    if (!note) {
      if (resolution === 'CONFIRM_ATTENDANCE') {
        note = '确认以课时签到照片记录为准，不自动拍板，已人工核对';
      } else if (resolution === 'CONFIRM_TICKET') {
        note = '确认以票务导出表记录为准，不自动拍板，已人工核对';
      } else if (resolution === 'PENDING_REVIEW') {
        note = '转票务同事复核，留给票务同事复核，不自动拍板';
      }
    }
    
    const conflict = conflictService.resolveConflict(
      req.params.conflictId,
      resolution as ConflictResolution,
      resolvedBy,
      note
    );
    if (!conflict) {
      return res.status(404).json({ error: '冲突记录不存在' });
    }
    res.json(conflict);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cards/:cardId/self-check', (req: Request, res: Response) => {
  try {
    const results = selfCheckService.runAllChecks(req.params.cardId);
    const hasErrors = results.some((r) => r.severity === 'ERROR' && !r.passed);
    const hasWarnings = results.some((r) => r.severity === 'WARNING' && !r.passed);
    res.json({
      results,
      summary: {
        passed: results.filter((r) => r.passed).length,
        errors: hasErrors ? results.filter((r) => r.severity === 'ERROR' && !r.passed).length : 0,
        warnings: hasWarnings ? results.filter((r) => r.severity === 'WARNING' && !r.passed).length : 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cards/:cardId/calculate-revenue', (req: Request, res: Response) => {
  try {
    const { calculatedBy } = req.body;
    if (!calculatedBy) {
      return res.status(400).json({ error: 'calculatedBy 必填' });
    }
    const result = revenueService.calculateRevenue(req.params.cardId, calculatedBy);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/cards/:cardId/revenue', (req: Request, res: Response) => {
  try {
    const version = req.query.version ? parseInt(req.query.version as string) : undefined;
    const details = revenueService.getRevenueByCardId(req.params.cardId, version);
    const summary = details.reduce(
      (acc, d) => {
        acc.totalBase += d.baseAmount;
        acc.totalAdjustment += d.adjustmentAmount;
        acc.totalFinal += d.finalAmount;
        return acc;
      },
      { totalBase: 0, totalAdjustment: 0, totalFinal: 0 }
    );
    res.json({ details, summary, version: version || 'latest' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cards/:cardId/revenue/export', (req: Request, res: Response) => {
  try {
    const exportData = revenueService.getRevenueExportData(req.params.cardId);
    res.json({ exportData, count: exportData.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cards/:cardId/withdraw', (req: Request, res: Response) => {
  try {
    const { withdrawnBy } = req.body;
    if (!withdrawnBy) {
      return res.status(400).json({ error: 'withdrawnBy 必填' });
    }
    const result = withdrawService.withdrawToPreviousVersion(req.params.cardId, withdrawnBy);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cards/:cardId/withdraw-revenue', (req: Request, res: Response) => {
  try {
    const { withdrawnBy } = req.body;
    if (!withdrawnBy) {
      return res.status(400).json({ error: 'withdrawnBy 必填' });
    }
    const result = withdrawService.withdrawRevenueVersion(req.params.cardId, withdrawnBy);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cards/:cardId/version-history', (req: Request, res: Response) => {
  try {
    const history = withdrawService.getVersionHistory(req.params.cardId);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cards/:cardId/full-details', (req: Request, res: Response) => {
  try {
    const cardId = req.params.cardId;
    const card = cardService.getCard(cardId);
    if (!card) {
      return res.status(404).json({ error: '卡片不存在' });
    }

    const attendance = importService.getAttendanceByCardId(cardId);
    const tickets = importService.getTicketsByCardId(cardId);
    const conflicts = conflictService.getConflictsByCardId(cardId);
    const revenue = revenueService.getLatestRevenue(cardId);
    const revenueExport = revenueService.getRevenueExportData(cardId);
    const versionHistory = withdrawService.getVersionHistory(cardId);
    const unresolvedConflicts = conflictService.getUnresolvedConflicts(cardId);
    
    const attendanceWithFlags = attendance.map(a => ({
      ...a,
      hasConflict: conflicts.some(c => c.attendanceId === a.id),
      isUnresolved: unresolvedConflicts.some(c => c.attendanceId === a.id),
    }));
    
    const ticketsWithFlags = tickets.map(t => {
      const relatedConflict = conflicts.find(c => c.ticketId === t.id);
      return {
        ...t,
        hasConflict: !!relatedConflict,
        isUnresolved: relatedConflict ? conflictService.isUnresolved(relatedConflict) : false,
      };
    });

    res.json({
      card: {
        ...card,
        unresolvedConflictCount: unresolvedConflicts.length,
        canCalculateRevenue: unresolvedConflicts.length === 0,
      },
      attendance: attendanceWithFlags,
      tickets: ticketsWithFlags,
      conflicts: conflicts.map(c => ({
        ...c,
        isUnresolved: conflictService.isUnresolved(c),
      })),
      revenue,
      revenueExport,
      versionHistory,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
