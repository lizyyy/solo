class Gate {
    constructor(id, processingTime = 3) {
        this.id = id;
        this.processingTime = processingTime;
        this.currentVehicle = null;
        this.processingStartTime = null;
        this.processedCount = 0;
        this.totalProcessingTime = 0;
        this.status = 'idle';
    }

    setProcessingTime(processingTime) {
        this.processingTime = processingTime;
    }

    isAvailable() {
        return this.status === 'idle' && this.currentVehicle === null;
    }

    isProcessing() {
        return this.status === 'processing' && this.currentVehicle !== null;
    }

    getProgress(currentTime) {
        if (!this.isProcessing()) return 0;
        const elapsed = currentTime - this.processingStartTime;
        return Math.min((elapsed / this.processingTime) * 100, 100);
    }

    startProcessing(vehicle, currentTime) {
        if (!this.isAvailable()) {
            return false;
        }
        this.currentVehicle = vehicle;
        this.processingStartTime = currentTime;
        this.status = 'processing';
        vehicle.startProcessing(this.id, currentTime);
        return true;
    }

    checkCompletion(currentTime) {
        if (!this.isProcessing()) {
            return null;
        }
        const elapsed = currentTime - this.processingStartTime;
        if (elapsed >= this.processingTime) {
            const completedVehicle = this.completeProcessing(currentTime);
            return completedVehicle;
        }
        return null;
    }

    completeProcessing(currentTime) {
        if (this.currentVehicle === null) {
            return null;
        }
        const actualProcessingTime = currentTime - this.processingStartTime;
        this.currentVehicle.completeProcessing(currentTime);
        this.processedCount++;
        this.totalProcessingTime += actualProcessingTime;
        const completedVehicle = this.currentVehicle;
        this.currentVehicle = null;
        this.processingStartTime = null;
        this.status = 'idle';
        return completedVehicle;
    }

    getUtilizationRate(totalSimulationTime) {
        if (totalSimulationTime === 0) return 0;
        return (this.totalProcessingTime / totalSimulationTime) * 100;
    }

    getAverageProcessingTime() {
        if (this.processedCount === 0) return 0;
        return this.totalProcessingTime / this.processedCount;
    }

    reset() {
        this.currentVehicle = null;
        this.processingStartTime = null;
        this.processedCount = 0;
        this.totalProcessingTime = 0;
        this.status = 'idle';
    }

    toJSON(currentTime = 0) {
        return {
            id: this.id,
            status: this.status,
            currentVehicle: this.currentVehicle ? this.currentVehicle.toJSON() : null,
            processingTime: this.processingTime,
            progress: this.getProgress(currentTime),
            processedCount: this.processedCount,
            totalProcessingTime: this.totalProcessingTime
        };
    }
}

class GateManager {
    constructor(config = {}) {
        this.gates = [];
        this.totalGates = config.totalGates || 5;
        this.activeGates = config.activeGates || 5;
        this.processingTime = config.processingTime || 3;
        this.initGates();
    }

    initGates() {
        this.gates = [];
        for (let i = 1; i <= this.totalGates; i++) {
            const gate = new Gate(i, this.processingTime);
            if (i > this.activeGates) {
                gate.status = 'inactive';
            }
            this.gates.push(gate);
        }
    }

    setConfig(config) {
        if (config.totalGates !== undefined) this.totalGates = config.totalGates;
        if (config.activeGates !== undefined) this.activeGates = config.activeGates;
        if (config.processingTime !== undefined) this.processingTime = config.processingTime;
        
        this.initGates();
    }

    setActiveGates(count) {
        this.activeGates = Math.min(count, this.totalGates);
        this.gates.forEach((gate, index) => {
            if (index < this.activeGates) {
                if (gate.status === 'inactive') {
                    gate.status = 'idle';
                }
            } else {
                if (gate.status === 'idle') {
                    gate.status = 'inactive';
                }
            }
        });
    }

    getActiveGates() {
        return this.gates.filter(gate => gate.status !== 'inactive');
    }

    getAvailableGates() {
        return this.gates.filter(gate => gate.isAvailable());
    }

    getBusyGates() {
        return this.gates.filter(gate => gate.isProcessing());
    }

    getInactiveGates() {
        return this.gates.filter(gate => gate.status === 'inactive');
    }

    assignVehicle(vehicle, currentTime) {
        const availableGates = this.getAvailableGates();
        if (availableGates.length === 0) {
            return false;
        }
        const gate = availableGates[0];
        return gate.startProcessing(vehicle, currentTime);
    }

    processCompletedVehicles(currentTime) {
        const completedVehicles = [];
        this.gates.forEach(gate => {
            const completed = gate.checkCompletion(currentTime);
            if (completed) {
                completedVehicles.push(completed);
            }
        });
        return completedVehicles;
    }

    getTotalProcessedCount() {
        return this.gates.reduce((sum, gate) => sum + gate.processedCount, 0);
    }

    getAverageUtilizationRate(totalSimulationTime) {
        const activeGates = this.getActiveGates();
        if (activeGates.length === 0) return 0;
        const totalUtilization = activeGates.reduce((sum, gate) => {
            return sum + gate.getUtilizationRate(totalSimulationTime);
        }, 0);
        return totalUtilization / activeGates.length;
    }

    getGateStatus(currentTime) {
        return this.gates.map(gate => gate.toJSON(currentTime));
    }

    reset() {
        this.gates.forEach(gate => gate.reset());
    }

    toJSON(currentTime = 0) {
        return {
            totalGates: this.totalGates,
            activeGates: this.activeGates,
            processingTime: this.processingTime,
            gates: this.getGateStatus(currentTime),
            totalProcessed: this.getTotalProcessedCount()
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Gate, GateManager };
}
