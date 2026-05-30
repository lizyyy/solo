import { Router } from 'express';
import SetlistController from '../controllers/SetlistController';
import ValidationController from '../controllers/ValidationController';

const router = Router();

router.post('/', SetlistController.create);
router.get('/', SetlistController.list);
router.get('/validate/key', ValidationController.validateKey);
router.get('/:id', SetlistController.get);
router.patch('/:id', SetlistController.update);
router.delete('/:id', SetlistController.remove);

export default router;
