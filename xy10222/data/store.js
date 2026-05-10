/**
 * 内存数据存储层
 * 用于演示和测试，生产环境可替换为数据库
 */

class DataStore {
  constructor() {
    this.pets = new Map();
    this.medicationPlans = new Map();
    this.executionReceipts = new Map();
    this.requestIdempotencyKeys = new Map();
  }

  // 幂等性检查
  checkIdempotency(requestId) {
    if (this.requestIdempotencyKeys.has(requestId)) {
      return this.requestIdempotencyKeys.get(requestId);
    }
    return null;
  }

  // 记录幂等请求
  recordIdempotency(requestId, response) {
    this.requestIdempotencyKeys.set(requestId, response);
  }

  // 宠物档案操作
  addPet(pet) {
    this.pets.set(pet.id, pet);
    return pet;
  }

  getPetById(id) {
    return this.pets.get(id) || null;
  }

  getPetByName(name) {
    return Array.from(this.pets.values()).find(p => p.name === name) || null;
  }

  getAllPets() {
    return Array.from(this.pets.values());
  }

  updatePet(id, updates) {
    const pet = this.pets.get(id);
    if (!pet) return null;
    const updatedPet = { ...pet, ...updates, updatedAt: new Date().toISOString() };
    this.pets.set(id, updatedPet);
    return updatedPet;
  }

  // 喂药计划操作
  addMedicationPlan(plan) {
    this.medicationPlans.set(plan.id, plan);
    return plan;
  }

  getMedicationPlanById(id) {
    return this.medicationPlans.get(id) || null;
  }

  getMedicationPlansByPetId(petId) {
    return Array.from(this.medicationPlans.values()).filter(p => p.petId === petId);
  }

  getMedicationPlansByPetIdAndDate(petId, date) {
    return Array.from(this.medicationPlans.values()).filter(
      p => p.petId === petId && p.startDate <= date && p.endDate >= date
    );
  }

  updateMedicationPlan(id, updates) {
    const plan = this.medicationPlans.get(id);
    if (!plan) return null;
    const updatedPlan = { ...plan, ...updates, updatedAt: new Date().toISOString() };
    this.medicationPlans.set(id, updatedPlan);
    return updatedPlan;
  }

  // 执行回执操作
  addExecutionReceipt(receipt) {
    this.executionReceipts.set(receipt.id, receipt);
    return receipt;
  }

  getExecutionReceiptById(id) {
    return this.executionReceipts.get(id) || null;
  }

  getExecutionReceiptsByPlanId(planId) {
    return Array.from(this.executionReceipts.values()).filter(r => r.planId === planId);
  }

  getExecutionReceiptsByPetId(petId) {
    return Array.from(this.executionReceipts.values()).filter(r => r.petId === petId);
  }

  updateExecutionReceipt(id, updates) {
    const receipt = this.executionReceipts.get(id);
    if (!receipt) return null;
    const updatedReceipt = { ...receipt, ...updates, updatedAt: new Date().toISOString() };
    this.executionReceipts.set(id, updatedReceipt);
    return updatedReceipt;
  }
}

module.exports = new DataStore();
