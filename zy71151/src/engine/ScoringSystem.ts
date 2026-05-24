import { Score, Grade, LevelObjective } from '../types';
export class ScoringSystem {
    static DOCK_ON_TIME_BONUS = 100;
    static UNDOCK_ON_TIME_BONUS = 80;
    static SAFETY_BONUS = 100;
    static TIDE_MISS_PENALTY = 150;
    static COLLISION_WARNING_PENALTY = 30;
    static COLLISION_PENALTY = 300;
    static FUEL_DEPLETED_PENALTY = 200;
    static calculateGrade(score: number): Grade {
        if (score >= 500)
            return 'S';
        if (score >= 400)
            return 'A';
        if (score >= 300)
            return 'B';
        if (score >= 200)
            return 'C';
        if (score >= 100)
            return 'D';
        return 'F';
    }
    static calculateInitialScore(): Score {
        return {
            onTimeCompletions: 0,
            fuelEfficiency: 0,
            safetyScore: this.SAFETY_BONUS,
            penalties: 0,
            total: this.SAFETY_BONUS,
            grade: 'F',
        };
    }
    static updateScore(score: Score): Score {
        const total = score.onTimeCompletions + score.fuelEfficiency + score.safetyScore - score.penalties;
        return {
            ...score,
            total: Math.max(0, total),
            grade: this.calculateGrade(Math.max(0, total)),
        };
    }
    static addOnTimeCompletion(score: Score, points: number): Score {
        return this.updateScore({
            ...score,
            onTimeCompletions: score.onTimeCompletions + points,
        });
    }
    static addFuelEfficiency(score: Score, efficiency: number): Score {
        const efficiencyScore = Math.floor(efficiency / 2);
        return this.updateScore({
            ...score,
            fuelEfficiency: efficiencyScore,
        });
    }
    static applyTideMissPenalty(score: Score): Score {
        return this.updateScore({
            ...score,
            penalties: score.penalties + this.TIDE_MISS_PENALTY,
        });
    }
    static applyCollisionWarningPenalty(score: Score): Score {
        return this.updateScore({
            ...score,
            safetyScore: Math.max(0, score.safetyScore - this.COLLISION_WARNING_PENALTY),
            penalties: score.penalties + this.COLLISION_WARNING_PENALTY,
        });
    }
    static applyCollisionPenalty(score: Score): Score {
        return this.updateScore({
            ...score,
            safetyScore: 0,
            penalties: score.penalties + this.COLLISION_PENALTY,
        });
    }
    static applyFuelDepletedPenalty(score: Score): Score {
        return this.updateScore({
            ...score,
            penalties: score.penalties + this.FUEL_DEPLETED_PENALTY,
        });
    }
    static calculateObjectivesScore(objectives: LevelObjective[]): number {
        return objectives
            .filter((o) => o.completed)
            .reduce((sum, o) => sum + o.points, 0);
    }
}

