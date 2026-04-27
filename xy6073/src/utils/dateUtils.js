/**
 * 日期工具类
 * 处理日期格式化、计算等功能
 */

/**
 * 格式化日期为 YYYY-MM-DD 格式
 * @param {Date|string|number} date - 日期对象、日期字符串或时间戳
 * @returns {string} 格式化后的日期字符串
 */
export const formatDate = (date) => {
  let d = date
  if (typeof d === 'string') {
    d = new Date(d)
  } else if (typeof d === 'number') {
    d = new Date(d)
  }
  
  if (!(d instanceof Date) || isNaN(d.getTime())) {
    return ''
  }
  
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * 格式化日期为完整格式 YYYY-MM-DD HH:mm:ss
 * @param {Date|string|number} date - 日期对象、日期字符串或时间戳
 * @returns {string} 格式化后的日期时间字符串
 */
export const formatDateTime = (date) => {
  let d = date
  if (typeof d === 'string') {
    d = new Date(d)
  } else if (typeof d === 'number') {
    d = new Date(d)
  }
  
  if (!(d instanceof Date) || isNaN(d.getTime())) {
    return ''
  }
  
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * 获取今天的日期（YYYY-MM-DD格式）
 * @returns {string}
 */
export const getToday = () => {
  return formatDate(new Date())
}

/**
 * 获取明天的日期（YYYY-MM-DD格式）
 * @returns {string}
 */
export const getTomorrow = () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return formatDate(tomorrow)
}

/**
 * 获取昨天的日期（YYYY-MM-DD格式）
 * @returns {string}
 */
export const getYesterday = () => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return formatDate(yesterday)
}

/**
 * 获取指定天数后的日期
 * @param {number} days - 天数（正数表示未来，负数表示过去）
 * @param {Date|string} fromDate - 从哪天开始计算，默认今天
 * @returns {string} YYYY-MM-DD格式的日期字符串
 */
export const getDateAfterDays = (days, fromDate = null) => {
  const date = fromDate ? new Date(fromDate) : new Date()
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

/**
 * 计算两个日期之间的天数差
 * @param {string|Date} date1 - 第一个日期
 * @param {string|Date} date2 - 第二个日期
 * @returns {number} 天数差（date2 - date1）
 */
export const getDaysDiff = (date1, date2) => {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  
  // 设置为0点，只比较日期
  d1.setHours(0, 0, 0, 0)
  d2.setHours(0, 0, 0, 0)
  
  const diffTime = d2.getTime() - d1.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * 检查日期是否是今天
 * @param {string|Date} date - 要检查的日期
 * @returns {boolean}
 */
export const isToday = (date) => {
  return formatDate(date) === getToday()
}

/**
 * 检查日期是否是昨天
 * @param {string|Date} date - 要检查的日期
 * @returns {boolean}
 */
export const isYesterday = (date) => {
  return formatDate(date) === getYesterday()
}

/**
 * 检查日期是否是明天
 * @param {string|Date} date - 要检查的日期
 * @returns {boolean}
 */
export const isTomorrow = (date) => {
  return formatDate(date) === getTomorrow()
}

/**
 * 格式化相对时间显示
 * @param {string|Date} date - 日期
 * @returns {string} 如：今天、明天、3天后、5天前等
 */
export const formatRelativeTime = (date) => {
  const daysDiff = getDaysDiff(new Date(), date)
  
  if (daysDiff === 0) {
    return '今天'
  } else if (daysDiff === 1) {
    return '明天'
  } else if (daysDiff === -1) {
    return '昨天'
  } else if (daysDiff > 0) {
    return `${daysDiff}天后`
  } else {
    return `${Math.abs(daysDiff)}天前`
  }
}

/**
 * 格式化过期提示文本
 * @param {number} daysLeft - 剩余天数
 * @returns {string}
 */
export const formatExpireText = (daysLeft) => {
  if (daysLeft === null || daysLeft === undefined) {
    return '未设置保质期'
  }
  
  if (daysLeft < 0) {
    return `已过期 ${Math.abs(daysLeft)} 天`
  } else if (daysLeft === 0) {
    return '今天过期'
  } else if (daysLeft === 1) {
    return '明天过期'
  } else if (daysLeft <= 2) {
    return `还有 ${daysLeft} 天过期`
  } else {
    return `还有 ${daysLeft} 天`
  }
}

/**
 * 解析食材常见保质期
 * @param {string} foodName - 食材名称
 * @returns {number} 默认保质期天数
 */
export const getDefaultShelfLife = (foodName) => {
  const shelfLifeMap = {
    // 蔬菜类
    '白菜': 7, '青菜': 3, '菠菜': 3, '生菜': 3, '芹菜': 5,
    '胡萝卜': 14, '萝卜': 14, '土豆': 30, '红薯': 30,
    '西红柿': 5, '番茄': 5, '黄瓜': 5, '茄子': 5,
    '辣椒': 7, '青椒': 7, '西兰花': 7, '花菜': 7,
    '洋葱': 30, '大蒜': 30, '生姜': 30,
    
    // 水果类
    '苹果': 14, '梨': 14, '香蕉': 5, '橙子': 14, '橘子': 14,
    '葡萄': 5, '草莓': 3, '西瓜': 7, '哈密瓜': 7, '芒果': 5,
    '猕猴桃': 7, '榴莲': 3,
    
    // 肉类
    '猪肉': 3, '牛肉': 3, '羊肉': 3, '鸡肉': 2, '鸭肉': 2,
    '五花肉': 3, '瘦肉': 3, '排骨': 3, '鸡翅': 3, '鸡腿': 3,
    
    // 海鲜类
    '鱼': 2, '虾': 2, '蟹': 2, '海鲜': 2,
    
    // 乳制品
    '牛奶': 7, '酸奶': 14, '鸡蛋': 30, '鸭蛋': 30,
    '奶酪': 60, '黄油': 90,
    
    // 谷物类
    '米饭': 2, '面条': 30, '面粉': 180, '大米': 180,
    '面包': 5, '馒头': 3,
    
    // 调味品
    '酱油': 365, '醋': 365, '盐': 730, '糖': 365,
    '料酒': 365, '蚝油': 180, '豆瓣酱': 180
  }
  
  // 模糊匹配
  for (const [key, days] of Object.entries(shelfLifeMap)) {
    if (foodName.includes(key) || key.includes(foodName)) {
      return days
    }
  }
  
  // 默认7天
  return 7
}

/**
 * 根据食材名称获取推荐的过期日期
 * @param {string} foodName - 食材名称
 * @returns {string} YYYY-MM-DD格式的日期
 */
export const getRecommendedExpireDate = (foodName) => {
  const shelfLife = getDefaultShelfLife(foodName)
  return getDateAfterDays(shelfLife)
}
