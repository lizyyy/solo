import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { AppDataSource } from '../config/database';
import { Contract } from '../entities/Contract';

const router = Router();
const contractRepository = AppDataSource.getRepository(Contract);

const contractSchema = Joi.object({
  name: Joi.string().required(),
  path: Joi.string().required(),
  method: Joi.string().valid('GET', 'POST', 'PUT', 'DELETE', 'PATCH').default('GET'),
  description: Joi.string().allow(''),
  requestSchema: Joi.object().allow(null),
  responseSchema: Joi.object().allow(null),
  isActive: Joi.boolean().default(true),
  environment: Joi.string().default('production')
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, environment, isActive } = req.query;
    const where: any = {};
    if (environment) where.environment = environment;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [contracts, total] = await contractRepository.findAndCount({
      where,
      relations: ['scenes'],
      order: { createdAt: 'DESC' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    });

    res.json({
      success: true, data: contracts, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const contract = await contractRepository.findOne({
      where: { id: req.params.id },
      relations: ['scenes']
    });
    
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found' });
    }

    res.json({ success: true, data: contract });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { error, value } = contractSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const existing = await contractRepository.findOne({ where: { path: value.path, method: value.method } });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Contract with this path and method already exists' });
    }

    const contract = contractRepository.create(value);
    await contractRepository.save(contract);

    res.status(201).json({ success: true, data: contract });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { error, value } = contractSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const contract = await contractRepository.findOneBy({ id: req.params.id });
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found' });
    }

    contractRepository.merge(contract, value);
    await contractRepository.save(contract);

    res.json({ success: true, data: contract });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await contractRepository.delete(req.params.id);
    if (result.affected === 0) {
      return res.status(404).json({ success: false, error: 'Contract not found' });
    }

    res.json({ success: true, message: 'Contract deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/import', async (req: Request, res: Response) => {
  try {
    const { contracts } = req.body;
    if (!Array.isArray(contracts)) {
      return res.status(400).json({ success: false, error: 'Invalid contracts format' });
    }

    const results = [];
    for (const contractData of contracts) {
      try {
        const { error, value } = contractSchema.validate(contractData);
        if (error) {
          results.push({ name: contractData.name, success: false, error: error.details[0].message });
          continue;
        }

        const existing = await contractRepository.findOne({ where: { path: value.path, method: value.method } });
        if (existing) {
          contractRepository.merge(existing, value);
          await contractRepository.save(existing);
          results.push({ name: value.name, success: true, action: 'updated', id: existing.id });
        } else {
          const contract = contractRepository.create(value);
          await contractRepository.save(contract);
          results.push({ name: value.name, success: true, action: 'created', id: contract.id });
        }
      } catch (e) {
        results.push({ name: contractData.name, success: false, error: (e as Error).message });
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
