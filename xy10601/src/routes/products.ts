import express from 'express';
import { inventoryService } from '../services/InventoryService';

const router = express.Router();

router.get('/', (req, res) => {
  const products = inventoryService.getAllInventory();
  res.json({ success: true, data: products });
});

router.get('/:productId', (req, res) => {
  const product = inventoryService.getInventory(req.params.productId);
  if (!product) {
    return res.status(404).json({ success: false, message: '商品不存在' });
  }
  res.json({ success: true, data: product });
});

export default router;
