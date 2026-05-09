const STORAGE_KEYS = {
  MATERIALS: 'flower_materials',
  RECIPES: 'bouquet_recipes',
  PREORDERS: 'pre_orders',
  INVENTORY: 'material_inventory',
  LOSS_RECORDS: 'loss_records',
  SUBSTITUTE_PLANS: 'substitute_plans'
}

export function saveData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
    return true
  } catch (e) {
    console.error('保存数据失败:', e)
    return false
  }
}

export function loadData(key, defaultValue = []) {
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : defaultValue
  } catch (e) {
    console.error('加载数据失败:', e)
    return defaultValue
  }
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

export { STORAGE_KEYS }