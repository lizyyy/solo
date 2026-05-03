import { STORAGE_KEYS } from './constants'
import { getSampleData } from './sampleData'

export function getStorageItem(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key)
    if (item === null) return defaultValue
    return JSON.parse(item)
  } catch (e) {
    console.error(`Error reading from localStorage: ${key}`, e)
    return defaultValue
  }
}

export function setStorageItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    console.error(`Error writing to localStorage: ${key}`, e)
    return false
  }
}

export function removeStorageItem(key) {
  try {
    localStorage.removeItem(key)
    return true
  } catch (e) {
    console.error(`Error removing from localStorage: ${key}`, e)
    return false
  }
}

export function clearAllStorage() {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key)
    })
    return true
  } catch (e) {
    console.error('Error clearing localStorage', e)
    return false
  }
}

export function isAppInitialized() {
  return getStorageItem(STORAGE_KEYS.INITIALIZED, false)
}

export function initializeApp() {
  if (isAppInitialized()) {
    return false
  }
  
  const sampleData = getSampleData()
  
  setStorageItem(STORAGE_KEYS.FAMILY_MEMBERS, sampleData.familyMembers)
  setStorageItem(STORAGE_KEYS.MEDICINES, sampleData.medicines)
  setStorageItem(STORAGE_KEYS.MEDICATION_PLANS, sampleData.medicationPlans)
  setStorageItem(STORAGE_KEYS.DOSE_HISTORY, [])
  setStorageItem(STORAGE_KEYS.INITIALIZED, true)
  
  return true
}

export function getFamilyMembers() {
  return getStorageItem(STORAGE_KEYS.FAMILY_MEMBERS, [])
}

export function setFamilyMembers(members) {
  return setStorageItem(STORAGE_KEYS.FAMILY_MEMBERS, members)
}

export function getFamilyMember(id) {
  const members = getFamilyMembers()
  return members.find(m => m.id === id) || null
}

export function addFamilyMember(member) {
  const members = getFamilyMembers()
  members.push(member)
  return setFamilyMembers(members)
}

export function updateFamilyMember(id, updates) {
  const members = getFamilyMembers()
  const index = members.findIndex(m => m.id === id)
  if (index === -1) return false
  
  members[index] = { ...members[index], ...updates, updatedAt: Date.now() }
  return setFamilyMembers(members)
}

export function deleteFamilyMember(id) {
  const members = getFamilyMembers()
  const filtered = members.filter(m => m.id !== id)
  return setFamilyMembers(filtered)
}

export function getMedicines() {
  return getStorageItem(STORAGE_KEYS.MEDICINES, [])
}

export function setMedicines(medicines) {
  return setStorageItem(STORAGE_KEYS.MEDICINES, medicines)
}

export function getMedicine(id) {
  const medicines = getMedicines()
  return medicines.find(m => m.id === id) || null
}

export function addMedicine(medicine) {
  const medicines = getMedicines()
  medicines.push(medicine)
  return setMedicines(medicines)
}

export function updateMedicine(id, updates) {
  const medicines = getMedicines()
  const index = medicines.findIndex(m => m.id === id)
  if (index === -1) return false
  
  medicines[index] = { ...medicines[index], ...updates, updatedAt: Date.now() }
  return setMedicines(medicines)
}

export function deleteMedicine(id) {
  const medicines = getMedicines()
  const filtered = medicines.filter(m => m.id !== id)
  return setMedicines(filtered)
}

export function getMedicationPlans() {
  return getStorageItem(STORAGE_KEYS.MEDICATION_PLANS, [])
}

export function setMedicationPlans(plans) {
  return setStorageItem(STORAGE_KEYS.MEDICATION_PLANS, plans)
}

export function getMedicationPlan(id) {
  const plans = getMedicationPlans()
  return plans.find(p => p.id === id) || null
}

export function addMedicationPlan(plan) {
  const plans = getMedicationPlans()
  plans.push(plan)
  return setMedicationPlans(plans)
}

export function updateMedicationPlan(id, updates) {
  const plans = getMedicationPlans()
  const index = plans.findIndex(p => p.id === id)
  if (index === -1) return false
  
  plans[index] = { ...plans[index], ...updates, updatedAt: Date.now() }
  return setMedicationPlans(plans)
}

export function deleteMedicationPlan(id) {
  const plans = getMedicationPlans()
  const filtered = plans.filter(p => p.id !== id)
  return setMedicationPlans(filtered)
}

export function getDoseHistory() {
  return getStorageItem(STORAGE_KEYS.DOSE_HISTORY, [])
}

export function setDoseHistory(history) {
  return setStorageItem(STORAGE_KEYS.DOSE_HISTORY, history)
}

export function addDoseHistory(record) {
  const history = getDoseHistory()
  history.push(record)
  return setDoseHistory(history)
}

export function exportAllData() {
  return {
    version: '1.0.0',
    exportedAt: Date.now(),
    data: {
      familyMembers: getFamilyMembers(),
      medicines: getMedicines(),
      medicationPlans: getMedicationPlans(),
      doseHistory: getDoseHistory()
    }
  }
}

export function importAllData(data) {
  try {
    if (!data || !data.data) {
      throw new Error('无效的数据格式')
    }
    
    const { familyMembers, medicines, medicationPlans, doseHistory } = data.data
    
    if (familyMembers) setFamilyMembers(familyMembers)
    if (medicines) setMedicines(medicines)
    if (medicationPlans) setMedicationPlans(medicationPlans)
    if (doseHistory) setDoseHistory(doseHistory)
    
    return true
  } catch (e) {
    console.error('Import failed:', e)
    return false
  }
}
