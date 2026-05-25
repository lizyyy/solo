class RobotController {
    constructor(sceneManager, pathfinding) {
        this.sceneManager = sceneManager;
        this.pathfinding = pathfinding;
        
        this.position = { x: 0, z: 0 };
        this.rotation = 0;
        this.battery = 100;
        this.maxBattery = 100;
        this.speed = 5;
        this.status = 'idle';
        
        this.isRunning = false;
        this.isPaused = false;
        this.playbackSpeed = 1.0;
        this.currentTime = 0;
        this.totalTime = 0;
        
        this.currentSegmentIndex = 0;
        this.currentPathIndex = 0;
        this.segments = [];
        this.fullPath = [];
        
        this.inspectedPoints = new Set();
        this.eventLog = [];
        this.timeline = [];
        
        this.isInspecting = false;
        this.inspectRemainingTime = 0;
        this.currentInspectPoint = null;
        
        this.isCharging = false;
        this.chargingRemainingTime = 0;
        
        this.chargerPosition = null;
        this.lowBatteryThreshold = 20;
        this.returningToCharger = false;
        
        this.onUpdate = null;
        this.onComplete = null;
        this.onLowBattery = null;
        
        this.animationFrame = null;
        this.lastTimestamp = 0;
    }

    initialize(startPosition) {
        this.position = { ...startPosition };
        this.battery = this.maxBattery;
        this.status = 'idle';
        this.currentTime = 0;
        this.currentSegmentIndex = 0;
        this.currentPathIndex = 0;
        this.inspectedPoints.clear();
        this.eventLog = [];
        this.timeline = [];
        this.returningToCharger = false;
        this.isInspecting = false;
        this.inspectRemainingTime = 0;
        this.currentInspectPoint = null;
        this.isCharging = false;
        this.chargingRemainingTime = 0;
        
        this.sceneManager.createRobot(startPosition);
        this.sceneManager.setRobotStatus('idle');
        this.logEvent('初始化', `机器人在位置 (${startPosition.x}, ${startPosition.z}) 准备就绪`);
    }

    setChargerPosition(position) {
        this.chargerPosition = position;
    }

    planRoute(inspectionPoints) {
        if (this.chargerPosition) {
            this.initialize(this.chargerPosition);
        }
        
        const result = this.pathfinding.calculateFullRoute(
            this.position,
            inspectionPoints,
            this.chargerPosition
        );
        
        this.segments = result.segments;
        this.fullPath = this.pathfinding.getFullPath(result.segments);
        
        this.calculateTotalTime();
        this.buildTimeline();
        
        if (this.fullPath.length > 0) {
            this.sceneManager.drawPath(this.fullPath);
        }
        
        this.logEvent('路径规划', `规划完成，共 ${this.segments.length} 段路径，总距离 ${result.totalDistance.toFixed(1)} 米`);
        
        if (result.hasCollision) {
            result.collisions.forEach(c => {
                this.logEvent('警告', `无法到达 (${c.to.x}, ${c.to.z})，存在障碍物阻挡`);
            });
        }
        
        return result;
    }

    calculateTotalTime() {
        this.totalTime = 0;
        
        for (const segment of this.segments) {
            const moveTime = segment.distance / this.speed;
            this.totalTime += moveTime;
            
            if (segment.targetPoint && !segment.isReturn) {
                this.totalTime += segment.targetPoint.duration || 5;
            }
        }
        
        return this.totalTime;
    }

    buildTimeline() {
        this.timeline = [];
        let accumulatedTime = 0;
        
        for (let i = 0; i < this.segments.length; i++) {
            const segment = this.segments[i];
            const moveTime = segment.distance / this.speed;
            
            this.timeline.push({
                time: accumulatedTime,
                type: 'move_start',
                segmentIndex: i,
                from: segment.from,
                to: segment.to
            });
            
            accumulatedTime += moveTime;
            
            this.timeline.push({
                time: accumulatedTime,
                type: 'move_end',
                segmentIndex: i,
                position: segment.to
            });
            
            if (segment.targetPoint && !segment.isReturn) {
                const inspectDuration = segment.targetPoint.duration || 5;
                
                this.timeline.push({
                    time: accumulatedTime,
                    type: 'inspect_start',
                    point: segment.targetPoint
                });
                
                accumulatedTime += inspectDuration;
                
                this.timeline.push({
                    time: accumulatedTime,
                    type: 'inspect_end',
                    point: segment.targetPoint
                });
            }
        }
        
        return this.timeline;
    }

    start() {
        if (this.segments.length === 0) {
            this.logEvent('错误', '没有规划的路径，请先规划路径');
            return false;
        }
        
        this.isRunning = true;
        this.isPaused = false;
        this.status = 'moving';
        this.sceneManager.setRobotStatus('moving');
        this.lastTimestamp = performance.now();
        
        this.logEvent('开始巡检', '机器人开始执行巡检任务');
        this.animate();
        
        return true;
    }

    pause() {
        this.isPaused = !this.isPaused;
        
        if (this.isPaused) {
            this.status = 'idle';
            this.sceneManager.setRobotStatus('idle');
            this.logEvent('暂停', '巡检任务已暂停');
        } else {
            this.status = 'moving';
            this.sceneManager.setRobotStatus('moving');
            this.lastTimestamp = performance.now();
            this.logEvent('继续', '巡检任务继续执行');
            this.animate();
        }
    }

    stop() {
        this.isRunning = false;
        this.isPaused = false;
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        this.status = 'idle';
        this.sceneManager.setRobotStatus('idle');
    }

    reset() {
        this.stop();
        this.currentTime = 0;
        this.currentSegmentIndex = 0;
        this.currentPathIndex = 0;
        this.inspectedPoints.clear();
        this.returningToCharger = false;
        this.isInspecting = false;
        this.inspectRemainingTime = 0;
        this.currentInspectPoint = null;
        this.isCharging = false;
        this.chargingRemainingTime = 0;
        
        if (this.chargerPosition) {
            this.position = { ...this.chargerPosition };
            this.rotation = 0;
            this.sceneManager.updateRobotPosition(this.position, this.rotation);
        }
        
        this.battery = this.maxBattery;
        this.eventLog = [];
        
        if (this.fullPath.length > 0) {
            this.sceneManager.drawPath(this.fullPath);
        }
        
        this.updateUI();
        this.logEvent('重置', '机器人状态已重置');
    }

    animate() {
        if (!this.isRunning || this.isPaused) return;
        
        const now = performance.now();
        const delta = (now - this.lastTimestamp) / 1000 * this.playbackSpeed;
        this.lastTimestamp = now;
        
        this.update(delta);
        
        if (this.isRunning && !this.isPaused) {
            this.animationFrame = requestAnimationFrame(() => this.animate());
        }
    }

    update(deltaTime) {
        if (this.currentSegmentIndex >= this.segments.length) {
            this.completeMission();
            return;
        }
        
        this.currentTime += deltaTime;
        
        if (this.isInspecting) {
            this.updateInspecting(deltaTime);
            this.updateUI();
            return;
        }
        
        if (this.isCharging) {
            this.updateCharging(deltaTime);
            this.updateUI();
            return;
        }
        
        const segment = this.segments[this.currentSegmentIndex];
        
        if (this.currentPathIndex < segment.path.length - 1) {
            this.moveAlongPath(segment, deltaTime);
        } else {
            this.handleSegmentEnd(segment);
        }
        
        this.updateUI();
    }
    
    updateInspecting(deltaTime) {
        this.inspectRemainingTime -= deltaTime;
        
        const batteryConsumption = deltaTime * 0.2;
        this.battery = Math.max(0, this.battery - batteryConsumption);
        
        if (this.inspectRemainingTime <= 0) {
            this.finishInspecting();
        }
    }
    
    updateCharging(deltaTime) {
        this.chargingRemainingTime -= deltaTime;
        
        this.battery = Math.min(this.maxBattery, this.battery + deltaTime * 10);
        
        if (this.battery >= this.maxBattery || this.chargingRemainingTime <= 0) {
            this.finishCharging();
        }
    }

    moveAlongPath(segment, deltaTime) {
        const currentTarget = segment.path[this.currentPathIndex + 1];
        const dx = currentTarget.x - this.position.x;
        const dz = currentTarget.z - this.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < 0.1) {
            this.currentPathIndex++;
            return;
        }
        
        const moveDistance = this.speed * deltaTime;
        const ratio = Math.min(moveDistance / distance, 1);
        
        this.position.x += dx * ratio;
        this.position.z += dz * ratio;
        
        this.rotation = Math.atan2(dx, dz);
        this.sceneManager.updateRobotPosition(this.position, this.rotation);
        
        const batteryConsumption = (moveDistance * 0.5) + (deltaTime * 0.1);
        this.battery = Math.max(0, this.battery - batteryConsumption);
        
        this.checkBatteryLevel(segment);
        
        if (this.onUpdate) {
            this.onUpdate(this.getState());
        }
    }

    handleSegmentEnd(segment) {
        if (segment.targetPoint && !segment.isReturn) {
            if (!this.inspectedPoints.has(segment.targetPoint.id)) {
                this.startInspecting(segment.targetPoint);
                return;
            }
        }
        
        if (segment.isReturn) {
            this.startCharging();
            return;
        }
        
        this.currentSegmentIndex++;
        this.currentPathIndex = 0;
        
        if (this.currentSegmentIndex < this.segments.length) {
            this.status = 'moving';
            this.sceneManager.setRobotStatus('moving');
        }
    }

    startInspecting(point) {
        this.isInspecting = true;
        this.inspectRemainingTime = point.duration || 5;
        this.currentInspectPoint = point;
        this.inspectedPoints.add(point.id);
        
        this.status = 'inspecting';
        this.sceneManager.setRobotStatus('inspecting');
        
        point.mesh.material.color.setHex(0x81C784);
        
        this.logEvent('巡检', `正在巡检 ${point.name} (${point.x}, ${point.z})，停留 ${this.inspectRemainingTime} 秒`);
    }
    
    finishInspecting() {
        const point = this.currentInspectPoint;
        
        this.isInspecting = false;
        this.inspectRemainingTime = 0;
        this.currentInspectPoint = null;
        
        if (point && point.mesh) {
            point.mesh.material.color.setHex(0x4CAF50);
        }
        
        this.logEvent('完成', `${point?.name || '巡检点'} 巡检完成`);
        
        this.currentSegmentIndex++;
        this.currentPathIndex = 0;
        this.status = 'moving';
        this.sceneManager.setRobotStatus('moving');
    }

    checkBatteryLevel(currentSegment) {
        if (this.returningToCharger) return;
        
        if (this.battery <= this.lowBatteryThreshold && this.chargerPosition) {
            const distToCharger = this.pathfinding.calculatePathDistance(
                this.pathfinding.findPath(this.position.x, this.position.z, 
                    this.chargerPosition.x, this.chargerPosition.z)
            );
            
            const batteryNeeded = distToCharger * 0.5;
            
            if (this.battery <= batteryNeeded + 5) {
                this.initiateReturnToCharger();
            }
        }
    }

    initiateReturnToCharger() {
        this.returningToCharger = true;
        this.status = 'moving';
        this.sceneManager.setRobotStatus('lowBattery');
        
        const returnPath = this.pathfinding.findPath(
            this.position.x, this.position.z,
            this.chargerPosition.x, this.chargerPosition.z
        );
        
        if (returnPath) {
            this.segments.splice(this.currentSegmentIndex, 0, {
                from: { ...this.position },
                to: { ...this.chargerPosition },
                path: returnPath,
                distance: this.pathfinding.calculatePathDistance(returnPath),
                isReturn: true,
                isEmergency: true
            });
            
            this.currentPathIndex = 0;
            
            this.logEvent('低电量', `电量过低，紧急返航到充电桩。当前电量: ${this.battery.toFixed(1)}%`);
            
            if (this.onLowBattery) {
                this.onLowBattery(this.battery);
            }
        }
    }

    startCharging() {
        this.isCharging = true;
        this.chargingRemainingTime = 3600;
        this.status = 'charging';
        this.sceneManager.setRobotStatus('charging');
        this.logEvent('充电', '机器人到达充电桩，开始充电');
    }
    
    finishCharging() {
        this.isCharging = false;
        this.chargingRemainingTime = 0;
        this.battery = this.maxBattery;
        
        if (this.returningToCharger && this.currentSegmentIndex < this.segments.length - 1) {
            this.logEvent('充电完成', '电量已满，继续执行未完成的巡检任务');
            this.returningToCharger = false;
            this.currentSegmentIndex++;
            this.currentPathIndex = 0;
            this.status = 'moving';
            this.sceneManager.setRobotStatus('moving');
        } else {
            this.completeMission();
        }
    }

    completeMission() {
        this.stop();
        this.status = 'idle';
        this.sceneManager.setRobotStatus('idle');
        this.logEvent('任务完成', `巡检任务完成！共巡检 ${this.inspectedPoints.size} 个点`);
        
        if (this.onComplete) {
            this.onComplete(this.getReport());
        }
    }

    seekTo(time) {
        this.currentTime = Math.max(0, Math.min(time, this.totalTime));
        
        let accumulatedTime = 0;
        let targetSegment = 0;
        let timeInSegment = 0;
        
        for (let i = 0; i < this.segments.length; i++) {
            const segment = this.segments[i];
            const moveTime = segment.distance / this.speed;
            const inspectTime = (segment.targetPoint && !segment.isReturn) ? 
                (segment.targetPoint.duration || 5) : 0;
            const segmentTotal = moveTime + inspectTime;
            
            if (accumulatedTime + segmentTotal >= this.currentTime) {
                targetSegment = i;
                timeInSegment = this.currentTime - accumulatedTime;
                break;
            }
            
            accumulatedTime += segmentTotal;
        }
        
        this.currentSegmentIndex = targetSegment;
        this.isInspecting = false;
        this.isCharging = false;
        
        const segment = this.segments[targetSegment];
        if (segment) {
            const moveTime = segment.distance / this.speed;
            const inspectTime = (segment.targetPoint && !segment.isReturn) ? 
                (segment.targetPoint.duration || 5) : 0;
            
            if (timeInSegment <= moveTime) {
                const progress = timeInSegment / moveTime;
                const pathIndex = Math.floor(progress * (segment.path.length - 1));
                this.currentPathIndex = pathIndex;
                
                if (pathIndex < segment.path.length) {
                    this.position = { ...segment.path[pathIndex] };
                    if (pathIndex < segment.path.length - 1) {
                        const next = segment.path[pathIndex + 1];
                        this.rotation = Math.atan2(
                            next.x - this.position.x,
                            next.z - this.position.z
                        );
                    }
                }
                
                this.status = 'moving';
                this.sceneManager.setRobotStatus('moving');
            } else if (segment.targetPoint && !segment.isReturn) {
                this.position = { ...segment.to };
                this.currentPathIndex = segment.path.length - 1;
                
                this.isInspecting = true;
                this.inspectRemainingTime = inspectTime - (timeInSegment - moveTime);
                this.currentInspectPoint = segment.targetPoint;
                
                this.status = 'inspecting';
                this.sceneManager.setRobotStatus('inspecting');
                
                if (segment.targetPoint.mesh) {
                    segment.targetPoint.mesh.material.color.setHex(0x81C784);
                }
            } else if (segment.isReturn) {
                this.position = { ...segment.to };
                this.currentPathIndex = segment.path.length - 1;
                
                this.isCharging = true;
                this.chargingRemainingTime = 3600;
                
                this.status = 'charging';
                this.sceneManager.setRobotStatus('charging');
            }
            
            this.sceneManager.updateRobotPosition(this.position, this.rotation);
        }
        
        this.updateUI();
    }

    setPlaybackSpeed(speed) {
        this.playbackSpeed = speed;
        this.logEvent('速度调整', `回放速度设置为 ${speed}x`);
    }

    updateUI() {
        const batteryFill = document.getElementById('battery-fill');
        const batteryValue = document.getElementById('battery-value');
        const batteryPercent = (this.battery / this.maxBattery) * 100;
        
        batteryFill.style.width = `${batteryPercent}%`;
        batteryValue.textContent = `${this.battery.toFixed(1)}%`;
        
        batteryFill.classList.remove('low', 'medium');
        if (batteryPercent <= 20) {
            batteryFill.classList.add('low');
        } else if (batteryPercent <= 50) {
            batteryFill.classList.add('medium');
        }
        
        document.getElementById('position-value').textContent = 
            `(${this.position.x.toFixed(1)}, ${this.position.z.toFixed(1)})`;
        
        const totalPoints = this.segments.filter(s => s.targetPoint && !s.isReturn).length;
        document.getElementById('progress-value').textContent = 
            `${this.inspectedPoints.size}/${totalPoints}`;
        
        const minutes = Math.floor(this.currentTime / 60);
        const seconds = Math.floor(this.currentTime % 60);
        document.getElementById('time-value').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const timelineSlider = document.getElementById('timeline-slider');
        timelineSlider.max = this.totalTime;
        timelineSlider.value = this.currentTime;
        
        document.getElementById('timeline-end').textContent = `${Math.floor(this.totalTime)}s`;
    }

    logEvent(type, message) {
        const event = {
            timestamp: new Date().toISOString(),
            time: this.currentTime,
            type: type,
            message: message,
            battery: this.battery,
            position: { ...this.position }
        };
        
        this.eventLog.push(event);
        this.sceneManager.updateStatus(`[${type}] ${message}`);
    }

    getState() {
        return {
            position: { ...this.position },
            rotation: this.rotation,
            battery: this.battery,
            status: this.status,
            currentTime: this.currentTime,
            totalTime: this.totalTime,
            inspectedCount: this.inspectedPoints.size,
            isRunning: this.isRunning,
            isPaused: this.isPaused
        };
    }

    getReport() {
        const totalDistance = this.segments.reduce((sum, s) => sum + s.distance, 0);
        const totalInspectTime = this.segments
            .filter(s => s.targetPoint && !s.isReturn)
            .reduce((sum, s) => sum + (s.targetPoint.duration || 5), 0);
        
        return {
            startTime: this.eventLog[0]?.timestamp || new Date().toISOString(),
            endTime: new Date().toISOString(),
            totalTime: this.currentTime,
            totalDistance: totalDistance,
            totalInspectTime: totalInspectTime,
            batteryUsed: this.maxBattery - this.battery,
            pointsInspected: this.inspectedPoints.size,
            totalPoints: this.segments.filter(s => s.targetPoint && !s.isReturn).length,
            events: [...this.eventLog],
            route: this.segments.map(s => ({
                from: s.from,
                to: s.to,
                distance: s.distance,
                isReturn: s.isReturn || false,
                pointName: s.targetPoint?.name || '充电桩'
            }))
        };
    }
}