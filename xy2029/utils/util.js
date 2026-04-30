const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('-')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

const formatDate = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  return `${year}年${month}月${day}日`
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

const formatMoney = amount => {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const getSalaryTier = salary => {
  if (salary <= 3000) return '3k'
  if (salary <= 9000) return '9k'
  if (salary <= 30000) return '3w'
  if (salary <= 50000) return '5w'
  return '10w'
}

const getTierName = tier => {
  const tierNames = {
    '3k': '生存模式',
    '9k': '生活模式',
    '3w': '品质模式',
    '5w': '舒适模式',
    '10w': '自由模式'
  }
  return tierNames[tier] || '未知模式'
}

const getTierColor = tier => {
  const colors = {
    '3k': '#95a5a6',
    '9k': '#3498db',
    '3w': '#27ae60',
    '5w': '#9b59b6',
    '10w': '#f39c12'
  }
  return colors[tier] || '#FF6B6B'
}

const calculateAllocation = (salary, tier) => {
  const allocationRules = {
    '3k': {
      rent: 0.40,
      food: 0.25,
      shopping: 0.08,
      entertainment: 0.07,
      savings: 0.10,
      reserve: 0.05,
      social: 0.05
    },
    '9k': {
      rent: 0.35,
      food: 0.25,
      shopping: 0.12,
      entertainment: 0.10,
      savings: 0.10,
      reserve: 0.05,
      social: 0.03
    },
    '3w': {
      rent: 0.30,
      food: 0.20,
      shopping: 0.15,
      entertainment: 0.12,
      savings: 0.15,
      reserve: 0.05,
      social: 0.03
    },
    '5w': {
      rent: 0.25,
      food: 0.15,
      shopping: 0.18,
      entertainment: 0.15,
      savings: 0.20,
      reserve: 0.04,
      social: 0.03
    },
    '10w': {
      rent: 0.20,
      food: 0.12,
      shopping: 0.20,
      entertainment: 0.15,
      savings: 0.25,
      reserve: 0.04,
      social: 0.04
    }
  }

  const rule = allocationRules[tier] || allocationRules['9k']
  const result = {}
  
  Object.keys(rule).forEach(key => {
    result[key] = {
      ratio: rule[key],
      amount: Math.round(salary * rule[key])
    }
  })

  return result
}

module.exports = {
  formatTime,
  formatDate,
  formatNumber,
  formatMoney,
  getSalaryTier,
  getTierName,
  getTierColor,
  calculateAllocation
}
