import { Router, Request, Response } from 'express';
import { db } from '../database.js';
import { riskDetector } from '../riskDetector.js';
import { Risk, TargetWindow, ObservingTarget, Device, ObservingSite } from '../types.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const risks = db
      .prepare('SELECT * FROM risks ORDER BY severity DESC, target_name')
      .all() as Risk[];
    res.json(risks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch risks' });
  }
});

router.get('/window/:windowId', (req: Request, res: Response) => {
  try {
    const risks = db
      .prepare('SELECT * FROM risks WHERE window_id = ? ORDER BY severity DESC')
      .all(req.params.windowId) as Risk[];
    res.json(risks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch risks for window' });
  }
});

router.post('/detect', (req: Request, res: Response) => {
  try {
    const { windows, targets, devices, site, lightPollution, activityDate } = req.body;

    db.prepare('DELETE FROM risks').run();

    const detectedRisks = riskDetector.detectAllRisks(
      windows as TargetWindow[],
      targets as ObservingTarget[],
      devices as Device[],
      site as ObservingSite,
      lightPollution,
      activityDate
    );

    const insertStmt = db.prepare(`
      INSERT INTO risks (id, window_id, target_name, type, severity, message, is_overridden)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((risks: Risk[]) => {
      for (const risk of risks) {
        insertStmt.run(
          risk.id,
          risk.windowId,
          risk.targetName,
          risk.type,
          risk.severity,
          risk.message,
          risk.isOverridden ? 1 : 0
        );
      }
    });

    transaction(detectedRisks);

    res.json(detectedRisks);
  } catch (error) {
    console.error('Error detecting risks:', error);
    res.status(500).json({ error: 'Failed to detect risks' });
  }
});

router.put('/:id/override', (req: Request, res: Response) => {
  try {
    const { isOverridden, overrideReason, overrideBy } = req.body;
    const now = new Date().toISOString();

    const result = db
      .prepare(`
        UPDATE risks
        SET is_overridden = ?, override_reason = ?, override_by = ?, override_at = ?
        WHERE id = ?
      `)
      .run(
        isOverridden ? 1 : 0,
        overrideReason || null,
        overrideBy || null,
        isOverridden ? now : null,
        req.params.id
      );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Risk not found' });
    }

    const risk = db
      .prepare('SELECT * FROM risks WHERE id = ?')
      .get(req.params.id) as Risk;

    res.json(risk);
  } catch (error) {
    res.status(500).json({ error: 'Failed to override risk' });
  }
});

router.get('/summary', (req: Request, res: Response) => {
  try {
    const stats = {
      critical: { total: 0, overridden: 0 },
      warning: { total: 0, overridden: 0 },
      info: { total: 0, overridden: 0 },
      byType: {} as Record<string, { total: number; overridden: number }>,
      byTarget: {} as Record<string, { total: number; critical: number; warning: number }>,
    };

    const risks = db
      .prepare('SELECT * FROM risks')
      .all() as Risk[];

    for (const risk of risks) {
      const severity = risk.severity as 'critical' | 'warning' | 'info';
      stats[severity].total++;
      if (risk.isOverridden) stats[severity].overridden++;

      if (!stats.byType[risk.type]) {
        stats.byType[risk.type] = { total: 0, overridden: 0 };
      }
      stats.byType[risk.type].total++;
      if (risk.isOverridden) stats.byType[risk.type].overridden++;

      if (!stats.byTarget[risk.targetName]) {
        stats.byTarget[risk.targetName] = { total: 0, critical: 0, warning: 0 };
      }
      stats.byTarget[risk.targetName].total++;
      if (risk.severity === 'critical') stats.byTarget[risk.targetName].critical++;
      if (risk.severity === 'warning') stats.byTarget[risk.targetName].warning++;
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get risk summary' });
  }
});

export default router;
