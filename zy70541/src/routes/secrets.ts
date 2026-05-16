import { Router } from 'express';
import secretController from '../controllers/SecretController';

const router = Router();

router.get('/', secretController.getErrors);

export default router;
