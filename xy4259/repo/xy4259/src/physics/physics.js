// 物理/规则模块 - 计算飞行能耗、风向影响等

import { Point, ElementType } from '../models/level.js';

export class PhysicsEngine {
    constructor(settings = {}) {
        this.settings = {
            baseEnergyConsumption: settings.baseEnergyConsumption || 0.1,
            windInfluenceFactor: settings.windInfluenceFactor || 1.0,
            mountainEnergyMultiplier: settings.mountainEnergyMultiplier || 2.0
        };
    }
    
    calculateSegmentEnergy(start, end, windZones = []) {
        const distance = start.distanceTo(end);
        let energy = distance * this.settings.baseEnergyConsumption;
        
        const pathDirection = this.calculateDirection(start, end);
        const windEffect = this.calculateWindEffect(start, end, windZones, pathDirection);
        
        energy += windEffect * distance * this.settings.baseEnergyConsumption;
        
        return Math.max(0, energy);
    }
    
    calculateDirection(from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        return Math.atan2(dy, dx) * 180 / Math.PI;
    }
    
    calculateWindEffect(start, end, windZones, pathDirection) {
        let totalEffect = 0;
        const affectedSegments = this.getSegmentsInWindZones(start, end, windZones);
        
        for (const { segment, windZone } of affectedSegments) {
            const segmentLength = segment.start.distanceTo(segment.end);
            const totalLength = start.distanceTo(end);
            const weight = segmentLength / totalLength;
            
            const windDirection = windZone.options.direction || 0;
            const windSpeed = windZone.options.speed || 1.0;
            
            const angleDiff = Math.abs(pathDirection - windDirection);
            const normalizedDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff;
            
            let windEffect;
            if (normalizedDiff <= 90) {
                windEffect = -(1 - normalizedDiff / 90) * windSpeed;
            } else {
                windEffect = ((normalizedDiff - 90) / 90) * windSpeed;
            }
            
            totalEffect += windEffect * weight * this.settings.windInfluenceFactor;
        }
        
        return totalEffect;
    }
    
    getSegmentsInWindZones(start, end, windZones) {
        const segments = [];
        
        for (const windZone of windZones) {
            if (this.isLineInPolygon(start, end, windZone.position)) {
                const intersectionPoints = this.getLinePolygonIntersections(start, end, windZone.position);
                
                if (intersectionPoints.length === 0) {
                    if (this.isPointInPolygon(start, windZone.position)) {
                        segments.push({
                            segment: { start, end },
                            windZone
                        });
                    }
                } else {
                    const allPoints = [start, ...intersectionPoints, end];
                    allPoints.sort((a, b) => {
                        const distA = start.distanceTo(a);
                        const distB = start.distanceTo(b);
                        return distA - distB;
                    });
                    
                    for (let i = 0; i < allPoints.length - 1; i++) {
                        const midPoint = new Point(
                            (allPoints[i].x + allPoints[i + 1].x) / 2,
                            (allPoints[i].y + allPoints[i + 1].y) / 2
                        );
                        
                        if (this.isPointInPolygon(midPoint, windZone.position)) {
                            segments.push({
                                segment: { start: allPoints[i], end: allPoints[i + 1] },
                                windZone
                            });
                        }
                    }
                }
            }
        }
        
        return segments;
    }
    
    isPointInPolygon(point, polygonPoints) {
        let inside = false;
        const n = polygonPoints.length;
        
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = polygonPoints[i].x, yi = polygonPoints[i].y;
            const xj = polygonPoints[j].x, yj = polygonPoints[j].y;
            
            const intersect = ((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            
            if (intersect) inside = !inside;
        }
        
        return inside;
    }
    
    isLineInPolygon(start, end, polygonPoints) {
        if (this.isPointInPolygon(start, polygonPoints) || 
            this.isPointInPolygon(end, polygonPoints)) {
            return true;
        }
        
        const intersections = this.getLinePolygonIntersections(start, end, polygonPoints);
        return intersections.length > 0;
    }
    
    getLinePolygonIntersections(start, end, polygonPoints) {
        const intersections = [];
        const n = polygonPoints.length;
        
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const p1 = polygonPoints[i];
            const p2 = polygonPoints[j];
            
            const intersection = this.lineIntersection(start, end, p1, p2);
            if (intersection) {
                intersections.push(intersection);
            }
        }
        
        return intersections;
    }
    
    lineIntersection(p1, p2, p3, p4) {
        const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
        
        if (Math.abs(denom) < 0.0001) {
            return null;
        }
        
        const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
        const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;
        
        if (ua >= 0.0001 && ua <= 0.9999 && ub >= 0.0001 && ub <= 0.9999) {
            return new Point(
                p1.x + ua * (p2.x - p1.x),
                p1.y + ua * (p2.y - p1.y)
            );
        }
        
        return null;
    }
    
    calculatePathEnergy(path, windZones = []) {
        if (path.length < 2) return 0;
        
        let totalEnergy = 0;
        
        for (let i = 0; i < path.length - 1; i++) {
            totalEnergy += this.calculateSegmentEnergy(
                path[i], 
                path[i + 1], 
                windZones
            );
        }
        
        return totalEnergy;
    }
    
    calculateDetailedPathEnergy(path, windZones = []) {
        if (path.length < 2) return { total: 0, segments: [] };
        
        const segments = [];
        let totalEnergy = 0;
        
        for (let i = 0; i < path.length - 1; i++) {
            const start = path[i];
            const end = path[i + 1];
            const energy = this.calculateSegmentEnergy(start, end, windZones);
            
            segments.push({
                index: i,
                start: { x: start.x, y: start.y },
                end: { x: end.x, y: end.y },
                distance: start.distanceTo(end),
                energy
            });
            
            totalEnergy += energy;
        }
        
        return {
            total: totalEnergy,
            segments
        };
    }
    
    estimateReturnEnergy(currentPosition, returnPosition, windZones = []) {
        return this.calculateSegmentEnergy(currentPosition, returnPosition, windZones);
    }
    
    checkBatterySafety(currentEnergy, estimatedEnergy, returnEnergy, safetyMargin = 0.1) {
        const totalEstimated = estimatedEnergy + returnEnergy;
        const safetyThreshold = currentEnergy * (1 - safetyMargin);
        
        return {
            safe: totalEstimated <= safetyThreshold,
            totalEstimated,
            safetyThreshold,
            margin: safetyThreshold - totalEstimated
        };
    }
}

export class ScoreCalculator {
    calculateScore(gameResult, level) {
        let score = 0;
        
        if (!gameResult.success) {
            return {
                score: 0,
                breakdown: {
                    success: 0,
                    rescuePoints: 0,
                    batteryBonus: 0,
                    efficiencyBonus: 0,
                    penalties: 0
                },
                grade: 'F'
            };
        }
        
        score += 500;
        
        const rescuePointsBonus = gameResult.rescuePointsVisited * 100;
        score += rescuePointsBonus;
        
        const batteryPercentage = gameResult.remainingBattery / level.settings.initialBattery;
        const batteryBonus = Math.floor(batteryPercentage * 200);
        score += batteryBonus;
        
        const optimalDistance = this.estimateOptimalDistance(level);
        const efficiencyRatio = optimalDistance / gameResult.totalDistance;
        const efficiencyBonus = Math.floor(Math.max(0, efficiencyRatio - 0.5) * 200);
        score += efficiencyBonus;
        
        let penalties = 0;
        if (gameResult.nearMisses) {
            penalties = gameResult.nearMisses * 20;
            score = Math.max(0, score - penalties);
        }
        
        const grade = this.calculateGrade(score);
        
        return {
            score,
            breakdown: {
                success: 500,
                rescuePoints: rescuePointsBonus,
                batteryBonus,
                efficiencyBonus,
                penalties: -penalties
            },
            grade
        };
    }
    
    estimateOptimalDistance(level) {
        if (!level.startPoint || level.rescuePoints.length === 0) return 0;
        
        const startPoint = level.startPoint.position;
        const rescuePoints = level.rescuePoints.map(p => p.position);
        
        let totalDistance = 0;
        let currentPoint = startPoint;
        const visited = new Set();
        
        while (visited.size < rescuePoints.length) {
            let nearestIndex = -1;
            let nearestDistance = Infinity;
            
            for (let i = 0; i < rescuePoints.length; i++) {
                if (!visited.has(i)) {
                    const dist = currentPoint.distanceTo(rescuePoints[i]);
                    if (dist < nearestDistance) {
                        nearestDistance = dist;
                        nearestIndex = i;
                    }
                }
            }
            
            if (nearestIndex >= 0) {
                totalDistance += nearestDistance;
                currentPoint = rescuePoints[nearestIndex];
                visited.add(nearestIndex);
            }
        }
        
        totalDistance += currentPoint.distanceTo(startPoint);
        
        return totalDistance;
    }
    
    calculateGrade(score) {
        if (score >= 900) return 'S';
        if (score >= 750) return 'A';
        if (score >= 600) return 'B';
        if (score >= 400) return 'C';
        if (score >= 200) return 'D';
        return 'F';
    }
}
