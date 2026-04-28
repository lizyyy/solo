/**
 * 食材管理类
 * 处理食材的增删改查、过期提醒等业务逻辑
 */

import { STORAGE_KEYS, getStorageSync, setStorageSync } from './storage.js'

// 食材状态枚举
export const FOOD_STATUS = {
  NORMAL: 'normal',
  EXPIRING: 'expiring',
  EXPIRED: 'expired'
}

// 食材分类
export const FOOD_CATEGORIES = {
  VEGETABLE: 'vegetable',
  FRUIT: 'fruit',
  MEAT: 'meat',
  SEAFOOD: 'seafood',
  DAIRY: 'dairy',
  GRAIN: 'grain',
  CONDIMENT: 'condiment',
  OTHER: 'other'
}

// 分类名称映射
export const CATEGORY_NAMES = {
  [FOOD_CATEGORIES.VEGETABLE]: '蔬菜',
  [FOOD_CATEGORIES.FRUIT]: '水果',
  [FOOD_CATEGORIES.MEAT]: '肉类',
  [FOOD_CATEGORIES.SEAFOOD]: '海鲜',
  [FOOD_CATEGORIES.DAIRY]: '乳制品',
  [FOOD_CATEGORIES.GRAIN]: '谷物',
  [FOOD_CATEGORIES.CONDIMENT]: '调味品',
  [FOOD_CATEGORIES.OTHER]: '其他'
}

// 创建食材数据模型
export const createFood = (options = {}) => {
  const now = Date.now()
  return {
    id: options.id || `food_${now}_${Math.random().toString(36).substr(2, 9)}`,
    name: options.name || '',
    quantity: options.quantity || 1,
    unit: options.unit || '个',
    expireDate: options.expireDate || '',
    category: options.category || FOOD_CATEGORIES.OTHER,
    image: options.image || '',
    notes: options.notes || '',
    createdAt: options.createdAt || now,
    updatedAt: options.updatedAt || now
  }
}

// 计算食材状态
export const calculateFoodStatus = (expireDate) => {
  if (!expireDate) {
    return { status: FOOD_STATUS.NORMAL, daysLeft: null }
  }
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const expire = new Date(expireDate)
  expire.setHours(0, 0, 0, 0)
  
  const diffTime = expire.getTime() - today.getTime()
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (daysLeft <= 0) {
    return { status: FOOD_STATUS.EXPIRED, daysLeft }
  } else if (daysLeft <= 2) {
    return { status: FOOD_STATUS.EXPIRING, daysLeft }
  } else {
    return { status: FOOD_STATUS.NORMAL, daysLeft }
  }
}

// 获取所有食材（同步）
const getFoods = () => {
  const foods = getStorageSync(STORAGE_KEYS.FOODS, [])
  return foods.map(food => ({
    ...food,
    ...calculateFoodStatus(food.expireDate)
  }))
}

// 添加食材（同步）
const addFood = (foodData) => {
  const foods = getStorageSync(STORAGE_KEYS.FOODS, [])
  const newFood = createFood(foodData)
  foods.push(newFood)
  setStorageSync(STORAGE_KEYS.FOODS, foods)
  return newFood
}

// 删除食材（同步）
const deleteFood = (id) => {
  const foods = getStorageSync(STORAGE_KEYS.FOODS, [])
  const newFoods = foods.filter(f => f.id !== id)
  setStorageSync(STORAGE_KEYS.FOODS, newFoods)
  return true
}

// 批量删除食材（同步）
const batchDeleteFoods = (ids) => {
  const foods = getStorageSync(STORAGE_KEYS.FOODS, [])
  const newFoods = foods.filter(f => !ids.includes(f.id))
  const deletedCount = foods.length - newFoods.length
  setStorageSync(STORAGE_KEYS.FOODS, newFoods)
  return deletedCount
}

// 导出 foodManager 对象
export const foodManager = {
  getFoods,
  addFood,
  deleteFood,
  batchDeleteFoods,
  calculateFoodStatus,
  createFood,
  
  FOOD_STATUS,
  FOOD_CATEGORIES,
  CATEGORY_NAMES
}
