export const LoadPriority = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4
}

export const LoadCategory = {
  LIFE_SUPPORT: 'life_support',
  PROPULSION: 'propulsion',
  SCIENCE: 'science',
  COMFORT: 'comfort',
  COMMUNICATION: 'communication'
}

export class Load {
  constructor(id, name, category, priority, powerDemand, moduleId) {
    this.id = id
    this.name = name
    this.category = category
    this.priority = priority
    this.powerDemand = powerDemand
    this.moduleId = moduleId
    this.isPowered = true
    this.powerReceived = 0
    this.uptime = 0
    this.downtime = 0
    this.consecutiveOutages = 0
    this.trips = 0
  }

  supplyPower(amount, durationHours = 1) {
    if (amount >= this.powerDemand) {
      this.isPowered = true
      this.powerReceived = this.powerDemand
      this.uptime += durationHours
      this.consecutiveOutages = 0
      return this.powerDemand
    } else {
      this.isPowered = false
      this.powerReceived = 0
      this.downtime += durationHours
      this.consecutiveOutages += durationHours
      if (this.consecutiveOutages >= 1) {
        this.trips++
      }
      return 0
    }
  }

  getReliabilityScore() {
    const totalTime = this.uptime + this.downtime
    if (totalTime === 0) return 100
    return (this.uptime / totalTime) * 100
  }

  getStatusText() {
    if (!this.isPowered) return '断电'
    if (this.consecutiveOutages > 0) return '恢复中'
    return '正常运行'
  }
}
