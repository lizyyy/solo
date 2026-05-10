import { PrismaClient } from '@prisma/client';
import { parseJsonArray } from '../utils/json';

const prisma = new PrismaClient();

function transformInjury(injury: any) {
  return {
    ...injury,
    restrictedActions: parseJsonArray(injury.restrictedActions),
  };
}

interface MeasurementData {
  bmi?: number | null;
  bodyFat?: number | null;
  muscleMass?: number | null;
  flexibility?: number | null;
  strength?: number | null;
  endurance?: number | null;
  cardio?: number | null;
}

export function generateTrainingAdvice(measurement: MeasurementData): {
  focusAreas: string[];
  recommendations: string[];
  exercises: string[];
} {
  const focusAreas: string[] = [];
  const recommendations: string[] = [];
  const exercises: string[] = [];

  if (measurement.bmi != null) {
    if (measurement.bmi >= 28) {
      focusAreas.push('减脂');
      recommendations.push('BMI偏高，建议增加有氧运动比例');
      exercises.push('快走', '椭圆机', '游泳');
    } else if (measurement.bmi < 18.5) {
      focusAreas.push('增肌增重');
      recommendations.push('BMI偏低，建议增加力量训练和蛋白质摄入');
      exercises.push('器械推胸', '坐姿划船', '腿举');
    }
  }

  if (measurement.bodyFat != null && measurement.bodyFat > 25) {
    focusAreas.push('体脂控制');
    recommendations.push('体脂率偏高，建议HIIT训练配合饮食控制');
    if (!exercises.includes('椭圆机')) exercises.push('椭圆机');
  }

  if (measurement.muscleMass != null && measurement.muscleMass < 35) {
    focusAreas.push('肌肉增长');
    recommendations.push('肌肉量偏低，建议进行分化训练');
    if (!exercises.includes('器械推胸')) exercises.push('器械推胸');
    if (!exercises.includes('坐姿划船')) exercises.push('坐姿划船');
  }

  if (measurement.flexibility != null && measurement.flexibility < 3) {
    focusAreas.push('柔韧性提升');
    recommendations.push('柔韧性不足，建议每次训练前增加动态拉伸');
    exercises.push('动态拉伸', '瑜伽');
  }

  if (measurement.strength != null && measurement.strength < 3) {
    focusAreas.push('力量提升');
    recommendations.push('力量水平偏低，建议渐进式负重训练');
    if (!exercises.includes('器械推胸')) exercises.push('器械推胸');
    if (!exercises.includes('坐姿划船')) exercises.push('坐姿划船');
    exercises.push('哑铃臂弯举');
  }

  if (measurement.cardio != null && measurement.cardio < 3) {
    focusAreas.push('心肺功能');
    recommendations.push('心肺功能偏弱，建议每周3次中等强度有氧');
    if (!exercises.includes('椭圆机')) exercises.push('椭圆机');
    if (!exercises.includes('游泳')) exercises.push('游泳');
  }

  if (focusAreas.length === 0) {
    focusAreas.push('综合体能维持');
    recommendations.push('体测指标良好，建议维持现有训练强度');
    exercises.push('综合训练', '功能性训练');
  }

  return {
    focusAreas: [...new Set(focusAreas)],
    recommendations: [...new Set(recommendations)],
    exercises: [...new Set(exercises)],
  };
}

export async function getMemberWithAdvice(memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      bodyMeasurements: { orderBy: { measuredAt: 'desc' }, take: 1 },
      injuries: { where: { isActive: true } },
      plans: { where: { isActive: true }, include: { exercises: true } },
      payments: true,
    },
  });

  if (!member) {
    return null;
  }

  const latestMeasurement = member.bodyMeasurements[0];
  const advice = latestMeasurement ? generateTrainingAdvice(latestMeasurement) : null;

  const totalSessions = member.payments.reduce((sum, p) => sum + p.totalSessions, 0);
  const usedSessions = member.payments.reduce((sum, p) => sum + p.usedSessions, 0);
  const remainingSessions = totalSessions - usedSessions;

  return {
    ...member,
    latestMeasurement,
    injuries: member.injuries.map(transformInjury),
    trainingAdvice: advice,
    sessionSummary: {
      total: totalSessions,
      used: usedSessions,
      remaining: remainingSessions,
      hasLowSessions: remainingSessions <= 3,
    },
  };
}
