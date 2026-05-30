export class CollisionDetector {
    static lineIntersection(p1, p2, p3, p4) {
        const d1x = p2.x - p1.x;
        const d1y = p2.y - p1.y;
        const d2x = p4.x - p3.x;
        const d2y = p4.y - p3.y;
        
        const cross = d1x * d2y - d1y * d2x;
        if (Math.abs(cross) < 0.0001) return null;
        
        const dx = p3.x - p1.x;
        const dy = p3.y - p1.y;
        
        const t = (dx * d2y - dy * d2x) / cross;
        const s = (dx * d1y - dy * d1x) / cross;
        
        if (t >= 0 && t <= 1 && s >= 0 && s <= 1) {
            return {
                x: p1.x + t * d1x,
                y: p1.y + t * d1y,
                t: t,
                s: s
            };
        }
        
        return null;
    }

    static pointToLineDistance(point, lineStart, lineEnd) {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) param = dot / lenSq;
        
        let xx, yy;
        
        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;
            yy = lineStart.y + param * D;
        }
        
        const dx = point.x - xx;
        const dy = point.y - yy;
        
        return {
            distance: Math.sqrt(dx * dx + dy * dy),
            closestPoint: { x: xx, y: yy },
            param: param
        };
    }

    static checkWallCollision(x1, y1, x2, y2, walls) {
        let closestHit = null;
        let closestWall = null;
        let minT = Infinity;
        
        for (const wall of walls) {
            const hit = this.lineIntersection(
                { x: x1, y: y1 },
                { x: x2, y: y2 },
                { x: wall.x1, y: wall.y1 },
                { x: wall.x2, y: wall.y2 }
            );
            
            if (hit && hit.t < minT) {
                minT = hit.t;
                closestHit = hit;
                closestWall = wall;
            }
        }
        
        if (closestHit) {
            return {
                hit: true,
                point: { x: closestHit.x, y: closestHit.y },
                wall: closestWall,
                t: minT
            };
        }
        
        return { hit: false };
    }

    static checkPointNearWall(point, walls, threshold = 5) {
        for (const wall of walls) {
            const result = this.pointToLineDistance(
                point,
                { x: wall.x1, y: wall.y1 },
                { x: wall.x2, y: wall.y2 }
            );
            
            if (result.distance < threshold) {
                return {
                    near: true,
                    wall: wall,
                    distance: result.distance,
                    closestPoint: result.closestPoint
                };
            }
        }
        
        return { near: false };
    }

    static checkCircleWallCollision(cx, cy, radius, walls) {
        for (const wall of walls) {
            const result = this.pointToLineDistance(
                { x: cx, y: cy },
                { x: wall.x1, y: wall.y1 },
                { x: wall.x2, y: wall.y2 }
            );
            
            if (result.distance < radius) {
                return {
                    collision: true,
                    wall: wall,
                    distance: result.distance,
                    closestPoint: result.closestPoint,
                    penetration: radius - result.distance
                };
            }
        }
        
        return { collision: false };
    }

    static reflectVector(dx, dy, normalX, normalY) {
        const dot = dx * normalX + dy * normalY;
        return {
            x: dx - 2 * dot * normalX,
            y: dy - 2 * dot * normalY
        };
    }

    static calculateIncidentAngle(dx, dy, normalX, normalY) {
        const dot = dx * normalX + dy * normalY;
        const len1 = Math.sqrt(dx * dx + dy * dy);
        const len2 = Math.sqrt(normalX * normalX + normalY * normalY);
        const cosAngle = dot / (len1 * len2);
        return Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    }

    static calculateReflectionAngle(dx, dy, wallAngle) {
        const normalX = -Math.sin(wallAngle);
        const normalY = Math.cos(wallAngle);
        const reflected = this.reflectVector(dx, dy, normalX, normalY);
        return Math.atan2(reflected.y, reflected.x);
    }

    static isPointInPolygon(point, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            
            if (((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }
}
