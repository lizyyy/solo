export class AnalysisManager {
    constructor(pointManager, routeManager, sceneManager) {
        this.pointManager = pointManager;
        this.routeManager = routeManager;
        this.sceneManager = sceneManager;
        
        this.MIN_POINT_DISTANCE = 3;
        this.MIN_SAFE_DISTANCE = 5;
    }
    
    checkBoundary(point) {
        const boundary = this.sceneManager.getBoundary();
        
        const isWithin = point.x >= boundary.min.x &&
                        point.x <= boundary.max.x &&
                        point.y >= boundary.min.y &&
                        point.y <= boundary.max.y &&
                        point.z >= boundary.min.z &&
                        point.z <= boundary.max.z;
        
        return {
            valid: isWithin,
            boundary,
            point
        };
    }
    
    checkAllPointsBoundary() {
        const points = this.pointManager.getAllPoints();
        const violations = [];
        
        points.forEach(point => {
            const result = this.checkBoundary(point);
            if (!result.valid) {
                violations.push({
                    pointId: point.id,
                    pointName: point.name,
                    position: { x: point.x, y: point.y, z: point.z }
                });
            }
        });
        
        return {
            valid: violations.length === 0,
            violations,
            totalPoints: points.length,
            violationCount: violations.length
        };
    }
    
    checkRouteBoundary() {
        const routePoints = this.routeManager.getRoutePoints();
        const boundary = this.sceneManager.getBoundary();
        const violations = [];
        
        for (let i = 0; i < routePoints.length - 1; i++) {
            const p1 = routePoints[i];
            const p2 = routePoints[i + 1];
            
            const samples = 10;
            for (let j = 0; j <= samples; j++) {
                const t = j / samples;
                const samplePoint = {
                    x: p1.x + (p2.x - p1.x) * t,
                    y: p1.y + (p2.y - p1.y) * t,
                    z: p1.z + (p2.z - p1.z) * t
                };
                
                const isWithin = samplePoint.x >= boundary.min.x &&
                               samplePoint.x <= boundary.max.x &&
                               samplePoint.y >= boundary.min.y &&
                               samplePoint.y <= boundary.max.y &&
                               samplePoint.z >= boundary.min.z &&
                               samplePoint.z <= boundary.max.z;
                
                if (!isWithin) {
                    violations.push({
                        segment: `${p1.name} -> ${p2.name}`,
                        segmentIndex: i,
                        position: samplePoint
                    });
                    break;
                }
            }
        }
        
        return {
            valid: violations.length === 0,
            violations,
            totalSegments: routePoints.length > 1 ? routePoints.length - 1 : 0,
            violationCount: violations.length
        };
    }
    
    distance(p1, p2) {
        return Math.sqrt(
            Math.pow(p2.x - p1.x, 2) +
            Math.pow(p2.y - p1.y, 2) +
            Math.pow(p2.z - p1.z, 2)
        );
    }
    
    pointToLineDistance(point, lineStart, lineEnd) {
        const line = {
            x: lineEnd.x - lineStart.x,
            y: lineEnd.y - lineStart.y,
            z: lineEnd.z - lineStart.z
        };
        
        const lineLength = Math.sqrt(
            line.x * line.x + line.y * line.y + line.z * line.z
        );
        
        if (lineLength === 0) {
            return this.distance(point, lineStart);
        }
        
        const v = {
            x: line.x / lineLength,
            y: line.y / lineLength,
            z: line.z / lineLength
        };
        
        const w = {
            x: point.x - lineStart.x,
            y: point.y - lineStart.y,
            z: point.z - lineStart.z
        };
        
        const dot = w.x * v.x + w.y * v.y + w.z * v.z;
        
        if (dot <= 0) {
            return this.distance(point, lineStart);
        }
        
        if (dot >= lineLength) {
            return this.distance(point, lineEnd);
        }
        
        const pb = {
            x: lineStart.x + v.x * dot,
            y: lineStart.y + v.y * dot,
            z: lineStart.z + v.z * dot
        };
        
        return this.distance(point, pb);
    }
    
    checkPointCollisions() {
        const points = this.pointManager.getAllPoints();
        const collisions = [];
        
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                const dist = this.distance(points[i], points[j]);
                if (dist < this.MIN_POINT_DISTANCE) {
                    collisions.push({
                        type: 'point_too_close',
                        point1: {
                            id: points[i].id,
                            name: points[i].name,
                            position: { x: points[i].x, y: points[i].y, z: points[i].z }
                        },
                        point2: {
                            id: points[j].id,
                            name: points[j].name,
                            position: { x: points[j].x, y: points[j].y, z: points[j].z }
                        },
                        distance: dist,
                        minDistance: this.MIN_POINT_DISTANCE
                    });
                }
            }
        }
        
        return {
            valid: collisions.length === 0,
            collisions,
            totalPairs: (points.length * (points.length - 1)) / 2,
            collisionCount: collisions.length
        };
    }
    
    checkRouteCollisionsWithPoints() {
        const routePoints = this.routeManager.getRoutePoints();
        const allPoints = this.pointManager.getAllPoints();
        const collisions = [];
        
        const routePointIds = new Set(routePoints.map(p => p.id));
        
        for (let i = 0; i < routePoints.length - 1; i++) {
            const segmentStart = routePoints[i];
            const segmentEnd = routePoints[i + 1];
            
            for (const point of allPoints) {
                if (routePointIds.has(point.id)) continue;
                
                const dist = this.pointToLineDistance(point, segmentStart, segmentEnd);
                if (dist < this.MIN_SAFE_DISTANCE) {
                    collisions.push({
                        type: 'route_too_close',
                        segment: `${segmentStart.name} -> ${segmentEnd.name}`,
                        segmentIndex: i,
                        point: {
                            id: point.id,
                            name: point.name,
                            position: { x: point.x, y: point.y, z: point.z }
                        },
                        distance: dist,
                        minDistance: this.MIN_SAFE_DISTANCE
                    });
                }
            }
        }
        
        return {
            valid: collisions.length === 0,
            collisions,
            totalSegments: routePoints.length > 1 ? routePoints.length - 1 : 0,
            collisionCount: collisions.length
        };
    }
    
    calculateCoverage() {
        const allPoints = this.pointManager.getAllPoints();
        const routePointIds = new Set(this.routeManager.getRoute());
        
        const visitedPoints = [];
        const unvisitedPoints = [];
        
        allPoints.forEach(point => {
            if (routePointIds.has(point.id)) {
                visitedPoints.push(point);
            } else {
                unvisitedPoints.push(point);
            }
        });
        
        const coverageRate = allPoints.length > 0
            ? (visitedPoints.length / allPoints.length) * 100
            : 0;
        
        return {
            totalPoints: allPoints.length,
            visitedCount: visitedPoints.length,
            unvisitedCount: unvisitedPoints.length,
            coverageRate: Math.round(coverageRate * 100) / 100,
            visitedPoints: visitedPoints.map(p => ({
                id: p.id,
                name: p.name,
                position: { x: p.x, y: p.y, z: p.z }
            })),
            unvisitedPoints: unvisitedPoints.map(p => ({
                id: p.id,
                name: p.name,
                position: { x: p.x, y: p.y, z: p.z }
            }))
        };
    }
    
    runFullAnalysis() {
        const boundaryResult = this.checkRouteBoundary();
        const pointCollisionResult = this.checkPointCollisions();
        const routeCollisionResult = this.checkRouteCollisionsWithPoints();
        const coverageResult = this.calculateCoverage();
        
        const issues = [
            ...boundaryResult.violations,
            ...pointCollisionResult.collisions,
            ...routeCollisionResult.collisions,
            ...coverageResult.unvisitedPoints.map(p => ({
                type: 'missing_point',
                point: {
                    id: p.id,
                    name: p.name,
                    position: p.position
                }
            }))
        ];
        
        const valid = boundaryResult.valid &&
                     pointCollisionResult.valid &&
                     routeCollisionResult.valid &&
                     coverageResult.unvisitedCount === 0;
        
        return {
            valid,
            totalIssues: issues.length,
            boundary: boundaryResult,
            pointCollisions: pointCollisionResult,
            routeCollisions: routeCollisionResult,
            coverage: coverageResult,
            issues
        };
    }
    
    setMinPointDistance(distance) {
        this.MIN_POINT_DISTANCE = distance;
    }
    
    setMinSafeDistance(distance) {
        this.MIN_SAFE_DISTANCE = distance;
    }
}