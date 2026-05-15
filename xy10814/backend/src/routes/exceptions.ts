import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { AppDataSource } from '../config/database';
import { ExceptionTemplate } from '../entities/ExceptionTemplate';

const router = Router();
const templateRepository = AppDataSource.getRepository(ExceptionTemplate);

const templateSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().required(),
  responseBody: Joi.object().required(),
  statusCode: Joi.number().required(),
  description: Joi.string().allow(''),
  isActive: Joi.boolean().default(true)
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { type, isActive } = req.query;
    const where: any = {};
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const templates = await templateRepository.find({
      where,
      order: { createdAt: 'DESC' }
    });

    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const template = await templateRepository.findOneBy({ id: req.params.id });
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { error, value } = templateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const template = templateRepository.create(value);
    await templateRepository.save(template);

    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { error, value } = templateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const template = await templateRepository.findOneBy({ id: req.params.id });
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    templateRepository.merge(template, value);
    await templateRepository.save(template);

    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await templateRepository.delete(req.params.id);
    if (result.affected === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
