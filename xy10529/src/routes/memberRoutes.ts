import { Router, Request, Response } from 'express';
import { benefitService } from '../services/benefitService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.post('/create', (req: Request, res: Response) => {
  const { name, phone } = req.body;
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  if (!name || !phone) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: name 或 phone',
      requestId
    });
  }

  const result = benefitService.createMember({
    requestId,
    name,
    phone
  });

  res.json(result);
});

router.get('/:memberId', (req: Request, res: Response) => {
  const { memberId } = req.params;
  const result = benefitService.getMember({ memberId });
  res.json(result);
});

router.get('/:memberId/benefits', (req: Request, res: Response) => {
  const { memberId } = req.params;
  const result = benefitService.queryMemberBenefits({ memberId });
  res.json(result);
});

export { router as memberRouter };
