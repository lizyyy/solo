import { Router } from 'express';
import { getMembers, getMember, createMember, updateMember } from '../controllers/memberController';

const router = Router();

router.get('/', getMembers);
router.get('/:id', getMember);
router.post('/', createMember);
router.put('/:id', updateMember);

export default router;
