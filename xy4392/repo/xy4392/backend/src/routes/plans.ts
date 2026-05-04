import { Router, Request, Response } from 'express';
import { planModel, lightModel, actorModel, cameraModel, scheduleModel, riskModel } from '../database/models';
import { calculateAllRisks } from '../services/riskCalculator';
import { generateMarkdownHandover, generateExportPackage } from '../services/exportService';
import { parseLightCsv, parseCameraActorJson, parseScheduleJson } from '../services/importService';
import { PlacedLight, Actor, Camera, ScheduleItem, Vec3 } from '../types';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', (req: Request, res: Response) => {
  try {
    const plans = planModel.getAll();
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const plan = planModel.getById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const lights = lightModel.getByPlan(req.params.id);
    const actors = actorModel.getByPlan(req.params.id);
    const cameras = cameraModel.getByPlan(req.params.id);
    const schedule = scheduleModel.getByPlan(req.params.id);
    const risks = riskModel.getByPlan(req.params.id, true);

    res.json({
      success: true,
      data: {
        plan,
        lights,
        actors,
        cameras,
        schedule,
        risks
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, description, studioDimensions, maxPowerLimit } = req.body;

    if (!name || !studioDimensions) {
      return res.status(400).json({ success: false, error: 'Name and studioDimensions are required' });
    }

    const plan = planModel.create({
      name,
      description: description || '',
      studioDimensions,
      totalPower: 0,
      maxPowerLimit: maxPowerLimit || 5000
    });

    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const { name, description, studioDimensions, maxPowerLimit } = req.body;
    
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (studioDimensions !== undefined) updateData.studioDimensions = studioDimensions;
    if (maxPowerLimit !== undefined) updateData.maxPowerLimit = maxPowerLimit;

    const plan = planModel.update(req.params.id, updateData);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const success = planModel.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.post('/:id/lights', (req: Request, res: Response) => {
  try {
    const plan = planModel.getById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const { name, type, power, colorTemp, dmxChannel, isHighTemp, position, rotation, intensity, color, standHeight, notes } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const light = lightModel.create(req.params.id, {
      name,
      type: type || '',
      power: power || 0,
      colorTemp: colorTemp || 5600,
      dmxChannel,
      isHighTemp: isHighTemp || false,
      position: position || { x: 0, y: 1.5, z: 0 },
      rotation: rotation || { x: 0, y: 0, z: 0 },
      intensity: intensity ?? 1,
      color: color || '#ffffff',
      standHeight: standHeight || 2,
      notes: notes || ''
    });

    const allLights = lightModel.getByPlan(req.params.id);
    const totalPower = allLights.reduce((sum, l) => sum + l.power, 0);
    planModel.update(req.params.id, { totalPower });

    res.status(201).json({ success: true, data: light });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.put('/:id/lights/:lightId', (req: Request, res: Response) => {
  try {
    const light = lightModel.update(req.params.lightId, req.body);
    if (!light) {
      return res.status(404).json({ success: false, error: 'Light not found' });
    }

    const allLights = lightModel.getByPlan(req.params.id);
    const totalPower = allLights.reduce((sum, l) => sum + l.power, 0);
    planModel.update(req.params.id, { totalPower });

    res.json({ success: true, data: light });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.delete('/:id/lights/:lightId', (req: Request, res: Response) => {
  try {
    const success = lightModel.delete(req.params.lightId);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Light not found' });
    }

    const allLights = lightModel.getByPlan(req.params.id);
    const totalPower = allLights.reduce((sum, l) => sum + l.power, 0);
    planModel.update(req.params.id, { totalPower });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.post('/:id/actors', (req: Request, res: Response) => {
  try {
    const plan = planModel.getById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const { name, position, rotation, walkPath } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const actor = actorModel.create(req.params.id, {
      name,
      position: position || { x: 0, y: 0, z: 0 },
      rotation: rotation || { x: 0, y: 0, z: 0 },
      walkPath
    });

    res.status(201).json({ success: true, data: actor });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.put('/:id/actors/:actorId', (req: Request, res: Response) => {
  try {
    const actor = actorModel.update(req.params.actorId, req.body);
    if (!actor) {
      return res.status(404).json({ success: false, error: 'Actor not found' });
    }
    res.json({ success: true, data: actor });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.delete('/:id/actors/:actorId', (req: Request, res: Response) => {
  try {
    const success = actorModel.delete(req.params.actorId);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Actor not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.post('/:id/cameras', (req: Request, res: Response) => {
  try {
    const plan = planModel.getById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const { name, position, rotation, lens, fov } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const camera = cameraModel.create(req.params.id, {
      name,
      position: position || { x: 0, y: 1.5, z: 0 },
      rotation: rotation || { x: 0, y: 0, z: 0 },
      lens: lens || '50mm',
      fov: fov || 60
    });

    res.status(201).json({ success: true, data: camera });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.put('/:id/cameras/:cameraId', (req: Request, res: Response) => {
  try {
    const camera = cameraModel.update(req.params.cameraId, req.body);
    if (!camera) {
      return res.status(404).json({ success: false, error: 'Camera not found' });
    }
    res.json({ success: true, data: camera });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.delete('/:id/cameras/:cameraId', (req: Request, res: Response) => {
  try {
    const success = cameraModel.delete(req.params.cameraId);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Camera not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.post('/:id/schedule', (req: Request, res: Response) => {
  try {
    const plan = planModel.getById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const { sceneId, sceneName, startTime, endTime, date, lightIds, cameraIds, actorIds, notes } = req.body;
    if (!sceneId || !sceneName || !startTime || !endTime || !date) {
      return res.status(400).json({ success: false, error: 'Required fields: sceneId, sceneName, startTime, endTime, date' });
    }

    const scheduleItem = scheduleModel.create(req.params.id, {
      sceneId,
      sceneName,
      startTime,
      endTime,
      date,
      lightIds: lightIds || [],
      cameraIds: cameraIds || [],
      actorIds: actorIds || [],
      notes: notes || ''
    });

    res.status(201).json({ success: true, data: scheduleItem });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.put('/:id/schedule/:scheduleId', (req: Request, res: Response) => {
  try {
    const scheduleItem = scheduleModel.update(req.params.scheduleId, req.body);
    if (!scheduleItem) {
      return res.status(404).json({ success: false, error: 'Schedule item not found' });
    }
    res.json({ success: true, data: scheduleItem });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.delete('/:id/schedule/:scheduleId', (req: Request, res: Response) => {
  try {
    const success = scheduleModel.delete(req.params.scheduleId);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Schedule item not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.post('/:id/calculate-risks', (req: Request, res: Response) => {
  try {
    const plan = planModel.getById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const lights = lightModel.getByPlan(req.params.id);
    const actors = actorModel.getByPlan(req.params.id);
    const cameras = cameraModel.getByPlan(req.params.id);
    const schedule = scheduleModel.getByPlan(req.params.id);

    const riskResults = calculateAllRisks({
      lights,
      actors,
      cameras,
      schedule,
      studioDimensions: plan.studioDimensions,
      maxPowerLimit: plan.maxPowerLimit
    });

    riskModel.deleteByPlan(req.params.id);

    const risks = riskResults.map(r => 
      riskModel.create(req.params.id, {
        type: r.type,
        severity: r.severity,
        title: r.title,
        description: r.description,
        affectedItems: r.affectedItems,
        isOverridden: false,
        overrideReason: '',
        overrideBy: ''
      })
    );

    res.json({ success: true, data: risks });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.put('/:id/risks/:riskId/override', (req: Request, res: Response) => {
  try {
    const { isOverridden, overrideReason, overrideBy } = req.body;
    const risk = riskModel.updateOverride(
      req.params.riskId,
      isOverridden ?? true,
      overrideReason || '',
      overrideBy || 'user'
    );

    if (!risk) {
      return res.status(404).json({ success: false, error: 'Risk not found' });
    }

    res.json({ success: true, data: risk });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.get('/:id/export/markdown', (req: Request, res: Response) => {
  try {
    const plan = planModel.getById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const lights = lightModel.getByPlan(req.params.id);
    const actors = actorModel.getByPlan(req.params.id);
    const cameras = cameraModel.getByPlan(req.params.id);
    const schedule = scheduleModel.getByPlan(req.params.id);
    const risks = riskModel.getByPlan(req.params.id, true);

    const markdown = generateMarkdownHandover({
      plan,
      lights,
      actors,
      cameras,
      schedule,
      risks
    });

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="lighting-plan-${plan.id}.md"`);
    res.send(markdown);
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.get('/:id/export/json', (req: Request, res: Response) => {
  try {
    const plan = planModel.getById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const lights = lightModel.getByPlan(req.params.id);
    const actors = actorModel.getByPlan(req.params.id);
    const cameras = cameraModel.getByPlan(req.params.id);
    const schedule = scheduleModel.getByPlan(req.params.id);
    const risks = riskModel.getByPlan(req.params.id, true);

    const pkg = generateExportPackage({
      plan,
      lights,
      actors,
      cameras,
      schedule,
      risks
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="lighting-audit-${plan.id}.json"`);
    res.json(pkg);
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.post('/:id/import/lights', upload.single('file'), (req: Request, res: Response) => {
  try {
    const plan = planModel.getById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const content = req.file.buffer.toString('utf-8');
    const result = parseLightCsv(content);

    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.errors });
    }

    const createdLights: PlacedLight[] = [];
    for (const fixture of result.data) {
      const light = lightModel.create(req.params.id, {
        ...fixture,
        position: { x: 0, y: 1.5, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        intensity: 1,
        color: '#ffffff',
        standHeight: 2,
        notes: ''
      });
      createdLights.push(light);
    }

    const allLights = lightModel.getByPlan(req.params.id);
    const totalPower = allLights.reduce((sum, l) => sum + l.power, 0);
    planModel.update(req.params.id, { totalPower });

    res.json({ 
      success: true, 
      data: createdLights,
      errors: result.errors
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.post('/:id/import/camera-actor', upload.single('file'), (req: Request, res: Response) => {
  try {
    const plan = planModel.getById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const content = req.file.buffer.toString('utf-8');
    const result = parseCameraActorJson(content);

    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.errors });
    }

    const createdActors: Actor[] = [];
    const createdCameras: Camera[] = [];

    if (result.data.actors) {
      for (const actor of result.data.actors) {
        createdActors.push(actorModel.create(req.params.id, actor));
      }
    }

    if (result.data.cameras) {
      for (const camera of result.data.cameras) {
        createdCameras.push(cameraModel.create(req.params.id, camera));
      }
    }

    res.json({ 
      success: true, 
      data: { actors: createdActors, cameras: createdCameras },
      errors: result.errors
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.post('/:id/import/schedule', upload.single('file'), (req: Request, res: Response) => {
  try {
    const plan = planModel.getById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const content = req.file.buffer.toString('utf-8');
    const result = parseScheduleJson(content);

    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.errors });
    }

    const createdSchedule: ScheduleItem[] = [];
    for (const item of result.data) {
      createdSchedule.push(scheduleModel.create(req.params.id, item));
    }

    res.json({ 
      success: true, 
      data: createdSchedule,
      errors: result.errors
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

export default router;
