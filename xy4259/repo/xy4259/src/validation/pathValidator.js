// 路径校验模块 - 实时碰撞/越界判定

import { Point, ElementType } from '../models/level.js';
import { PhysicsEngine } from '../physics/physics.js';

export const ValidationErrorType = {
    NO_FLY_ZONE_VIOLATION: 'no_fly_zone_violation',
    MOUNTAIN_COLLISION: 'mountain_collision',
    OUT_OF_BOUNDS: 'out_of_bounds',
    INSUFFICIENT_BATTERY: 'insufficient_battery',
    NO_RETURN_PATH: 'no_return_path',
    INVALID_PATH: 'invalid_path'
};

export class PathValidator {
    constructor(level, physicsEngine = null) {
        this.level = level;
        this.physicsEngine = physicsEngine || new PhysicsEngine(level.settings);
        this.mapBounds = level.settings.mapSize || { width: 1000, height: 800 };
    }
    
    validatePath(path, checkBattery = true) {
        const errors = [];
        const warnings = [];
        
        if (!path || path.length < 2) {
            errors.push({
                type: ValidationErrorType.INVALID_PATH,
                message: '路径至少需要两个点',
                details: { pathLength: path ? path.length : 0 }
            });
            return { valid: false, errors, warnings };
        }
        
        for (let i = 0; i < path.length - 1; i++) {
            const start = path[i];
            const end = path[i + 1];
            const segmentErrors = this.validateSegment(start, end, i);
            errors.push(...segmentErrors);
        }
        
        for (const point of path) {
            if (!this.isPointInBounds(point)) {
                errors.push({
                    type: ValidationErrorType.OUT_OF_BOUNDS,
                    message: '路径点超出地图边界',
                    details: { 
                        point: { x: point.x, y: point.y },
                        bounds: this.mapBounds
                    }
                });
            }
        }
        
        if (checkBattery && this.physicsEngine) {
            const batteryCheck = this.checkBattery(path);
            if (!batteryCheck.safe) {
                errors.push({
                    type: ValidationErrorType.INSUFFICIENT_BATTERY,
                    message: '电量不足以完成飞行',
                    details: batteryCheck
                });
            } else if (batteryCheck.margin < this.level.settings.initialBattery * 0.1) {
                warnings.push({
                    type: 'LOW_BATTERY_MARGIN',
                    message: '返航电量余量较低',
                    details: batteryCheck
                });
            }
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    
    validateSegment(start, end, segmentIndex = 0) {
        const errors = [];
        
        for (const zone of this.level.noFlyZones) {
            if (this.physicsEngine.isLineInPolygon(start, end, zone.position)) {
                errors.push({
                    type: ValidationErrorType.NO_FLY_ZONE_VIOLATION,
                    message: `路径段 ${segmentIndex + 1} 穿越禁飞区`,
                    details: {
                        segmentIndex,
                        start: { x: start.x, y: start.y },
                        end: { x: end.x, y: end.y },
                        zoneId: zone.id
                    }
                });
            }
        }
        
        for (const mountain of this.level.mountains) {
            if (this.physicsEngine.isLineInPolygon(start, end, mountain.position)) {
                errors.push({
                    type: ValidationErrorType.MOUNTAIN_COLLISION,
                    message: `路径段 ${segmentIndex + 1} 与山脊碰撞`,
                    details: {
                        segmentIndex,
                        start: { x: start.x, y: start.y },
                        end: { x: end.x, y: end.y },
                        mountainId: mountain.id
                    }
                });
            }
        }
        
        return errors;
    }
    
    isPointInBounds(point) {
        return point.x >= 0 && 
               point.x <= this.mapBounds.width &&
               point.y >= 0 && 
               point.y <= this.mapBounds.height;
    }
    
    checkBattery(path) {
        if (!this.physicsEngine) return { safe: true, margin: Infinity };
        
        const flightEnergy = this.physicsEngine.calculatePathEnergy(
            path, 
            this.level.windZones
        );
        
        let returnEnergy = 0;
        if (path.length > 0 && this.level.startPoint) {
            const lastPoint = path[path.length - 1];
            const startPoint = this.level.startPoint.position;
            returnEnergy = this.physicsEngine.estimateReturnEnergy(
                lastPoint, 
                startPoint, 
                this.level.windZones
            );
        }
        
        const totalEstimated = flightEnergy + returnEnergy;
        const availableBattery = this.level.settings.initialBattery;
        
        return {
            safe: totalEstimated <= availableBattery,
            totalEstimated,
            availableBattery,
            margin: availableBattery - totalEstimated,
            flightEnergy,
            returnEnergy
        };
    }
    
    checkRescuePointCoverage(path) {
        const visitedRescuePoints = new Set();
        
        for (const point of path) {
            for (const rescuePoint of this.level.rescuePoints) {
                const dist = point.distanceTo(rescuePoint.position);
                if (dist <= 15) {
                    visitedRescuePoints.add(rescuePoint.id);
                }
            }
        }
        
        return {
            allVisited: visitedRescuePoints.size === this.level.rescuePoints.length,
            visited: Array.from(visitedRescuePoints),
            total: this.level.rescuePoints.length,
            missing: this.level.rescuePoints
                .filter(p => !visitedRescuePoints.has(p.id))
                .map(p => p.id)
        };
    }
    
    checkReturnToStart(path) {
        if (path.length < 2 || !this.level.startPoint) {
            return { returnsToStart: false, distance: Infinity };
        }
        
        const lastPoint = path[path.length - 1];
        const startPoint = this.level.startPoint.position;
        const distance = lastPoint.distanceTo(startPoint);
        
        return {
            returnsToStart: distance <= 20,
            distance
        };
    }
    
    validateCompleteMission(path) {
        const results = {
            valid: true,
            issues: [],
            warnings: []
        };
        
        const pathValidation = this.validatePath(path, false);
        if (!pathValidation.valid) {
            results.valid = false;
            results.issues.push(...pathValidation.errors);
        }
        results.warnings.push(...pathValidation.warnings);
        
        const coverageCheck = this.checkRescuePointCoverage(path);
        if (!coverageCheck.allVisited) {
            results.valid = false;
            results.issues.push({
                type: 'MISSING_RESCUE_POINTS',
                message: `还有 ${coverageCheck.missing.length} 个求救点未覆盖`,
                details: coverageCheck
            });
        }
        
        const returnCheck = this.checkReturnToStart(path);
        if (!returnCheck.returnsToStart) {
            results.valid = false;
            results.issues.push({
                type: ValidationErrorType.NO_RETURN_PATH,
                message: '路径未返回起点',
                details: returnCheck
            });
        }
        
        const batteryCheck = this.checkBattery(path);
        if (!batteryCheck.safe) {
            results.valid = false;
            results.issues.push({
                type: ValidationErrorType.INSUFFICIENT_BATTERY,
                message: '电量不足以完成飞行',
                details: batteryCheck
            });
        }
        
        return results;
    }
    
    getPathStatistics(path) {
        if (!path || path.length < 2) {
            return {
                totalDistance: 0,
                totalEnergy: 0,
                segmentCount: 0,
                windZoneIntersections: [],
                estimatedTime: 0
            };
        }
        
        let totalDistance = 0;
        const segments = [];
        const windZoneIntersections = [];
        
        for (let i = 0; i < path.length - 1; i++) {
            const start = path[i];
            const end = path[i + 1];
            const distance = start.distanceTo(end);
            totalDistance += distance;
            
            for (const windZone of this.level.windZones) {
                if (this.physicsEngine.isLineInPolygon(start, end, windZone.position)) {
                    windZoneIntersections.push({
                        segmentIndex: i,
                        windZoneId: windZone.id,
                        windDirection: windZone.options.direction,
                        windSpeed: windZone.options.speed
                    });
                }
            }
            
            segments.push({
                index: i,
                start: { x: start.x, y: start.y },
                end: { x: end.x, y: end.y },
                distance
            });
        }
        
        const totalEnergy = this.physicsEngine.calculatePathEnergy(
            path, 
            this.level.windZones
        );
        
        const averageSpeed = 50;
        const estimatedTime = totalDistance / averageSpeed;
        
        return {
            totalDistance,
            totalEnergy,
            segmentCount: path.length - 1,
            segments,
            windZoneIntersections,
            estimatedTime
        };
    }
}

export function createValidationSummary(validationResult) {
    if (!validationResult.valid) {
        const errorMessages = validationResult.issues.map(issue => {
            switch (issue.type) {
                case ValidationErrorType.NO_FLY_ZONE_VIOLATION:
                    return `⚠️ 禁飞区违规: ${issue.message}`;
                case ValidationErrorType.MOUNTAIN_COLLISION:
                    return `⚠️ 山脊碰撞: ${issue.message}`;
                case ValidationErrorType.OUT_OF_BOUNDS:
                    return `⚠️ 越界: ${issue.message}`;
                case ValidationErrorType.INSUFFICIENT_BATTERY:
                    return `⚠️ 电量不足: ${issue.message}`;
                case ValidationErrorType.NO_RETURN_PATH:
                    return `⚠️ 未返航: ${issue.message}`;
                case 'MISSING_RESCUE_POINTS':
                    return `⚠️ 求救点遗漏: ${issue.message}`;
                default:
                    return `⚠️ ${issue.message}`;
            }
        });
        
        return {
            status: 'FAILED',
            title: '路径验证失败',
            messages: errorMessages
        };
    }
    
    const warningMessages = validationResult.warnings.map(warning => {
        return `⚠️ ${warning.message}`;
    });
    
    return {
        status: 'PASSED',
        title: '路径验证通过',
        messages: warningMessages.length > 0 
            ? warningMessages 
            : ['✓ 所有检查项通过']
    };
}
