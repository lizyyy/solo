const DataStore = {
    batches: [],
    openings: [],
    consumptions: [],
    problems: [],
    logs: [],
    currentStore: 'store1',

    init() {
        this.loadFromStorage();
    },

    loadFromStorage() {
        const data = localStorage.getItem('coffeeRotationData');
        if (data) {
            const parsed = JSON.parse(data);
            this.batches = parsed.batches || [];
            this.openings = parsed.openings || [];
            this.consumptions = parsed.consumptions || [];
            this.problems = parsed.problems || [];
            this.logs = parsed.logs || [];
        }
    },

    saveToStorage() {
        localStorage.setItem('coffeeRotationData', JSON.stringify({
            batches: this.batches,
            openings: this.openings,
            consumptions: this.consumptions,
            problems: this.problems,
            logs: this.logs
        }));
    },

    generateId(prefix) {
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `${prefix}-${timestamp.slice(-6)}-${random}`;
    },

    addBatch(batch) {
        batch.id = this.generateId('BATCH');
        batch.store = this.currentStore;
        batch.status = batch.status || 'pending';
        batch.createdAt = new Date().toISOString();
        this.batches.push(batch);
        this.saveToStorage();
        return batch;
    },

    updateBatch(id, updates) {
        const index = this.batches.findIndex(b => b.id === id);
        if (index === -1) return null;
        this.batches[index] = { ...this.batches[index], ...updates, updatedAt: new Date().toISOString() };
        this.saveToStorage();
        return this.batches[index];
    },

    getBatch(id) {
        return this.batches.find(b => b.id === id);
    },

    getBatchesByStore(store) {
        return this.batches.filter(b => b.store === store);
    },

    addOpening(opening) {
        opening.id = this.generateId('OPEN');
        opening.store = this.currentStore;
        opening.status = opening.status || 'pending';
        opening.createdAt = new Date().toISOString();
        this.openings.push(opening);
        this.saveToStorage();
        return opening;
    },

    updateOpening(id, updates) {
        const index = this.openings.findIndex(o => o.id === id);
        if (index === -1) return null;
        this.openings[index] = { ...this.openings[index], ...updates, updatedAt: new Date().toISOString() };
        this.saveToStorage();
        return this.openings[index];
    },

    getOpening(id) {
        return this.openings.find(o => o.id === id);
    },

    getOpeningsByStore(store) {
        return this.openings.filter(o => o.store === store);
    },

    addConsumption(consumption) {
        consumption.id = this.generateId('CONS');
        consumption.store = this.currentStore;
        consumption.createdAt = new Date().toISOString();
        this.consumptions.push(consumption);
        this.saveToStorage();
        return consumption;
    },

    updateConsumption(id, updates) {
        const index = this.consumptions.findIndex(c => c.id === id);
        if (index === -1) return null;
        this.consumptions[index] = { ...this.consumptions[index], ...updates, updatedAt: new Date().toISOString() };
        this.saveToStorage();
        return this.consumptions[index];
    },

    getConsumption(id) {
        return this.consumptions.find(c => c.id === id);
    },

    getConsumptionsByStore(store) {
        return this.consumptions.filter(c => c.store === store);
    },

    getConsumptionsByBatch(batchId) {
        return this.consumptions.filter(c => c.batchId === batchId);
    },

    addProblem(problem) {
        problem.id = this.generateId('PROB');
        problem.status = problem.status || 'open';
        problem.createdAt = new Date().toISOString();
        this.problems.push(problem);
        this.saveToStorage();
        return problem;
    },

    updateProblem(id, updates) {
        const index = this.problems.findIndex(p => p.id === id);
        if (index === -1) return null;
        this.problems[index] = { ...this.problems[index], ...updates, updatedAt: new Date().toISOString() };
        this.saveToStorage();
        return this.problems[index];
    },

    getProblemsByStore(store) {
        return this.problems.filter(p => p.store === store);
    },

    clearResolvedProblems() {
        this.problems = this.problems.filter(p => p.status !== 'resolved');
        this.saveToStorage();
    },

    addLog(log) {
        log.id = this.generateId('LOG');
        log.timestamp = new Date().toISOString();
        log.store = this.currentStore;
        this.logs.push(log);
        this.saveToStorage();
        return log;
    },

    getLogsByStore(store) {
        return this.logs.filter(l => l.store === store).sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
    },

    exportAll() {
        return {
            batches: this.batches,
            openings: this.openings,
            consumptions: this.consumptions,
            problems: this.problems,
            logs: this.logs
        };
    },

    exportLogs() {
        return this.logs;
    },

    loadSampleData() {
        const today = new Date();
        const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const tomorrow = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000);
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        const nextTwoWeeks = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

        this.batches = [
            {
                id: this.generateId('BATCH'),
                coffeeType: '埃塞俄比亚 耶加雪菲',
                roastDate: twoWeeksAgo.toISOString().split('T')[0],
                bestBefore: nextTwoWeeks.toISOString().split('T')[0],
                quantity: 5000,
                remainingQuantity: 5000,
                store: 'store1',
                status: 'confirmed',
                createdAt: twoWeeksAgo.toISOString()
            },
            {
                id: this.generateId('BATCH'),
                coffeeType: '哥伦比亚 慧兰',
                roastDate: weekAgo.toISOString().split('T')[0],
                bestBefore: nextWeek.toISOString().split('T')[0],
                quantity: 4000,
                remainingQuantity: 3500,
                store: 'store1',
                status: 'confirmed',
                createdAt: weekAgo.toISOString()
            },
            {
                id: this.generateId('BATCH'),
                coffeeType: '巴西 喜拉多',
                roastDate: twoWeeksAgo.toISOString().split('T')[0],
                bestBefore: tomorrow.toISOString().split('T')[0],
                quantity: 3000,
                remainingQuantity: 2000,
                store: 'store1',
                status: 'confirmed',
                createdAt: twoWeeksAgo.toISOString()
            }
        ];

        this.openings = [
            {
                id: this.generateId('OPEN'),
                batchId: this.batches[1].id,
                coffeeType: '哥伦比亚 慧兰',
                openDate: weekAgo.toISOString().split('T')[0],
                openQuantity: 500,
                store: 'store1',
                status: 'confirmed',
                createdAt: weekAgo.toISOString()
            }
        ];

        this.consumptions = [
            {
                id: this.generateId('CONS'),
                batchId: this.batches[1].id,
                coffeeType: '哥伦比亚 慧兰',
                consumptionDate: weekAgo.toISOString().split('T')[0],
                quantity: 200,
                store: 'store1',
                createdAt: weekAgo.toISOString()
            },
            {
                id: this.generateId('CONS'),
                batchId: this.batches[1].id,
                coffeeType: '哥伦比亚 慧兰',
                consumptionDate: new Date(weekAgo.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                quantity: 300,
                store: 'store1',
                createdAt: new Date(weekAgo.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];

        this.problems = [
            {
                id: this.generateId('PROB'),
                type: 'validation_error',
                sourceData: JSON.stringify({
                    coffeeType: '埃塞俄比亚 耶加雪菲',
                    roastDate: '2026-05-20',
                    quantity: -100
                }),
                description: '数量不能为负数',
                store: 'store1',
                status: 'open',
                createdAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];

        this.logs = [
            {
                id: this.generateId('LOG'),
                type: 'add_batch',
                status: 'success',
                input: JSON.stringify({
                    coffeeType: '埃塞俄比亚 耶加雪菲',
                    roastDate: twoWeeksAgo.toISOString().split('T')[0],
                    quantity: 5000
                }),
                output: JSON.stringify({ batchId: this.batches[0].id }),
                failureReason: '',
                store: 'store1',
                timestamp: twoWeeksAgo.toISOString()
            }
        ];

        this.saveToStorage();
    },

    clearAllData() {
        this.batches = [];
        this.openings = [];
        this.consumptions = [];
        this.problems = [];
        this.logs = [];
        this.saveToStorage();
    }
};

DataStore.init();
