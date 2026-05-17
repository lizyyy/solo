import { Router, Request, Response } from 'express';
import { MasterDataService } from '../services/MasterDataService';

const router = Router();
const masterService = new MasterDataService();

router.post('/customers', async (req: Request, res: Response) => {
  try {
    const customer = await masterService.createCustomer(req.body);
    res.status(201).json(customer);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/customers', async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const customers = await masterService.getAllCustomers(includeInactive);
    res.json(customers);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/customers/:id', async (req: Request, res: Response) => {
  try {
    const customer = await masterService.getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: '客户不存在' });
    }
    res.json(customer);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/customers/:id', async (req: Request, res: Response) => {
  try {
    const customer = await masterService.updateCustomer(req.params.id, req.body);
    res.json(customer);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/customers/:id', async (req: Request, res: Response) => {
  try {
    const customer = await masterService.deactivateCustomer(req.params.id);
    res.json(customer);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/persons', async (req: Request, res: Response) => {
  try {
    const person = await masterService.createPersonInCharge(req.body);
    res.status(201).json(person);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/persons', async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const persons = await masterService.getAllPersonInCharge(includeInactive);
    res.json(persons);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/persons/:id', async (req: Request, res: Response) => {
  try {
    const person = await masterService.getPersonInChargeById(req.params.id);
    if (!person) {
      return res.status(404).json({ error: '负责人不存在' });
    }
    res.json(person);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/persons/:id', async (req: Request, res: Response) => {
  try {
    const person = await masterService.updatePersonInCharge(req.params.id, req.body);
    res.json(person);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/persons/:id', async (req: Request, res: Response) => {
  try {
    const person = await masterService.deactivatePersonInCharge(req.params.id);
    res.json(person);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
