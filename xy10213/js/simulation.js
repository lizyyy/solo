class Simulation {
    constructor(config = {}) {
        this.currentTime = 0;
        this.status = 'stopped';
        this.speed = 1;
        this.intervalId = null;
        this.lastGenerationTime = 0;
        this.totalGenerated = 0;
        this.totalProcessed = 0;
        this.processedVehicles = [];
        this.startTime = null;
        this.endTime = null;
        
        this.vehicleGenerator = new VehicleGenerator({
            peakArrivalRate: config.peakArrivalRate || 30,
            offPeakArrivalRate: config.offPeakArrivalRate || 10
        });
        
        this.queue = new Queue(config.maxQueueSize || 100);
        
        this.gateManager = new GateManager({
            totalGates: 20,
            activeGates: config.offPeakGates || 2,
            processingTime: config.processingTime || 3
        });
        
        this.strategyManager = new StrategyManager({
            peakStrategy: config.peakStrategy || 'fixed',
            offPeakStrategy: config.offPeakStrategy || 'fixed',
            peakGates: config.peakGates || 5,
            offPeakGates: config.offPeakGates || 2
        });
        
        this.analyzer = new PerformanceAnalyzer();
        this.eventLog = [];
        this.peakStats = {
            totalWaitTime: 0,
            vehicleCount: 0,
            totalGatesActive: 0,
            sampleCount: 0
        };
        this.offPeakStats = {
            totalWaitTime: 0,
            vehicleCount: 0,
            totalGatesActive: 0,
            sampleCount: 0
        };
    }

    setConfig(config) {
        if (config.peakArrivalRate !== undefined || config.offPeakArrivalRate !== undefined) {
            this.vehicleGenerator.setConfig({
                peakArrivalRate: config.peakArrivalRate,
                offPeakArrivalRate: config.offPeakArrivalRate
            });
        }
        
        if (config.maxQueueSize !== undefined) {
            this.queue.setMaxSize(config.maxQueueSize);
        }
        
        if (config.processingTime !== undefined) {
            this.gateManager.setConfig({ processingTime: config.processingTime });
        }
        
        this.strategyManager.setConfig({
            peakStrategy: config.peakStrategy,
            offPeakStrategy: config.offPeakStrategy,
            peakGates: config.peakGates,
            offPeakGates: config.offPeakGates
        });
    }

    setSpeed(speed) {
        this.speed = speed;
    }

    start() {
        if (this.status === 'running') return;
        
        if (this.status === 'stopped') {
            this.startTime = Date.now();
        }
        
        this.status = 'running';
        this.run();
    }

    pause() {
        if (this.status !== 'running') return;
        this.status = 'paused';
        if (this.intervalId) {
            clearTimeout(this.intervalId);
            this.intervalId = null;
        }
    }

    stop() {
        this.status = 'stopped';
        if (this.intervalId) {
            clearTimeout(this.intervalId);
            this.intervalId = null;
        }
        this.endTime = Date.now();
    }

    reset() {
        this.stop();
        this.currentTime = 0;
        this.lastGenerationTime = 0;
        this.totalGenerated = 0;
        this.totalProcessed = 0;
        this.processedVehicles = [];
        this.startTime = null;
        this.endTime = null;
        this.eventLog = [];
        
        this.queue.clear();
        this.gateManager.reset();
        this.strategyManager.reset();
        
        this.peakStats = {
            totalWaitTime: 0,
            vehicleCount: 0,
            totalGatesActive: 0,
            sampleCount: 0
        };
        this.offPeakStats = {
            totalWaitTime: 0,
            vehicleCount: 0,
            totalGatesActive: 0,
            sampleCount: 0
        };
    }

    run() {
        if (this.status !== 'running') return;
        
        const step = 0.1 * this.speed;
        this.step(step);
        
        const delay = Math.max(10, 100 / this.speed);
        this.intervalId = setTimeout(() => this.run(), delay);
    }

    step(deltaTime) {
        const previousTime = this.currentTime;
        this.currentTime += deltaTime;
        const currentHour = this.currentTime / 60;
        
        this.updateStrategy();
        this.generateVehicles();
        this.processCompletedVehicles();
        this.assignVehiclesToGates();
        this.collectStatistics(previousTime, currentHour);
    }

    updateStrategy() {
        const currentGates = this.strategyManager.currentGates;
        const newGatesCount = this.strategyManager.calculateGatesCount(
            this.currentTime,
            this.queue.size(),
            this.queue.maxSize,
            currentGates,
            20
        );
        
        if (newGatesCount !== currentGates) {
            this.gateManager.setActiveGates(newGatesCount);
            this.logEvent('strategy_change', {
                time: this.currentTime,
                oldGates: currentGates,
                newGates: newGatesCount,
                queueSize: this.queue.size()
            });
        }
    }

    generateVehicles() {
        while (this.vehicleGenerator.shouldGenerateVehicle(this.currentTime, this.lastGenerationTime)) {
            this.lastGenerationTime = this.vehicleGenerator.getNextGenerationTime(
                this.currentTime,
                this.lastGenerationTime
            );
            const vehicle = this.vehicleGenerator.generateVehicle(this.currentTime);
            const added = this.queue.enqueue(vehicle);
            this.totalGenerated++;
            
            if (added) {
                this.logEvent('vehicle_arrived', {
                    vehicleId: vehicle.id,
                    time: this.currentTime,
                    queueSize: this.queue.size()
                });
            } else {
                this.logEvent('vehicle_overflow', {
                    vehicleId: vehicle.id,
                    time: this.currentTime,
                    queueSize: this.queue.size()
                });
            }
        }
    }

    processCompletedVehicles() {
        const completed = this.gateManager.processCompletedVehicles(this.currentTime);
        completed.forEach(vehicle => {
            this.totalProcessed++;
            this.processedVehicles.push(vehicle);
            this.logEvent('vehicle_completed', {
                vehicleId: vehicle.id,
                gateId: vehicle.gateId,
                time: this.currentTime,
                waitTime: vehicle.getWaitTime(this.currentTime),
                processingTime: vehicle.getProcessingTime()
            });
        });
    }

    assignVehiclesToGates() {
        while (!this.queue.isEmpty() && this.gateManager.getAvailableGates().length > 0) {
            const vehicle = this.queue.peek();
            if (this.gateManager.assignVehicle(vehicle, this.currentTime)) {
                this.queue.dequeue();
                this.logEvent('vehicle_processing_started', {
                    vehicleId: vehicle.id,
                    gateId: vehicle.gateId,
                    time: this.currentTime,
                    waitTime: vehicle.getWaitTime(this.currentTime)
                });
            } else {
                break;
            }
        }
    }

    collectStatistics(previousTime, currentHour) {
        const isPeak = this.strategyManager.isPeakTime(currentHour);
        const previousIsPeak = this.strategyManager.isPeakTime(previousTime / 60);
        
        if (isPeak) {
            this.peakStats.sampleCount++;
            this.peakStats.totalGatesActive += this.gateManager.activeGates;
        } else {
            this.offPeakStats.sampleCount++;
            this.offPeakStats.totalGatesActive += this.gateManager.activeGates;
        }
        
        if (isPeak !== previousIsPeak) {
            this.logEvent('time_period_change', {
                time: this.currentTime,
                isPeak: isPeak,
                activeGates: this.gateManager.activeGates
            });
        }
    }

    logEvent(type, data) {
        this.eventLog.push({
            type: type,
            ...data
        });
    }

    getResults() {
        const totalSimulationTime = this.currentTime;
        const allProcessed = this.processedVehicles;
        const inQueue = this.queue.getVehicles();
        const overflow = this.queue.getOverflowVehicles();
        
        const totalWaitTime = allProcessed.reduce((sum, v) => sum + v.getWaitTime(this.currentTime), 0);
        const maxWaitTime = Math.max(
            ...allProcessed.map(v => v.getWaitTime(this.currentTime)),
            ...inQueue.map(v => v.getWaitTime(this.currentTime)),
            0
        );
        
        const peakVehicles = allProcessed.filter(v => {
            const arrivalHour = v.arrivalTime / 60;
            return this.strategyManager.isPeakTime(arrivalHour);
        });
        const offPeakVehicles = allProcessed.filter(v => {
            const arrivalHour = v.arrivalTime / 60;
            return !this.strategyManager.isPeakTime(arrivalHour);
        });
        
        const peakWaitTime = peakVehicles.reduce((sum, v) => sum + v.getWaitTime(this.currentTime), 0);
        const offPeakWaitTime = offPeakVehicles.reduce((sum, v) => sum + v.getWaitTime(this.currentTime), 0);
        
        return {
            totalSimulationTime: totalSimulationTime,
            totalGenerated: this.totalGenerated,
            totalProcessed: this.totalProcessed,
            remainingQueue: this.queue.size(),
            overflowCount: this.queue.overflowCount,
            overflowRate: this.queue.getOverflowRate(this.totalGenerated),
            queueUtilization: this.queue.getUtilizationRate(),
            maxQueueLength: this.queue.maxLengthReached,
            averageWaitTime: allProcessed.length > 0 ? totalWaitTime / allProcessed.length : 0,
            maxWaitTime: maxWaitTime,
            peakAverageWaitTime: peakVehicles.length > 0 ? peakWaitTime / peakVehicles.length : 0,
            offPeakAverageWaitTime: offPeakVehicles.length > 0 ? offPeakWaitTime / offPeakVehicles.length : 0,
            averageGateUtilization: this.gateManager.getAverageUtilizationRate(totalSimulationTime),
            peakAverageGates: this.peakStats.sampleCount > 0 
                ? Math.round(this.peakStats.totalGatesActive / this.peakStats.sampleCount) 
                : this.strategyManager.peakGates,
            offPeakAverageGates: this.offPeakStats.sampleCount > 0 
                ? Math.round(this.offPeakStats.totalGatesActive / this.offPeakStats.sampleCount) 
                : this.strategyManager.offPeakGates,
            strategyChangeCount: this.strategyManager.getChangeHistory().length,
            processedVehicles: allProcessed,
            eventLog: [...this.eventLog],
            strategyHistory: this.strategyManager.getChangeHistory(),
            gateStatus: this.gateManager.toJSON(this.currentTime),
            queueStatus: this.queue.toJSON()
        };
    }

    getAnalysis() {
        const results = this.getResults();
        const analysis = this.analyzer.analyze(results);
        const report = this.analyzer.generateBusinessReport(results, analysis);
        
        return {
            results: results,
            analysis: analysis,
            report: report
        };
    }

    getState() {
        return {
            currentTime: this.currentTime,
            status: this.status,
            speed: this.speed,
            queue: this.queue.getVehicles(),
            queueSize: this.queue.size(),
            overflowCount: this.queue.overflowCount,
            processedCount: this.totalProcessed,
            gates: this.gateManager.getGateStatus(this.currentTime),
            strategyInfo: this.strategyManager.getStrategyInfo(this.currentTime)
        };
    }

    moveVehicleInQueue(fromIndex, toIndex) {
        const success = this.queue.moveVehicle(fromIndex, toIndex);
        if (success) {
            this.logEvent('manual_queue_reorder', {
                time: this.currentTime,
                fromIndex: fromIndex,
                toIndex: toIndex
            });
        }
        return success;
    }

    moveVehicleToFront(vehicleId) {
        const success = this.queue.moveVehicleToFront(vehicleId);
        if (success) {
            this.logEvent('manual_priority', {
                time: this.currentTime,
                vehicleId: vehicleId,
                action: 'moved_to_front'
            });
        }
        return success;
    }

    toggleGate(gateId) {
        const success = this.gateManager.toggleGate(gateId);
        if (success) {
            const gate = this.gateManager.gates.find(g => g.id === gateId);
            this.logEvent('manual_gate_toggle', {
                time: this.currentTime,
                gateId: gateId,
                newStatus: gate ? gate.status : 'unknown'
            });
        }
        return success;
    }

    activateGate(gateId) {
        const success = this.gateManager.activateGate(gateId);
        if (success) {
            this.logEvent('manual_gate_activate', {
                time: this.currentTime,
                gateId: gateId
            });
        }
        return success;
    }

    deactivateGate(gateId) {
        const success = this.gateManager.deactivateGate(gateId);
        if (success) {
            this.logEvent('manual_gate_deactivate', {
                time: this.currentTime,
                gateId: gateId
            });
        }
        return success;
    }

    addManualVehicle() {
        const vehicle = this.vehicleGenerator.generateVehicle(this.currentTime);
        const added = this.queue.enqueue(vehicle);
        this.totalGenerated++;
        
        if (added) {
            this.logEvent('manual_vehicle_added', {
                vehicleId: vehicle.id,
                time: this.currentTime
            });
        } else {
            this.logEvent('manual_vehicle_overflow', {
                vehicleId: vehicle.id,
                time: this.currentTime
            });
        }
        
        return added;
    }

    getQueueVehicleIndex(vehicleId) {
        return this.queue.getVehicleIndexById(vehicleId);
    }

    getGateById(gateId) {
        return this.gateManager.gates.find(g => g.id === gateId);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Simulation };
}
