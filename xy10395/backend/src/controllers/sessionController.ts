import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { deductSession, getMemberRemainingSessions } from '../services/trainingService';
import { BusinessErrors } from '../utils/errors';

const prisma = new PrismaClient();

export async function getSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const { memberId } = req.query;
    
    const sessions = await prisma.trainingSession.findMany({
      where: memberId ? { memberId: String(memberId) } : undefined,
      include: { 
        exercises: true,
        plan: { select: { name: true, version: true } },
      },
      orderBy: { sessionDate: 'desc' },
    });

    res.json({ success: true, data: sessions });
  } catch (err) {
    next(err);
  }
}

export async function createSession(req: Request, res: Response, next: NextFunction) {
  try {
    const { memberId, planId, sessionDate, durationMinutes } = req.body;

    if (!memberId || !sessionDate) {
      throw BusinessErrors.INVALID_INPUT('会员或训练日期', '不能为空');
    }

    const remaining = await getMemberRemainingSessions(memberId);
    const hasLowSessions = remaining <= 3;

    const session = await prisma.trainingSession.create({
      data: {
        memberId,
        planId,
        sessionDate: new Date(sessionDate),
        durationMinutes: durationMinutes || 60,
      },
      include: { exercises: true },
    });

    res.json({ 
      success: true, 
      data: session,
      warning: hasLowSessions ? `会员剩余课时不足 (剩余 ${remaining} 节)，请注意提醒` : null,
    });
  } catch (err) {
    next(err);
  }
}

export async function completeSession(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { feedback, rating, exercises } = req.body;

    const session = await prisma.trainingSession.findUnique({
      where: { id },
    });

    if (!session) {
      throw BusinessErrors.MEMBER_NOT_FOUND();
    }

    const result = await deductSession(session.memberId, id);

    if (exercises && exercises.length > 0) {
      await prisma.sessionExercise.createMany({
        data: exercises.map((ex: any) => ({
          sessionId: id,
          exerciseName: ex.exerciseName,
          completedSets: ex.completedSets,
          completedReps: ex.completedReps,
          actualWeight: ex.actualWeight,
          notes: ex.notes,
        })),
      });
    }

    const updatedSession = await prisma.trainingSession.update({
      where: { id },
      data: { feedback, rating },
      include: { exercises: true },
    });

    res.json({ 
      success: true, 
      data: updatedSession,
      remainingSessions: result.remainingSessions,
      message: `训练已完成，已扣除1课时，剩余 ${result.remainingSessions} 节`,
    });
  } catch (err) {
    next(err);
  }
}
