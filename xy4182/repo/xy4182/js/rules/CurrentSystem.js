/**
 * 潮流系统
 * 管理潮流对船舶的影响，自动叠加位移
 */

class CurrentSystem {
    constructor(gameEngine) {
        this.engine = gameEngine;
    }

    applyCurrents() {
        const ships = this.engine.ships;
        
        for (const ship of ships) {
            if (!ship.isActive()) continue;
            
            const currentEffect = this.engine.board.getCurrentEffect(ship.x, ship.y);
            
            if (currentEffect.dx !== 0 || currentEffect.dy !== 0) {
                ship.prevX = ship.x;
                ship.prevY = ship.y;
                
                ship.x += currentEffect.dx;
                ship.y += currentEffect.dy;
                
                if (currentEffect.dx !== 0 || currentEffect.dy !== 0) {
                    ship.heading = Math.atan2(currentEffect.dy, currentEffect.dx);
                }
            }
        }
    }

    getCurrentInfoAt(x, y) {
        const current = this.engine.board.getCurrentAt(x, y);
        if (!current) return null;
        
        return {
            name: current.name,
            direction: this.getDirectionName(current.dx, current.dy),
            speed: current.speed,
            effect: { dx: current.dx * current.speed, dy: current.dy * current.speed }
        };
    }

    getDirectionName(dx, dy) {
        if (dx === 0 && dy === 0) return '静止';
        if (dx === 0 && dy < 0) return '北流';
        if (dx === 0 && dy > 0) return '南流';
        if (dx < 0 && dy === 0) return '西流';
        if (dx > 0 && dy === 0) return '东流';
        if (dx < 0 && dy < 0) return '西北流';
        if (dx > 0 && dy < 0) return '东北流';
        if (dx < 0 && dy > 0) return '西南流';
        if (dx > 0 && dy > 0) return '东南流';
        return '未知流向';
    }

    isInCurrent(x, y) {
        return this.engine.board.getCurrentAt(x, y) !== null;
    }

    getShipCurrentEffect(ship) {
        return this.engine.board.getCurrentEffect(ship.x, ship.y);
    }

    predictNextPositionWithCurrent(ship) {
        const effect = this.getShipCurrentEffect(ship);
        return {
            x: ship.x + effect.dx,
            y: ship.y + effect.dy
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CurrentSystem };
}
