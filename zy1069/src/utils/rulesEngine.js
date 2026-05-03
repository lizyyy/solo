import { RISK_LEVEL, APPLICABLE_POPULATION } from './constants'
import { createRiskResult } from './models'
import { 
  isExpired, 
  isExpiringSoon, 
  getDaysUntilExpiry, 
  getTimeDifference,
  getAgeGroup,
  isDateInRange,
  getTodayString
} from './dateUtils'
import { getFamilyMembers, getMedicines, getMedicationPlans } from './storage'

function hasStringMatch(str, patterns) {
  if (!str || !patterns || patterns.length === 0) return false
  const strLower = str.toLowerCase()
  return patterns.some(pattern => 
    strLower.includes(pattern.toLowerCase())
  )
}

function splitIngredients(ingredientStr) {
  if (!ingredientStr) return []
  return ingredientStr
    .split(/[,、，]/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

export function checkDuplicateIngredients(familyMembers, medicines, medicationPlans) {
  const risks = []
  const today = getTodayString()
  
  const activePlans = medicationPlans.filter(plan => 
    isDateInRange(today, plan.startDate, plan.endDate)
  )
  
  const memberPlanGroups = {}
  activePlans.forEach(plan => {
    if (!memberPlanGroups[plan.familyMemberId]) {
      memberPlanGroups[plan.familyMemberId] = []
    }
    memberPlanGroups[plan.familyMemberId].push(plan)
  })
  
  Object.entries(memberPlanGroups).forEach(([memberId, plans]) => {
    const member = familyMembers.find(m => m.id === memberId)
    if (!member) return
    
    const ingredientPlans = {}
    plans.forEach(plan => {
      const medicine = medicines.find(m => m.id === plan.medicineId)
      if (!medicine || !medicine.genericIngredient) return
      
      const ingredients = splitIngredients(medicine.genericIngredient)
      ingredients.forEach(ingredient => {
        if (!ingredientPlans[ingredient]) {
          ingredientPlans[ingredient] = []
        }
        ingredientPlans[ingredient].push({ plan, medicine })
      })
    })
    
    Object.entries(ingredientPlans).forEach(([ingredient, items]) => {
      if (items.length > 1) {
        const medicineNames = items.map(i => i.medicine.name).join('、')
        const planIds = items.map(i => i.plan.id)
        const medicineIds = items.map(i => i.medicine.id)
        
        risks.push(createRiskResult({
          level: RISK_LEVEL.HIGH,
          category: 'duplicate_ingredient',
          title: `成分重复：${ingredient}`,
          description: `${member.name} 同时使用的多种药品含有相同成分「${ingredient}」，涉及药品：${medicineNames}。成分重复可能导致过量服用，存在严重风险。`,
          affectedMembers: [memberId],
          affectedMedicines: medicineIds,
          affectedPlans: planIds
        }))
      }
    })
  })
  
  return risks
}

export function checkAllergyContraindications(familyMembers, medicines, medicationPlans) {
  const risks = []
  const today = getTodayString()
  
  const activePlans = medicationPlans.filter(plan => 
    isDateInRange(today, plan.startDate, plan.endDate)
  )
  
  activePlans.forEach(plan => {
    const member = familyMembers.find(m => m.id === plan.familyMemberId)
    const medicine = medicines.find(m => m.id === plan.medicineId)
    
    if (!member || !medicine) return
    
    if (member.allergies && member.allergies.length > 0) {
      const allergyMatch = medicine.contraindications?.some(ci => 
        hasStringMatch(ci, member.allergies)
      )
      
      const ingredientMatch = hasStringMatch(medicine.genericIngredient, member.allergies)
      const nameMatch = hasStringMatch(medicine.name, member.allergies)
      
      if (allergyMatch || ingredientMatch || nameMatch) {
        const matchingAllergies = member.allergies.filter(a => 
          hasStringMatch(medicine.name, [a]) || 
          hasStringMatch(medicine.genericIngredient, [a]) ||
          medicine.contraindications?.some(ci => hasStringMatch(ci, [a]))
        )
        
        risks.push(createRiskResult({
          level: RISK_LEVEL.HIGH,
          category: 'allergy',
          title: `过敏/禁忌警告：${medicine.name}`,
          description: `${member.name} 对「${matchingAllergies.join('、')}」过敏，而药品「${medicine.name}」的禁忌说明或成分可能含有相关物质。请立即咨询医生后再使用。`,
          affectedMembers: [member.id],
          affectedMedicines: [medicine.id],
          affectedPlans: [plan.id]
        }))
      }
    }
    
    if (medicine.contraindications && medicine.contraindications.length > 0) {
      medicine.contraindications.forEach(ci => {
        if (hasStringMatch(ci, member.chronicConditions || [])) {
          const matchingConditions = member.chronicConditions?.filter(c => 
            hasStringMatch(ci, [c])
          ) || []
          
          if (matchingConditions.length > 0) {
            risks.push(createRiskResult({
              level: RISK_LEVEL.HIGH,
              category: 'contraindication',
              title: `慢性病禁忌：${medicine.name}`,
              description: `${member.name} 患有「${matchingConditions.join('、')}」，而药品「${medicine.name}」的禁忌说明中提到：「${ci}」。请咨询医生确认是否适合使用。`,
              affectedMembers: [member.id],
              affectedMedicines: [medicine.id],
              affectedPlans: [plan.id]
            }))
          }
        }
      })
    }
  })
  
  return risks
}

export function checkAgeAppropriateness(familyMembers, medicines, medicationPlans) {
  const risks = []
  const today = getTodayString()
  
  const activePlans = medicationPlans.filter(plan => 
    isDateInRange(today, plan.startDate, plan.endDate)
  )
  
  activePlans.forEach(plan => {
    const member = familyMembers.find(m => m.id === plan.familyMemberId)
    const medicine = medicines.find(m => m.id === plan.medicineId)
    
    if (!member || !medicine) return
    
    const applicable = medicine.applicablePopulation || []
    if (applicable.length === 0 || applicable.includes(APPLICABLE_POPULATION.ALL)) {
      return
    }
    
    const memberAgeGroup = getAgeGroup(member.age)
    
    if (!applicable.includes(memberAgeGroup)) {
      const applicableLabels = {
        [APPLICABLE_POPULATION.INFANT]: '婴幼儿',
        [APPLICABLE_POPULATION.CHILD]: '儿童',
        [APPLICABLE_POPULATION.TEEN]: '青少年',
        [APPLICABLE_POPULATION.ADULT]: '成年人',
        [APPLICABLE_POPULATION.ELDERLY]: '老年人'
      }
      
      const applicableText = applicable.map(a => applicableLabels[a] || a).join('、')
      const memberAgeGroupText = applicableLabels[memberAgeGroup] || memberAgeGroup
      
      risks.push(createRiskResult({
        level: RISK_LEVEL.MEDIUM,
        category: 'age_inappropriate',
        title: `年龄不适宜：${medicine.name}`,
        description: `${member.name}（${member.age}岁，属于${memberAgeGroupText}）使用的药品「${medicine.name}」仅适用于「${applicableText}」。请确认剂量或更换更合适的药品。`,
        affectedMembers: [member.id],
        affectedMedicines: [medicine.id],
        affectedPlans: [plan.id]
      }))
    }
  })
  
  return risks
}

export function checkDoseIntervals(familyMembers, medicines, medicationPlans) {
  const risks = []
  const today = getTodayString()
  
  const activePlans = medicationPlans.filter(plan => 
    isDateInRange(today, plan.startDate, plan.endDate)
  )
  
  const memberPlanGroups = {}
  activePlans.forEach(plan => {
    if (!memberPlanGroups[plan.familyMemberId]) {
      memberPlanGroups[plan.familyMemberId] = []
    }
    memberPlanGroups[plan.familyMemberId].push(plan)
  })
  
  Object.entries(memberPlanGroups).forEach(([memberId, plans]) => {
    const member = familyMembers.find(m => m.id === memberId)
    if (!member) return
    
    const allDoses = []
    plans.forEach(plan => {
      const medicine = medicines.find(m => m.id === plan.medicineId)
      if (!medicine) return
      
      plan.doses.forEach(dose => {
        allDoses.push({
          plan,
          medicine,
          dose,
          time: dose.time
        })
      })
    })
    
    allDoses.sort((a, b) => a.time.localeCompare(b.time))
    
    for (let i = 0; i < allDoses.length; i++) {
      for (let j = i + 1; j < allDoses.length; j++) {
        const doseA = allDoses[i]
        const doseB = allDoses[j]
        
        const timeDiff = getTimeDifference(doseA.time, doseB.time)
        const minInterval = Math.min(
          doseA.medicine.suggestedInterval || 4,
          doseB.medicine.suggestedInterval || 4
        )
        const minIntervalMinutes = minInterval * 60
        
        if (timeDiff < minIntervalMinutes && timeDiff > 0) {
          const diffHours = (timeDiff / 60).toFixed(1)
          
          risks.push(createRiskResult({
            level: RISK_LEVEL.MEDIUM,
            category: 'interval_too_close',
            title: `服药间隔过短`,
            description: `${member.name} 的「${doseA.medicine.name}」（${doseA.time}）和「${doseB.medicine.name}」（${doseB.time}）间隔仅 ${diffHours} 小时，建议至少间隔 ${minInterval} 小时。间隔过短可能增加副作用风险。`,
            affectedMembers: [memberId],
            affectedMedicines: [doseA.medicine.id, doseB.medicine.id],
            affectedPlans: [doseA.plan.id, doseB.plan.id]
          }))
        }
      }
    }
  })
  
  return risks
}

export function checkExpiredMedicines(medicines) {
  const risks = []
  
  medicines.forEach(medicine => {
    if (isExpired(medicine.expiryDate)) {
      const daysExpired = Math.abs(getDaysUntilExpiry(medicine.expiryDate))
      
      risks.push(createRiskResult({
        level: RISK_LEVEL.HIGH,
        category: 'expired',
        title: `药品已过期：${medicine.name}`,
        description: `药品「${medicine.name}」已过期 ${daysExpired} 天（有效期至 ${medicine.expiryDate}）。过期药品可能失去疗效或产生有害物质，请立即丢弃并补充新药。`,
        affectedMembers: [],
        affectedMedicines: [medicine.id],
        affectedPlans: []
      }))
    } else if (isExpiringSoon(medicine.expiryDate, 30)) {
      const daysRemaining = getDaysUntilExpiry(medicine.expiryDate)
      
      risks.push(createRiskResult({
        level: RISK_LEVEL.MEDIUM,
        category: 'expiring_soon',
        title: `药品即将过期：${medicine.name}`,
        description: `药品「${medicine.name}」将在 ${daysRemaining} 天后过期（有效期至 ${medicine.expiryDate}）。请在过期前使用完毕或提前备药。`,
        affectedMembers: [],
        affectedMedicines: [medicine.id],
        affectedPlans: []
      }))
    }
  })
  
  return risks
}

export function checkLowStock(medicines, medicationPlans) {
  const risks = []
  const today = getTodayString()
  
  medicines.forEach(medicine => {
    if (medicine.stockQuantity === 0) {
      risks.push(createRiskResult({
        level: RISK_LEVEL.HIGH,
        category: 'out_of_stock',
        title: `药品库存为0：${medicine.name}`,
        description: `药品「${medicine.name}」库存已耗尽，请立即补充！`,
        affectedMembers: [],
        affectedMedicines: [medicine.id],
        affectedPlans: []
      }))
    } else if (medicine.stockQuantity <= 5) {
      const activePlans = medicationPlans.filter(plan => 
        plan.medicineId === medicine.id && 
        isDateInRange(today, plan.startDate, plan.endDate)
      )
      
      const dailyDoses = activePlans.reduce((sum, plan) => sum + (plan.frequencyPerDay || 1), 0)
      const daysSupply = dailyDoses > 0 ? Math.floor(medicine.stockQuantity / dailyDoses) : null
      
      let description = `药品「${medicine.name}」库存仅剩 ${medicine.stockQuantity} 份，请及时补充。`
      if (daysSupply !== null) {
        description += ` 按当前用药计划，大约可用 ${daysSupply} 天。`
      }
      
      risks.push(createRiskResult({
        level: RISK_LEVEL.LOW,
        category: 'low_stock',
        title: `药品库存不足：${medicine.name}`,
        description,
        affectedMembers: [],
        affectedMedicines: [medicine.id],
        affectedPlans: []
      }))
    }
  })
  
  return risks
}

export function runAllChecks() {
  const familyMembers = getFamilyMembers()
  const medicines = getMedicines()
  const medicationPlans = getMedicationPlans()
  
  const risks = [
    ...checkDuplicateIngredients(familyMembers, medicines, medicationPlans),
    ...checkAllergyContraindications(familyMembers, medicines, medicationPlans),
    ...checkAgeAppropriateness(familyMembers, medicines, medicationPlans),
    ...checkDoseIntervals(familyMembers, medicines, medicationPlans),
    ...checkExpiredMedicines(medicines),
    ...checkLowStock(medicines, medicationPlans)
  ]
  
  risks.sort((a, b) => {
    const levelOrder = { [RISK_LEVEL.HIGH]: 0, [RISK_LEVEL.MEDIUM]: 1, [RISK_LEVEL.LOW]: 2 }
    return levelOrder[a.level] - levelOrder[b.level]
  })
  
  const statistics = {
    total: risks.length,
    high: risks.filter(r => r.level === RISK_LEVEL.HIGH).length,
    medium: risks.filter(r => r.level === RISK_LEVEL.MEDIUM).length,
    low: risks.filter(r => r.level === RISK_LEVEL.LOW).length,
    byCategory: {}
  }
  
  risks.forEach(r => {
    if (!statistics.byCategory[r.category]) {
      statistics.byCategory[r.category] = 0
    }
    statistics.byCategory[r.category]++
  })
  
  return {
    risks,
    statistics,
    checkedAt: Date.now()
  }
}

export const CATEGORY_LABELS = {
  duplicate_ingredient: '成分重复',
  allergy: '过敏警告',
  contraindication: '慢性病禁忌',
  age_inappropriate: '年龄不适宜',
  interval_too_close: '间隔过短',
  expired: '药品过期',
  expiring_soon: '即将过期',
  out_of_stock: '库存耗尽',
  low_stock: '库存不足'
}
