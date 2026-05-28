import { Audience, Item, Difficulty } from './types';
import { contrabandItems, safeItems, chineseNames, avatars, specialAvatars } from './data';

const generateId = () => Math.random().toString(36).substring(2, 9);

const pickRandom = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

const generateItems = (difficulty: Difficulty): Item[] => {
  const itemCount = {
    easy: Math.floor(Math.random() * 2) + 1,
    normal: Math.floor(Math.random() * 3) + 2,
    hard: Math.floor(Math.random() * 4) + 2
  }[difficulty];

  const contrabandChance = {
    easy: 0.15,
    normal: 0.25,
    hard: 0.35
  }[difficulty];

  const items: Item[] = [];

  for (let i = 0; i < itemCount; i++) {
    const isContraband = Math.random() < contrabandChance;
    const itemPool = isContraband ? contrabandItems : safeItems;
    const baseItem = pickRandom(itemPool);

    items.push({
      id: generateId(),
      ...baseItem
    });
  }

  return items;
};

export const generateAudience = (
  currentTime: number,
  difficulty: Difficulty,
  forceVIP = false
): Audience => {
  const vipChance = forceVIP ? 1 : { easy: 0.1, normal: 0.15, hard: 0.2 }[difficulty];
  const specialChance = { easy: 0.05, normal: 0.1, hard: 0.15 }[difficulty];

  const isVIP = Math.random() < vipChance;
  const isSpecial = !isVIP && Math.random() < specialChance;
  const specialTypes = ['elderly', 'child', 'disabled'] as const;
  const specialType = isSpecial ? pickRandom(specialTypes) : undefined;

  return {
    id: generateId(),
    name: pickRandom(chineseNames),
    avatar: isSpecial ? specialAvatars[specialType!] : pickRandom(avatars),
    isVIP,
    isSpecial,
    specialType,
    items: generateItems(difficulty),
    enterTime: currentTime,
    queueStartTime: currentTime,
    channel: isVIP ? 'vip' : 'normal'
  };
};

export const generateInitialQueue = (
  count: number,
  currentTime: number,
  difficulty: Difficulty
): Audience[] => {
  const queue: Audience[] = [];
  let vipCount = 0;
  const targetVIP = Math.ceil(count * 0.15);

  for (let i = 0; i < count; i++) {
    const needsVIP = vipCount < targetVIP && i >= count - targetVIP;
    const audience = generateAudience(currentTime, difficulty, needsVIP);
    if (audience.isVIP) vipCount++;
    audience.queueStartTime = currentTime + i * 2;
    queue.push(audience);
  }

  return queue;
};

export const getSpawnInterval = (currentTime: number, totalDuration: number, difficulty: Difficulty): number => {
  const progress = currentTime / totalDuration;
  
  let baseInterval: number;
  if (difficulty === 'easy') {
    baseInterval = progress > 0.7 ? 4 : 6;
  } else if (difficulty === 'normal') {
    baseInterval = progress > 0.7 ? 3 : 5;
  } else {
    baseInterval = progress > 0.7 ? 2 : 4;
  }

  if (progress > 0.85) {
    baseInterval *= 0.6;
  }

  return baseInterval;
};
