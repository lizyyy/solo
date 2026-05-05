export class ScoringSystem {
  constructor() {
    this.score = 0;
    this.baseScore = 1000;
    this.movePenalty = 5;
    this.pushPenalty = 10;
    this.violationPenalties = {
      humidity: 50,
      patrol: 100,
      box_stuck: 300,
      elevator_overload: 250
    };
    this.boxDeliveryBonus = 200;
    this.perfectBonus = 500;
    this.stats = {
      moves: 0,
      pushes: 0,
      boxesDelivered: 0,
      violations: [],
      totalBoxes: 0
    };
  }

  initialize(totalBoxes) {
    this.score = this.baseScore;
    this.stats = {
      moves: 0,
      pushes: 0,
      boxesDelivered: 0,
      violations: [],
      totalBoxes: totalBoxes
    };
  }

  recordMove() {
    this.stats.moves++;
    this.score -= this.movePenalty;
    this.score = Math.max(0, this.score);
  }

  recordPush() {
    this.stats.pushes++;
    this.score -= this.pushPenalty;
    this.score = Math.max(0, this.score);
  }

  recordBoxDelivery() {
    this.stats.boxesDelivered++;
    this.score += this.boxDeliveryBonus;
  }

  recordViolation(violation) {
    this.stats.violations.push(violation);
    const penalty = this.violationPenalties[violation.type] || 0;
    this.score -= penalty;
    this.score = Math.max(0, this.score);
  }

  applyPerfectBonus() {
    if (this.stats.violations.length === 0 && 
        this.stats.boxesDelivered === this.stats.totalBoxes) {
      this.score += this.perfectBonus;
      return true;
    }
    return false;
  }

  getScore() {
    return this.score;
  }

  getStats() {
    return {
      ...this.stats,
      finalScore: this.score,
      hasPerfectBonus: this.stats.violations.length === 0 && 
                       this.stats.boxesDelivered === this.stats.totalBoxes
    };
  }

  getViolationSummary() {
    const summary = {};
    this.stats.violations.forEach(v => {
      summary[v.type] = (summary[v.type] || 0) + 1;
    });
    return summary;
  }

  getGrade() {
    const percentage = this.score / this.baseScore;
    if (percentage >= 1.2) return { grade: 'S', color: '#FFD700', label: '完美' };
    if (percentage >= 0.9) return { grade: 'A', color: '#4CAF50', label: '优秀' };
    if (percentage >= 0.7) return { grade: 'B', color: '#2196F3', label: '良好' };
    if (percentage >= 0.5) return { grade: 'C', color: '#FF9800', label: '合格' };
    return { grade: 'D', color: '#F44336', label: '不及格' };
  }
}
