/**
 * 路线播放器
 * 负责在 3D 场景中播放拣货路线动画
 */

class RoutePlayer {
    constructor(sceneManager, route, options = {}) {
        this.sceneManager = sceneManager;
        this.route = route;
        this.options = {
            speed: options.speed || 1,
            loop: options.loop || false,
            ...options
        };
        
        this.isPlaying = false;
        this.isPaused = false;
        this.currentPointIndex = 0;
        this.animationId = null;
        this.playerMarker = null;
        
        this.onProgress = null;
        this.onComplete = null;
        this.onPointReached = null;
    }
    
    play() {
        if (!this.route || !this.route.points || this.route.points.length < 2) {
            console.warn('路线数据无效，无法播放');
            return;
        }
        
        this.isPlaying = true;
        this.isPaused = false;
        this.currentPointIndex = 0;
        
        this.createPlayerMarker();
        this.startAnimation();
        
        this.updateProgress();
    }
    
    pause() {
        this.isPaused = true;
    }
    
    resume() {
        if (!this.isPlaying) return;
        this.isPaused = false;
    }
    
    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentPointIndex = 0;
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        this.removePlayerMarker();
        this.updateProgress();
    }
    
    createPlayerMarker() {
        this.removePlayerMarker();
        
        if (this.route.points.length > 0) {
            const startPoint = this.route.points[0];
            this.playerMarker = RouteRenderer.createPlayerMarker(
                { x: startPoint.x, z: startPoint.z },
                0x4ade80
            );
            this.sceneManager.scene.add(this.playerMarker);
        }
    }
    
    removePlayerMarker() {
        if (this.playerMarker) {
            this.sceneManager.scene.remove(this.playerMarker);
            this.playerMarker = null;
        }
    }
    
    startAnimation() {
        const points = this.route.points;
        const totalPoints = points.length;
        
        let currentSegmentStart = 0;
        let currentSegmentProgress = 0;
        
        const animate = () => {
            if (!this.isPlaying) return;
            
            if (this.isPaused) {
                this.animationId = requestAnimationFrame(animate);
                return;
            }
            
            const speed = this.options.speed * 0.02;
            currentSegmentProgress += speed;
            
            if (currentSegmentProgress >= 1) {
                currentSegmentProgress = 0;
                currentSegmentStart++;
                
                if (currentSegmentStart >= totalPoints - 1) {
                    if (this.options.loop) {
                        currentSegmentStart = 0;
                        currentSegmentProgress = 0;
                    } else {
                        this.currentPointIndex = totalPoints - 1;
                        this.updateProgress();
                        this.isPlaying = false;
                        
                        if (this.onComplete) {
                            this.onComplete();
                        }
                        return;
                    }
                }
                
                this.currentPointIndex = currentSegmentStart;
                
                if (this.onPointReached) {
                    this.onPointReached(currentSegmentStart, points[currentSegmentStart]);
                }
            }
            
            if (currentSegmentStart < totalPoints - 1) {
                const from = points[currentSegmentStart];
                const to = points[currentSegmentStart + 1];
                
                const x = Utils.lerp(from.x, to.x, currentSegmentProgress);
                const z = Utils.lerp(from.z, to.z, currentSegmentProgress);
                
                this.updatePlayerPosition(x, z);
                
                this.currentPointIndex = currentSegmentStart;
                this.updateProgress();
            }
            
            this.animationId = requestAnimationFrame(animate);
        };
        
        this.animationId = requestAnimationFrame(animate);
    }
    
    updatePlayerPosition(x, z) {
        if (this.playerMarker) {
            this.playerMarker.position.x = x;
            this.playerMarker.position.z = z;
        }
    }
    
    updateProgress() {
        if (this.onProgress) {
            const total = this.route.points ? this.route.points.length : 0;
            const current = this.currentPointIndex + 1;
            this.onProgress(current, total);
        }
    }
    
    goToPoint(index) {
        if (!this.route || !this.route.points) return;
        
        index = Math.max(0, Math.min(index, this.route.points.length - 1));
        this.currentPointIndex = index;
        
        const point = this.route.points[index];
        this.updatePlayerPosition(point.x, point.z);
        this.updateProgress();
    }
    
    getProgress() {
        return {
            currentPoint: this.currentPointIndex,
            totalPoints: this.route.points ? this.route.points.length : 0,
            isPlaying: this.isPlaying,
            isPaused: this.isPaused
        };
    }
    
    destroy() {
        this.stop();
    }
}
