import type { Meal, Allergen, Grade } from './types';

const ALL_ALLERGENS: Allergen[] = ['花生', '海鲜', '牛奶', '鸡蛋', '小麦', '大豆'];

function makeMeal(id: string, name: string, type: Meal['type'], grade: Grade, allergens: Allergen[], emoji: string, color: string): Meal {
  return { id, name, type, grade, containsAllergens: allergens, emoji, color };
}

export const MEALS: Meal[] = [
  makeMeal('m1', '米饭套餐', '主食', 1, [], '🍚', '#F5DEB3'),
  makeMeal('m2', '白米饭', '主食', 2, [], '🍚', '#F5DEB3'),
  makeMeal('m3', '杂粮饭', '主食', 3, ['小麦'], '🍚', '#DEB887'),

  makeMeal('m4', '红烧肉', '荤菜', 1, ['大豆'], '🍖', '#B22222'),
  makeMeal('m5', '清蒸鱼', '荤菜', 2, ['海鲜'], '🐟', '#4682B4'),
  makeMeal('m6', '宫保鸡丁', '荤菜', 3, ['花生'], '🍗', '#D2691E'),
  makeMeal('m7', '糖醋排骨', '荤菜', 1, [], '🍖', '#CD853F'),
  makeMeal('m8', '虾仁炒蛋', '荤菜', 2, ['海鲜', '鸡蛋'], '🍤', '#FFA500'),
  makeMeal('m9', '牛肉炖土豆', '荤菜', 3, [], '🥩', '#8B4513'),

  makeMeal('m10', '炒青菜', '素菜', 1, [], '🥬', '#228B22'),
  makeMeal('m11', '番茄炒蛋', '素菜', 2, ['鸡蛋'], '🍅', '#DC143C'),
  makeMeal('m12', '麻婆豆腐', '素菜', 3, ['大豆'], '🧈', '#DAA520'),
  makeMeal('m13', '凉拌黄瓜', '素菜', 1, [], '🥒', '#9ACD32'),
  makeMeal('m14', '土豆丝', '素菜', 2, [], '🥔', '#DEB887'),

  makeMeal('m15', '紫菜蛋花汤', '汤品', 1, ['鸡蛋'], '🥣', '#4682B4'),
  makeMeal('m16', '番茄蛋汤', '汤品', 2, ['鸡蛋'], '🍲', '#DC143C'),
  makeMeal('m17', '排骨汤', '汤品', 3, [], '🥣', '#8B4513'),

  makeMeal('m18', '苹果', '水果', 1, [], '🍎', '#FF6347'),
  makeMeal('m19', '香蕉', '水果', 2, [], '🍌', '#FFD700'),
  makeMeal('m20', '橙子', '水果', 3, [], '🍊', '#FFA500'),
];

export function getMealsByGrade(grade: Grade): Meal[] {
  return MEALS.filter(m => m.grade === grade);
}

export function getAllergenLabel(allergen: Allergen): string {
  const labels: Record<Allergen, string> = {
    '花生': '🥜',
    '海鲜': '🦐',
    '牛奶': '🥛',
    '鸡蛋': '🥚',
    '小麦': '🌾',
    '大豆': '🫘',
  };
  return labels[allergen];
}

export { ALL_ALLERGENS };