export class Battery {
  constructor(id, name, capacity, maxChargeRate, maxDischargeRate) {
    this.id = id
    this.name = name
    this.capacity = capacity
    this.maxChargeRate = maxChargeRate
    this.maxDischargeRate = maxDischargeRate
    this.currentCharge = capacity * 0.5
    this.status = 'operational'
    this.damageLevel = 0
    this.cycleCount = 0
    this.temperature = 20
    this.overDischargeCount = 0
    this.overChargeCount = 0
  }

  get stateOfCharge() {
    return this.currentCharge / this.effectiveCapacity
  }

  get effectiveCapacity() {
    const healthFactor = 1 - (this.damageLevel * 0.4)
    const cycleFactor = Math.max(0.7, 1 - (this.cycleCount * 0.0001))
    return this.capacity * healthFactor * cycleFactor
  }

  get maxSafeDischarge() {
    if (this.stateOfCharge < 0.1) return 0
    if (this.stateOfCharge < 0.2) return this.maxDischargeRate * 0.3
    return this.maxDischargeRate
  }

  charge(amount, durationHours = 1) {
    const actualAmount = Math.min(amount, this.maxChargeRate * durationHours)
    const maxAcceptable = this.effectiveCapacity - this.currentCharge
    
    if (this.currentCharge + actualAmount > this.effectiveCapacity) {
      this.overChargeCount++
      this.temperature += 5
    }
    
    const accepted = Math.min(actualAmount, maxAcceptable)
    this.currentCharge += accepted
    
    if (accepted > 0) this.cycleCount += 0.5
    
    return accepted
  }

  discharge(amount, durationHours = 1) {
    const actualAmount = Math.min(amount, this.maxSafeDischarge * durationHours)
    const available = this.currentCharge
    
    if (this.stateOfCharge < 0.1) {
      this.overDischargeCount++
      this.temperature -= 2
    }
    
    const provided = Math.min(actualAmount, available)
    this.currentCharge -= provided
    
    if (provided > 0) this.cycleCount += 0.5
    
    return provided
  }

  applyDamage(amount) {
    this.damageLevel = Math.min(1, this.damageLevel + amount)
    if (this.damageLevel >= 1) {
      this.status = 'destroyed'
    }
  }

  getHealthStatus() {
    if (this.overDischargeCount > 5) return 'critical'
    if (this.overDischargeCount > 0) return 'warning'
    if (this.temperature > 45) return 'warning'
    return 'normal'
  }
}
