/**
 * 风险规则模块
 * 负责检测和分析车辆轨迹中的风险事件，包括会车、急停、禁行区靠近等
 */

export class RiskRules {
    constructor(options = {}) {
        this.options = {
            collisionDistance: options.collisionDistance || 2.0,
            suddenStopThreshold: options.suddenStopThreshold || -3.0,
            restrictedAreaBuffer: options.restrictedAreaBuffer || 1.0,
            maxSpeed: options.maxSpeed || 15,
            speedLimit: options.speedLimit || 10,
            timeWindow: options.timeWindow || 5000,
            minStopDuration: options.minStopDuration || 2000,
            ...options
        };
    }

    detectRisks(trajectoryData, mapData = null) {
        const risks = {
            collisions: [],
            suddenStops: [],
            restrictedAreaApproaches: [],
            speeding: [],
            nearMisses: [],
            statistics: {
                totalRisks: 0,
                byType: {
                    collisions: 0,
                    suddenStops: 0,
                    restrictedAreaApproaches: 0,
                    speeding: 0,
                    nearMisses: 0
                },
                bySeverity: {
                    high: 0,
                    medium: 0,
                    low: 0
                }
            }
        };

        if (!trajectoryData || trajectoryData.length === 0) {
            return risks;
        }

        const vehicleTrajectories = this.groupByVehicle(trajectoryData);
        const timeSortedData = [...trajectoryData].sort((a, b) => a.timestamp - b.timestamp);

        risks.collisions = this.detectCollisions(timeSortedData, vehicleTrajectories);
        risks.suddenStops = this.detectSuddenStops(vehicleTrajectories);
        
        if (mapData && mapData.restrictedAreas) {
            risks.restrictedAreaApproaches = this.detectRestrictedAreaApproaches(
                timeSortedData, 
                mapData.restrictedAreas
            );
        }

        risks.speeding = this.detectSpeeding(timeSortedData);
        risks.nearMisses = this.detectNearMisses(timeSortedData, vehicleTrajectories);

        risks.statistics.totalRisks = 
            risks.collisions.length + 
            risks.suddenStops.length + 
            risks.restrictedAreaApproaches.length + 
            risks.speeding.length + 
            risks.nearMisses.length;

        risks.statistics.byType = {
            collisions: risks.collisions.length,
            suddenStops: risks.suddenStops.length,
            restrictedAreaApproaches: risks.restrictedAreaApproaches.length,
            speeding: risks.speeding.length,
            nearMisses: risks.nearMisses.length
        };

        const allRisks = [
            ...risks.collisions,
            ...risks.suddenStops,
            ...risks.restrictedAreaApproaches,
            ...risks.speeding,
            ...risks.nearMisses
        ];

        allRisks.forEach(risk => {
            if (risk.severity === 'high') {
                risks.statistics.bySeverity.high++;
            } else if (risk.severity === 'medium') {
                risks.statistics.bySeverity.medium++;
            } else {
                risks.statistics.bySeverity.low++;
            }
        });

        return risks;
    }

    groupByVehicle(trajectoryData) {
        const vehicleMap = {};
        trajectoryData.forEach(point => {
            if (!vehicleMap[point.vehicleId]) {
                vehicleMap[point.vehicleId] = [];
            }
            vehicleMap[point.vehicleId].push(point);
        });

        Object.keys(vehicleMap).forEach(vehicleId => {
            vehicleMap[vehicleId].sort((a, b) => a.timestamp - b.timestamp);
        });

        return vehicleMap;
    }

    detectCollisions(timeSortedData, vehicleTrajectories) {
        const collisions = [];
        const timeGroups = this.groupByTime(timeSortedData, 1000);

        Object.keys(timeGroups).forEach(timeKey => {
            const group = timeGroups[timeKey];
            if (group.length < 2) return;

            for (let i = 0; i < group.length; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    const vehicleA = group[i];
                    const vehicleB = group[j];

                    if (vehicleA.vehicleId === vehicleB.vehicleId) continue;

                    const distance = this.calculateDistance(vehicleA, vehicleB);

                    if (distance <= this.options.collisionDistance) {
                        const severity = this.calculateCollisionSeverity(distance, vehicleA.speed, vehicleB.speed);
                        
                        collisions.push({
                            id: `collision_${timeKey}_${vehicleA.vehicleId}_${vehicleB.vehicleId}`,
                            type: 'collision',
                            timestamp: vehicleA.timestamp,
                            vehicles: [vehicleA.vehicleId, vehicleB.vehicleId],
                            positions: [
                                { x: vehicleA.x, y: vehicleA.y, z: vehicleA.z },
                                { x: vehicleB.x, y: vehicleB.y, z: vehicleB.z }
                            ],
                            distances: distance,
                            speeds: [vehicleA.speed, vehicleB.speed],
                            severity: severity,
                            description: `Collision risk between ${vehicleA.vehicleId} and ${vehicleB.vehicleId} at distance ${distance.toFixed(2)}m`,
                            evidence: {
                                vehicleA: { ...vehicleA },
                                vehicleB: { ...vehicleB }
                            }
                        });
                    }
                }
            }
        });

        return this.removeDuplicateRisks(collisions, 2000);
    }

    detectSuddenStops(vehicleTrajectories) {
        const suddenStops = [];

        Object.keys(vehicleTrajectories).forEach(vehicleId => {
            const trajectory = vehicleTrajectories[vehicleId];
            
            for (let i = 1; i < trajectory.length; i++) {
                const current = trajectory[i];
                const previous = trajectory[i - 1];

                const timeDelta = (current.timestamp - previous.timestamp) / 1000;
                
                if (timeDelta <= 0 || timeDelta > 10) continue;

                const acceleration = (current.speed - previous.speed) / timeDelta;

                if (acceleration <= this.options.suddenStopThreshold) {
                    const severity = this.calculateSuddenStopSeverity(acceleration, current.speed);
                    
                    suddenStops.push({
                        id: `suddenStop_${vehicleId}_${current.timestamp}`,
                        type: 'suddenStop',
                        timestamp: current.timestamp,
                        vehicleId: vehicleId,
                        position: { x: current.x, y: current.y, z: current.z },
                        acceleration: acceleration,
                        previousSpeed: previous.speed,
                        currentSpeed: current.speed,
                        severity: severity,
                        description: `Sudden stop detected for ${vehicleId}: acceleration ${acceleration.toFixed(2)} m/s²`,
                        evidence: {
                            previous: { ...previous },
                            current: { ...current }
                        }
                    });
                }
            }
        });

        return this.removeDuplicateRisks(suddenStops, 3000);
    }

    detectRestrictedAreaApproaches(timeSortedData, restrictedAreas) {
        const approaches = [];

        if (!restrictedAreas || restrictedAreas.length === 0) {
            return approaches;
        }

        timeSortedData.forEach(point => {
            restrictedAreas.forEach(area => {
                const distanceToArea = this.calculateDistanceToRestrictedArea(point, area);

                if (distanceToArea <= this.options.restrictedAreaBuffer) {
                    const isInside = this.isPointInRestrictedArea(point, area);
                    const severity = this.calculateRestrictedAreaSeverity(distanceToArea, isInside);

                    approaches.push({
                        id: `restricted_${area.id}_${point.vehicleId}_${point.timestamp}`,
                        type: 'restrictedArea',
                        timestamp: point.timestamp,
                        vehicleId: point.vehicleId,
                        position: { x: point.x, y: point.y, z: point.z },
                        areaId: area.id,
                        areaName: area.name,
                        distance: distanceToArea,
                        isInside: isInside,
                        severity: severity,
                        description: `Vehicle ${point.vehicleId} ${isInside ? 'entered' : 'approached'} restricted area ${area.name} at distance ${distanceToArea.toFixed(2)}m`,
                        evidence: {
                            point: { ...point },
                            area: { ...area }
                        }
                    });
                }
            });
        });

        return this.removeDuplicateRisks(approaches, 5000);
    }

    detectSpeeding(timeSortedData) {
        const speeding = [];

        timeSortedData.forEach(point => {
            if (point.speed > this.options.speedLimit) {
                const severity = this.calculateSpeedingSeverity(point.speed, this.options.speedLimit);

                speeding.push({
                    id: `speeding_${point.vehicleId}_${point.timestamp}`,
                    type: 'speeding',
                    timestamp: point.timestamp,
                    vehicleId: point.vehicleId,
                    position: { x: point.x, y: point.y, z: point.z },
                    speed: point.speed,
                    speedLimit: this.options.speedLimit,
                    overSpeed: point.speed - this.options.speedLimit,
                    severity: severity,
                    description: `Vehicle ${point.vehicleId} speeding: ${point.speed.toFixed(1)} km/h (limit: ${this.options.speedLimit})`,
                    evidence: {
                        point: { ...point }
                    }
                });
            }
        });

        return this.removeDuplicateRisks(speeding, 3000);
    }

    detectNearMisses(timeSortedData, vehicleTrajectories) {
        const nearMisses = [];
        const timeGroups = this.groupByTime(timeSortedData, 500);

        Object.keys(timeGroups).forEach(timeKey => {
            const group = timeGroups[timeKey];
            if (group.length < 2) return;

            for (let i = 0; i < group.length; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    const vehicleA = group[i];
                    const vehicleB = group[j];

                    if (vehicleA.vehicleId === vehicleB.vehicleId) continue;

                    const distance = this.calculateDistance(vehicleA, vehicleB);
                    const nearMissDistance = this.options.collisionDistance * 2;

                    if (distance > this.options.collisionDistance && distance <= nearMissDistance) {
                        const relativeSpeed = Math.abs(vehicleA.speed - vehicleB.speed);
                        const severity = this.calculateNearMissSeverity(distance, relativeSpeed);

                        nearMisses.push({
                            id: `nearMiss_${timeKey}_${vehicleA.vehicleId}_${vehicleB.vehicleId}`,
                            type: 'nearMiss',
                            timestamp: vehicleA.timestamp,
                            vehicles: [vehicleA.vehicleId, vehicleB.vehicleId],
                            positions: [
                                { x: vehicleA.x, y: vehicleA.y, z: vehicleA.z },
                                { x: vehicleB.x, y: vehicleB.y, z: vehicleB.z }
                            ],
                            distance: distance,
                            speeds: [vehicleA.speed, vehicleB.speed],
                            relativeSpeed: relativeSpeed,
                            severity: severity,
                            description: `Near miss between ${vehicleA.vehicleId} and ${vehicleB.vehicleId} at distance ${distance.toFixed(2)}m`,
                            evidence: {
                                vehicleA: { ...vehicleA },
                                vehicleB: { ...vehicleB }
                            }
                        });
                    }
                }
            }
        });

        return this.removeDuplicateRisks(nearMisses, 2000);
    }

    groupByTime(data, timeWindowMs) {
        const groups = {};
        data.forEach(point => {
            const timeKey = Math.floor(point.timestamp / timeWindowMs);
            if (!groups[timeKey]) {
                groups[timeKey] = [];
            }
            groups[timeKey].push(point);
        });
        return groups;
    }

    calculateDistance(pointA, pointB) {
        const dx = pointA.x - pointB.x;
        const dy = pointA.y - pointB.y;
        const dz = (pointA.z || 0) - (pointB.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    calculateDistanceToRestrictedArea(point, area) {
        let minDistance = Infinity;

        if (area.polygon && area.polygon.length >= 3) {
            for (let i = 0; i < area.polygon.length; i++) {
                const start = area.polygon[i];
                const end = area.polygon[(i + 1) % area.polygon.length];
                const distance = this.pointToLineSegmentDistance(point, start, end);
                minDistance = Math.min(minDistance, distance);
            }
        } else if (area.bounds) {
            minDistance = this.pointToBoundsDistance(point, area.bounds);
        }

        if (this.isPointInRestrictedArea(point, area)) {
            return 0;
        }

        return minDistance;
    }

    pointToLineSegmentDistance(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const lengthSquared = dx * dx + dy * dy;

        if (lengthSquared === 0) {
            return this.calculateDistance(point, lineStart);
        }

        let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared;
        t = Math.max(0, Math.min(1, t));

        const nearestPoint = {
            x: lineStart.x + t * dx,
            y: lineStart.y + t * dy,
            z: lineStart.z || 0
        };

        return this.calculateDistance(point, nearestPoint);
    }

    pointToBoundsDistance(point, bounds) {
        let dx = 0, dy = 0;

        if (point.x < bounds.minX) dx = bounds.minX - point.x;
        else if (point.x > bounds.maxX) dx = point.x - bounds.maxX;

        if (point.y < bounds.minY) dy = bounds.minY - point.y;
        else if (point.y > bounds.maxY) dy = point.y - bounds.maxY;

        return Math.sqrt(dx * dx + dy * dy);
    }

    isPointInRestrictedArea(point, area) {
        if (area.polygon) {
            return this.isPointInPolygon(point, area.polygon);
        }

        if (area.bounds) {
            return point.x >= area.bounds.minX && point.x <= area.bounds.maxX &&
                   point.y >= area.bounds.minY && point.y <= area.bounds.maxY;
        }

        return false;
    }

    isPointInPolygon(point, polygon) {
        let inside = false;
        const x = point.x;
        const y = point.y;

        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x;
            const yi = polygon[i].y;
            const xj = polygon[j].x;
            const yj = polygon[j].y;

            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            
            if (intersect) inside = !inside;
        }

        return inside;
    }

    calculateCollisionSeverity(distance, speedA, speedB) {
        const avgSpeed = (speedA + speedB) / 2;
        const distanceFactor = 1 - (distance / this.options.collisionDistance);
        const speedFactor = avgSpeed / this.options.maxSpeed;

        const severityScore = distanceFactor * 0.6 + speedFactor * 0.4;

        if (severityScore >= 0.8) return 'high';
        if (severityScore >= 0.5) return 'medium';
        return 'low';
    }

    calculateSuddenStopSeverity(acceleration, currentSpeed) {
        const accelerationFactor = Math.abs(acceleration) / Math.abs(this.options.suddenStopThreshold);
        const speedFactor = currentSpeed / this.options.maxSpeed;

        const severityScore = accelerationFactor * 0.7 + speedFactor * 0.3;

        if (severityScore >= 1.5) return 'high';
        if (severityScore >= 1.0) return 'medium';
        return 'low';
    }

    calculateRestrictedAreaSeverity(distance, isInside) {
        if (isInside) {
            return 'high';
        }

        const distanceFactor = 1 - (distance / this.options.restrictedAreaBuffer);

        if (distanceFactor >= 0.8) return 'high';
        if (distanceFactor >= 0.5) return 'medium';
        return 'low';
    }

    calculateSpeedingSeverity(speed, limit) {
        const overSpeed = speed - limit;
        const overSpeedPercent = overSpeed / limit;

        if (overSpeedPercent >= 0.5) return 'high';
        if (overSpeedPercent >= 0.2) return 'medium';
        return 'low';
    }

    calculateNearMissSeverity(distance, relativeSpeed) {
        const nearMissDistance = this.options.collisionDistance * 2;
        const distanceFactor = 1 - ((distance - this.options.collisionDistance) / (nearMissDistance - this.options.collisionDistance));
        const speedFactor = relativeSpeed / this.options.maxSpeed;

        const severityScore = distanceFactor * 0.6 + speedFactor * 0.4;

        if (severityScore >= 0.7) return 'high';
        if (severityScore >= 0.4) return 'medium';
        return 'low';
    }

    removeDuplicateRisks(risks, timeWindowMs) {
        if (risks.length === 0) return risks;

        const uniqueRisks = [];
        const grouped = {};

        risks.forEach(risk => {
            let key;
            if (risk.type === 'collision' || risk.type === 'nearMiss') {
                const vehicles = [...risk.vehicles].sort();
                key = `${risk.type}_${Math.floor(risk.timestamp / timeWindowMs)}_${vehicles.join('_')}`;
            } else {
                key = `${risk.type}_${risk.vehicleId}_${Math.floor(risk.timestamp / timeWindowMs)}`;
            }

            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(risk);
        });

        Object.keys(grouped).forEach(key => {
            const group = grouped[key];
            const highestSeverity = this.getHighestSeverity(group);
            const highestSeverityRisk = group.find(r => r.severity === highestSeverity);
            if (highestSeverityRisk) {
                uniqueRisks.push(highestSeverityRisk);
            }
        });

        return uniqueRisks.sort((a, b) => a.timestamp - b.timestamp);
    }

    getHighestSeverity(risks) {
        const severityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        let highest = 'low';

        risks.forEach(risk => {
            if (severityOrder[risk.severity] > severityOrder[highest]) {
                highest = risk.severity;
            }
        });

        return highest;
    }

    getRiskById(risks, riskId) {
        const allRisks = [
            ...(risks.collisions || []),
            ...(risks.suddenStops || []),
            ...(risks.restrictedAreaApproaches || []),
            ...(risks.speeding || []),
            ...(risks.nearMisses || [])
        ];

        return allRisks.find(risk => risk.id === riskId);
    }

    filterRisksByTime(risks, startTime, endTime) {
        const result = {
            collisions: [],
            suddenStops: [],
            restrictedAreaApproaches: [],
            speeding: [],
            nearMisses: [],
            statistics: { ...risks.statistics }
        };

        const timeFilter = (risk) => {
            return risk.timestamp >= startTime && risk.timestamp <= endTime;
        };

        result.collisions = (risks.collisions || []).filter(timeFilter);
        result.suddenStops = (risks.suddenStops || []).filter(timeFilter);
        result.restrictedAreaApproaches = (risks.restrictedAreaApproaches || []).filter(timeFilter);
        result.speeding = (risks.speeding || []).filter(timeFilter);
        result.nearMisses = (risks.nearMisses || []).filter(timeFilter);

        return result;
    }

    filterRisksByVehicle(risks, vehicleIds) {
        const result = {
            collisions: [],
            suddenStops: [],
            restrictedAreaApproaches: [],
            speeding: [],
            nearMisses: [],
            statistics: { ...risks.statistics }
        };

        const vehicleFilter = (risk) => {
            if (risk.vehicles) {
                return risk.vehicles.some(v => vehicleIds.includes(v));
            }
            return vehicleIds.includes(risk.vehicleId);
        };

        result.collisions = (risks.collisions || []).filter(vehicleFilter);
        result.suddenStops = (risks.suddenStops || []).filter(vehicleFilter);
        result.restrictedAreaApproaches = (risks.restrictedAreaApproaches || []).filter(vehicleFilter);
        result.speeding = (risks.speeding || []).filter(vehicleFilter);
        result.nearMisses = (risks.nearMisses || []).filter(vehicleFilter);

        return result;
    }

    filterRisksBySeverity(risks, severities) {
        const result = {
            collisions: [],
            suddenStops: [],
            restrictedAreaApproaches: [],
            speeding: [],
            nearMisses: [],
            statistics: { ...risks.statistics }
        };

        const severityFilter = (risk) => {
            return severities.includes(risk.severity);
        };

        result.collisions = (risks.collisions || []).filter(severityFilter);
        result.suddenStops = (risks.suddenStops || []).filter(severityFilter);
        result.restrictedAreaApproaches = (risks.restrictedAreaApproaches || []).filter(severityFilter);
        result.speeding = (risks.speeding || []).filter(severityFilter);
        result.nearMisses = (risks.nearMisses || []).filter(severityFilter);

        return result;
    }
}

export default RiskRules;
