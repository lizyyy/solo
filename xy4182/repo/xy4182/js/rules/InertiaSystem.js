/**
 * 惯性系统
 * 管理船舶的惯性影响，使船舶不能立即停下
 */

class InertiaSystem {
    constructor(gameEngine) {
        this.engine = gameEngine;
    }

    applyInertia() {
        const ships = this.engine.ships;
        
        for (const ship of ships) {
            if (!ship.isActive()) continue;
            
            ship.applyInertia();
        }
    }

    getInertiaInfo(ship) {
        return {
            currentInertia: { dx: ship.inertia.dx, dy: ship.inertia.dy },
            decayRate: ship.inertia.decay,
            nextInertia: {
                dx: ship.inertia.dx * ship.inertia.decay,
                dy: ship.inertia.dy * ship.inertia.decay
            }
        };
    }

    hasInertia(ship) {
        return Math.abs(ship.inertia.dx) > 0.1 || Math.abs(ship.inertia.dy) > 0.1;
    }

    getInertiaDirection(ship) {
        if (!this.hasInertia(ship)) return '无惯性';
        
        const dx = ship.inertia.dx;
        const dy = ship.inertia.dy;
        
        return DirectionNames[`${Math.sign(dx)},${Math.sign(dy)}`] || '未知方向';
    }

    predictNextPositionWithInertia(ship) {
        return {
            x: ship.x + ship.inertia.dx,
            y: ship.y + ship.inertia.dy
        };
    }

    calculateEffectiveMove(ship, plannedDx, plannedDy) {
        const inertia = ship.inertia;
        const current = this.engine.board.getCurrentEffect(ship.x, ship.y);
        
        const effectiveDx = plannedDx + inertia.dx + current.dx;
        const effectiveDy = plannedDy + inertia.dy + current.dy;
        
        return {
            dx: effectiveDx,
            dy: effectiveDy,
            breakdown: {
                planned: { dx: plannedDx, dy: plannedDy },
                inertia: { dx: inertia.dx, dy: inertia.dy },
                current: { dx: current.dx, dy: current.dy }
            }
        };
    }

    getMinStoppingDistance(ship) {
        const inertia = ship.inertia;
        if (inertia.dx === 0 && inertia.dy === 0) return 0;
        
        let totalDistance = 0;
        let currentDx = Math.abs(inertia.dx);
        let currentDy = Math.abs(inertia.dy);
        const decay = inertia.decay;
        
        while (currentDx > 0.1 || currentDy > 0.1) {
            totalDistance += Math.max(currentDx, currentDy);
            currentDx *= decay;
            currentDy *= decay;
        }
        
        return Math.ceil(totalDistance);
    }

    willStopIn(ship) {
        const inertia = ship.inertia;
        if (inertia.dx === 0 && inertia.dy === 0) return 0;
        
        let turns = 0;
        let currentDx = Math.abs(inertia.dx);
        let currentDy = Math.abs(inertia.dy);
        const decay = inertia.decay;
        
        while (currentDx > 0.1 || currentDy > 0.1) {
            turns++;
            currentDx *= decay;
            currentDy *= decay;
        }
        
        return turns;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { InertiaSystem };
}
