const { v4: uuidv4 } = require('uuid');

const db = {
    levels: [],
    hidingSpots: [],
    interferenceZones: [],
    games: [],
    locationSamples: [],
    items: [],
    hitRecords: [],
    
    nextId: 1,
    
    getNextId() {
        return this.nextId++;
    },
    
    insert(table, data) {
        const record = {
            id: table === 'games' ? 'game_' + uuidv4().slice(0, 12) : this.getNextId(),
            ...data,
            created_at: new Date().toISOString()
        };
        this[table].push(record);
        return record;
    },
    
    findAll(table, filterFn = null) {
        if (filterFn) {
            return this[table].filter(filterFn);
        }
        return [...this[table]];
    },
    
    findOne(table, filterFn) {
        return this[table].find(filterFn) || null;
    },
    
    findById(table, id) {
        return this.findOne(table, r => r.id === id);
    },
    
    update(table, filterFn, updates) {
        const index = this[table].findIndex(filterFn);
        if (index !== -1) {
            this[table][index] = {
                ...this[table][index],
                ...updates
            };
            return this[table][index];
        }
        return null;
    },
    
    count(table, filterFn = null) {
        if (filterFn) {
            return this[table].filter(filterFn).length;
        }
        return this[table].length;
    }
};

module.exports = db;
