export const RATINGS = {
    S: 'S',
    A: 'A',
    B: 'B',
    C: 'C',
    D: 'D'
};

export class ScoringSystem {
    constructor(options = {}) {
        this.baseScore = options.baseScore || 1000;
        this.timeBonusMultiplier = options.timeBonusMultiplier || 10;
        this.stepPenalty = options.stepPenalty || 5;
        this.perfectBonus = options.perfectBonus || 200;
        
        this.timer = null;
        this.startTime = null;
        this.elapsedSeconds = 0;
        this.isPaused = false;
        this.pauseStartTime = null;
        this.totalPausedSeconds = 0;
    }

    startTimer() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        this.startTime = Date.now();
        this.elapsedSeconds = 0;
        this.totalPausedSeconds = 0;
        this.isPaused = false;
        
        this.timer = setInterval(() => {
            if (!this.isPaused) {
                this.elapsedSeconds = Math.floor((Date.now() - this.startTime - this.totalPausedSeconds * 1000) / 1000);
            }
        }, 1000);
    }

    pauseTimer() {
        if (this.isPaused) return;
        
        this.isPaused = true;
        this.pauseStartTime = Date.now();
    }

    resumeTimer() {
        if (!this.isPaused) return;
        
        if (this.pauseStartTime) {
            this.totalPausedSeconds += Math.floor((Date.now() - this.pauseStartTime) / 1000);
        }
        
        this.isPaused = false;
        this.pauseStartTime = null;
    }

    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        return this.elapsedSeconds;
    }

    getElapsedSeconds() {
        return this.elapsedSeconds;
    }

    getFormattedTime() {
        const minutes = Math.floor(this.elapsedSeconds / 60);
        const seconds = this.elapsedSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    resetTimer() {
        this.stopTimer();
        this.elapsedSeconds = 0;
        this.totalPausedSeconds = 0;
        this.isPaused = false;
        this.startTime = null;
    }

    calculateScore(steps, targetTime, maxSteps, options = {}) {
        let score = this.baseScore;
        
        const timeBonus = this.calculateTimeBonus(this.elapsedSeconds, targetTime);
        score += timeBonus;
        
        const stepPenalty = this.calculateStepPenalty(steps, maxSteps);
        score -= stepPenalty;
        
        if (options.isPerfect) {
            score += this.perfectBonus;
        }
        
        if (options.noMistakes) {
            score += 100;
        }
        
        return Math.max(0, Math.floor(score));
    }

    calculateTimeBonus(elapsedSeconds, targetTime) {
        if (!targetTime || targetTime <= 0) {
            return 0;
        }
        
        const timeDifference = targetTime - elapsedSeconds;
        
        if (timeDifference > 0) {
            return Math.floor(timeDifference * this.timeBonusMultiplier);
        } else {
            return Math.floor(timeDifference * this.timeBonusMultiplier * 0.5);
        }
    }

    calculateStepPenalty(steps, maxSteps) {
        if (!maxSteps || maxSteps <= 0) {
            return steps * this.stepPenalty;
        }
        
        const excessSteps = Math.max(0, steps - Math.ceil(maxSteps * 0.5));
        return excessSteps * this.stepPenalty;
    }

    determineRating(score, steps, targetTime, maxSteps) {
        const elapsedSeconds = this.elapsedSeconds;
        
        let timeRatio = targetTime > 0 ? elapsedSeconds / targetTime : 0.5;
        let stepRatio = maxSteps > 0 ? steps / maxSteps : 0.5;
        
        const perfectTime = targetTime > 0 ? targetTime * 0.3 : 30;
        const goodTime = targetTime > 0 ? targetTime * 0.6 : 60;
        const okTime = targetTime > 0 ? targetTime * 1.0 : 120;
        
        const perfectSteps = maxSteps > 0 ? maxSteps * 0.5 : 10;
        const goodSteps = maxSteps > 0 ? maxSteps * 0.8 : 15;
        const okSteps = maxSteps > 0 ? maxSteps * 1.2 : 25;
        
        if (score >= 1200 && elapsedSeconds <= perfectTime && steps <= perfectSteps) {
            return RATINGS.S;
        }
        
        if (score >= 1000 && elapsedSeconds <= goodTime && steps <= goodSteps) {
            return RATINGS.A;
        }
        
        if (score >= 800 && elapsedSeconds <= okTime && steps <= okSteps) {
            return RATINGS.B;
        }
        
        if (score >= 500) {
            return RATINGS.C;
        }
        
        return RATINGS.D;
    }

    getRatingColor(rating) {
        const colors = {
            [RATINGS.S]: '#FFD700',
            [RATINGS.A]: '#00FF00',
            [RATINGS.B]: '#00BFFF',
            [RATINGS.C]: '#FFA500',
            [RATINGS.D]: '#FF6347'
        };
        return colors[rating] || '#FFFFFF';
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    generateResult(completed, steps, targetTime, maxSteps, options = {}) {
        const timeSeconds = this.elapsedSeconds;
        
        if (!completed) {
            return {
                completed: false,
                score: 0,
                timeSeconds: timeSeconds,
                steps: steps,
                rating: null
            };
        }
        
        const score = this.calculateScore(steps, targetTime, maxSteps, options);
        const rating = this.determineRating(score, steps, targetTime, maxSteps);
        
        return {
            completed: true,
            score: score,
            timeSeconds: timeSeconds,
            formattedTime: this.formatTime(timeSeconds),
            steps: steps,
            rating: rating,
            ratingColor: this.getRatingColor(rating)
        };
    }

    restoreState(elapsedSeconds, totalPausedSeconds = 0) {
        this.elapsedSeconds = elapsedSeconds;
        this.totalPausedSeconds = totalPausedSeconds;
        this.startTime = Date.now() - (elapsedSeconds + totalPausedSeconds) * 1000;
    }
}