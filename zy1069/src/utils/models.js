export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export function createFamilyMember(data = {}) {
  return {
    id: data.id || generateId(),
    name: data.name || '',
    age: data.age || 0,
    ageGroup: data.ageGroup || '',
    allergies: data.allergies || [],
    chronicConditions: data.chronicConditions || [],
    notes: data.notes || '',
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now()
  }
}

export function createMedicine(data = {}) {
  return {
    id: data.id || generateId(),
    name: data.name || '',
    genericIngredient: data.genericIngredient || '',
    specifications: data.specifications || '',
    stockQuantity: data.stockQuantity || 0,
    expiryDate: data.expiryDate || '',
    applicablePopulation: data.applicablePopulation || [],
    contraindications: data.contraindications || [],
    suggestedInterval: data.suggestedInterval || 4,
    notes: data.notes || '',
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now()
  }
}

export function createMedicationPlan(data = {}) {
  return {
    id: data.id || generateId(),
    familyMemberId: data.familyMemberId || '',
    medicineId: data.medicineId || '',
    startDate: data.startDate || '',
    endDate: data.endDate || '',
    frequencyPerDay: data.frequencyPerDay || 1,
    doses: data.doses || [],
    mealTiming: data.mealTiming || 'any',
    dosage: data.dosage || '',
    notes: data.notes || '',
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now()
  }
}

export function createDose(data = {}) {
  return {
    id: data.id || generateId(),
    time: data.time || '',
    status: data.status || 'pending',
    takenAt: data.takenAt || null
  }
}

export function createDoseHistory(data = {}) {
  return {
    id: data.id || generateId(),
    planId: data.planId || '',
    doseId: data.doseId || '',
    familyMemberId: data.familyMemberId || '',
    medicineId: data.medicineId || '',
    date: data.date || '',
    time: data.time || '',
    status: data.status || 'pending',
    takenAt: data.takenAt || null,
    createdAt: data.createdAt || Date.now()
  }
}

export function createRiskResult(data = {}) {
  return {
    id: data.id || generateId(),
    level: data.level || 'medium',
    category: data.category || '',
    title: data.title || '',
    description: data.description || '',
    affectedMembers: data.affectedMembers || [],
    affectedMedicines: data.affectedMedicines || [],
    affectedPlans: data.affectedPlans || [],
    createdAt: data.createdAt || Date.now()
  }
}
