export class GameState {
    constructor(data = {}) {
        this.turn = data.turn ?? 1;
        this.resources = {
            soundPulses: data.resources?.soundPulses ?? 10,
            soundPulsesMax: data.resources?.soundPulsesMax ?? 10,
            energy: data.resources?.energy ?? 100,
            energyMax: data.resources?.energyMax ?? 100,
            timeUnits: data.resources?.timeUnits ?? 60,
            timeUnitsMax: data.resources?.timeUnitsMax ?? 60
        };
        this.score = {
            base: data.score?.base ?? 0,
            efficiency: data.score?.efficiency ?? 0,
            accuracy: data.score?.accuracy ?? 0,
            rescue: data.score?.rescue ?? 0,
            total: data.score?.total ?? 0
        };
        this.risk = {
            level: data.risk?.level ?? 'low',
            factors: data.risk?.factors ?? []
        };
        this.gameOver = data.gameOver ?? false;
        this.victory = data.victory ?? false;
        this.failReason = data.failReason || '';
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = data.updatedAt || Date.now();
    }

    updateScore() {
        this.score.total = this.score.base + this.score.efficiency + this.score.accuracy + this.score.rescue;
        this.updatedAt = Date.now();
        return this.score.total;
    }

    updateRisk() {
        const factors = [];
        
        if (this.resources.soundPulses <= 2) {
            factors.push('声波脉冲不足');
        }
        if (this.resources.energy <= 20) {
            factors.push('能量不足');
        }
        if (this.resources.timeUnits <= 10) {
            factors.push('时间紧迫');
        }
        
        this.risk.factors = factors;
        
        if (factors.length >= 2) {
            this.risk.level = 'high';
        } else if (factors.length === 1) {
            this.risk.level = 'medium';
        } else {
            this.risk.level = 'low';
        }
        
        this.updatedAt = Date.now();
        return this.risk;
    }

    consumeResource(type, amount) {
        if (this.resources[type] === undefined) return false;
        if (this.resources[type] < amount) return false;
        
        this.resources[type] -= amount;
        this.updatedAt = Date.now();
        this.updateRisk();
        return true;
    }

    addResource(type, amount) {
        if (this.resources[type] === undefined) return false;
        const maxKey = `${type}Max`;
        const max = this.resources[maxKey] || Infinity;
        this.resources[type] = Math.min(max, this.resources[type] + amount);
        this.updatedAt = Date.now();
        this.updateRisk();
        return true;
    }

    addScore(type, amount) {
        if (this.score[type] === undefined) return false;
        this.score[type] += amount;
        this.updateScore();
        return true;
    }

    nextTurn() {
        this.turn++;
        this.updatedAt = Date.now();
        return this.turn;
    }

    setGameOver(reason = '', victory = false) {
        this.gameOver = true;
        this.victory = victory;
        this.failReason = reason;
        this.updatedAt = Date.now();
    }

    isGameOver() {
        return this.gameOver;
    }

    isVictory() {
        return this.victory;
    }

    getResourcePercent(type) {
        const maxKey = `${type}Max`;
        const current = this.resources[type] || 0;
        const max = this.resources[maxKey] || 1;
        return (current / max) * 100;
    }

    toJSON() {
        return {
            turn: this.turn,
            resources: { ...this.resources },
            score: { ...this.score },
            risk: { ...this.risk },
            gameOver: this.gameOver,
            victory: this.victory,
            failReason: this.failReason,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    clone() {
        return new GameState(this.toJSON());
    }

    equals(other) {
        if (!(other instanceof GameState)) return false;
        return this.turn === other.turn &&
               this.score.total === other.score.total &&
               this.gameOver === other.gameOver;
    }
}
