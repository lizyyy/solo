import { BodyShapeRule, BodyShape, PetType } from '../types';

export const dogBodyShapeRules: BodyShapeRule[] = [
  {
    shape: 'toy',
    name: '超小型',
    description: '体型最小的犬种，通常体重不超过3公斤，适合家庭饲养。',
    weightRange: { min: 0, max: 4 },
    petType: 'dog',
    examples: ['吉娃娃', '博美', '迷你贵宾', '西施犬', '约克夏'],
  },
  {
    shape: 'small',
    name: '小型',
    description: '体型较小的犬种，体重在4-10公斤之间，适合城市公寓饲养。',
    weightRange: { min: 4, max: 12 },
    petType: 'dog',
    examples: ['柯基', '柴犬', '巴哥', '比熊', '法国斗牛犬', '雪纳瑞'],
  },
  {
    shape: 'medium',
    name: '中型',
    description: '中等体型的犬种，体重在12-25公斤之间，需要一定的运动空间。',
    weightRange: { min: 12, max: 25 },
    petType: 'dog',
    examples: ['可卡', '比格', '英国斗牛犬', '边境牧羊犬', '萨摩耶'],
  },
  {
    shape: 'large',
    name: '大型',
    description: '大型犬种，体重在25-50公斤之间，需要较大的活动空间和运动量。',
    weightRange: { min: 25, max: 50 },
    petType: 'dog',
    examples: ['金毛', '拉布拉多', '哈士奇', '德牧', '阿拉斯加'],
  },
  {
    shape: 'giant',
    name: '超大型',
    description: '体型最大的犬种，体重超过50公斤，需要非常大的生活空间。',
    weightRange: { min: 50, max: 100 },
    petType: 'dog',
    examples: ['大丹犬', '纽芬兰', '圣伯纳', '英国獒犬', '大白熊'],
  },
];

export const catBodyShapeRules: BodyShapeRule[] = [
  {
    shape: 'toy',
    name: '超小型',
    description: '体型娇小的猫咪品种，通常体重不超过3公斤。',
    weightRange: { min: 0, max: 3 },
    petType: 'cat',
    examples: ['曼基康', '新加坡猫', '德文卷毛猫'],
  },
  {
    shape: 'small',
    name: '小型',
    description: '常见的猫咪体型，体重在3-5公斤之间，最常见的家猫体型。',
    weightRange: { min: 3, max: 5.5 },
    petType: 'cat',
    examples: ['美短', '英短', '折耳猫', '加菲猫', '俄罗斯蓝猫'],
  },
  {
    shape: 'medium',
    name: '中型',
    description: '中等体型的猫咪，体重在5-9公斤之间，体型较为健壮。',
    weightRange: { min: 5.5, max: 9 },
    petType: 'cat',
    examples: ['布偶猫', '波斯猫', '豹猫', '阿比西尼亚', '无毛猫'],
  },
  {
    shape: 'large',
    name: '大型',
    description: '大型猫咪品种，体重超过9公斤，是猫咪中的"大块头"。',
    weightRange: { min: 9, max: 15 },
    petType: 'cat',
    examples: ['缅因猫', '挪威森林猫', '西伯利亚猫', '萨凡纳猫'],
  },
];

export function getBodyShapeRulesByPetType(petType: PetType): BodyShapeRule[] {
  return petType === 'dog' ? dogBodyShapeRules : catBodyShapeRules;
}

export function estimateBodyShapeByWeight(
  petType: PetType,
  weight: number
): BodyShape {
  const rules = getBodyShapeRulesByPetType(petType);
  
  for (const rule of rules) {
    if (weight >= rule.weightRange.min && weight <= rule.weightRange.max) {
      return rule.shape;
    }
  }
  
  return rules[Math.floor(rules.length / 2)].shape;
}

export function getBodyShapeRule(
  petType: PetType,
  shape: BodyShape
): BodyShapeRule | undefined {
  const rules = getBodyShapeRulesByPetType(petType);
  return rules.find(r => r.shape === shape);
}
