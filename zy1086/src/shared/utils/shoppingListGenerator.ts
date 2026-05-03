import { 
  Recipe, 
  SelectedRecipe, 
  ExistingIngredient, 
  ShoppingListItem,
  RecipeIngredient
} from '@shared/types';
import { convertUnit, normalizeToGrams, roundQuantity } from './unitConverter';

export interface ShoppingListOptions {
  roundToPractical?: boolean;
  includeNotes?: boolean;
}

export function generateShoppingList(
  recipes: Recipe[],
  selectedRecipes: SelectedRecipe[],
  existingIngredients: ExistingIngredient[],
  options: ShoppingListOptions = {}
): ShoppingListItem[] {
  const ingredientMap = new Map<string, {
    ingredientId: string;
    ingredientName: string;
    totalGrams: number;
    unit: string;
    category: string;
    notes: string[];
    isOptional: boolean;
  }>();

  for (const selected of selectedRecipes) {
    const recipe = recipes.find(r => r.id === selected.recipeId);
    if (!recipe) continue;

    const multiplier = selected.multiplier;

    for (const ingredient of recipe.ingredients) {
      const key = ingredient.ingredientId;
      
      const grams = normalizeToGrams(
        ingredient.quantity * multiplier,
        ingredient.unit,
        ingredient.ingredientName
      );

      if (ingredientMap.has(key)) {
        const existing = ingredientMap.get(key)!;
        existing.totalGrams += grams;
        if (ingredient.notes) {
          existing.notes.push(`${recipe.name}: ${ingredient.notes}`);
        }
      } else {
        ingredientMap.set(key, {
          ingredientId: ingredient.ingredientId,
          ingredientName: ingredient.ingredientName,
          totalGrams: grams,
          unit: ingredient.unit,
          category: getIngredientCategory(ingredient.ingredientName),
          notes: ingredient.notes ? [`${recipe.name}: ${ingredient.notes}`] : [],
          isOptional: ingredient.isOptional,
        });
      }
    }
  }

  const existingGramsMap = new Map<string, number>();
  for (const existing of existingIngredients) {
    const grams = normalizeToGrams(
      existing.quantity,
      existing.unit,
      existing.ingredientName
    );
    existingGramsMap.set(existing.ingredientId, (existingGramsMap.get(existing.ingredientId) || 0) + grams);
  }

  const shoppingList: ShoppingListItem[] = [];

  for (const [, item] of ingredientMap) {
    const existingGrams = existingGramsMap.get(item.ingredientId) || 0;
    const toPurchaseGrams = Math.max(0, item.totalGrams - existingGrams);

    if (toPurchaseGrams > 0 || options.includeNotes) {
      const totalQuantity = convertUnit(item.totalGrams, 'g', item.unit, item.ingredientName);
      const existingQuantity = convertUnit(existingGrams, 'g', item.unit, item.ingredientName);
      const toPurchase = convertUnit(toPurchaseGrams, 'g', item.unit, item.ingredientName);

      shoppingList.push({
        ingredientId: item.ingredientId,
        ingredientName: item.ingredientName,
        totalQuantity: options.roundToPractical ? roundToPracticalQuantity(totalQuantity) : roundQuantity(totalQuantity),
        unit: item.unit,
        existingQuantity: options.roundToPractical ? roundToPracticalQuantity(existingQuantity) : roundQuantity(existingQuantity),
        toPurchase: options.roundToPractical ? roundToPracticalQuantity(toPurchase) : roundQuantity(toPurchase),
        category: item.category,
        notes: item.notes.length > 0 ? item.notes.join('; ') : undefined,
      });
    }
  }

  return shoppingList.sort((a, b) => a.category.localeCompare(b.category));
}

export function roundToPracticalQuantity(quantity: number): number {
  if (quantity <= 0) return 0;
  
  if (quantity < 0.1) {
    return Math.ceil(quantity * 100) / 100;
  } else if (quantity < 1) {
    return Math.ceil(quantity * 10) / 10;
  } else if (quantity < 10) {
    return Math.ceil(quantity * 2) / 2;
  } else {
    return Math.ceil(quantity);
  }
}

export function getIngredientCategory(name: string): string {
  const categories: { name: string; keywords: string[] }[] = [
    {
      name: '肉类',
      keywords: [
        '鸡胸肉', '鸡腿', '鸡翅', '鸡胗', '鸡肝', '鸡心', '鸡肉',
        '牛腩', '牛腱', '牛排', '牛肉',
        '羊排', '羊肉',
        '五花肉', '里脊', '排骨', '猪蹄', '猪肘', '猪肉',
        '虾仁', '虾', '蟹', '鱼', '三文鱼', '鳕鱼', '鲈鱼', '海鲜',
        '培根', '火腿', '香肠', '腊肠', '腊肉'
      ]
    },
    {
      name: '海鲜',
      keywords: ['虾仁', '虾', '蟹', '三文鱼', '鳕鱼', '鲈鱼', '鱼', '海鲜', '鲍鱼', '海参', '鱿鱼', '章鱼']
    },
    {
      name: '蔬菜',
      keywords: [
        '西兰花', '花菜', '菜花', '白菜', '青菜', '菠菜', '芹菜', '韭菜', '韭黄',
        '洋葱', '大蒜', '蒜头', '姜', '生姜', '老姜', '辣椒', '青椒', '红椒', '小米辣',
        '番茄', '西红柿', '土豆', '马铃薯', '胡萝卜', '红萝卜', '白萝卜', '萝卜',
        '黄瓜', '青瓜', '茄子', '豆角', '四季豆', '豇豆', '毛豆', '豌豆',
        '蘑菇', '香菇', '金针菇', '杏鲍菇', '平菇', '木耳', '银耳', '海带', '紫菜',
        '山药', '莲藕', '芋头', '红薯', '地瓜', '南瓜', '冬瓜', '苦瓜', '丝瓜', '佛手瓜'
      ]
    },
    {
      name: '水果',
      keywords: ['苹果', '香蕉', '橙子', '橘子', '柠檬', '青柠', '草莓', '蓝莓', '树莓', '葡萄', '提子', '西瓜', '哈密瓜', '甜瓜', '芒果', '菠萝', '凤梨', '猕猴桃', '梨', '桃', '李子', '杏', '枣', '椰子', '榴莲', '山竹', '荔枝', '龙眼', '石榴', '山楂']
    },
    {
      name: '蛋奶',
      keywords: ['鸡蛋', '鸭蛋', '鹅蛋', '鹌鹑蛋', '牛奶', '酸奶', '奶油', '奶酪', '芝士', '黄油', '牛油', '奶粉', '炼奶', '淡奶']
    },
    {
      name: '调料',
      keywords: [
        '盐', '酱油', '生抽', '老抽', '味极鲜', '醋', '白醋', '陈醋', '香醋', '米醋', '苹果醋',
        '料酒', '白酒', '红酒', '葡萄酒', '黄酒', '花雕', '米酒',
        '糖', '白糖', '红糖', '冰糖', '白砂糖', '绵白糖', '葡萄糖', '果糖', '蜂蜜', '枫糖浆',
        '番茄酱', '番茄沙司', '豆瓣酱', '黄豆酱', '甜面酱', '辣椒酱', '剁椒', '泡椒', '豆瓣酱',
        '花椒', '麻椒', '八角', '大料', '桂皮', '肉桂', '香叶', '月桂叶', '孜然', '小茴香', '咖喱',
        '黑胡椒', '白胡椒', '胡椒粉', '五香粉', '十三香', '花椒粉', '辣椒粉',
        '鸡精', '鸡粉', '味精', '味素', '蚝油', '鲍鱼汁', '鱼露', '虾酱', '豆豉', '腐乳',
        '芥末', '辣根', '山葵', '番茄酱', '沙拉酱', '蛋黄酱', '千岛酱', '甜辣酱', '泰式甜辣酱',
        '烧烤酱', '黑椒汁', '黑胡椒酱', '意面酱', '披萨酱', '照烧汁', '卤水', '卤料包'
      ]
    },
    {
      name: '粮油',
      keywords: [
        '大米', '稻米', '小米', '糯米', '江米', '糙米', '胚芽米',
        '面粉', '小麦粉', '高筋面粉', '低筋面粉', '中筋面粉', '面包粉', '蛋糕粉',
        '面条', '挂面', '拉面', '刀削面', '意大利面', '意面', '通心粉', '螺旋粉',
        '面包', '吐司', '全麦面包',
        '油', '食用油', '橄榄油', '芝麻油', '香油', '花生油', '大豆油', '玉米油', '菜籽油', '葵花籽油', '调和油',
        '芝麻', '白芝麻', '黑芝麻', '花生', '核桃仁', '杏仁', '腰果', '开心果', '夏威夷果', '碧根果',
        '燕麦', '麦片', '玉米片', '藜麦', '奇亚籽', '亚麻籽'
      ]
    },
    {
      name: '干货',
      keywords: ['木耳', '香菇', '银耳', '莲子', '枸杞', '枸杞子', '红枣', '大枣', '葡萄干', '核桃', '杏仁', '花生', '芝麻', '桂圆', '龙眼', '荔枝干', '蜜枣', '无花果', '杏干', '桃干', '芒果干', '菠萝干', '草莓干', '蓝莓干', '蔓越莓干', '山楂干', '陈皮', '甘草', '黄芪', '当归', '党参', '淮山', '山药干', '百合', '玉竹', '沙参', '麦冬', '天冬', '银耳', '黑木耳', '白木耳', '香菇', '冬菇', '花菇', '茶树菇', '金针菇', '杏鲍菇', '猴头菇', '鸡腿菇', '牛肝菌', '羊肚菌', '松茸', '竹荪', '虫草花', '雪燕', '皂角米', '桃胶', '雪莲子']
    },
    {
      name: '豆制品',
      keywords: ['豆腐', '老豆腐', '嫩豆腐', '水豆腐', '豆腐干', '豆干', '香干', '豆腐皮', '千张', '百叶', '腐竹', '腐皮', '豆浆', '豆奶', '豆腐乳', '腐乳', '臭豆腐', '毛豆腐', '豆花', '豆腐脑', '素鸡', '素鸭', '素肠', '豆皮', '豆泡', '油豆腐', '豆腐泡']
    }
  ];

  const exactMatches: Record<string, string> = {
    '鸡胸肉': '肉类',
    '牛肉馅': '肉类',
    '虾仁': '肉类',
    '生抽': '调料',
    '蚝油': '调料',
    '料酒': '调料',
    '淀粉': '粮油',
  };

  if (exactMatches[name]) {
    return exactMatches[name];
  }

  for (const category of categories) {
    for (const keyword of category.keywords) {
      if (name.includes(keyword)) {
        return category.name;
      }
    }
  }

  return '其他';
}

export function mergeIngredientsByRecipe(
  recipeIngredients: RecipeIngredient[],
  multiplier: number
): RecipeIngredient[] {
  const merged = new Map<string, RecipeIngredient>();

  for (const ing of recipeIngredients) {
    const key = `${ing.ingredientId}-${ing.unit}`;
    
    if (merged.has(key)) {
      const existing = merged.get(key)!;
      existing.quantity += ing.quantity;
      if (ing.notes) {
        existing.notes = existing.notes ? `${existing.notes}; ${ing.notes}` : ing.notes;
      }
    } else {
      merged.set(key, {
        ...ing,
        quantity: ing.quantity * multiplier,
      });
    }
  }

  return Array.from(merged.values());
}
