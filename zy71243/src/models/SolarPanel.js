export class SolarPanel {
  constructor(id, name, maxOutput, efficiency = 1.0, tiltAngle = 45) {
    this.id = id
    this.name = name
    this.maxOutput = maxOutput
    this.efficiency = efficiency
    this.tiltAngle = tiltAngle
    this.status = 'operational'
    this.damageLevel = 0
    this.sunAngleFactor = 1.0
  }

  calculateOutput(sunAngle = 90) {
    if (this.status !== 'operational') return 0
    
    const angleDiff = Math.abs(sunAngle - this.tiltAngle)
    const rawCosine = Math.cos(angleDiff * Math.PI / 180)
    const sunAngleFactor = Math.max(0, rawCosine)
    const healthFactor = 1 - (this.damageLevel * 0.3)
    
    return Math.max(0, this.maxOutput * this.efficiency * sunAngleFactor * healthFactor)
  }

  applyDamage(amount) {
    this.damageLevel = Math.min(1, this.damageLevel + amount)
    if (this.damageLevel >= 1) {
      this.status = 'destroyed'
    } else if (this.damageLevel >= 0.5) {
      this.status = 'degraded'
    }
  }

  repair() {
    this.damageLevel = 0
    this.status = 'operational'
  }
}
