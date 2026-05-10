import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateTrainingAdvice } from '../services/trainingAdviceService';
import { BusinessErrors } from '../utils/errors';
import { parseJsonArray } from '../utils/json';

const prisma = new PrismaClient();

export async function exportMemberPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const { memberId, planId } = req.query;

    const member = await prisma.member.findUnique({
      where: { id: String(memberId) },
      include: {
        bodyMeasurements: { orderBy: { measuredAt: 'desc' }, take: 1 },
        injuries: { where: { isActive: true } },
        payments: true,
      },
    });

    if (!member) {
      throw BusinessErrors.MEMBER_NOT_FOUND();
    }

    const plan = await prisma.trainingPlan.findUnique({
      where: { id: String(planId) },
      include: { exercises: { orderBy: { orderIndex: 'asc' } } },
    });

    if (!plan) {
      throw BusinessErrors.PLAN_NOT_FOUND();
    }

    const latestMeasurement = member.bodyMeasurements[0];
    const advice = latestMeasurement ? generateTrainingAdvice(latestMeasurement) : null;

    const totalSessions = member.payments.reduce((sum, p) => sum + p.totalSessions, 0);
    const usedSessions = member.payments.reduce((sum, p) => sum + p.usedSessions, 0);
    const remainingSessions = totalSessions - usedSessions;

    const exportData = {
      member: {
        name: member.name,
        phone: member.phone,
        joinDate: member.joinDate,
      },
      latestMeasurement: latestMeasurement ? {
        weight: latestMeasurement.weight,
        height: latestMeasurement.height,
        bmi: latestMeasurement.bmi,
        bodyFat: latestMeasurement.bodyFat,
        muscleMass: latestMeasurement.muscleMass,
        flexibility: latestMeasurement.flexibility,
        strength: latestMeasurement.strength,
        endurance: latestMeasurement.endurance,
        cardio: latestMeasurement.cardio,
        measuredAt: latestMeasurement.measuredAt,
      } : null,
      activeInjuries: member.injuries.map(i => ({
        bodyPart: i.bodyPart,
        severity: i.severity,
        description: i.description,
        restrictedActions: parseJsonArray(i.restrictedActions),
      })),
      trainingPlan: {
        name: plan.name,
        version: plan.version,
        description: plan.description,
        exercises: plan.exercises.map(e => ({
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          weight: e.weight,
          notes: e.notes,
        })),
        createdAt: plan.createdAt,
      },
      trainingAdvice: advice,
      sessionInfo: {
        total: totalSessions,
        used: usedSessions,
        remaining: remainingSessions,
      },
      exportDate: new Date(),
    };

    res.json({ 
      success: true, 
      data: exportData,
      message: '方案导出成功'
    });
  } catch (err) {
    next(err);
  }
}
