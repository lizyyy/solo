import { Router, Request, Response } from 'express';
import { customerService } from '../services/customer-service';

export const customerRouter = Router();

customerRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, idCardNo } = req.body;

    if (!name || !idCardNo) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必填字段: name, idCardNo' 
      });
    }

    const customer = await customerService.createCustomer(name, idCardNo);

    res.status(201).json({ success: true, data: customer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

customerRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const customer = await customerService.getCustomerById(id);

    if (!customer) {
      return res.status(404).json({ success: false, error: '客户不存在' });
    }

    res.json({ success: true, data: customer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

customerRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const customers = await customerService.getAllCustomers(
      limit ? parseInt(limit as string) : 100
    );

    res.json({ success: true, data: customers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});