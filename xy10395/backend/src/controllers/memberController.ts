import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { getMemberWithAdvice } from '../services/trainingAdviceService';
import { BusinessErrors } from '../utils/errors';
import { parseJsonArray } from '../utils/json';

const prisma = new PrismaClient();

function transformInjury(injury: any) {
  return {
    ...injury,
    restrictedActions: parseJsonArray(injury.restrictedActions),
  };
}

export async function getMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const members = await prisma.member.findMany({
      include: {
        bodyMeasurements: { orderBy: { measuredAt: 'desc' }, take: 1 },
        injuries: { where: { isActive: true } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const membersWithSummary = members.map(member => {
      const totalSessions = member.payments.reduce((sum, p) => sum + p.totalSessions, 0);
      const usedSessions = member.payments.reduce((sum, p) => sum + p.usedSessions, 0);
      
      return {
        id: member.id,
        name: member.name,
        phone: member.phone,
        email: member.email,
        joinDate: member.joinDate,
        latestMeasurement: member.bodyMeasurements[0],
        activeInjuries: member.injuries.map(transformInjury),
        remainingSessions: totalSessions - usedSessions,
        hasLowSessions: (totalSessions - usedSessions) <= 3,
      };
    });

    res.json({ success: true, data: membersWithSummary });
  } catch (err) {
    next(err);
  }
}

export async function getMember(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const member = await getMemberWithAdvice(id);
    
    if (!member) {
      throw BusinessErrors.MEMBER_NOT_FOUND();
    }

    res.json({ success: true, data: member });
  } catch (err) {
    next(err);
  }
}

export async function createMember(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, phone, email } = req.body;
    
    if (!name || !phone) {
      throw BusinessErrors.INVALID_INPUT('姓名或手机号', '不能为空');
    }

    const member = await prisma.member.create({
      data: { name, phone, email },
    });

    res.json({ success: true, data: member });
  } catch (err) {
    next(err);
  }
}

export async function updateMember(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { name, phone, email } = req.body;

    const member = await prisma.member.update({
      where: { id },
      data: { name, phone, email },
    });

    res.json({ success: true, data: member });
  } catch (err) {
    next(err);
  }
}
