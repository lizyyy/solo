import express from 'express';
import { mockDeductionItems } from '../mock/data';

const router = express.Router();

router.get('/', (req, res) => {
  const { category } = req.query;
  let items = [...mockDeductionItems];
  
  if (category) {
    items = items.filter(i => i.category === category);
  }
  
  res.json(items);
});

router.get('/categories', (req, res) => {
  const categories = [...new Set(mockDeductionItems.map(i => i.category))];
  res.json(categories);
});

export default router;
