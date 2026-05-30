import { CollisionDetector } from './CollisionDetector.js';

export class SoundWave {
    constructor(data = {}) {
        this.id = data.id || `wave_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.startX = data.startX ?? 0;
        this.startY = data.startY ?? 0;
        this.direction = data.direction ?? 0;
        this.intensity = data.intensity ?? 1.0;
        this.frequency = data.frequency ?? 2000;
        this.speed = data.speed ?? 343;
        this.maxDistance = data.maxDistance ?? 1000;
        this.maxReflections = data.maxReflections ?? 5;
        this.createdAt = data.createdAt || Date.now();
        this.path = [];
        this.reflections = [];
        this.echoes = [];
        this.complete = false;
    }

    getDirectionRadians() {
        return (this.direction * Math.PI) / 180;
    }

    propagate(walls, startTime = 0) {
        this.path = [];
        this.reflections = [];
        this.echoes = [];
        
        let currentX = this.startX;
        let currentY = this.startY;
        let dirRad = this.getDirectionRadians();
        let currentDx = Math.cos(dirRad);
        let currentDy = Math.sin(dirRad);
        let currentIntensity = this.intensity;
        let totalDistance = 0;
        let reflectionCount = 0;
        let currentTime = startTime;
        
        this.path.push({
            x: currentX,
            y: currentY,
            intensity: currentIntensity,
            distance: totalDistance,
            time: currentTime
        });
        
        while (reflectionCount < this.maxReflections && totalDistance < this.maxDistance && currentIntensity > 0.01) {
            const stepLength = this.maxDistance;
            const endX = currentX + currentDx * stepLength;
            const endY = currentY + currentDy * stepLength;
            
            const collision = CollisionDetector.checkWallCollision(
                currentX, currentY, endX, endY, walls
            );
            
            if (collision.hit) {
                const hitDistance = collision.t * stepLength;
                totalDistance += hitDistance;
                currentTime += hitDistance / this.speed;
                
                const incidentAngle = CollisionDetector.calculateIncidentAngle(
                    currentDx, currentDy,
                    collision.wall.getNormal().x,
                    collision.wall.getNormal().y
                );
                
                const reflected = CollisionDetector.reflectVector(
                    currentDx, currentDy,
                    collision.wall.getNormal().x,
                    collision.wall.getNormal().y
                );
                
                currentIntensity *= collision.wall.reflectionCoefficient;
                
                this.path.push({
                    x: collision.point.x,
                    y: collision.point.y,
                    intensity: currentIntensity,
                    distance: totalDistance,
                    time: currentTime,
                    isReflection: true
                });
                
                this.reflections.push({
                    point: { x: collision.point.x, y: collision.point.y },
                    wall: collision.wall,
                    incidentAngle: incidentAngle,
                    reflectionAngle: Math.atan2(reflected.y, reflected.x),
                    intensity: currentIntensity,
                    distance: totalDistance,
                    time: currentTime
                });
                
                const echoTime = currentTime * 2;
                const echoDistance = totalDistance * 2;
                this.echoes.push({
                    id: `echo_${this.id}_${this.echoes.length}`,
                    reflectionId: this.reflections.length - 1,
                    time: echoTime,
                    distance: echoDistance,
                    intensity: currentIntensity,
                    wallMaterial: collision.wall.material,
                    wallId: collision.wall.id,
                    point: { x: collision.point.x, y: collision.point.y },
                    incidentAngleDegrees: (incidentAngle * 180) / Math.PI,
                    reflectionAngleDegrees: (Math.atan2(reflected.y, reflected.x) * 180) / Math.PI,
                    expectedReflectionAngle: (2 * Math.atan2(collision.wall.getNormal().y, collision.wall.getNormal().x) - Math.atan2(currentDy, currentDx)) * 180 / Math.PI
                });
                
                currentX = collision.point.x + reflected.x * 0.1;
                currentY = collision.point.y + reflected.y * 0.1;
                currentDx = reflected.x;
                currentDy = reflected.y;
                reflectionCount++;
            } else {
                totalDistance += stepLength;
                currentTime += stepLength / this.speed;
                
                this.path.push({
                    x: endX,
                    y: endY,
                    intensity: currentIntensity,
                    distance: totalDistance,
                    time: currentTime,
                    isReflection: false
                });
                break;
            }
        }
        
        this.complete = true;
        return {
            path: this.path,
            reflections: this.reflections,
            echoes: this.echoes
        };
    }

    getTotalDistance() {
        if (this.path.length < 2) return 0;
        let total = 0;
        for (let i = 1; i < this.path.length; i++) {
            total += Math.sqrt(
                Math.pow(this.path[i].x - this.path[i-1].x, 2) +
                Math.pow(this.path[i].y - this.path[i-1].y, 2)
            );
        }
        return total;
    }

    getTotalTime() {
        if (this.path.length === 0) return 0;
        return this.path[this.path.length - 1].time;
    }

    getEchoAnalysis() {
        return this.echoes.map((echo, index) => ({
            echoNumber: index + 1,
            time: echo.time.toFixed(4),
            distance: echo.distance.toFixed(2),
            intensity: (echo.intensity * 100).toFixed(1),
            material: echo.wallMaterial,
            incidentAngle: echo.incidentAngleDegrees.toFixed(1),
            reflectionAngle: echo.reflectionAngleDegrees.toFixed(1),
            position: `(${echo.point.x.toFixed(1)}, ${echo.point.y.toFixed(1)})`
        }));
    }

    toJSON() {
        return {
            id: this.id,
            startX: this.startX,
            startY: this.startY,
            direction: this.direction,
            intensity: this.intensity,
            frequency: this.frequency,
            speed: this.speed,
            maxDistance: this.maxDistance,
            maxReflections: this.maxReflections,
            createdAt: this.createdAt,
            path: [...this.path],
            reflections: this.reflections.map(r => ({
                ...r,
                wall: r.wall ? r.wall.id : null
            })),
            echoes: [...this.echoes],
            complete: this.complete
        };
    }

    clone() {
        return new SoundWave(this.toJSON());
    }

    static generateId() {
        return `wave_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
