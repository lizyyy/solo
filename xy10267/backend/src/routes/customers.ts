import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getState, setState, addHistory } from '../data/store';
import { Customer } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { customers } = getState();
  res.json({ success: true, data: customers });
});

router.get('/:id', (req: Request, res: Response) => {
  const { customers } = getState();
  const customer = customers.find(c => c.id === req.params.id);
  if (!customer) {
    return res.status(404).json({ success: false, error: '客户不存在' });
  }
  res.json({ success: true, data: customer });
});

router.post('/', (req: Request, res: Response) => {
  const { customers } = getState();
  const existing = customers.find(c => c.phone === req.body.phone);
  
  if (existing) {
    return res.status(400).json({ 
      success: false, 
      error: '该手机号已存在' 
    });
  }
  
  const now = new Date().toISOString();
  const newCustomer: Customer = {
    id: `cust_${uuidv4()}`,
    name: req.body.name,
    phone: req.body.phone,
    location: req.body.location,
    taboos: req.body.taboos || [],
    notes: req.body.notes,
    createdAt: now,
    updatedAt: now
  };
  
  setState({ customers: [...customers, newCustomer] });
  addHistory({
    entityType: 'order',
    entityId: newCustomer.id,
    action: 'create',
    description: `添加新客户: ${newCustomer.name}`,
    newState: { ...newCustomer }
  });
  
  res.json({ success: true, data: newCustomer });
});

router.put('/:id', (req: Request, res: Response) => {
  const { customers } = getState();
  const index = customers.findIndex(c => c.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, error: '客户不存在' });
  }
  
  const previousState = { ...customers[index] };
  const updatedCustomer: Customer = {
    ...customers[index],
    ...req.body,
    id: customers[index].id,
    updatedAt: new Date().toISOString()
  };
  
  const newCustomers = [...customers];
  newCustomers[index] = updatedCustomer;
  setState({ customers: newCustomers });
  
  addHistory({
    entityType: 'order',
    entityId: updatedCustomer.id,
    action: 'update',
    description: `更新客户信息: ${updatedCustomer.name}`,
    previousState,
    newState: { ...updatedCustomer }
  });
  
  res.json({ success: true, data: updatedCustomer });
});

router.delete('/:id', (req: Request, res: Response) => {
  const { customers } = getState();
  const customer = customers.find(c => c.id === req.params.id);
  
  if (!customer) {
    return res.status(404).json({ success: false, error: '客户不存在' });
  }
  
  setState({ customers: customers.filter(c => c.id !== req.params.id) });
  
  addHistory({
    entityType: 'order',
    entityId: req.params.id,
    action: 'delete',
    description: `删除客户: ${customer.name}`
  });
  
  res.json({ success: true, message: '删除成功' });
});

export default router;
