class Scorer {
  constructor(game) {
    this.game = game;
    this.score = 0;
    this.multiplier = 1.0;
    this.combo = 0;
    this.consecutiveSafeTicks = 0;
  }
  
  update() {
    this.updateMultiplier();
    this.applyTimeBonus();
    this.applySafetyBonus();
  }
  
  updateMultiplier() {
    const risk = this.game.riskEvaluator.getOverallRisk();
    
    if (risk < 0.2) {
      this.consecutiveSafeTicks++;
      if (this.consecutiveSafeTicks > 300) {
        this.multiplier = 1.5;
      } else if (this.consecutiveSafeTicks > 150) {
        this.multiplier = 1.3;
      } else if (this.consecutiveSafeTicks > 60) {
        this.multiplier = 1.1;
      }
    } else if (risk > 0.5) {
      this.consecutiveSafeTicks = 0;
      this.multiplier = Math.max(0.5, this.multiplier - 0.01);
    }
  }
  
  applyTimeBonus() {
    if (this.game.tickCount % 600 === 0) {
      const bonus = Math.floor(5 * this.multiplier);
      this.game.score += bonus;
    }
  }
  
  applySafetyBonus() {
    if (this.game.tickCount % 1200 === 0 && this.multiplier > 1.1) {
      const bonus = Math.floor(50 * this.multiplier);
      this.game.score += bonus;
      this.game.addAlert('info', `安全运营奖励：+${bonus}分（连击加成：${(this.multiplier * 100 - 100).toFixed(0)}%）`);
    }
  }
  
  addBoardingScore(passengerCount) {
    const baseScore = passengerCount * 10;
    const bonusScore = Math.floor(baseScore * this.multiplier);
    this.game.score += bonusScore;
    this.combo++;
    
    if (this.combo >= 10) {
      const comboBonus = this.combo * 2;
      this.game.score += comboBonus;
    }
    
    return bonusScore;
  }
  
  deductPenalty(reason, amount) {
    const actualPenalty = Math.floor(amount / this.multiplier);
    this.game.score = Math.max(0, this.game.score - actualPenalty);
    this.combo = 0;
    this.multiplier = Math.max(0.5, this.multiplier - 0.2);
    
    return actualPenalty;
  }
  
  calculateFinalScore() {
    let finalScore = this.game.score;
    
    const totalPassengers = this.game.totalPassengers;
    const remainingPassengers = this.game.passengers.length;
    const safelyTransported = totalPassengers - remainingPassengers;
    
    if (safelyTransported > 0) {
      finalScore += safelyTransported * 5;
    }
    
    if (remainingPassengers === 0) {
      finalScore += 500;
    }
    
    if (this.game.incidents === 0) {
      finalScore += 1000;
    }
    
    const maxRisk = this.game.maxRisk;
    if (maxRisk < 0.3) {
      finalScore += 800;
    } else if (maxRisk < 0.5) {
      finalScore += 400;
    } else if (maxRisk < 0.7) {
      finalScore += 100;
    }
    
    return finalScore;
  }
  
  getScoreBreakdown() {
    const breakdown = {
      baseScore: this.game.score,
      transportedBonus: 0,
      allClearBonus: 0,
      noIncidentBonus: 0,
      riskManagementBonus: 0,
      penalties: this.game.incidents * 100,
      final: 0
    };
    
    const totalPassengers = this.game.totalPassengers;
    const remainingPassengers = this.game.passengers.length;
    const safelyTransported = totalPassengers - remainingPassengers;
    
    if (safelyTransported > 0) {
      breakdown.transportedBonus = safelyTransported * 5;
    }
    
    if (remainingPassengers === 0) {
      breakdown.allClearBonus = 500;
    }
    
    if (this.game.incidents === 0) {
      breakdown.noIncidentBonus = 1000;
    }
    
    const maxRisk = this.game.maxRisk;
    if (maxRisk < 0.3) {
      breakdown.riskManagementBonus = 800;
    } else if (maxRisk < 0.5) {
      breakdown.riskManagementBonus = 400;
    } else if (maxRisk < 0.7) {
      breakdown.riskManagementBonus = 100;
    }
    
    breakdown.final = breakdown.baseScore + 
                      breakdown.transportedBonus + 
                      breakdown.allClearBonus + 
                      breakdown.noIncidentBonus + 
                      breakdown.riskManagementBonus - 
                      breakdown.penalties;
    
    return breakdown;
  }
}

export default Scorer;
