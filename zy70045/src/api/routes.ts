import { Router, Request, Response } from 'express';
import { shiftService } from '../services/shiftService';
import { productionService } from '../services/productionService';
import { downtimeService } from '../services/downtimeService';
import { snapshotService } from '../services/snapshotService';
import { handoverService } from '../services/handoverService';
import { revisionService } from '../services/revisionService';

const router = Router();

const handleError = (res: Response, error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  res.status(400).json({ error: message });
};

router.post('/shifts', (req: Request, res: Response) => {
  try {
    const { lineId, teamId, teamName, startTime } = req.body;
    const shift = shiftService.startShift({
      lineId,
      teamId,
      teamName,
      startTime: startTime ? new Date(startTime) : undefined,
    });
    res.json(shift);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/shifts/:id/end', (req: Request, res: Response) => {
  try {
    const { endTime } = req.body;
    const shift = shiftService.endShift(
      req.params.id,
      endTime ? new Date(endTime) : undefined
    );
    res.json(shift);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/shifts/:id', (req: Request, res: Response) => {
  try {
    const shift = shiftService.getShift(req.params.id);
    if (!shift) {
      res.status(404).json({ error: '班次不存在' });
      return;
    }
    res.json(shift);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/shifts/:id/status', (req: Request, res: Response) => {
  try {
    const status = shiftService.getShiftStatus(req.params.id);
    res.json(status);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/shifts/:id/history', (req: Request, res: Response) => {
  try {
    const history = shiftService.getShiftHistory(req.params.id);
    res.json(history);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/productions', (req: Request, res: Response) => {
  try {
    const { shiftId, productId, productName, quantity, createdBy, timestamp } = req.body;
    const record = productionService.addProduction({
      shiftId,
      productId,
      productName,
      quantity,
      createdBy,
      timestamp: timestamp ? new Date(timestamp) : undefined,
    });
    res.json(record);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/productions/:id/confirm', (req: Request, res: Response) => {
  try {
    const record = productionService.confirmProduction(req.params.id);
    res.json(record);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/shifts/:shiftId/productions', (req: Request, res: Response) => {
  try {
    const result = productionService.getShiftProductions(req.params.shiftId);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/wastes', (req: Request, res: Response) => {
  try {
    const { shiftId, productId, productName, quantity, reason, createdBy, timestamp } = req.body;
    const record = productionService.addWaste({
      shiftId,
      productId,
      productName,
      quantity,
      reason,
      createdBy,
      timestamp: timestamp ? new Date(timestamp) : undefined,
    });
    res.json(record);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/wastes/:id/confirm', (req: Request, res: Response) => {
  try {
    const record = productionService.confirmWaste(req.params.id);
    res.json(record);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/shifts/:shiftId/wastes', (req: Request, res: Response) => {
  try {
    const result = productionService.getShiftWastes(req.params.shiftId);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/downtimes', (req: Request, res: Response) => {
  try {
    const { lineId, startTime, endTime, reason, createdBy } = req.body;
    const record = downtimeService.recordDowntime({
      lineId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      reason,
      createdBy,
    });
    res.json(record);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/downtimes/:id/allocate/:shiftId', (req: Request, res: Response) => {
  try {
    const allocation = downtimeService.allocateDowntime(req.params.id, req.params.shiftId);
    res.json(allocation);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/lines/:lineId/auto-allocate', (req: Request, res: Response) => {
  try {
    const results = downtimeService.autoAllocateDowntimeForLine(req.params.lineId);
    res.json(results);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/shifts/:shiftId/downtime', (req: Request, res: Response) => {
  try {
    const result = downtimeService.getShiftDowntime(req.params.shiftId);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/downtimes/:id/allocations', (req: Request, res: Response) => {
  try {
    const result = downtimeService.getDowntimeAllocations(req.params.id);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/snapshots', (req: Request, res: Response) => {
  try {
    const { shiftId, handoverFrom, handoverTo, isConfirmed } = req.body;
    const snapshot = snapshotService.createSnapshot(shiftId, {
      handoverFrom,
      handoverTo,
      isConfirmed,
    });
    res.json(snapshot);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/shifts/:shiftId/snapshots', (req: Request, res: Response) => {
  try {
    const { version } = req.query;
    if (version !== undefined) {
      const snapshot = snapshotService.getSnapshot(req.params.shiftId, Number(version));
      if (!snapshot) {
        res.status(404).json({ error: '快照不存在' });
        return;
      }
      res.json(snapshot);
    } else {
      const snapshot = snapshotService.getSnapshot(req.params.shiftId);
      if (!snapshot) {
        res.status(404).json({ error: '快照不存在' });
        return;
      }
      res.json(snapshot);
    }
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/shifts/:shiftId/snapshots/history', (req: Request, res: Response) => {
  try {
    const history = snapshotService.getSnapshotHistory(req.params.shiftId);
    res.json(history);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/shifts/:shiftId/summary', (req: Request, res: Response) => {
  try {
    const { version } = req.query;
    const result = snapshotService.getShiftSummaryFromSnapshot(
      req.params.shiftId,
      version !== undefined ? Number(version) : undefined
    );
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/handover/:shiftId/confirm', (req: Request, res: Response) => {
  try {
    const { handoverFrom, handoverTo } = req.body;
    const shift = handoverService.confirmHandover(req.params.shiftId, {
      handoverFrom,
      handoverTo,
    });
    res.json(shift);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/handover/:shiftId/summary', (req: Request, res: Response) => {
  try {
    const summary = handoverService.getHandoverSummary(req.params.shiftId);
    res.json(summary);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/reports/daily', (req: Request, res: Response) => {
  try {
    const { date, lineId } = req.query;
    if (!date || !lineId) {
      res.status(400).json({ error: '缺少必要参数: date 和 lineId' });
      return;
    }
    const report = handoverService.generateDailyReport(String(date), String(lineId));
    res.json(report);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/reports/daily/export', (req: Request, res: Response) => {
  try {
    const { date, lineId, format = 'json' } = req.query;
    if (!date || !lineId) {
      res.status(400).json({ error: '缺少必要参数: date 和 lineId' });
      return;
    }

    if (format === 'csv') {
      const csv = handoverService.exportDailyReportAsCSV(String(date), String(lineId));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="daily-report-${date}-${lineId}.csv"`);
      res.send(csv);
    } else {
      const json = handoverService.exportDailyReportAsJSON(String(date), String(lineId));
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.send(json);
    }
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/revisions/productions/:id', (req: Request, res: Response) => {
  try {
    const { revisedBy, reason, changes } = req.body;
    const record = revisionService.reviseProduction(req.params.id, {
      revisedBy,
      reason,
      changes: {
        quantity: changes?.quantity,
        shiftId: changes?.shiftId,
      },
    });
    res.json(record);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/revisions/wastes/:id', (req: Request, res: Response) => {
  try {
    const { revisedBy, reason, changes } = req.body;
    const record = revisionService.reviseWaste(req.params.id, {
      revisedBy,
      reason,
      changes: {
        quantity: changes?.quantity,
        reason: changes?.reason,
        shiftId: changes?.shiftId,
      },
    });
    res.json(record);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/revisions/downtimes/:id', (req: Request, res: Response) => {
  try {
    const { revisedBy, reason, changes } = req.body;
    const record = revisionService.reviseDowntime(req.params.id, {
      revisedBy,
      reason,
      changes: {
        startTime: changes?.startTime ? new Date(changes.startTime) : undefined,
        endTime: changes?.endTime ? new Date(changes.endTime) : undefined,
        reason: changes?.reason,
      },
    });
    res.json(record);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/revisions/shifts/:id', (req: Request, res: Response) => {
  try {
    const { revisedBy, reason, changes } = req.body;
    const record = handoverService.reviseShift(req.params.id, {
      revisedBy,
      reason,
      changes: {
        teamId: changes?.teamId,
        teamName: changes?.teamName,
        startTime: changes?.startTime ? new Date(changes.startTime) : undefined,
        endTime: changes?.endTime ? new Date(changes.endTime) : undefined,
      },
    });
    res.json(record);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/revisions/:targetType/:targetId', (req: Request, res: Response) => {
  try {
    const { targetType, targetId } = req.params;
    const history = revisionService.getRevisionHistory(
      targetId,
      targetType as 'shift' | 'production' | 'waste' | 'downtime' | 'allocation'
    );
    res.json(history);
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
