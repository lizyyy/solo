
import { TrashItem, TargetType, RuleResult, GameState, LevelConfig, CATEGORY_NAMES } from '@/types';

export const validateDrop = (
  trash: TrashItem,
  target: TargetType,
  gameState: GameState,
  levelConfig: LevelConfig
): RuleResult => {
  if (trash.category === 'bulky') {
    return validateBulkyTrash(trash, target, gameState, levelConfig);
  }

  if (target === 'appointment') {
    return {
      isCorrect: false,
      scoreChange: -levelConfig.wrongPenalty,
      message: '只有大件垃圾需要预约',
      explanation: `${trash.name}不属于大件垃圾，请投入对应的垃圾桶`,
    };
  }

  if (levelConfig.hasBagBreakMechanic && trash.requiresBagBreak && !trash.isBagBroken) {
    return {
      isCorrect: false,
      scoreChange: -levelConfig.wrongPenalty,
      message: '湿垃圾未破袋！',
      explanation: `${trash.name}属于湿垃圾，投放前需要先破袋`,
    };
  }

  if (levelConfig.hasContaminationMechanic && trash.isContaminated && !trash.isCleaned) {
    if (target === 'recyclable') {
      return {
        isCorrect: false,
        scoreChange: -levelConfig.wrongPenalty,
        message: '可回收物被污染！',
        explanation: `${trash.name}已被污染，清洁后才能投入可回收桶，或改投干垃圾桶`,
      };
    }
    if (target === 'dry') {
      return {
        isCorrect: true,
        scoreChange: levelConfig.correctPoints,
        message: '正确！污染物品改投干垃圾',
      };
    }
  }

  if (trash.category === target) {
    return {
      isCorrect: true,
      scoreChange: levelConfig.correctPoints,
      message: `正确！${CATEGORY_NAMES[trash.category]}`,
    };
  }

  return {
    isCorrect: false,
    scoreChange: -levelConfig.wrongPenalty,
    message: '分类错误！',
    explanation: `${trash.name}属于${CATEGORY_NAMES[trash.category]}，不应投入${CATEGORY_NAMES[target as keyof typeof CATEGORY_NAMES] || target}桶`,
  };
};

const validateBulkyTrash = (
  trash: TrashItem,
  target: TargetType,
  gameState: GameState,
  levelConfig: LevelConfig
): RuleResult => {
  if (target !== 'appointment') {
    return {
      isCorrect: false,
      scoreChange: -levelConfig.wrongPenalty,
      message: '大件垃圾不能直接投放！',
      explanation: `${trash.name}是大件垃圾，需要预约回收，不能直接投入垃圾桶`,
    };
  }

  if (!levelConfig.hasAppointmentMechanic || !levelConfig.appointmentSlots) {
    return {
      isCorrect: true,
      scoreChange: levelConfig.correctPoints,
      message: '大件垃圾预约成功！',
    };
  }

  const currentTime = levelConfig.timeLimit - gameState.timeRemaining;
  const activeSlot = levelConfig.appointmentSlots.find(
    slot => slot.isAvailable && currentTime >= slot.startTime && currentTime <= slot.endTime
  );

  if (activeSlot) {
    return {
      isCorrect: true,
      scoreChange: levelConfig.correctPoints,
      message: '大件垃圾预约成功！',
    };
  }

  return {
    isCorrect: false,
    scoreChange: -levelConfig.wrongPenalty,
    message: '不在预约时段内！',
    explanation: `当前不在大件垃圾预约时段内，请等待下一个预约时段`,
  };
};

export const validateBagBreak = (trash: TrashItem, levelConfig: LevelConfig): RuleResult => {
  if (!levelConfig.hasBagBreakMechanic) {
    return {
      isCorrect: true,
      scoreChange: 0,
      message: '本关卡无需破袋',
    };
  }

  if (trash.category !== 'wet') {
    return {
      isCorrect: false,
      scoreChange: 0,
      message: '只有湿垃圾需要破袋',
      explanation: `${trash.name}不属于湿垃圾，不需要破袋`,
    };
  }

  if (!trash.requiresBagBreak) {
    return {
      isCorrect: false,
      scoreChange: 0,
      message: '此物品无需破袋',
      explanation: `${trash.name}可以直接投放，无需破袋`,
    };
  }

  if (trash.isBagBroken) {
    return {
      isCorrect: true,
      scoreChange: 0,
      message: '已经破袋完成',
    };
  }

  return {
    isCorrect: true,
    scoreChange: 0,
    message: '破袋完成！',
  };
};

export const validateClean = (trash: TrashItem, levelConfig: LevelConfig): RuleResult => {
  if (!levelConfig.hasContaminationMechanic) {
    return {
      isCorrect: true,
      scoreChange: 0,
      message: '本关卡无需清洁',
    };
  }

  if (trash.category !== 'recyclable') {
    return {
      isCorrect: false,
      scoreChange: 0,
      message: '只有可回收物需要清洁',
      explanation: `${trash.name}不属于可回收物，不需要清洁`,
    };
  }

  if (!trash.isContaminated) {
    return {
      isCorrect: false,
      scoreChange: 0,
      message: '此物品未被污染',
      explanation: `${trash.name}已经是清洁状态`,
    };
  }

  if (trash.isCleaned) {
    return {
      isCorrect: true,
      scoreChange: 0,
      message: '已经清洁完成',
    };
  }

  return {
    isCorrect: true,
    scoreChange: 0,
    message: '清洁完成！',
  };
};

export const isAppointmentAvailable = (
  gameState: GameState,
  levelConfig: LevelConfig
): boolean => {
  if (!levelConfig.hasAppointmentMechanic || !levelConfig.appointmentSlots) {
    return true;
  }

  const currentTime = levelConfig.timeLimit - gameState.timeRemaining;
  return levelConfig.appointmentSlots.some(
    slot => slot.isAvailable && currentTime >= slot.startTime && currentTime <= slot.endTime
  );
};

export const getCurrentAppointmentSlot = (
  gameState: GameState,
  levelConfig: LevelConfig
): { available: boolean; nextSlotTime?: number } => {
  if (!levelConfig.hasAppointmentMechanic || !levelConfig.appointmentSlots) {
    return { available: true };
  }

  const currentTime = levelConfig.timeLimit - gameState.timeRemaining;
  const activeSlot = levelConfig.appointmentSlots.find(
    slot => slot.isAvailable && currentTime >= slot.startTime && currentTime <= slot.endTime
  );

  if (activeSlot) {
    return { available: true };
  }

  const nextSlot = levelConfig.appointmentSlots
    .filter(slot => slot.isAvailable && slot.startTime > currentTime)
    .sort((a, b) => a.startTime - b.startTime)[0];

  return {
    available: false,
    nextSlotTime: nextSlot ? nextSlot.startTime - currentTime : undefined,
  };
};
