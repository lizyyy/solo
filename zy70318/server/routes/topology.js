import express from 'express';
import { Store } from '../data/store.js';

const router = express.Router();

router.get('/services', (req, res) => {
  res.json(Store.getServices());
});

router.get('/dependencies', (req, res) => {
  res.json(Store.getDependencies());
});

router.get('/', (req, res) => {
  res.json({
    services: Store.getServices(),
    dependencies: Store.getDependencies(),
  });
});

export default router;
