import * as THREE from 'three';

export class RouteManager {
    constructor(pointManager, sceneManager) {
        this.pointManager = pointManager;
        this.sceneManager = sceneManager;
        this.route = [];
        
        this.isPlaying = false;
        this.isPaused = false;
        this.playbackProgress = 0;
        this.playbackSpeed = 30;
        this.currentSegmentIndex = 0;
        this.currentPointIndex = 0;
        
        this.animationFrameId = null;
        this.lastTime = 0;
    }
    
    addPointToRoute(pointId) {
        if (!this.route.includes(pointId)) {
            this.route.push(pointId);
            this.updateRouteDisplay();
            return true;
        }
        return false;
    }
    
    removePointFromRoute(pointId) {
        const index = this.route.indexOf(pointId);
        if (index !== -1) {
            this.route.splice(index, 1);
            this.updateRouteDisplay();
            return true;
        }
        return false;
    }
    
    movePointInRoute(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.route.length ||
            toIndex < 0 || toIndex >= this.route.length) {
            return false;
        }
        
        const [removed] = this.route.splice(fromIndex, 1);
        this.route.splice(toIndex, 0, removed);
        this.updateRouteDisplay();
        return true;
    }
    
    clearRoute() {
        this.route = [];
        this.stopPlayback();
        this.sceneManager.clearRoute();
        this.pointManager.resetAllVisited();
    }
    
    autoPlanRoute() {
        const allPoints = this.pointManager.getAllPoints();
        if (allPoints.length < 2) {
            return [];
        }
        
        const unvisited = new Set(allPoints.map(p => p.id));
        const result = [];
        
        let current = allPoints[0];
        unvisited.delete(current.id);
        result.push(current.id);
        
        while (unvisited.size > 0) {
            let nearest = null;
            let nearestDist = Infinity;
            
            for (const pointId of unvisited) {
                const point = this.pointManager.getPoint(pointId);
                const dist = this.distance(current, point);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = point;
                }
            }
            
            if (nearest) {
                unvisited.delete(nearest.id);
                result.push(nearest.id);
                current = nearest;
            } else {
                break;
            }
        }
        
        this.route = result;
        this.updateRouteDisplay();
        return result;
    }
    
    distance(p1, p2) {
        return Math.sqrt(
            Math.pow(p2.x - p1.x, 2) +
            Math.pow(p2.y - p1.y, 2) +
            Math.pow(p2.z - p1.z, 2)
        );
    }
    
    getRoutePoints() {
        return this.route.map(id => this.pointManager.getPoint(id)).filter(Boolean);
    }
    
    calculateTotalDistance() {
        const points = this.getRoutePoints();
        if (points.length < 2) return 0;
        
        let total = 0;
        for (let i = 1; i < points.length; i++) {
            total += this.distance(points[i - 1], points[i]);
        }
        return total;
    }
    
    updateRouteDisplay() {
        const points = this.getRoutePoints();
        this.sceneManager.drawRoute(points);
    }
    
    startPlayback(speed = 30) {
        if (this.route.length < 2) return;
        
        this.playbackSpeed = speed;
        this.isPlaying = true;
        this.isPaused = false;
        this.playbackProgress = 0;
        this.currentSegmentIndex = 0;
        this.currentPointIndex = 0;
        this.lastTime = performance.now();
        
        this.pointManager.resetAllVisited();
        
        const startPoint = this.pointManager.getPoint(this.route[0]);
        this.sceneManager.createAnimatedPoint(
            new THREE.Vector3(startPoint.x, startPoint.y, startPoint.z)
        );
        this.pointManager.setPointVisited(this.route[0], true);
        
        this.animate();
    }
    
    pausePlayback() {
        this.isPaused = true;
    }
    
    resumePlayback() {
        if (this.isPaused) {
            this.isPaused = false;
            this.lastTime = performance.now();
            this.animate();
        }
    }
    
    stopPlayback() {
        this.isPlaying = false;
        this.isPaused = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.sceneManager.removeAnimatedPoint();
    }
    
    animate() {
        if (!this.isPlaying || this.isPaused) return;
        
        this.animationFrameId = requestAnimationFrame(() => this.animate());
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        this.playbackProgress += deltaTime * this.playbackSpeed;
        
        const points = this.getRoutePoints();
        
        let accumulatedDistance = 0;
        let segmentFound = false;
        
        for (let i = 0; i < points.length - 1; i++) {
            const segmentLength = this.distance(points[i], points[i + 1]);
            
            if (this.playbackProgress <= accumulatedDistance + segmentLength) {
                this.currentSegmentIndex = i;
                segmentFound = true;
                
                const segmentProgress = (this.playbackProgress - accumulatedDistance) / segmentLength;
                
                if (i > this.currentPointIndex) {
                    this.currentPointIndex = i;
                    this.pointManager.setPointVisited(this.route[i], true);
                    if (this.onPointVisitCallback) {
                        this.onPointVisitCallback(this.route[i]);
                    }
                }
                
                const start = points[i];
                const end = points[i + 1];
                const currentPosition = new THREE.Vector3(
                    start.x + (end.x - start.x) * segmentProgress,
                    start.y + (end.y - start.y) * segmentProgress,
                    start.z + (end.z - start.z) * segmentProgress
                );
                
                this.sceneManager.updateAnimatedPoint(currentPosition);
                break;
            }
            
            accumulatedDistance += segmentLength;
        }
        
        if (!segmentFound) {
            this.currentPointIndex = points.length - 1;
            this.pointManager.setPointVisited(this.route[points.length - 1], true);
            
            const lastPoint = points[points.length - 1];
            this.sceneManager.updateAnimatedPoint(
                new THREE.Vector3(lastPoint.x, lastPoint.y, lastPoint.z)
            );
            
            this.isPlaying = false;
            if (this.onPlaybackEndCallback) {
                this.onPlaybackEndCallback();
            }
        }
    }
    
    setOnPointVisitCallback(callback) {
        this.onPointVisitCallback = callback;
    }
    
    setOnPlaybackEndCallback(callback) {
        this.onPlaybackEndCallback = callback;
    }
    
    getVisitedPointIds() {
        return this.route.slice(0, this.currentPointIndex + 1);
    }
    
    getMissingPointIds() {
        const allPointIds = new Set(this.pointManager.getAllPoints().map(p => p.id));
        const routeSet = new Set(this.route);
        const missing = [];
        
        for (const id of allPointIds) {
            if (!routeSet.has(id)) {
                missing.push(id);
            }
        }
        
        return missing;
    }
    
    getRouteInfo() {
        return {
            totalPoints: this.route.length,
            totalDistance: this.calculateTotalDistance(),
            visitedCount: this.currentPointIndex + 1,
            missingCount: this.getMissingPointIds().length,
            currentPointIndex: this.currentPointIndex,
            isPlaying: this.isPlaying,
            isPaused: this.isPaused
        };
    }
    
    exportRoute() {
        return {
            pointIds: [...this.route],
            totalDistance: this.calculateTotalDistance()
        };
    }
    
    importRoute(routeData) {
        this.route = [...routeData.pointIds];
        this.updateRouteDisplay();
    }
    
    getRoute() {
        return [...this.route];
    }
}