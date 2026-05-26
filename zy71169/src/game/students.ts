import type { Grade, Allergen } from './types';

export const STUDENT_NAMES: Record<Grade, string[]> = {
  1: ['小明', '小红', '小刚', '小丽', '小华', '小强', '小芳', '小军', '小燕', '小龙', '小梅', '小虎', '小英', '小伟', '小娟', '小磊', '小雪', '小鹏', '小敏', '小涛'],
  2: ['子轩', '思雨', '浩然', '梓涵', '宇航', '欣怡', '博文', '佳怡', '天佑', '梦琪', '嘉豪', '语桐', '俊熙', '若曦', '承泽', '诗涵', '启航', '婉清', '奕辰', '芷晴'],
  3: ['建国', '志强', '秀英', '桂兰', '德昌', '美玲', '文斌', '淑芬', '伟华', '玉兰', '志明', '丽娟', '国安', '春梅', '建华', '雪梅', '国强', '淑华', '志远', '秀珍'],
};

const ALLERGENS: Allergen[] = ['花生', '海鲜', '牛奶', '鸡蛋', '小麦', '大豆'];

export function generateStudent(grade: Grade, allergenRatio: number): { name: string; grade: Grade; allergens: Allergen[] } {
  const names = STUDENT_NAMES[grade];
  const name = names[Math.floor(Math.random() * names.length)];

  const allergens: Allergen[] = [];
  if (Math.random() < allergenRatio) {
    const allergenCount = Math.random() < 0.3 ? 2 : 1;
    const shuffled = [...ALLERGENS].sort(() => Math.random() - 0.5);
    for (let i = 0; i < allergenCount && i < shuffled.length; i++) {
      allergens.push(shuffled[i]);
    }
  }

  return { name, grade, allergens };
}