import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { BusinessErrors } from '../utils/errors';

const prisma = new PrismaClient();

export async function getPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const { memberId } = req.query;
    
    const payments = await prisma.coursePayment.findMany({
      where: memberId ? { memberId: String(memberId) } : undefined,
      orderBy: { purchaseDate: 'desc' },
    });

    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
}

export async function createPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { memberId, totalSessions, note } = req.body;

    if (!memberId || !totalSessions) {
      throw BusinessErrors.INVALID_INPUT('购课信息', '会员和课时数量不能为空');
    }

    if (totalSessions <= 0) {
      throw BusinessErrors.INVALID_INPUT('课时数量', '必须大于0');
    }

    const payment = await prisma.coursePayment.create({
      data: {
        memberId,
        totalSessions,
        note,
      },
    });

    res.json({ 
      success: true, 
      data: payment,
      message: `已为会员添加 ${totalSessions} 节课时`
    });
  } catch (err) {
    next(err);
  }
}
