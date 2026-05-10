import { Router } from 'express';
import { getInjuries, createInjury, updateInjury } from '../controllers/injuryController';

const router = Router();

router.get('/', getInjuries);
router.post('/', createInjury);
router.put('/:id', updateInjury);

export default router;
