import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { CompletePlanData, RehearsalPlan, SceneIssue } from '../../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SOUND_OVERLAP_THRESHOLD = 0.5;
const MIN_MONITOR_SOUND_LEVEL = 60;
const MAX_VOLUME_RATIO = 0.6;
const MIN_VOLUME_RATIO = 0.1;

const distance2D = (a: { x: number; z: number }, b: { x: number; z: number }) => {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.z - b.z, 2));
};

const calculateSoundPressure = (
  sourcePos: { x: number; y: number; z: number },
  listenerPos: { x: number; y: number; z: number },
  sourceLevel: number,
  directivity: number,
  sourceRotation: number
): number => {
  const distance = Math.max(0.1, distance2D(sourcePos, listenerPos));
  const attenuation = 20 * Math.log10(distance);

  const angleToListener = Math.atan2(
    listenerPos.x - sourcePos.x,
    listenerPos.z - sourcePos.z
  );
  const angleDiff = Math.abs(((angleToListener - sourceRotation + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  const directivityFactor = 1 - directivity * (angleDiff / Math.PI);

  return sourceLevel - attenuation * (0.5 + directivityFactor * 0.5);
};

const calculateCombinedSoundPressure = (
  sources: { position: { x: number; y: number; z: number }; sourceLevel: number; directivity: number; rotation: number }[],
  listenerPos: { x: number; y: number; z: number }
): number => {
  const totalLinear = sources.reduce((sum, source) => {
    const spl = calculateSoundPressure(
      source.position,
      listenerPos,
      source.sourceLevel,
      source.directivity,
      source.rotation
    );
    return sum + Math.pow(10, spl / 20);
  }, 0);
  return 20 * Math.log10(Math.max(0.0001, totalLinear));
};

const runAllSceneValidations = (
  musicians: { position: { x: number; y: number; z: number }; planId: string; sourceLevel: number; directivity: number; rotation: number }[],
  monitorPoints: { position: { x: number; y: number; z: number }; planId: string }[]
): SceneIssue[] => {
  const issues: SceneIssue[] = [];

  for (let i = 0; i < musicians.length; i++) {
    for (let j = i + 1; j < musicians.length; j++) {
      const dist = distance2D(musicians[i].position, musicians[j].position);
      if (dist < SOUND_OVERLAP_THRESHOLD) {
        issues.push({
          id: '1',
          planId: musicians[i].planId,
          type: 'source_overlap',
          severity: 'error',
          message: '',
          details: {},
          detectedAt: new Date(),
          relatedObjectIds: [],
        });
      }
    }
  }

  monitorPoints.forEach(mp => {
    const avgDb = calculateCombinedSoundPressure(musicians, mp.position);
    if (avgDb < MIN_MONITOR_SOUND_LEVEL) {
      issues.push({
        id: '2',
        planId: mp.planId,
        type: 'missing_monitor',
        severity: 'warning',
        message: '',
        details: {},
        detectedAt: new Date(),
        relatedObjectIds: [],
      });
    }

    if (musicians.length >= 2) {
      const levels = musicians.map(m => ({
        level: calculateSoundPressure(m.position, mp.position, m.sourceLevel, m.directivity, m.rotation),
      }));
      const totalLinear = levels.reduce((sum, l) => sum + Math.pow(10, l.level / 20), 0);
      levels.forEach(({ level }) => {
        const ratio = totalLinear > 0 ? Math.pow(10, level / 20) / totalLinear : 0;
        if (ratio > MAX_VOLUME_RATIO || ratio < MIN_VOLUME_RATIO) {
          issues.push({
            id: '3',
            planId: mp.planId,
            type: 'volume_imbalance',
            severity: 'warning',
            message: '',
            details: {},
            detectedAt: new Date(),
            relatedObjectIds: [],
          });
        }
      });
    }
  });

  return issues;
};

const router = Router();

const ensureDataDir = async () => {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
};

const getPlanPath = (planId: string) => path.join(DATA_DIR, `plan_${planId}.json`);
const getIndexPath = () => path.join(DATA_DIR, 'plans_index.json');

router.get('/', async (req: Request, res: Response) => {
  try {
    await ensureDataDir();
    const indexPath = getIndexPath();
    try {
      const indexData = await fs.readFile(indexPath, 'utf-8');
      const plans: RehearsalPlan[] = JSON.parse(indexData);

      const plansWithStats = await Promise.all(plans.map(async (plan) => {
        try {
          const planData = await fs.readFile(getPlanPath(plan.id), 'utf-8');
          const fullData: CompletePlanData = JSON.parse(planData);
          const issues = runAllSceneValidations(fullData.musicians, fullData.monitorPoints);

          return {
            ...plan,
            musicianCount: fullData.musicians.length,
            monitorCount: fullData.monitorPoints.length,
            issueCount: issues.length,
          };
        } catch {
          return {
            ...plan,
            musicianCount: 0,
            monitorCount: 0,
            issueCount: 0,
          };
        }
      }));

      res.json(plansWithStats.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ));
    } catch {
      res.json([]);
    }
  } catch (error) {
    console.error('Failed to list plans:', error);
    res.status(500).json({ error: 'Failed to list plans' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const planPath = getPlanPath(id);
    try {
      const data = await fs.readFile(planPath, 'utf-8');
      const planData: CompletePlanData = JSON.parse(data);
      res.json(planData);
    } catch {
      res.status(404).json({ error: 'Plan not found' });
    }
  } catch (error) {
    console.error('Failed to load plan:', error);
    res.status(500).json({ error: 'Failed to load plan' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    await ensureDataDir();
    const data: CompletePlanData = req.body;

    if (!data.plan?.id) {
      return res.status(400).json({ error: 'Invalid plan data' });
    }

    const planPath = getPlanPath(data.plan.id);
    await fs.writeFile(planPath, JSON.stringify(data, null, 2));

    const indexPath = getIndexPath();
    let plans: RehearsalPlan[] = [];
    try {
      const indexData = await fs.readFile(indexPath, 'utf-8');
      plans = JSON.parse(indexData);
    } catch {
      plans = [];
    }

    const existingIndex = plans.findIndex(p => p.id === data.plan.id);
    if (existingIndex >= 0) {
      plans[existingIndex] = { ...data.plan, updatedAt: new Date() };
    } else {
      plans.push({ ...data.plan, updatedAt: new Date() });
    }

    await fs.writeFile(indexPath, JSON.stringify(plans, null, 2));
    res.json({ success: true, plan: data.plan });
  } catch (error) {
    console.error('Failed to save plan:', error);
    res.status(500).json({ error: 'Failed to save plan' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const planPath = getPlanPath(id);

    try {
      await fs.unlink(planPath);
    } catch {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const indexPath = getIndexPath();
    try {
      const indexData = await fs.readFile(indexPath, 'utf-8');
      let plans: RehearsalPlan[] = JSON.parse(indexData);
      plans = plans.filter(p => p.id !== id);
      await fs.writeFile(indexPath, JSON.stringify(plans, null, 2));
    } catch {
      // Index file might not exist yet, that's fine
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete plan:', error);
    res.status(500).json({ error: 'Failed to delete plan' });
  }
});

export default router;
