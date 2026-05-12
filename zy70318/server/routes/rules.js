import express from 'express';
import { Store } from '../data/store.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json(Store.getRules());
});

router.get('/:id', (req, res) => {
  const rule = Store.getRuleById(req.params.id);
  if (!rule) return res.status(404).json({ error: '规则不存在' });
  res.json(rule);
});

router.post('/', (req, res) => {
  const current = Store.getCurrentDrill();
  if (current && current.status === 'running') {
    return res.status(409).json({ error: '演练进行中，禁止修改规则' });
  }
  const rule = Store.createRule(req.body);
  res.status(201).json(rule);
});

router.put('/:id', (req, res) => {
  const current = Store.getCurrentDrill();
  if (current && current.status === 'running') {
    return res.status(409).json({ error: '演练进行中，禁止修改规则' });
  }
  const rule = Store.updateRule(req.params.id, req.body);
  if (!rule) return res.status(404).json({ error: '规则不存在' });
  res.json(rule);
});

router.delete('/:id', (req, res) => {
  const current = Store.getCurrentDrill();
  if (current && current.status === 'running') {
    return res.status(409).json({ error: '演练进行中，禁止修改规则' });
  }
  Store.deleteRule(req.params.id);
  res.status(204).send();
});

export default router;
