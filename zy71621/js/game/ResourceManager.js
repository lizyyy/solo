export class ResourceManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.resourceCosts = {
            move: { energy: 2, timeUnits: 1 },
            soundPulse: { soundPulses: 1, energy: 5, timeUnits: 2 },
            rescue: { energy: 10, timeUnits: 5 }
        };
        this.resourceGains = {
            rescue: { score: 500, efficiency: 100 },
            echoQuality: { accuracy: 10 },
            efficientMove: { efficiency: 5 }
        };
    }

    canAfford(actionType) {
        const costs = this.resourceCosts[actionType];
        if (!costs) return false;
        
        for (const [resource, amount] of Object.entries(costs)) {
            if ((this.gameState.resources[resource] || 0) < amount) {
                return false;
            }
        }
        return true;
    }

    consume(actionType) {
        const costs = this.resourceCosts[actionType];
        if (!costs) return false;
        if (!this.canAfford(actionType)) return false;
        
        for (const [resource, amount] of Object.entries(costs)) {
            this.gameState.consumeResource(resource, amount);
        }
        return true;
    }

    gain(gainType, multiplier = 1) {
        const gains = this.resourceGains[gainType];
        if (!gains) return false;
        
        for (const [type, amount] of Object.entries(gains)) {
            if (type === 'score' || type === 'efficiency' || type === 'accuracy' || type === 'rescue') {
                this.gameState.addScore(type, amount * multiplier);
            } else {
                this.gameState.addResource(type, amount * multiplier);
            }
        }
        return true;
    }

    getCost(actionType) {
        return { ...this.resourceCosts[actionType] };
    }

    setCost(actionType, costs) {
        this.resourceCosts[actionType] = { ...costs };
    }

    checkResourceWarnings() {
        const warnings = [];
        
        if (this.gameState.resources.soundPulses <= 2) {
            warnings.push({
                type: 'critical',
                message: '声波脉冲不足！剩余 ' + this.gameState.resources.soundPulses + ' 次'
            });
        }
        
        if (this.gameState.resources.energy <= 20) {
            warnings.push({
                type: 'warning',
                message: '能量不足！剩余 ' + this.gameState.resources.energy + '%'
            });
        }
        
        if (this.gameState.resources.timeUnits <= 10) {
            warnings.push({
                type: 'critical',
                message: '时间紧迫！剩余 ' + this.gameState.resources.timeUnits + ' 单位'
            });
        }
        
        return warnings;
    }

    calculateMoveEfficiency(fromX, fromY, toX, toY, targetX, targetY) {
        const actualDistance = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
        const directToTarget = Math.sqrt(Math.pow(targetX - fromX, 2) + Math.pow(targetY - fromY, 2));
        const newToTarget = Math.sqrt(Math.pow(targetX - toX, 2) + Math.pow(targetY - toY, 2));
        
        if (newToTarget < directToTarget) {
            const improvement = directToTarget - newToTarget;
            return Math.min(100, Math.round(improvement * 2));
        }
        return 0;
    }

    calculateEchoAccuracy(echoes, expectedEchoCount) {
        if (expectedEchoCount === 0) return 0;
        const accuracy = (echoes.length / expectedEchoCount) * 100;
        return Math.min(100, Math.round(accuracy));
    }

    calculateRescueBonus(timeRemaining, healthRemaining) {
        const timeBonus = Math.round(timeRemaining * 2);
        const healthBonus = Math.round(healthRemaining * 3);
        return timeBonus + healthBonus;
    }

    getResourceStatus() {
        return {
            soundPulses: {
                current: this.gameState.resources.soundPulses,
                max: this.gameState.resources.soundPulsesMax,
                percent: this.gameState.getResourcePercent('soundPulses')
            },
            energy: {
                current: this.gameState.resources.energy,
                max: this.gameState.resources.energyMax,
                percent: this.gameState.getResourcePercent('energy')
            },
            timeUnits: {
                current: this.gameState.resources.timeUnits,
                max: this.gameState.resources.timeUnitsMax,
                percent: this.gameState.getResourcePercent('timeUnits')
            }
        };
    }

    toJSON() {
        return {
            resourceCosts: { ...this.resourceCosts },
            resourceGains: { ...this.resourceGains }
        };
    }
}
