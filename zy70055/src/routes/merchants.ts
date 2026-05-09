import { Router, Request, Response } from 'express';
import { prisma } from '../config';
import { asyncHandler } from '../middleware';

const router = Router();

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const merchants = await prisma.merchant.findMany({
    include: { feeRule: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    success: true,
    data: merchants,
  });
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: req.params.id },
    include: {
      feeRule: true,
      batches: { take: 10, orderBy: { createdAt: 'desc' } },
    },
  });

  res.json({
    success: true,
    data: merchant,
  });
}));

router.get('/:id/batches', asyncHandler(async (req: Request, res: Response) => {
  const batches = await prisma.settlementBatch.findMany({
    where: { merchantId: req.params.id },
    include: { merchant: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    success: true,
    data: batches,
  });
}));

export { router as merchantsRouter };
