const STORAGE_KEYS = {
  BATCHES: 'pharmacy_batches',
  PROMOTIONS: 'pharmacy_promotions',
  ISSUES: 'pharmacy_issues',
  SETTINGS: 'pharmacy_settings'
}

function getFromStorage(key) {
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : null
  } catch (error) {
    console.error(`读取本地存储失败 [${key}]:`, error)
    return null
  }
}

function saveToStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
    return true
  } catch (error) {
    console.error(`写入本地存储失败 [${key}]:`, error)
    return false
  }
}

export function getBatches() {
  return getFromStorage(STORAGE_KEYS.BATCHES) || []
}

export function saveBatches(batches) {
  return saveToStorage(STORAGE_KEYS.BATCHES, batches)
}

export function getPromotions() {
  return getFromStorage(STORAGE_KEYS.PROMOTIONS) || []
}

export function savePromotions(promotions) {
  return saveToStorage(STORAGE_KEYS.PROMOTIONS, promotions)
}

export function getIssues() {
  return getFromStorage(STORAGE_KEYS.ISSUES) || []
}

export function saveIssues(issues) {
  return saveToStorage(STORAGE_KEYS.ISSUES, issues)
}

export function getSettings() {
  return getFromStorage(STORAGE_KEYS.SETTINGS) || {}
}

export function saveSettings(settings) {
  return saveToStorage(STORAGE_KEYS.SETTINGS, settings)
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export function clearAllData() {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })
}
