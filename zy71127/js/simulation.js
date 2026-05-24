class Simulation {
    constructor() {
        this.people = [];
        this.gates = [];
        this.batches = [];
        this.closedAreas = [];
        this.heatmap = new Heatmap(CONFIG.ARENA.WIDTH, CONFIG.ARENA.HEIGHT);
        this.currentTime = 0;
        this.simulationTime = 0;
        this.speed = 1;
        this.playing = false;
        this.totalPeople = 0;
        this.enteredPeople = 0;
        this.warnings = [];
        this.events = [];
        this.personIdCounter = 0;
        this.maxQueueLength = 0;
        this.totalWaitTime = 0;
        this.completedPeople = 0;
    }

    loadConfig(config) {
        this.reset();
        
        config.gates.forEach(g => {
            const gate = new Gate(g.id, g.x, g.open, g.scanRate);
            this.gates.push(gate);
        });

        config.batches.forEach(b => {
            this.batches.push(new Batch(b.id, b.time, b.count, b.spread));
        });

        config.closedAreas.forEach(a => {
            this.closedAreas.push(new ClosedArea(a.x, a.z, a.width, a.height));
        });
    }

    reset() {
        this.people = [];
        this.gates = [];
        this.batches = [];
        this.closedAreas = [];
        this.heatmap.reset();
        this.currentTime = 0;
        this.simulationTime = 0;
        this.totalPeople = 0;
        this.enteredPeople = 0;
        this.warnings = [];
        this.events = [];
        this.personIdCounter = 0;
        this.maxQueueLength = 0;
        this.totalWaitTime = 0;
        this.completedPeople = 0;
    }

    start() {
        this.playing = true;
    }

    pause() {
        this.playing = false;
    }

    setSpeed(speed) {
        this.speed = speed;
    }

    update(deltaTime) {
        if (!this.playing) return;

        const adjustedDelta = deltaTime * this.speed;
        this.simulationTime += adjustedDelta;
        this.currentTime = Math.floor(this.simulationTime);

        this.spawnBatches();
        this.updateGates(adjustedDelta);
        this.updatePeople(adjustedDelta);
        this.updateHeatmap();
        this.checkWarnings();
        this.cleanupPeople();
        this.updateStats();
    }

    spawnBatches() {
        this.batches.forEach(batch => {
            const toSpawn = batch.shouldSpawn(this.simulationTime);
            for (let i = 0; i < toSpawn; i++) {
                this.spawnPerson();
            }
        });
    }

    spawnPerson() {
        const x = (Math.random() - 0.5) * CONFIG.ARENA.WIDTH * 0.8;
        const z = CONFIG.ARENA.HEIGHT / 2 - 2;
        
        const openGates = this.gates.filter(g => g.open);
        openGates.sort((a, b) => a.getQueueLength() - b.getQueueLength());
        
        const targetGate = openGates.length > 0 ? openGates[0] : this.gates[0];
        
        const person = new Person(this.personIdCounter++, x, z, targetGate.id);
        person.arrivalTime = this.simulationTime;
        
        this.people.push(person);
        this.totalPeople++;
        
        this.addEvent('观众入场', `观众 ${person.id} 到达`);
    }

    updateGates(deltaTime) {
        this.gates.forEach(gate => {
            gate.update(deltaTime);
            this.maxQueueLength = Math.max(this.maxQueueLength, gate.getQueueLength());
        });
    }

    updatePeople(deltaTime) {
        this.people.forEach(person => {
            if (person.state === 'walking') {
                const gate = this.gates.find(g => g.id === person.targetGateId);
                if (gate && gate.open) {
                    const queuePos = gate.getQueueLength();
                    if (queuePos < gate.maxQueueLength) {
                        const distToGate = Math.abs(person.z - gate.z);
                        if (distToGate < 5) {
                            if (gate.addToQueue(person)) {
                                this.addEvent('排队', `观众 ${person.id} 加入闸机 ${gate.id} 队列`);
                            }
                        } else {
                            person.setTarget(gate.x, gate.z + 2);
                        }
                    } else {
                        const otherGate = this.findBestGate();
                        if (otherGate) {
                            person.targetGateId = otherGate.id;
                        }
                    }
                } else {
                    const otherGate = this.findBestGate();
                    if (otherGate) {
                        person.targetGateId = otherGate.id;
                    }
                }
            }
            
            person.update(deltaTime);
        });
    }

    findBestGate() {
        const openGates = this.gates.filter(g => g.open);
        if (openGates.length === 0) return null;
        return openGates.sort((a, b) => a.getQueueLength() - b.getQueueLength())[0];
    }

    updateHeatmap() {
        this.people.forEach(person => {
            if (person.state !== 'entered') {
                this.heatmap.addPoint(person.x, person.z);
            }
        });
    }

    checkWarnings() {
        this.gates.forEach(gate => {
            const queueLen = gate.getQueueLength();
            if (queueLen >= 15 && !this.hasWarning(`gate_${gate.id}_critical`)) {
                this.addWarning('danger', `闸机 ${gate.id} 队列过长 (${queueLen}人)`);
            } else if (queueLen >= 10 && !this.hasWarning(`gate_${gate.id}_warning`)) {
                this.addWarning('warning', `闸机 ${gate.id} 队列较长 (${queueLen}人)`);
            }
        });

        const queuingPeople = this.people.filter(p => p.state === 'queueing').length;
        if (queuingPeople >= 50 && !this.hasWarning('crowd_critical')) {
            this.addWarning('danger', `大规模排队预警: ${queuingPeople}人等待`);
        }
    }

    hasWarning(id) {
        return this.warnings.some(w => w.id === id && w.time > this.simulationTime - 10);
    }

    addWarning(type, message) {
        const warning = {
            id: `${type}_${Date.now()}`,
            type,
            message,
            time: this.simulationTime
        };
        this.warnings.push(warning);
        if (this.warnings.length > 20) {
            this.warnings.shift();
        }
    }

    addEvent(type, message) {
        this.events.push({
            type,
            message,
            time: this.simulationTime
        });
        if (this.events.length > 50) {
            this.events.shift();
        }
    }

    cleanupPeople() {
        this.people = this.people.filter(person => {
            if (person.state === 'entered' && person.z < -20) {
                this.enteredPeople++;
                this.completedPeople++;
                this.totalWaitTime += person.waitTime;
                return false;
            }
            return true;
        });
    }

    updateStats() {
        const queuingPeople = this.people.filter(p => p.state === 'queueing').length;
        const scanningPeople = this.people.filter(p => p.state === 'scanning').length;
        const avgWait = this.completedPeople > 0 ? this.totalWaitTime / this.completedPeople : 0;

        return {
            totalPeople: this.totalPeople,
            enteredPeople: this.enteredPeople,
            queuingPeople,
            scanningPeople,
            avgWaitTime: avgWait,
            maxQueueLen: this.maxQueueLength,
            currentTime: this.currentTime
        };
    }

    getReport() {
        const stats = this.updateStats();
        return {
            ...stats,
            gates: this.gates.map(g => ({
                id: g.id,
                open: g.open,
                processed: g.totalProcessed,
                queueLength: g.getQueueLength()
            })),
            batches: this.batches.map(b => ({
                id: b.id,
                total: b.count,
                spawned: b.spawned
            })),
            warnings: this.warnings,
            simulationTime: this.simulationTime
        };
    }
}

const simulation = new Simulation();
