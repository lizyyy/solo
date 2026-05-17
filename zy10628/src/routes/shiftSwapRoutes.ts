import { Router } from 'express';
import sqlite3 from 'sqlite3';
import { ShiftSwapController } from '../controllers/ShiftSwapController';

export function createShiftSwapRoutes(db: sqlite3.Database): Router {
  const router = Router();
  const controller = new ShiftSwapController(db);

  router.post('/', controller.createSwap);
  router.get('/', controller.getSwapList);
  router.get('/export', controller.exportSwaps);
  router.post('/validate-import', controller.validateImport);
  router.get('/:id', controller.getSwapById);
  router.get('/:id/history', controller.getSwapHistory);
  router.patch('/:id/confirm', controller.confirmSwap);
  router.patch('/:id/complete', controller.completeSwap);

  return router;
}
