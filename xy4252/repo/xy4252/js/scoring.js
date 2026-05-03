class ScoringSystem {
    constructor() {
        this.totalScore = 0;
        this.missionScores = {};
        this.bonusScore = 0;
        this.penaltyScore = 0;
    }

    calculateMissionScore(missionName, timeTaken, timeLimit, maxPoints) {
        if (timeTaken <= 0) return maxPoints;
        
        const ratio = timeTaken / timeLimit;
        
        if (ratio <= 0.5) {
            return maxPoints;
        } else if (ratio <= 0.75) {
            return Math.round(maxPoints * 0.8);
        } else if (ratio <= 0.9) {
            return Math.round(maxPoints * 0.5);
        } else if (ratio <= 1) {
            return Math.round(maxPoints * 0.2);
        }
        
        return 0;
    }

    calculateScoreFromMissions(missionStateMachine) {
        this.missionScores = {};
        this.totalScore = 0;
        this.bonusScore = 0;
        this.penaltyScore = 0;
        
        const missions = missionStateMachine.getAllMissions();
        
        for (const [name, mission] of Object.entries(missions)) {
            if (mission.completed && mission.endTime !== null && mission.startTime !== null) {
                const timeTaken = mission.endTime - mission.startTime;
                const score = this.calculateMissionScore(name, timeTaken, mission.timeLimit, mission.maxPoints);
                this.missionScores[name] = {
                    score: score,
                    timeTaken: timeTaken,
                    timeLimit: mission.timeLimit,
                    maxPoints: mission.maxPoints
                };
                this.totalScore += score;
            } else if (mission.failed) {
                this.missionScores[name] = {
                    score: 0,
                    timeTaken: mission.endTime !== null && mission.startTime !== null ? 
                        mission.endTime - mission.startTime : null,
                    timeLimit: mission.timeLimit,
                    maxPoints: mission.maxPoints,
                    failed: true
                };
            }
        }
        
        return this.totalScore;
    }

    addBonus(bonusPoints, reason = '') {
        this.bonusScore += bonusPoints;
        this.totalScore += bonusPoints;
        return {
            bonusPoints,
            reason,
            newTotal: this.totalScore
        };
    }

    addPenalty(penaltyPoints, reason = '') {
        this.penaltyScore += penaltyPoints;
        this.totalScore = Math.max(0, this.totalScore - penaltyPoints);
        return {
            penaltyPoints,
            reason,
            newTotal: this.totalScore
        };
    }

    calculateTimeBonus(totalTime, bonusThreshold, perfectThreshold) {
        if (totalTime <= perfectThreshold) {
            return 30;
        } else if (totalTime <= bonusThreshold) {
            return 15;
        }
        return 0;
    }

    getGrade() {
        const score = this.totalScore;
        const maxPossible = this.getMaxPossibleScore();
        const percentage = (score / maxPossible) * 100;
        
        if (percentage >= 90) return { grade: 'S', color: '#ffd700', label: '完美' };
        if (percentage >= 80) return { grade: 'A', color: '#4caf50', label: '优秀' };
        if (percentage >= 70) return { grade: 'B', color: '#2196f3', label: '良好' };
        if (percentage >= 60) return { grade: 'C', color: '#ff9800', label: '及格' };
        return { grade: 'F', color: '#f44336', label: '不及格' };
    }

    getMaxPossibleScore() {
        let maxScore = 0;
        for (const key in CONFIG.MISSIONS) {
            maxScore += CONFIG.MISSIONS[key].maxPoints;
        }
        return maxScore;
    }

    getScoreBreakdown() {
        return {
            totalScore: this.totalScore,
            missionScores: Utils.deepClone(this.missionScores),
            bonusScore: this.bonusScore,
            penaltyScore: this.penaltyScore,
            grade: this.getGrade(),
            maxPossible: this.getMaxPossibleScore()
        };
    }

    reset() {
        this.totalScore = 0;
        this.missionScores = {};
        this.bonusScore = 0;
        this.penaltyScore = 0;
    }

    getState() {
        return {
            totalScore: this.totalScore,
            missionScores: Utils.deepClone(this.missionScores),
            bonusScore: this.bonusScore,
            penaltyScore: this.penaltyScore
        };
    }

    restoreState(state) {
        if (state) {
            this.totalScore = state.totalScore || 0;
            this.missionScores = Utils.deepClone(state.missionScores || {});
            this.bonusScore = state.bonusScore || 0;
            this.penaltyScore = state.penaltyScore || 0;
        }
    }
}

window.ScoringSystem = ScoringSystem;