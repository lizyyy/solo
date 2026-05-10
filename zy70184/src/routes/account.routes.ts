import { Router } from 'express';
import { accountController } from '../controllers/account.controller';

const router = Router();

router.post('/', accountController.validate.create, accountController.createAccount);
router.get('/', accountController.validate.list, accountController.listAccounts);
router.get('/:id', accountController.validate.get, accountController.getAccount);
router.post('/:id/verify', accountController.validate.verify, accountController.verifyAccount);
router.post('/:id/toggle', accountController.validate.toggle, accountController.toggleAccountStatus);

export default router;
