import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateTrainingAdvice } from '../services/trainingAdviceService';
import { BusinessErrors } from '../utils/errors';

const prisma = new PrismaClient();

export async function getMeasurements(req: Request, res: Response, next: NextFunction) {
  try {
    const { memberId } = req.query;
    
    const measurements = await prisma.bodyMeasurement.findMany({
      where: memberId ? { memberId: String(memberId) } : undefined,
      orderBy: { measuredAt: 'desc' },
    });

    res.json({ success: true, data: measurements });
  } catch (err) {
    next(err);
  }
}

export async function createMeasurement(req: Request, res: Response, next: NextFunction) {
  try {
    const { memberId, weight, height, bodyFat, muscleMass, flexibility, strength, endurance, cardio, notes } = req.body;

    if (!memberId) {
      throw BusinessErrors.INVALID_INPUT('会员', '不能为空');
    }

    let bmi: number | undefined;
    if (weight && height) {
      const heightInM = height / 100;
      bmi = Math.round((weight / (heightInM * heightInM)) * 10) / 10;
    }

    const measurement = await prisma.bodyMeasurement.create({
      data: {
        memberId,
        weight,
        height,
        bmi,
        bodyFat,
        muscleMass,
        flexibility,
        strength,
        endurance,
        cardio,
        notes,
      },
    });

    const advice = generateTrainingAdvice(measurement);

    res.json({ 
      success: true, 
      data: measurement,
      advice,
      message: '体测数据已保存，系统已生成训练建议'
    });
  } catch (err) {
    next(err);
  }
}
