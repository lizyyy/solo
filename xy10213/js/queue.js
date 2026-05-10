class Queue {
    constructor(maxSize = 100) {
        this.items = [];
        this.maxSize = maxSize;
        this.overflowCount = 0;
        this.overflowVehicles = [];
        this.maxLengthReached = 0;
    }

    enqueue(vehicle) {
        if (this.isFull()) {
            vehicle.setOverflow();
            this.overflowCount++;
            this.overflowVehicles.push(vehicle);
            return false;
        }
        this.items.push(vehicle);
        if (this.items.length > this.maxLengthReached) {
            this.maxLengthReached = this.items.length;
        }
        return true;
    }

    dequeue() {
        if (this.isEmpty()) {
            return null;
        }
        return this.items.shift();
    }

    peek() {
        if (this.isEmpty()) {
            return null;
        }
        return this.items[0];
    }

    isEmpty() {
        return this.items.length === 0;
    }

    isFull() {
        return this.items.length >= this.maxSize;
    }

    size() {
        return this.items.length;
    }

    clear() {
        this.items = [];
        this.overflowCount = 0;
        this.overflowVehicles = [];
        this.maxLengthReached = 0;
    }

    setMaxSize(maxSize) {
        this.maxSize = maxSize;
    }

    getOverflowRate(totalGenerated) {
        if (totalGenerated === 0) return 0;
        return (this.overflowCount / totalGenerated) * 100;
    }

    getUtilizationRate() {
        if (this.maxSize === 0) return 0;
        return (this.maxLengthReached / this.maxSize) * 100;
    }

    getAverageWaitTime(currentTime) {
        if (this.isEmpty()) return 0;
        const totalWaitTime = this.items.reduce((sum, vehicle) => {
            return sum + vehicle.getWaitTime(currentTime);
        }, 0);
        return totalWaitTime / this.items.length;
    }

    getMaxWaitTime(currentTime) {
        if (this.isEmpty()) return 0;
        return Math.max(...this.items.map(vehicle => vehicle.getWaitTime(currentTime)));
    }

    getVehicles() {
        return [...this.items];
    }

    getOverflowVehicles() {
        return [...this.overflowVehicles];
    }

    toJSON() {
        return {
            size: this.items.length,
            maxSize: this.maxSize,
            maxLengthReached: this.maxLengthReached,
            overflowCount: this.overflowCount,
            overflowVehicles: this.overflowVehicles.map(v => v.toJSON()),
            utilizationRate: this.getUtilizationRate()
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Queue };
}
