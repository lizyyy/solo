class ScoringSystem {
  constructor() {
    this.level = null;
    this.currentScore = 0;
    this.baseScore = 100;
    this.violations = [];
    this.completedTasks = [];
    this.timeBonus = 0;
    this.isCompletedFlag = false;
    this.startTime = 0;
    
    this.scoringRules = {
      baseScore: 100,
      timeBonus: {
        perSecond: 0.5,
        maxBonus: 50
      },
      violations: {
        collision: -20,
        speeding: -10,
        turningRadius: -15,
        blindSpot: -25,
        wrongSequence: -30
      },
      tasks: {
        pickup: 20,
        delivery: 30,
        avoid: 15
      }
    };
  }

  setLevel(level) {
    this.level = level;
    if (level.scoringRules) {
      this.scoringRules = { ...this.scoringRules, ...level.scoringRules };
    }
    this.baseScore = this.scoringRules.baseScore;
  }

  reset() {
    this.currentScore = this.baseScore;
    this.violations = [];
    this.completedTasks = [];
    this.timeBonus = 0;
    this.isCompletedFlag = false;
    this.startTime = performance.now();
  }

  addViolation(violation) {
    const existingViolation = this.violations.find(v => 
      v.type === violation.type && 
      (performance.now() - (v.timestamp || 0)) < 2000
    );

    if (existingViolation) {
      return;
    }

    const penalty = this.scoringRules.violations[violation.type] || -10;
    this.currentScore = Math.max(0, this.currentScore + penalty);

    this.violations.push({
      ...violation,
      penalty: penalty,
      timestamp: performance.now(),
      scoreAtTime: this.currentScore
    });

    console.log(`违规扣分: ${violation.type}, 扣分: ${penalty}`);
  }

  addTaskCompletion(task) {
    const existingTask = this.completedTasks.find(t => t.id === task.id);
    if (existingTask) {
      return;
    }

    const taskScore = this.scoringRules.tasks[task.type] || 10;
    this.currentScore += taskScore;

    this.completedTasks.push({
      ...task,
      score: taskScore,
      timestamp: performance.now()
    });

    console.log(`任务完成加分: ${task.type}, 加分: ${taskScore}`);
  }

  calculateTimeBonus(elapsedTime) {
    if (!this.level) {
      return 0;
    }

    const timeLimit = this.level.timeLimit || 300;
    const timeSaved = Math.max(0, timeLimit - elapsedTime);
    
    const bonus = Math.min(
      timeSaved * this.scoringRules.timeBonus.perSecond,
      this.scoringRules.timeBonus.maxBonus
    );

    this.timeBonus = bonus;
    return bonus;
  }

  calculateFinalScore() {
    const elapsedTime = (performance.now() - this.startTime) / 1000;
    const timeBonus = this.calculateTimeBonus(elapsedTime);
    
    const finalScore = Math.max(0, this.currentScore + timeBonus);
    this.isCompletedFlag = true;
    
    return Math.round(finalScore);
  }

  getCurrentScore() {
    return Math.round(this.currentScore);
  }

  getViolations() {
    return [...this.violations];
  }

  getViolationsByType(type) {
    return this.violations.filter(v => v.type === type);
  }

  getCompletedTasks() {
    return [...this.completedTasks];
  }

  getScoreBreakdown() {
    const violationPenalties = {};
    Object.keys(this.scoringRules.violations).forEach(type => {
      const typeViolations = this.getViolationsByType(type);
      violationPenalties[type] = {
        count: typeViolations.length,
        totalPenalty: typeViolations.reduce((sum, v) => sum + v.penalty, 0)
      };
    });

    const taskScores = {};
    Object.keys(this.scoringRules.tasks).forEach(type => {
      const typeTasks = this.completedTasks.filter(t => t.type === type);
      taskScores[type] = {
        count: typeTasks.length,
        totalScore: typeTasks.reduce((sum, t) => sum + t.score, 0)
      };
    });

    return {
      baseScore: this.baseScore,
      currentScore: this.currentScore,
      timeBonus: this.timeBonus,
      violations: violationPenalties,
      tasks: taskScores,
      totalViolations: this.violations.length,
      totalTasksCompleted: this.completedTasks.length
    };
  }

  getGrade() {
    const score = this.getCurrentScore();
    
    if (score >= 90) return { grade: 'A', label: '优秀', color: '#4CAF50' };
    if (score >= 80) return { grade: 'B', label: '良好', color: '#8BC34A' };
    if (score >= 70) return { grade: 'C', label: '中等', color: '#CDDC39' };
    if (score >= 60) return { grade: 'D', label: '及格', color: '#FFC107' };
    return { grade: 'F', label: '不及格', color: '#F44336' };
  }

  isCompleted() {
    return this.isCompletedFlag;
  }

  getState() {
    return {
      currentScore: this.currentScore,
      baseScore: this.baseScore,
      violations: [...this.violations],
      completedTasks: [...this.completedTasks],
      timeBonus: this.timeBonus,
      isCompletedFlag: this.isCompletedFlag,
      startTime: this.startTime
    };
  }

  restoreState(state) {
    this.currentScore = state.currentScore;
    this.baseScore = state.baseScore;
    this.violations = [...state.violations];
    this.completedTasks = [...state.completedTasks];
    this.timeBonus = state.timeBonus;
    this.isCompletedFlag = state.isCompletedFlag;
    this.startTime = state.startTime;
  }

  generateReport(elapsedTime) {
    const finalScore = this.calculateFinalScore();
    const grade = this.getGrade();
    const breakdown = this.getScoreBreakdown();

    return {
      finalScore: finalScore,
      grade: grade,
      elapsedTime: elapsedTime,
      breakdown: breakdown,
      timestamp: Date.now(),
      levelName: this.level?.name || '未知关卡',
      summary: {
        totalViolations: this.violations.length,
        totalTasksCompleted: this.completedTasks.length,
        timeBonus: this.timeBonus
      }
    };
  }
}

export default ScoringSystem;
