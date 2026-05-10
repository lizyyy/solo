import { PrismaClient } from '@prisma/client';
import { BusinessErrors } from '../utils/errors';
import { parseJsonArray } from '../utils/json';

const prisma = new PrismaClient();

const EXERCISE_BODY_PART_MAP: Record<string, string[]> = {
  '深蹲': ['膝', '膝盖', '膝关节'],
  '腿举': ['膝', '膝盖', '膝关节', '髋'],
  '弓步蹲': ['膝', '膝盖', '膝关节'],
  '硬拉': ['腰', '腰椎', '膝', '膝盖'],
  '卧推': ['肩', '肩膀', '肘关节'],
  '俯卧撑': ['肩', '肩膀', '肘关节', '腕'],
  '引体向上': ['肩', '肩膀', '肘', '肘关节'],
  '划船': ['腰', '腰椎', '肩'],
  '平板支撑': ['腰', '腰椎'],
  '卷腹': ['腰', '腰椎', '颈部'],
  '跑步': ['膝', '膝盖', '踝关节'],
  '跳跃': ['膝', '膝盖', '踝关节'],
  '肩推': ['肩', '肩膀'],
  '二头弯举': ['肘', '肘关节'],
  '三头下压': ['肘', '肘关节'],
};

export function checkExerciseRestriction(
  exerciseName: string,
  activeInjuries: { bodyPart: string; restrictedActions: string | string[] }[]
): { restricted: boolean; bodyPart?: string } {
  for (const injury of activeInjuries) {
    const bodyParts = EXERCISE_BODY_PART_MAP[exerciseName] || [];
    
    if (bodyParts.includes(injury.bodyPart)) {
      return { restricted: true, bodyPart: injury.bodyPart };
    }

    const restrictedList = Array.isArray(injury.restrictedActions)
      ? injury.restrictedActions
      : parseJsonArray(injury.restrictedActions);

    for (const restricted of restrictedList) {
      if (exerciseName.includes(restricted) || restricted.includes(exerciseName)) {
        return { restricted: true, bodyPart: injury.bodyPart };
      }
    }
  }
  
  return { restricted: false };
}

export async function validatePlanExercises(memberId: string, exercises: { name: string }[]) {
  const activeInjuries = await prisma.injury.findMany({
    where: { memberId, isActive: true },
    select: { bodyPart: true, restrictedActions: true },
  });

  for (const exercise of exercises) {
    const result = checkExerciseRestriction(exercise.name, activeInjuries);
    if (result.restricted && result.bodyPart) {
      throw BusinessErrors.INJURY_RESTRICTION(exercise.name, result.bodyPart);
    }
  }
}

export async function getMemberRemainingSessions(memberId: string): Promise<number> {
  const payments = await prisma.coursePayment.findMany({
    where: { memberId },
    select: { totalSessions: true, usedSessions: true },
  });

  return payments.reduce(
    (sum, p) => sum + (p.totalSessions - p.usedSessions),
    0
  );
}

export async function deductSession(memberId: string, sessionId: string) {
  const existingSession = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
  });

  if (!existingSession) {
    throw BusinessErrors.MEMBER_NOT_FOUND();
  }

  if (existingSession.isCompleted) {
    throw BusinessErrors.SESSION_ALREADY_DEDUCTED();
  }

  const remaining = await getMemberRemainingSessions(memberId);
  if (remaining <= 0) {
    throw BusinessErrors.INSUFFICIENT_SESSIONS(0);
  }

  const availablePayment = await prisma.coursePayment.findFirst({
    where: { 
      memberId, 
      usedSessions: { lt: prisma.coursePayment.fields.totalSessions } 
    },
    orderBy: { purchaseDate: 'asc' },
  });

  if (!availablePayment) {
    throw BusinessErrors.PAYMENT_NOT_FOUND();
  }

  await prisma.coursePayment.update({
    where: { id: availablePayment.id },
    data: { usedSessions: { increment: 1 } },
  });

  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: { 
      isCompleted: true,
      paymentId: availablePayment.id,
    },
  });

  return { 
    success: true, 
    remainingSessions: remaining - 1,
    paymentId: availablePayment.id,
  };
}
