import { Router } from 'express';
import { VendorController } from '../controllers/VendorController';

const router = Router();
const controller = new VendorController();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);
router.post('/bulk', controller.bulkImport);

export default router;
