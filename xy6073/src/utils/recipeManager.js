/**
 * 菜谱管理类
 * 处理菜谱数据、根据食材推荐菜谱等业务逻辑
 */

import { STORAGE_KEYS, getStorageSync, setStorageSync } from './storage.js'
import { FOOD_CATEGORIES } from './foodManager.js'

// 内置菜谱数据
const DEFAULT_RECIPES = [
  {
    id: 'recipe_1',
    name: '西红柿炒鸡蛋',
    ingredients: [
      { name: '西红柿', amount: '2个', category: FOOD_CATEGORIES.VEGETABLE },
      { name: '鸡蛋', amount: '3个', category: FOOD_CATEGORIES.DAIRY }
    ],
    requiredIngredients: ['西红柿', '鸡蛋'],
    steps: [
      '西红柿洗净切块，鸡蛋打散备用',
      '热锅凉油，倒入鸡蛋液炒至金黄盛出',
      '锅中留底油，放入西红柿翻炒出汁',
      '加入炒好的鸡蛋，加盐调味，翻炒均匀即可'
    ],
    difficulty: '简单',
    cookTime: '15分钟',
    category: '家常菜',
    image: '',
    description: '经典家常菜，酸甜可口，营养丰富'
  },
  {
    id: 'recipe_2',
    name: '青椒炒肉丝',
    ingredients: [
      { name: '猪肉', amount: '200g', category: FOOD_CATEGORIES.MEAT },
      { name: '青椒', amount: '2个', category: FOOD_CATEGORIES.VEGETABLE }
    ],
    requiredIngredients: ['猪肉', '青椒'],
    steps: [
      '猪肉切丝，加入料酒、生抽、淀粉腌制10分钟',
      '青椒洗净切丝备用',
      '热锅凉油，放入肉丝滑炒至变色盛出',
      '锅中留底油，放入青椒丝翻炒',
      '加入肉丝，加盐、生抽调味，翻炒均匀即可'
    ],
    difficulty: '中等',
    cookTime: '25分钟',
    category: '家常菜',
    image: '',
    description: '鲜香微辣，下饭神器'
  },
  {
    id: 'recipe_3',
    name: '蒜蓉西兰花',
    ingredients: [
      { name: '西兰花', amount: '1颗', category: FOOD_CATEGORIES.VEGETABLE },
      { name: '大蒜', amount: '3瓣', category: FOOD_CATEGORIES.CONDIMENT }
    ],
    requiredIngredients: ['西兰花', '大蒜'],
    steps: [
      '西兰花掰成小朵，洗净备用',
      '大蒜切末备用',
      '锅中烧水，加少许盐和油，放入西兰花焯水1分钟捞出',
      '热锅凉油，放入蒜末爆香',
      '加入西兰花，加盐调味，翻炒均匀即可'
    ],
    difficulty: '简单',
    cookTime: '10分钟',
    category: '素菜',
    image: '',
    description: '清爽健康，简单易做'
  },
  {
    id: 'recipe_4',
    name: '红烧肉',
    ingredients: [
      { name: '五花肉', amount: '500g', category: FOOD_CATEGORIES.MEAT },
      { name: '生姜', amount: '3片', category: FOOD_CATEGORIES.CONDIMENT },
      { name: '大葱', amount: '1段', category: FOOD_CATEGORIES.CONDIMENT }
    ],
    requiredIngredients: ['五花肉'],
    steps: [
      '五花肉切块，冷水下锅焯水去血沫，捞出洗净',
      '锅中放少许油，放入冰糖小火炒至焦糖色',
      '放入五花肉翻炒上色',
      '加入姜片、葱段、八角、桂皮',
      '加入料酒、生抽、老抽，翻炒均匀',
      '加入没过肉的热水，大火烧开转小火炖1小时',
      '大火收汁即可'
    ],
    difficulty: '中等',
    cookTime: '90分钟',
    category: '荤菜',
    image: '',
    description: '肥而不腻，入口即化'
  },
  {
    id: 'recipe_5',
    name: '番茄蛋汤',
    ingredients: [
      { name: '西红柿', amount: '1个', category: FOOD_CATEGORIES.VEGETABLE },
      { name: '鸡蛋', amount: '2个', category: FOOD_CATEGORIES.DAIRY }
    ],
    requiredIngredients: ['西红柿', '鸡蛋'],
    steps: [
      '西红柿洗净切块，鸡蛋打散备用',
      '锅中放少许油，放入西红柿翻炒出汁',
      '加入适量清水，大火烧开',
      '转中火煮5分钟，让西红柿充分出汁',
      '将鸡蛋液缓慢倒入锅中，形成蛋花',
      '加盐调味，撒上葱花即可'
    ],
    difficulty: '简单',
    cookTime: '15分钟',
    category: '汤类',
    image: '',
    description: '酸甜开胃，营养丰富'
  },
  {
    id: 'recipe_6',
    name: '酸辣土豆丝',
    ingredients: [
      { name: '土豆', amount: '2个', category: FOOD_CATEGORIES.VEGETABLE },
      { name: '干辣椒', amount: '5个', category: FOOD_CATEGORIES.CONDIMENT },
      { name: '大蒜', amount: '2瓣', category: FOOD_CATEGORIES.CONDIMENT }
    ],
    requiredIngredients: ['土豆'],
    steps: [
      '土豆去皮切丝，放入清水中浸泡去淀粉',
      '大蒜切末，干辣椒切段备用',
      '锅中烧水，放入土豆丝焯水1分钟捞出',
      '热锅凉油，放入蒜末、干辣椒爆香',
      '加入土豆丝快速翻炒',
      '加入醋、盐调味，翻炒均匀即可'
    ],
    difficulty: '简单',
    cookTime: '20分钟',
    category: '家常菜',
    image: '',
    description: '酸辣爽口，下饭神器'
  },
  {
    id: 'recipe_7',
    name: '可乐鸡翅',
    ingredients: [
      { name: '鸡翅', amount: '8个', category: FOOD_CATEGORIES.MEAT },
      { name: '可乐', amount: '1罐', category: FOOD_CATEGORIES.OTHER }
    ],
    requiredIngredients: ['鸡翅', '可乐'],
    steps: [
      '鸡翅洗净，两面划几刀便于入味',
      '冷水下锅焯水去血沫，捞出洗净',
      '热锅放少许油，放入鸡翅煎至两面金黄',
      '加入料酒、生抽、老抽、姜片、葱段',
      '倒入可乐，没过鸡翅',
      '大火烧开转中火煮20分钟',
      '大火收汁即可'
    ],
    difficulty: '简单',
    cookTime: '40分钟',
    category: '荤菜',
    image: '',
    description: '甜香软嫩，老少皆宜'
  },
  {
    id: 'recipe_8',
    name: '蛋炒饭',
    ingredients: [
      { name: '米饭', amount: '1碗', category: FOOD_CATEGORIES.GRAIN },
      { name: '鸡蛋', amount: '2个', category: FOOD_CATEGORIES.DAIRY },
      { name: '小葱', amount: '少许', category: FOOD_CATEGORIES.VEGETABLE }
    ],
    requiredIngredients: ['米饭', '鸡蛋'],
    steps: [
      '鸡蛋打散，加少许盐备用',
      '小葱切葱花备用',
      '热锅凉油，倒入鸡蛋液炒至八分熟盛出',
      '锅中再放少许油，放入米饭翻炒均匀',
      '加入炒好的鸡蛋，继续翻炒',
      '加盐调味，撒上葱花即可'
    ],
    difficulty: '简单',
    cookTime: '10分钟',
    category: '主食',
    image: '',
    description: '粒粒分明，香飘四溢'
  }
]

// 初始化菜谱数据
const initRecipes = () => {
  const existingRecipes = getStorageSync(STORAGE_KEYS.RECIPES, null)
  if (!existingRecipes || existingRecipes.length === 0) {
    setStorageSync(STORAGE_KEYS.RECIPES, DEFAULT_RECIPES)
    return DEFAULT_RECIPES
  }
  return existingRecipes
}

// 获取所有菜谱（同步）
const getAllRecipes = () => {
  let recipes = getStorageSync(STORAGE_KEYS.RECIPES, [])
  if (recipes.length === 0) {
    recipes = initRecipes()
  }
  return recipes
}

// 食材别名映射 - 双向映射，用于匹配不同叫法
const INGREDIENT_ALIASES = {
  '西红柿': ['番茄', '洋柿子'],
  '番茄': ['西红柿', '洋柿子'],
  '土豆': ['马铃薯', '洋芋'],
  '马铃薯': ['土豆', '洋芋'],
  '猪肉': ['五花肉', '瘦肉', '肥肉'],
  '五花肉': ['猪肉', '瘦肉'],
  '瘦肉': ['猪肉', '五花肉'],
  '鸡肉': ['鸡翅', '鸡腿'],
  '鸡翅': ['鸡肉', '鸡腿'],
  '鸡腿': ['鸡肉', '鸡翅'],
  '鸡蛋': ['蛋'],
  '蛋': ['鸡蛋'],
  '西兰花': ['花椰菜'],
  '花椰菜': ['西兰花'],
  '青椒': ['辣椒'],
  '辣椒': ['青椒'],
  '大蒜': ['蒜'],
  '蒜': ['大蒜'],
  '生姜': ['姜'],
  '姜': ['生姜'],
  '米饭': ['米', '大米'],
  '米': ['米饭', '大米'],
  '大米': ['米饭', '米']
}

// 简化匹配检查
const isIngredientMatch = (availableName, recipeIngredient) => {
  const a = availableName.toLowerCase()
  const r = recipeIngredient.toLowerCase()
  
  // 直接匹配（完全相等或互相包含）
  if (a === r) return true
  if (a.includes(r) && a.length > r.length) return true
  if (r.includes(a) && r.length > a.length) return true
  
  // 别名匹配
  const aliasesA = INGREDIENT_ALIASES[a] || []
  const aliasesR = INGREDIENT_ALIASES[r] || []
  
  // 检查 availableName 的别名是否包含 recipeIngredient
  if (aliasesA.includes(r)) return true
  
  // 检查 recipeIngredient 的别名是否包含 availableName
  if (aliasesR.includes(a)) return true
  
  // 检查别名之间是否有交集
  for (const aliasA of aliasesA) {
    if (aliasesR.includes(aliasA)) return true
  }
  
  return false
}

// 计算食材匹配度
const calculateIngredientMatch = (recipeIngredients, availableIngredients) => {
  let matchCount = 0
  const missingIngredients = []
  
  recipeIngredients.forEach((ingredient, index) => {
    const isMatched = availableIngredients.some(available => 
      isIngredientMatch(available, ingredient)
    )
    
    if (isMatched) {
      matchCount++
    } else {
      missingIngredients.push(recipeIngredients[index])
    }
  })
  
  return {
    matchCount,
    totalCount: recipeIngredients.length,
    matchPercentage: recipeIngredients.length > 0 ? (matchCount / recipeIngredients.length) * 100 : 0,
    missingIngredients
  }
}

// 根据可用食材推荐菜谱（同步）
// 返回所有菜谱，按匹配度从高到低排序
const recommendRecipes = (availableFoods = [], minMatchPercentage = 0) => {
  let foods = availableFoods
  
  const foodNames = []
  if (foods && foods.length > 0) {
    foodNames.push(...foods.map(food => {
      if (typeof food === 'string') {
        return food
      }
      return food.name
    }))
  }
  
  const recipes = getAllRecipes()
  
  // 为所有菜谱计算匹配度
  const recipesWithMatch = recipes.map(recipe => {
    let matchInfo
    if (foodNames.length > 0) {
      matchInfo = calculateIngredientMatch(
        recipe.requiredIngredients,
        foodNames
      )
    } else {
      // 没有食材时，默认匹配度为 0
      matchInfo = {
        matchCount: 0,
        totalCount: recipe.requiredIngredients.length,
        matchPercentage: 0,
        missingIngredients: [...recipe.requiredIngredients]
      }
    }
    
    return {
      ...recipe,
      matchInfo
    }
  })
  
  // 按匹配度从高到低排序
  const sortedRecipes = recipesWithMatch
    .filter(recipe => recipe.matchInfo.matchPercentage >= minMatchPercentage)
    .sort((a, b) => {
      if (b.matchInfo.matchPercentage !== a.matchInfo.matchPercentage) {
        return b.matchInfo.matchPercentage - a.matchInfo.matchPercentage
      }
      return a.matchInfo.missingIngredients.length - b.matchInfo.missingIngredients.length
    })
  
  return sortedRecipes
}

// 导出 recipeManager 对象
export const recipeManager = {
  getAllRecipes,
  recommendRecipes,
  calculateIngredientMatch,
  initRecipes,
  DEFAULT_RECIPES
}
