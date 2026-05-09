import { Router, Request, Response } from 'express';
import { transactionService, CreateTransactionRequest } from '../services/transaction-service';
import { customerService } from '../services/customer-service';

export const transactionRouter = Router();

transactionRouter.post('/', async (req: Request, res: Response) => {
  try {
    const request: CreateTransactionRequest = req.body;

    if (!request.idempotentKey || !request.customerId || !request.type || 
        !request.currency || !request.foreignCurrencyAmount) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必填字段: idempotentKey, customerId, type, currency, foreignCurrencyAmount' 
      });
    }

    const customer = await customerService.getCustomerById(request.customerId);
    if (!customer) {
      return res.status(404).json({ success: false, error: '客户不存在' });
    }

    const transaction = await transactionService.createTransaction(request);

    res.status(201).json({ success: true, data: transaction });
  } catch (error: any) {
    if (error.message.includes('请求正在处理中')) {
      return res.status(409).json({ success: false, error: error.message });
    }
    if (error.message.includes('额度不足')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

transactionRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const transaction = await transactionService.getTransactionById(id);

    res.json({ success: true, data: transaction });
  } catch (error: any) {
    if (error.message.includes('交易不存在')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

transactionRouter.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { limit } = req.query;

    const customer = await customerService.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, error: '客户不存在' });
    }

    const transactions = await transactionService.getCustomerTransactions(
      customerId,
      limit ? parseInt(limit as string) : 100
    );

    res.json({ success: true, data: transactions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

transactionRouter.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const transaction = await transactionService.cancelTransaction(id);

    res.json({ 
      success: true, 
      message: '交易已取消', 
      data: transaction 
    });
  } catch (error: any) {
    if (error.message.includes('交易不存在')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.message.includes('无法取消')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});