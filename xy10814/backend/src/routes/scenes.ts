import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { AppDataSource } from '../config/database';
import { ResponseScene } from '../entities/ResponseScene';

const router = Router();
const sceneRepository = AppDataSource.getRepository(ResponseScene);

const matchRuleSchema = Joi.object({
  type: Joi.string().valid('header', 'query', 'body', 'path').required(),
  key: Joi.string().required(),
  value: Joi.string().allow(''),
  operator: Joi.string().valid('equals', 'contains', 'regex', 'exists').required()
});

const delayConfigSchema = Joi.object({
  enabled: Joi.boolean().default(false),
  minDelay: Joi.number().min(0).default(0),
  maxDelay: Joi.number().min(0).default(1000),
  fixedDelay: Joi.number().min(0),
  strategy: Joi.string().valid('fixed', 'random', 'linear').default('fixed')
});

const sceneSchema = Joi.object({
  name: Joi.string().required(),
  contractId: Joi.string().required(),
  matchRules: Joi.array().items(matchRuleSchema).default([]),
  responseBody: Joi.object().required(),
  statusCode: Joi.number().default(200),
  headers: Joi.object().allow(null),
  isDefault: Joi.boolean().default(false),
  isEnabled: Joi.boolean().default(true),
  delayConfig: delayConfigSchema.allow(null)
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { contractId } = req.query;
    const where: any = {};
    if (contractId) where.contractId = contractId;

    const scenes = await sceneRepository.find({
      where,
      order: { createdAt: 'DESC' }
    });

    res.json({ success: true, data: scenes });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const scene = await sceneRepository.findOneBy({ id: req.params.id });
    if (!scene) {
      return res.status(404).json({ success: false, error: 'Scene not found' });
    }

    res.json({ success: true, data: scene });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { error, value } = sceneSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    if (value.isDefault) {
      await sceneRepository.update(
        { contractId: value.contractId, isDefault: true },
        { isDefault: false }
      );
    }

    const scene = sceneRepository.create(value);
    await sceneRepository.save(scene);

    res.status(201).json({ success: true, data: scene });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { error, value } = sceneSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const scene = await sceneRepository.findOneBy({ id: req.params.id });
    if (!scene) {
      return res.status(404).json({ success: false, error: 'Scene not found' });
    }

    if (value.isDefault && !scene.isDefault) {
      await sceneRepository.update(
        { contractId: scene.contractId, isDefault: true },
        { isDefault: false }
      );
    }

    sceneRepository.merge(scene, value);
    await sceneRepository.save(scene);

    res.json({ success: true, data: scene });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await sceneRepository.delete(req.params.id);
    if (result.affected === 0) {
      return res.status(404).json({ success: false, error: 'Scene not found' });
    }

    res.json({ success: true, message: 'Scene deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.patch('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const scene = await sceneRepository.findOneBy({ id: req.params.id });
    if (!scene) {
      return res.status(404).json({ success: false, error: 'Scene not found' });
    }

    scene.isEnabled = !scene.isEnabled;
    await sceneRepository.save(scene);

    res.json({ success: true, data: scene });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.patch('/:id/set-default', async (req: Request, res: Response) => {
  try {
    const scene = await sceneRepository.findOneBy({ id: req.params.id });
    if (!scene) {
      return res.status(404).json({ success: false, error: 'Scene not found' });
    }

    await sceneRepository.update(
      { contractId: scene.contractId, isDefault: true },
      { isDefault: false }
    );

    scene.isDefault = true;
    await sceneRepository.save(scene);

    res.json({ success: true, data: scene });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
