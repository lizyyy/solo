import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { validatePlanExercises } from '../services/trainingService';
import { BusinessErrors } from '../utils/errors';

const prisma = new PrismaClient();

export async function getPlans(req: Request, res: Response, next: NextFunction) {
  try {
    const { memberId } = req.query;
    
    const plans = await prisma.trainingPlan.findMany({
      where: memberId ? { memberId: String(memberId) } : undefined,
      include: { exercises: { orderBy: { orderIndex: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
}

export async function getPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const plan = await prisma.trainingPlan.findUnique({
      where: { id },
      include: { exercises: { orderBy: { orderIndex: 'asc' } } },
    });

    if (!plan) {
      throw BusinessErrors.PLAN_NOT_FOUND();
    }

    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
}

export async function createPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const { memberId, name, description, exercises } = req.body;

    if (!memberId || !name) {
      throw BusinessErrors.INVALID_INPUT('会员或计划名称', '不能为空');
    }

    await validatePlanExercises(memberId, exercises || []);

    const plan = await prisma.trainingPlan.create({
      data: {
        memberId,
        name,
        description,
        exercises: exercises ? {
          create: exercises.map((ex: any, idx: number) => ({
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight,
            notes: ex.notes,
            orderIndex: idx,
          }))
        } : undefined,
      },
      include: { exercises: true },
    });

    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
}

export async function updatePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { name, description, exercises } = req.body;

    const existingPlan = await prisma.trainingPlan.findUnique({
      where: { id },
      include: { exercises: true },
    });

    if (!existingPlan) {
      throw BusinessErrors.PLAN_NOT_FOUND();
    }

    if (exercises) {
      await validatePlanExercises(existingPlan.memberId, exercises);
    }

    await prisma.trainingPlan.update({
      where: { id },
      data: { isActive: false },
    });

    const newVersion = await prisma.trainingPlan.create({
      data: {
        memberId: existingPlan.memberId,
        name: name || existingPlan.name,
        description: description ?? existingPlan.description,
        version: existingPlan.version + 1,
        isActive: true,
        exercises: exercises ? {
          create: exercises.map((ex: any, idx: number) => ({
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight,
            notes: ex.notes,
            orderIndex: idx,
          }))
        } : {
          create: existingPlan.exercises.map(ex => ({
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight,
            notes: ex.notes,
            orderIndex: ex.orderIndex,
          }))
        },
      },
      include: { exercises: true },
    });

    res.json({ 
      success: true, 
      data: newVersion,
      message: `计划已更新，旧版本 v${existingPlan.version} 已保存`
    });
  } catch (err) {
    next(err);
  }
}

export async function getPlanHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { memberId } = req.query;
    
    const plans = await prisma.trainingPlan.findMany({
      where: { memberId: String(memberId) },
      include: { exercises: { orderBy: { orderIndex: 'asc' } } },
      orderBy: { version: 'desc' },
    });

    res.json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
}
