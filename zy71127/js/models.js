class Person {
    constructor(id, x, z, targetGateId) {
        this.id = id;
        this.x = x;
        this.z = z;
        this.targetX = x;
        this.targetZ = z;
        this.targetGateId = targetGateId;
        this.state = 'walking';
        this.arrivalTime = 0;
        this.enterTime = null;
        this.scanStartTime = null;
        this.leaveTime = null;
        this.waitTime = 0;
        this.speed = CONFIG.SIMULATION.PERSON_SPEED * (0.8 + Math.random() * 0.4);
        this.color = CONFIG.COLORS.PERSON_NORMAL;
        this.patience = 100;
        this.queuePosition = -1;
        this.mesh = null;
    }

    update(deltaTime) {
        const dx = this.targetX - this.x;
        const dz = this.targetZ - this.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 0.1) {
            const moveSpeed = this.speed * deltaTime;
            this.x += (dx / dist) * Math.min(moveSpeed, dist);
            this.z += (dz / dist) * Math.min(moveSpeed, dist);
        }

        if (this.state === 'queueing') {
            this.waitTime += deltaTime;
            this.patience -= deltaTime * 2;
            if (this.patience < 30) {
                this.color = CONFIG.COLORS.PERSON_ANGRY;
            } else if (this.patience < 60) {
                this.color = CONFIG.COLORS.PERSON_WAITING;
            }
        }

        if (this.mesh) {
            this.mesh.position.x = this.x;
            this.mesh.position.z = this.z;
            this.mesh.material.color.setHex(this.color);
        }
    }

    setTarget(x, z) {
        this.targetX = x;
        this.targetZ = z;
    }
}

class Gate {
    constructor(id, x, open = true, scanRate = 1) {
        this.id = id;
        this.x = x;
        this.z = -10;
        this.open = open;
        this.scanRate = scanRate;
        this.queue = [];
        this.maxQueueLength = 20;
        this.currentPerson = null;
        this.scanProgress = 0;
        this.totalProcessed = 0;
        this.mesh = null;
        this.queueIndicator = null;
    }

    update(deltaTime) {
        if (!this.open) return;

        if (this.currentPerson) {
            this.scanProgress += deltaTime * this.scanRate;
            if (this.scanProgress >= CONFIG.SIMULATION.SCAN_TIME) {
                this.currentPerson.leaveTime = simulation.currentTime;
                this.currentPerson.state = 'entered';
                this.currentPerson.setTarget(this.x, -25);
                this.totalProcessed++;
                this.currentPerson = null;
                this.scanProgress = 0;
            }
        } else if (this.queue.length > 0) {
            this.currentPerson = this.queue.shift();
            this.currentPerson.state = 'scanning';
            this.currentPerson.scanStartTime = simulation.currentTime;
            this.currentPerson.setTarget(this.x, this.z);
            this.scanProgress = 0;
        }

        this.updateQueuePositions();
    }

    addToQueue(person) {
        if (this.queue.length >= this.maxQueueLength) return false;
        person.state = 'queueing';
        person.queuePosition = this.queue.length;
        this.queue.push(person);
        return true;
    }

    updateQueuePositions() {
        for (let i = 0; i < this.queue.length; i++) {
            const person = this.queue[i];
            person.queuePosition = i;
            person.setTarget(this.x, this.z + 3 + i * 1.5);
        }
    }

    getQueueLength() {
        return this.queue.length + (this.currentPerson ? 1 : 0);
    }

    toggle() {
        this.open = !this.open;
        if (this.mesh) {
            this.mesh.material.color.setHex(
                this.open ? CONFIG.COLORS.GATE_OPEN : CONFIG.COLORS.GATE_CLOSED
            );
        }
    }
}

class Batch {
    constructor(id, time, count, spread) {
        this.id = id;
        this.time = time;
        this.count = count;
        this.spread = spread;
        this.spawned = 0;
        this.completed = false;
    }

    shouldSpawn(currentTime) {
        if (this.completed) return 0;
        if (currentTime < this.time) return 0;
        if (currentTime > this.time + this.spread) return 0;

        const elapsed = currentTime - this.time;
        const expected = Math.floor((elapsed / this.spread) * this.count);
        const toSpawn = expected - this.spawned;
        this.spawned = expected;

        if (this.spawned >= this.count) {
            this.completed = true;
        }

        return toSpawn;
    }
}

class ClosedArea {
    constructor(x, z, width, height) {
        this.x = x;
        this.z = z;
        this.width = width;
        this.height = height;
        this.mesh = null;
    }

    contains(px, pz) {
        return px >= this.x - this.width / 2 &&
               px <= this.x + this.width / 2 &&
               pz >= this.z - this.height / 2 &&
               pz <= this.z + this.height / 2;
    }
}

class Heatmap {
    constructor(width, height, cellSize = 2) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.grid = [];
        this.maxValue = 1;
        this.initGrid();
    }

    initGrid() {
        const cols = Math.ceil(this.width / this.cellSize);
        const rows = Math.ceil(this.height / this.cellSize);
        this.grid = Array(rows).fill(null).map(() => Array(cols).fill(0));
    }

    addPoint(x, z, value = 1) {
        const col = Math.floor((x + this.width / 2) / this.cellSize);
        const row = Math.floor((z + this.height / 2) / this.cellSize);
        
        if (row >= 0 && row < this.grid.length && col >= 0 && col < this.grid[0].length) {
            this.grid[row][col] += value;
            this.maxValue = Math.max(this.maxValue, this.grid[row][col]);
        }
    }

    getValue(x, z) {
        const col = Math.floor((x + this.width / 2) / this.cellSize);
        const row = Math.floor((z + this.height / 2) / this.cellSize);
        
        if (row >= 0 && row < this.grid.length && col >= 0 && col < this.grid[0].length) {
            return this.grid[row][col];
        }
        return 0;
    }

    getColor(x, z) {
        const value = this.getValue(x, z);
        const ratio = Math.min(value / this.maxValue, 1);
        
        if (ratio < 0.33) {
            return CONFIG.COLORS.HEATMAP_LOW;
        } else if (ratio < 0.66) {
            return CONFIG.COLORS.HEATMAP_MEDIUM;
        } else {
            return CONFIG.COLORS.HEATMAP_HIGH;
        }
    }

    reset() {
        this.initGrid();
        this.maxValue = 1;
    }
}
