/**
 * 本地存储工具类
 * 封装 localStorage，提供更便捷的使用方式
 */

// 存储键名常量
const STORAGE_KEYS = {
  FOODS: 'fridge_foods', // 食材列表
  RECIPES: 'fridge_recipes', // 菜谱数据
  SETTINGS: 'fridge_settings', // 用户设置
  NOTIFICATIONS: 'fridge_notifications' // 通知记录
}

/**
 * 存储数据到本地
 * @param {string} key 存储键名
 * @param {any} data 要存储的数据
 * @returns {Promise}
 */
export const setStorage = (key, data) => {
  return new Promise((resolve) => {
    try {
      localStorage.setItem(key, JSON.stringify(data))
      resolve(true)
    } catch (err) {
      console.error('存储失败:', err)
      resolve(false)
    }
  })
}

/**
 * 从本地获取数据
 * @param {string} key 存储键名
 * @param {any} defaultValue 默认值
 * @returns {Promise}
 */
export const getStorage = (key, defaultValue = null) => {
  return new Promise((resolve) => {
    try {
      const data = localStorage.getItem(key)
      if (data !== null && data !== undefined && data !== '') {
        resolve(JSON.parse(data))
      } else {
        resolve(defaultValue)
      }
    } catch (err) {
      console.error('获取存储失败:', err)
      resolve(defaultValue)
    }
  })
}

/**
 * 同步获取存储数据
 * @param {string} key 存储键名
 * @param {any} defaultValue 默认值
 * @returns {any}
 */
export const getStorageSync = (key, defaultValue = null) => {
  try {
    const data = localStorage.getItem(key)
    if (data !== null && data !== undefined && data !== '') {
      return JSON.parse(data)
    }
    return defaultValue
  } catch (e) {
    console.error('同步获取存储失败:', e)
    return defaultValue
  }
}

/**
 * 同步存储数据
 * @param {string} key 存储键名
 * @param {any} data 要存储的数据
 * @returns {boolean}
 */
export const setStorageSync = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data))
    return true
  } catch (e) {
    console.error('同步存储失败:', e)
    return false
  }
}

/**
 * 删除指定存储
 * @param {string} key 存储键名
 * @returns {Promise}
 */
export const removeStorage = (key) => {
  return new Promise((resolve) => {
    try {
      localStorage.removeItem(key)
      resolve(true)
    } catch (err) {
      console.error('删除存储失败:', err)
      resolve(false)
    }
  })
}

/**
 * 清空所有存储
 * @returns {Promise}
 */
export const clearStorage = () => {
  return new Promise((resolve) => {
    try {
      localStorage.clear()
      resolve(true)
    } catch (err) {
      console.error('清空存储失败:', err)
      resolve(false)
    }
  })
}

export { STORAGE_KEYS }
