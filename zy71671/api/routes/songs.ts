import { Router } from 'express';
import SongController from '../controllers/SongController';

const router = Router({ mergeParams: true });

router.post('/', SongController.create);
router.get('/', SongController.list);
router.get('/:songId', SongController.get);
router.patch('/:songId', SongController.update);
router.delete('/:songId', SongController.remove);

export default router;
