import { Router, Request, Response } from 'express';
import * as customerDao from '../dao/customerDao';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, phone, address } = req.body;
    if (!name) {
      return res.status(400).json({ error: '客户名称不能为空' });
    }
    const id = await customerDao.createCustomer({ name, phone, address });
    res.status(201).json({ id, name, phone, address });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const customers = await customerDao.getAllCustomers();
    res.json(customers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const customer = await customerDao.getCustomerById(id);
    if (!customer) {
      return res.status(404).json({ error: '客户不存在' });
    }
    res.json(customer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name, phone, address } = req.body;
    await customerDao.updateCustomer(id, { name, phone, address });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
