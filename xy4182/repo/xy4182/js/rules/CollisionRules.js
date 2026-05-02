/**
 * 碰撞规则系统
 * 管理碰撞检测、会遇避让判定（交叉相遇、对遇、追越）
 */

const EncounterType = {
    NONE: 'none',
    HEAD_ON: 'head_on',
    CROSSING: 'crossing',
    OVERTAKING: 'overtaking'
};

const RelativePosition = {
    SAME_DIRECTION: 'same_direction',
    OPPOSITE_DIRECTION: 'opposite_direction',
    RIGHT_CROSS: 'right_cross',
    LEFT_CROSS: 'left_cross',
    STARBOARD: 'starboard',
    PORT: 'port',
    AHEAD: 'ahead',
    ASTERN: 'astern'
};

class CollisionRules {
    constructor(gameEngine) {
        this.engine = gameEngine;
    }

    checkCollisions() {
        const ships = this.engine.getActiveShips();
        
        for (let i = 0; i < ships.length; i++) {
            for (let j = i + 1; j < ships.length; j++) {
                const ship1 = ships[i];
                const ship2 = ships[j];
                
                if (this.checkShipCollision(ship1, ship2)) {
                    this.engine.addIncident({
                        type: IncidentType.COLLISION,
                        turn: this.engine.turn,
                        ships: [ship1.id, ship2.id],
                        description: `${ship1.name} 与 ${ship2.name} 发生碰撞！位置: (${ship1.x}, ${ship1.y}) - (${ship2.x}, ${ship2.y})`
                    });
                }
            }
        }
    }

    checkShipCollision(ship1, ship2) {
        const dx = Math.abs(ship1.x - ship2.x);
        const dy = Math.abs(ship1.y - ship2.y);
        
        return dx < 1 && dy < 1;
    }

    checkGiveWayViolations() {
        const ships = this.engine.getActiveShips();
        
        for (let i = 0; i < ships.length; i++) {
            for (let j = i + 1; j < ships.length; j++) {
                const ship1 = ships[i];
                const ship2 = ships[j];
                
                const encounter = this.analyzeEncounter(ship1, ship2);
                
                if (encounter.type !== EncounterType.NONE) {
                    const risk = this.assessCollisionRisk(ship1, ship2, encounter);
                    
                    if (risk.riskLevel === 'high') {
                        const giveWayShip = this.getGiveWayShip(ship1, ship2, encounter);
                        const standOnShip = this.getStandOnShip(ship1, ship2, encounter);
                        
                        if (giveWayShip && standOnShip) {
                            const violation = this.checkGiveWayAction(giveWayShip, standOnShip, encounter);
                            
                            if (violation) {
                                this.engine.addIncident({
                                    type: IncidentType.GIVE_WAY,
                                    turn: this.engine.turn,
                                    ships: [giveWayShip.id],
                                    encounterType: encounter.type,
                                    description: `${giveWayShip.name} 未按规则给 ${standOnShip.name} 让路！遭遇类型: ${this.getEncounterTypeName(encounter.type)}`,
                                    details: {
                                        giveWayShip: giveWayShip.name,
                                        standOnShip: standOnShip.name,
                                        encounterType: encounter.type,
                                        relativePosition: encounter.relativePosition,
                                        riskDetails: risk
                                    }
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    analyzeEncounter(ship1, ship2) {
        const dx = ship2.x - ship1.x;
        const dy = ship2.y - ship1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 5) {
            return { type: EncounterType.NONE };
        }
        
        const dir1 = { dx: ship1.dx, dy: ship1.dy };
        const dir2 = { dx: ship2.dx, dy: ship2.dy };
        
        const isMoving1 = dir1.dx !== 0 || dir1.dy !== 0;
        const isMoving2 = dir2.dx !== 0 || dir2.dy !== 0;
        
        if (!isMoving1 || !isMoving2) {
            return { type: EncounterType.NONE };
        }
        
        const dotProduct = dir1.dx * dir2.dx + dir1.dy * dir2.dy;
        const mag1 = Math.sqrt(dir1.dx * dir1.dx + dir1.dy * dir1.dy);
        const mag2 = Math.sqrt(dir2.dx * dir2.dx + dir2.dy * dir2.dy);
        
        const cosAngle = dotProduct / (mag1 * mag2);
        const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
        
        const relativePos = this.getRelativePosition(ship1, ship2, dir1, dir2, angle);
        
        if (this.isHeadOn(angle, dx, dy, dir1, dir2)) {
            return {
                type: EncounterType.HEAD_ON,
                relativePosition: relativePos,
                distance: distance,
                angle: angle
            };
        }
        
        if (this.isOvertaking(angle, dx, dy, dir1, dir2, ship1, ship2)) {
            return {
                type: EncounterType.OVERTAKING,
                relativePosition: relativePos,
                distance: distance,
                angle: angle,
                overtakingShip: this.getOvertakingShip(ship1, ship2, dir1, dir2)
            };
        }
        
        return {
            type: EncounterType.CROSSING,
            relativePosition: relativePos,
            distance: distance,
            angle: angle
        };
    }

    isHeadOn(angle, dx, dy, dir1, dir2) {
        const angleDeg = angle * 180 / Math.PI;
        return angleDeg > 157.5 && angleDeg < 202.5;
    }

    isOvertaking(angle, dx, dy, dir1, dir2, ship1, ship2) {
        const angleDeg = angle * 180 / Math.PI;
        
        const isSameDirection = angleDeg < 22.5 || angleDeg > 337.5;
        if (!isSameDirection) return false;
        
        const aheadOf1 = this.isAheadOf(ship1, ship2, dir1);
        const aheadOf2 = this.isAheadOf(ship2, ship1, dir2);
        
        return aheadOf1 || aheadOf2;
    }

    isAheadOf(shipA, shipB, dirA) {
        const dx = shipB.x - shipA.x;
        const dy = shipB.y - shipA.y;
        
        if (dirA.dx === 0 && dirA.dy === 0) return false;
        
        const dotProduct = dx * dirA.dx + dy * dirA.dy;
        return dotProduct > 0;
    }

    getOvertakingShip(ship1, ship2, dir1, dir2) {
        const aheadOf1 = this.isAheadOf(ship1, ship2, dir1);
        const aheadOf2 = this.isAheadOf(ship2, ship1, dir2);
        
        if (aheadOf1) return ship1;
        if (aheadOf2) return ship2;
        return ship1;
    }

    getRelativePosition(ship1, ship2, dir1, dir2, angle) {
        const dx = ship2.x - ship1.x;
        const dy = ship2.y - ship1.y;
        
        if (dir1.dx === 0 && dir1.dy === 0) {
            if (dx > 0) return RelativePosition.RIGHT_CROSS;
            if (dx < 0) return RelativePosition.LEFT_CROSS;
            if (dy < 0) return RelativePosition.AHEAD;
            if (dy > 0) return RelativePosition.ASTERN;
            return RelativePosition.SAME_DIRECTION;
        }
        
        const rightSide = this.isOnRightSide(dir1, dx, dy);
        const leftSide = this.isOnLeftSide(dir1, dx, dy);
        const ahead = this.isAheadOf(ship1, ship2, dir1);
        const astern = this.isAheadOf(ship2, ship1, dir2);
        
        if (ahead) {
            if (rightSide) return RelativePosition.STARBOARD;
            if (leftSide) return RelativePosition.PORT;
            return RelativePosition.AHEAD;
        }
        
        if (astern) {
            return RelativePosition.ASTERN;
        }
        
        const angleDeg = angle * 180 / Math.PI;
        if (angleDeg > 157.5 && angleDeg < 202.5) {
            return RelativePosition.OPPOSITE_DIRECTION;
        }
        
        if (rightSide) return RelativePosition.RIGHT_CROSS;
        if (leftSide) return RelativePosition.LEFT_CROSS;
        
        return RelativePosition.SAME_DIRECTION;
    }

    isOnRightSide(dir, dx, dy) {
        if (dir.dx === 0 && dir.dy === 0) return dx > 0;
        
        const rightNormal = { dx: dir.dy, dy: -dir.dx };
        const dotProduct = dx * rightNormal.dx + dy * rightNormal.dy;
        return dotProduct > 0;
    }

    isOnLeftSide(dir, dx, dy) {
        if (dir.dx === 0 && dir.dy === 0) return dx < 0;
        
        const leftNormal = { dx: -dir.dy, dy: dir.dx };
        const dotProduct = dx * leftNormal.dx + dy * leftNormal.dy;
        return dotProduct > 0;
    }

    assessCollisionRisk(ship1, ship2, encounter) {
        const dx = ship2.x - ship1.x;
        const dy = ship2.y - ship1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const v1 = Math.sqrt(ship1.dx * ship1.dx + ship1.dy * ship1.dy);
        const v2 = Math.sqrt(ship2.dx * ship2.dx + ship2.dy * ship2.dy);
        
        const relVx = ship2.dx - ship1.dx;
        const relVy = ship2.dy - ship1.dy;
        
        const approaching = (dx * relVx + dy * relVy) < 0;
        
        if (distance < 2) {
            return {
                riskLevel: 'high',
                distance: distance,
                approaching: approaching,
                details: '距离过近，存在碰撞风险'
            };
        }
        
        if (distance < 4 && approaching) {
            return {
                riskLevel: 'medium',
                distance: distance,
                approaching: approaching,
                details: '正在接近，需注意避让'
            };
        }
        
        return {
            riskLevel: 'low',
            distance: distance,
            approaching: approaching
        };
    }

    getGiveWayShip(ship1, ship2, encounter) {
        switch (encounter.type) {
            case EncounterType.HEAD_ON:
                return null;
            
            case EncounterType.CROSSING:
                if (encounter.relativePosition === RelativePosition.RIGHT_CROSS) {
                    return ship1;
                }
                if (encounter.relativePosition === RelativePosition.LEFT_CROSS) {
                    return ship2;
                }
                return null;
            
            case EncounterType.OVERTAKING:
                return encounter.overtakingShip;
            
            default:
                return null;
        }
    }

    getStandOnShip(ship1, ship2, encounter) {
        switch (encounter.type) {
            case EncounterType.HEAD_ON:
                return null;
            
            case EncounterType.CROSSING:
                if (encounter.relativePosition === RelativePosition.RIGHT_CROSS) {
                    return ship2;
                }
                if (encounter.relativePosition === RelativePosition.LEFT_CROSS) {
                    return ship1;
                }
                return null;
            
            case EncounterType.OVERTAKING:
                return encounter.overtakingShip === ship1 ? ship2 : ship1;
            
            default:
                return null;
        }
    }

    checkGiveWayAction(giveWayShip, standOnShip, encounter) {
        const move = this.engine.getPendingMove(giveWayShip.id);
        
        if (!move) return false;
        
        const originalPos = { x: giveWayShip.x, y: giveWayShip.y };
        const nextPos = { x: originalPos.x + move.dx, y: originalPos.y + move.dy };
        
        const originalDistance = this.getDistance(originalPos, standOnShip);
        const nextDistance = this.getDistance(nextPos, standOnShip);
        
        if (nextDistance <= originalDistance && nextDistance < 3) {
            return true;
        }
        
        const isAwayAction = this.isTakingAvoidingAction(giveWayShip, standOnShip, move, encounter);
        if (!isAwayAction) {
            return true;
        }
        
        return false;
    }

    getDistance(pos1, pos2) {
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    isTakingAvoidingAction(giveWayShip, standOnShip, move, encounter) {
        if (move.dx === 0 && move.dy === 0) return false;
        
        const dx = standOnShip.x - giveWayShip.x;
        const dy = standOnShip.y - giveWayShip.y;
        
        const dotProduct = dx * move.dx + dy * move.dy;
        return dotProduct < 0;
    }

    getEncounterTypeName(type) {
        switch (type) {
            case EncounterType.HEAD_ON: return '对遇';
            case EncounterType.CROSSING: return '交叉相遇';
            case EncounterType.OVERTAKING: return '追越';
            default: return '无';
        }
    }

    getRuleDescription(encounterType) {
        switch (encounterType) {
            case EncounterType.HEAD_ON:
                return '对遇规则：两船对遇时，应各自向右转向，从他船左舷驶过。';
            
            case EncounterType.CROSSING:
                return '交叉相遇规则：有他船在本船右舷的船舶应给他船让路，如当时环境许可，还应避免横越他船的前方。';
            
            case EncounterType.OVERTAKING:
                return '追越规则：任何船舶，在追越任何他船时，均应给被追越船让路。';
            
            default:
                return '';
        }
    }

    getRelativeToShip(observerShip, targetShip) {
        const dx = targetShip.x - observerShip.x;
        const dy = targetShip.y - observerShip.y;
        
        const bearing = this.calculateBearing(observerShip.dx, observerShip.dy, dx, dy);
        
        let sector;
        if (bearing >= 355 || bearing <= 5) {
            sector = '正前方';
        } else if (bearing > 5 && bearing < 67.5) {
            sector = '右前方';
        } else if (bearing >= 67.5 && bearing <= 112.5) {
            sector = '正右方';
        } else if (bearing > 112.5 && bearing < 180) {
            sector = '右后方';
        } else if (bearing > 180 && bearing < 247.5) {
            sector = '左后方';
        } else if (bearing >= 247.5 && bearing <= 292.5) {
            sector = '正左方';
        } else if (bearing > 292.5 && bearing < 355) {
            sector = '左前方';
        } else {
            sector = '未知方位';
        }
        
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        return {
            dx: dx,
            dy: dy,
            distance: distance,
            bearing: bearing,
            sector: sector
        };
    }

    calculateBearing(shipDx, shipDy, targetDx, targetDy) {
        if (shipDx === 0 && shipDy === 0) {
            const angle = Math.atan2(targetDy, targetDx) * 180 / Math.PI;
            return (angle + 360) % 360;
        }
        
        const shipAngle = Math.atan2(shipDy, shipDx);
        const targetAngle = Math.atan2(targetDy, targetDx);
        
        let relativeAngle = (targetAngle - shipAngle) * 180 / Math.PI;
        return (relativeAngle + 360) % 360;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        CollisionRules, 
        EncounterType, 
        RelativePosition 
    };
}
