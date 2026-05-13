import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';
import { createReagent, updateReagent, getReagents, getReagentById } from '../services/reagentService';

const router = Router();

router.use(authenticateToken);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const reagent = await createReagent({
      ...req.body,
      createdBy: req.user!.id,
    });
    res.status(201).json(reagent);
  })
);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await getReagents({
      page: Number(req.query.page),
      limit: Number(req.query.limit),
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      search: req.query.search as string,
    });
    res.json(result);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const reagent = await getReagentById(req.params.id);
    if (!reagent) {
      return res.status(404).json({ error: '试剂不存在' });
    }
    res.json(reagent);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const reagent = await updateReagent(req.params.id, req.body, req.user!.id);
    res.json(reagent);
  })
);

export default router;
