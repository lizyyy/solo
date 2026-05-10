class Vehicle {
    constructor(id, arrivalTime) {
        this.id = id;
        this.arrivalTime = arrivalTime;
        this.processingStartTime = null;
        this.processingEndTime = null;
        this.gateId = null;
        this.status = 'waiting';
        this.isOverflow = false;
    }

    getWaitTime(currentTime) {
        if (this.processingStartTime === null) {
            return currentTime - this.arrivalTime;
        }
        return this.processingStartTime - this.arrivalTime;
    }

    getProcessingTime() {
        if (this.processingEndTime === null || this.processingStartTime === null) {
            return 0;
        }
        return this.processingEndTime - this.processingStartTime;
    }

    getTotalTime() {
        if (this.processingEndTime === null) {
            return 0;
        }
        return this.processingEndTime - this.arrivalTime;
    }

    startProcessing(gateId, startTime) {
        this.status = 'processing';
        this.gateId = gateId;
        this.processingStartTime = startTime;
    }

    completeProcessing(endTime) {
        this.status = 'completed';
        this.processingEndTime = endTime;
    }

    setOverflow() {
        this.status = 'overflow';
        this.isOverflow = true;
    }

    toJSON() {
        return {
            id: this.id,
            arrivalTime: this.arrivalTime,
            processingStartTime: this.processingStartTime,
            processingEndTime: this.processingEndTime,
            gateId: this.gateId,
            status: this.status,
            isOverflow: this.isOverflow,
            waitTime: this.processingStartTime ? this.getWaitTime(0) : 0,
            processingTime: this.getProcessingTime(),
            totalTime: this.getTotalTime()
        };
    }
}

class VehicleGenerator {
    constructor(config) {
        this.vehicleIdCounter = 0;
        this.peakArrivalRate = config.peakArrivalRate || 30;
        this.offPeakArrivalRate = config.offPeakArrivalRate || 10;
        this.peakStartTime = config.peakStartTime || 6;
        this.peakEndTime = config.peakEndTime || 18;
    }

    setConfig(config) {
        if (config.peakArrivalRate !== undefined) this.peakArrivalRate = config.peakArrivalRate;
        if (config.offPeakArrivalRate !== undefined) this.offPeakArrivalRate = config.offPeakArrivalRate;
        if (config.peakStartTime !== undefined) this.peakStartTime = config.peakStartTime;
        if (config.peakEndTime !== undefined) this.peakEndTime = config.peakEndTime;
    }

    isPeakTime(currentHour) {
        return currentHour >= this.peakStartTime && currentHour < this.peakEndTime;
    }

    getCurrentArrivalRate(currentHour) {
        return this.isPeakTime(currentHour) ? this.peakArrivalRate : this.offPeakArrivalRate;
    }

    generateVehicle(currentTime) {
        this.vehicleIdCounter++;
        return new Vehicle(this.vehicleIdCounter, currentTime);
    }

    shouldGenerateVehicle(currentTime, lastGenerationTime) {
        const currentHour = currentTime / 60;
        const arrivalRate = this.getCurrentArrivalRate(currentHour);
        const interval = 60 / arrivalRate;
        return (currentTime - lastGenerationTime) >= interval;
    }

    getNextGenerationTime(currentTime, lastGenerationTime) {
        const currentHour = currentTime / 60;
        const arrivalRate = this.getCurrentArrivalRate(currentHour);
        const interval = 60 / arrivalRate;
        return lastGenerationTime + interval;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Vehicle, VehicleGenerator };
}
