import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { BusinessErrors } from '../utils/errors';
import { parseJsonArray, stringifyJsonArray } from '../utils/json';

const prisma = new PrismaClient();

function transformInjury(injury: any) {
  return {
    ...injury,
    restrictedActions: parseJsonArray(injury.restrictedActions),
  };
}

export async function getInjuries(req: Request, res: Response, next: NextFunction) {
  try {
    const { memberId, activeOnly } = req.query;
    
    const injuries = await prisma.injury.findMany({
      where: {
        memberId: memberId ? String(memberId) : undefined,
        isActive: activeOnly === 'true' ? true : undefined,
      },
      orderBy: { createdAt: 'desc' },
    });

    const transformed = injuries.map(transformInjury);
    res.json({ success: true, data: transformed });
  } catch (err) {
    next(err);
  }
}

export async function createInjury(req: Request, res: Response, next: NextFunction) {
  try {
    const { memberId, bodyPart, severity, description, restrictedActions, startDate, endDate } = req.body;

    if (!memberId || !bodyPart || !severity) {
      throw BusinessErrors.INVALID_INPUT('伤病信息', '会员、部位和严重程度不能为空');
    }

    const injury = await prisma.injury.create({
      data: {
        memberId,
        bodyPart,
        severity,
        description,
        restrictedActions: stringifyJsonArray(restrictedActions),
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    res.json({ 
      success: true, 
      data: transformInjury(injury),
      message: `已记录${bodyPart}部位${severity}度伤病，系统将自动限制相关动作`
    });
  } catch (err) {
    next(err);
  }
}

export async function updateInjury(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { isActive, endDate } = req.body;

    const injury = await prisma.injury.update({
      where: { id },
      data: { 
        isActive,
        endDate: endDate ? new Date(endDate) : undefined,
      },
    });

    res.json({ 
      success: true, 
      data: transformInjury(injury),
      message: isActive ? '伤病状态已更新' : '伤病已标记为康复'
    });
  } catch (err) {
    next(err);
  }
}
