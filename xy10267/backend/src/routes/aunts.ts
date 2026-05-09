import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getState, setState, addHistory } from '../data/store';
import { Aunt } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { aunts } = getState();
  res.json({ success: true, data: aunts });
});

router.get('/:id', (req: Request, res: Response) => {
  const { aunts } = getState();
  const aunt = aunts.find(a => a.id === req.params.id);
  if (!aunt) {
    return res.status(404).json({ success: false, error: '阿姨不存在' });
  }
  res.json({ success: true, data: aunt });
});

router.post('/', (req: Request, res: Response) => {
  const { aunts } = getState();
  const existing = aunts.find(a => a.phone === req.body.phone);
  
  if (existing) {
    return res.status(400).json({ 
      success: false, 
      error: '该手机号已存在，请使用其他手机号' 
    });
  }
  
  const now = new Date().toISOString();
  const newAunt: Aunt = {
    id: `aunt_${uuidv4()}`,
    name: req.body.name,
    phone: req.body.phone,
    avatar: req.body.avatar,
    skills: req.body.skills || [],
    taboos: req.body.taboos || [],
    location: req.body.location,
    rating: req.body.rating || 4.0,
    experienceYears: req.body.experienceYears || 0,
    isAvailable: true,
    createdAt: now,
    updatedAt: now
  };
  
  setState({ aunts: [...aunts, newAunt] });
  addHistory({
    entityType: 'aunt',
    entityId: newAunt.id,
    action: 'create',
    description: `添加新阿姨: ${newAunt.name}`,
    newState: { ...newAunt }
  });
  
  res.json({ success: true, data: newAunt });
});

router.put('/:id', (req: Request, res: Response) => {
  const { aunts } = getState();
  const index = aunts.findIndex(a => a.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, error: '阿姨不存在' });
  }
  
  const previousState = { ...aunts[index] };
  const updatedAunt: Aunt = {
    ...aunts[index],
    ...req.body,
    id: aunts[index].id,
    updatedAt: new Date().toISOString()
  };
  
  const newAunts = [...aunts];
  newAunts[index] = updatedAunt;
  setState({ aunts: newAunts });
  
  addHistory({
    entityType: 'aunt',
    entityId: updatedAunt.id,
    action: 'update',
    description: `更新阿姨信息: ${updatedAunt.name}`,
    previousState,
    newState: { ...updatedAunt }
  });
  
  res.json({ success: true, data: updatedAunt });
});

router.delete('/:id', (req: Request, res: Response) => {
  const { aunts } = getState();
  const aunt = aunts.find(a => a.id === req.params.id);
  
  if (!aunt) {
    return res.status(404).json({ success: false, error: '阿姨不存在' });
  }
  
  setState({ aunts: aunts.filter(a => a.id !== req.params.id) });
  
  addHistory({
    entityType: 'aunt',
    entityId: req.params.id,
    action: 'delete',
    description: `删除阿姨: ${aunt.name}`
  });
  
  res.json({ success: true, message: '删除成功' });
});

export default router;
