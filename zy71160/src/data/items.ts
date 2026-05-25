import { WasteItem, CategoryBin } from '../types';

export const RECYCLABLE_ITEMS: WasteItem[] = [
  { id: 'plastic-bottle', name: '塑料瓶', emoji: '🍶', category: 'recyclable', isPolluted: false, isDangerous: false, points: 10 },
  { id: 'paper', name: '纸张', emoji: '📄', category: 'recyclable', isPolluted: false, isDangerous: false, points: 10 },
  { id: 'can', name: '易拉罐', emoji: '🥫', category: 'recyclable', isPolluted: false, isDangerous: false, points: 15 },
  { id: 'glass', name: '玻璃瓶', emoji: '🍾', category: 'recyclable', isPolluted: false, isDangerous: false, points: 15 },
  { id: 'cardboard', name: '纸箱', emoji: '📦', category: 'recyclable', isPolluted: false, isDangerous: false, points: 12 },
  { id: 'newspaper', name: '报纸', emoji: '📰', category: 'recyclable', isPolluted: false, isDangerous: false, points: 10 },
  { id: 'magazine', name: '杂志', emoji: '📓', category: 'recyclable', isPolluted: false, isDangerous: false, points: 10 },
  { id: 'metal', name: '金属块', emoji: '🔩', category: 'recyclable', isPolluted: false, isDangerous: false, points: 18 },
];

export const HAZARDOUS_ITEMS: WasteItem[] = [
  { id: 'battery', name: '电池', emoji: '🔋', category: 'hazardous', isPolluted: false, isDangerous: true, points: 25 },
  { id: 'medicine', name: '过期药品', emoji: '💊', category: 'hazardous', isPolluted: false, isDangerous: true, points: 25 },
  { id: 'lightbulb', name: '灯泡', emoji: '💡', category: 'hazardous', isPolluted: false, isDangerous: true, points: 20 },
  { id: 'paint', name: '油漆桶', emoji: '🪣', category: 'hazardous', isPolluted: false, isDangerous: true, points: 22 },
  { id: 'pesticide', name: '杀虫剂', emoji: '🧴', category: 'hazardous', isPolluted: false, isDangerous: true, points: 24 },
  { id: 'thermometer', name: '水银温度计', emoji: '🌡️', category: 'hazardous', isPolluted: false, isDangerous: true, points: 28 },
];

export const KITCHEN_ITEMS: WasteItem[] = [
  { id: 'apple', name: '苹果核', emoji: '🍎', category: 'kitchen', isPolluted: false, isDangerous: false, points: 10 },
  { id: 'fishbone', name: '鱼骨', emoji: '🐟', category: 'kitchen', isPolluted: false, isDangerous: false, points: 10 },
  { id: 'vegetable', name: '菜叶', emoji: '🥬', category: 'kitchen', isPolluted: false, isDangerous: false, points: 10 },
  { id: 'banana', name: '香蕉皮', emoji: '🍌', category: 'kitchen', isPolluted: false, isDangerous: false, points: 10 },
  { id: 'egg', name: '蛋壳', emoji: '🥚', category: 'kitchen', isPolluted: false, isDangerous: false, points: 10 },
  { id: 'rice', name: '剩饭', emoji: '🍚', category: 'kitchen', isPolluted: false, isDangerous: false, points: 10 },
  { id: 'bone', name: '骨头', emoji: '🍖', category: 'kitchen', isPolluted: false, isDangerous: false, points: 12 },
  { id: 'coffee', name: '咖啡渣', emoji: '☕', category: 'kitchen', isPolluted: false, isDangerous: false, points: 10 },
];

export const OTHER_ITEMS: WasteItem[] = [
  { id: 'cigarette', name: '烟蒂', emoji: '🚬', category: 'other', isPolluted: true, isDangerous: false, points: 10 },
  { id: 'tissue', name: '卫生纸', emoji: '🧻', category: 'other', isPolluted: true, isDangerous: false, points: 10 },
  { id: 'ceramic', name: '碎陶瓷', emoji: '🏺', category: 'other', isPolluted: false, isDangerous: false, points: 15 },
  { id: 'diaper', name: '尿不湿', emoji: '🩹', category: 'other', isPolluted: true, isDangerous: false, points: 12 },
  { id: 'mask', name: '口罩', emoji: '😷', category: 'other', isPolluted: true, isDangerous: false, points: 10 },
  { id: 'broken-glass', name: '碎玻璃', emoji: '🪟', category: 'other', isPolluted: false, isDangerous: false, points: 15 },
  { id: 'dust', name: '尘土', emoji: '🧹', category: 'other', isPolluted: true, isDangerous: false, points: 8 },
  { id: 'cotton', name: '棉签', emoji: '🪥', category: 'other', isPolluted: true, isDangerous: false, points: 10 },
];

export const CATEGORY_BINS: CategoryBin[] = [
  { category: 'recyclable', name: '可回收物', color: '#1E88E5', bgColor: 'bg-blue-500', emoji: '♻️' },
  { category: 'hazardous', name: '有害垃圾', color: '#E53935', bgColor: 'bg-red-500', emoji: '☠️' },
  { category: 'kitchen', name: '厨余垃圾', color: '#7CB342', bgColor: 'bg-green-500', emoji: '🍂' },
  { category: 'other', name: '其他垃圾', color: '#616161', bgColor: 'bg-gray-500', emoji: '🗑️' },
];

export const getCategoryBin = (category: string): CategoryBin | undefined => {
  return CATEGORY_BINS.find(bin => bin.category === category);
};

export const getAllItems = (): WasteItem[] => {
  return [...RECYCLABLE_ITEMS, ...HAZARDOUS_ITEMS, ...KITCHEN_ITEMS, ...OTHER_ITEMS];
};
