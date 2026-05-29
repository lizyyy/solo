import { Router } from 'express';
import { StallController } from '../controllers/StallController';

const router = Router();
const controller = new StallController();

router.get('/', controller.getAll);
router.get('/entrance', controller.getEntrance);
router.get('/dimensions', controller.getDimensions);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);
router.post('/replace-grid', controller.replaceGrid);
router.post('/bulk', controller.bulkImport);

export default router;
