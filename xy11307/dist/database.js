"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.Database = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const DB_DIR = path.join(process.cwd(), '.canteen-data');
const DB_PATH = path.join(DB_DIR, 'database.json');
const defaultDatabase = {
    elders: [],
    menuItems: [],
    mealPlans: [],
    deliveries: [],
    followUps: [],
    importErrors: {
        elders: [],
        menuItems: [],
        deliveries: [],
    },
    history: [],
};
class Database {
    constructor() {
        this.ensureDbDir();
        this.data = this.loadData();
    }
    ensureDbDir() {
        if (!fs.existsSync(DB_DIR)) {
            fs.mkdirSync(DB_DIR, { recursive: true });
        }
    }
    loadData() {
        try {
            if (fs.existsSync(DB_PATH)) {
                const rawData = fs.readFileSync(DB_PATH, 'utf-8');
                return JSON.parse(rawData);
            }
        }
        catch (error) {
            console.warn('数据库文件损坏，使用默认数据库');
        }
        return { ...defaultDatabase };
    }
    saveData() {
        fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    }
    addHistory(action, entityType, entityId, details = {}) {
        const record = {
            id: (0, uuid_1.v4)(),
            action,
            entityType,
            entityId,
            details,
            timestamp: new Date().toISOString(),
        };
        this.data.history.unshift(record);
        this.saveData();
    }
    getElders() {
        return [...this.data.elders];
    }
    getElderById(id) {
        return this.data.elders.find(e => e.id === id);
    }
    addElder(elder) {
        const now = new Date().toISOString();
        const newElder = {
            ...elder,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now,
        };
        this.data.elders.push(newElder);
        this.addHistory('create', 'elder', newElder.id, { name: newElder.name });
        this.saveData();
        return newElder;
    }
    bulkAddElders(elders) {
        const now = new Date().toISOString();
        const newElders = elders.map(elder => ({
            ...elder,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now,
        }));
        this.data.elders.push(...newElders);
        newElders.forEach(e => {
            this.addHistory('create', 'elder', e.id, { name: e.name, bulk: true });
        });
        this.saveData();
        return newElders;
    }
    updateElder(id, updates) {
        const index = this.data.elders.findIndex(e => e.id === id);
        if (index === -1)
            return undefined;
        this.data.elders[index] = {
            ...this.data.elders[index],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        this.addHistory('update', 'elder', id, updates);
        this.saveData();
        return this.data.elders[index];
    }
    getMenuItems() {
        return [...this.data.menuItems];
    }
    getMenuItemById(id) {
        return this.data.menuItems.find(m => m.id === id);
    }
    addMenuItem(item) {
        const newItem = {
            ...item,
            id: (0, uuid_1.v4)(),
        };
        this.data.menuItems.push(newItem);
        this.addHistory('create', 'menuItem', newItem.id, { name: newItem.name });
        this.saveData();
        return newItem;
    }
    bulkAddMenuItems(items) {
        const newItems = items.map(item => ({
            ...item,
            id: (0, uuid_1.v4)(),
        }));
        this.data.menuItems.push(...newItems);
        newItems.forEach(i => {
            this.addHistory('create', 'menuItem', i.id, { name: i.name, bulk: true });
        });
        this.saveData();
        return newItems;
    }
    getMealPlans() {
        return [...this.data.mealPlans];
    }
    getMealPlanById(id) {
        return this.data.mealPlans.find(m => m.id === id);
    }
    getMealPlansByElderAndDate(elderId, date) {
        return this.data.mealPlans.filter(m => m.elderId === elderId && m.date === date);
    }
    addMealPlan(plan) {
        const now = new Date().toISOString();
        const newPlan = {
            ...plan,
            id: (0, uuid_1.v4)(),
            conflicts: [],
            createdAt: now,
            updatedAt: now,
        };
        this.data.mealPlans.push(newPlan);
        this.addHistory('create', 'mealPlan', newPlan.id, {
            elderId: newPlan.elderId,
            date: newPlan.date,
            mealType: newPlan.mealType
        });
        this.saveData();
        return newPlan;
    }
    updateMealPlan(id, updates) {
        const index = this.data.mealPlans.findIndex(m => m.id === id);
        if (index === -1)
            return undefined;
        this.data.mealPlans[index] = {
            ...this.data.mealPlans[index],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        this.addHistory('update', 'mealPlan', id, updates);
        this.saveData();
        return this.data.mealPlans[index];
    }
    addConflictsToMealPlan(id, conflicts) {
        const index = this.data.mealPlans.findIndex(m => m.id === id);
        if (index === -1)
            return undefined;
        const existingConflicts = this.data.mealPlans[index].conflicts;
        const newConflicts = [...new Set([...existingConflicts, ...conflicts])];
        this.data.mealPlans[index].conflicts = newConflicts;
        this.data.mealPlans[index].updatedAt = new Date().toISOString();
        this.addHistory('add_conflicts', 'mealPlan', id, { conflicts });
        this.saveData();
        return this.data.mealPlans[index];
    }
    getDeliveries() {
        return [...this.data.deliveries];
    }
    getDeliveryById(id) {
        return this.data.deliveries.find(d => d.id === id);
    }
    addDelivery(delivery) {
        const now = new Date().toISOString();
        const newDelivery = {
            ...delivery,
            id: (0, uuid_1.v4)(),
            createdAt: now,
        };
        this.data.deliveries.push(newDelivery);
        this.addHistory('create', 'delivery', newDelivery.id, {
            elderId: newDelivery.elderId,
            date: newDelivery.date,
            route: newDelivery.route,
        });
        this.saveData();
        return newDelivery;
    }
    updateDeliveryStatus(id, status, notes) {
        const index = this.data.deliveries.findIndex(d => d.id === id);
        if (index === -1)
            return undefined;
        this.data.deliveries[index].status = status;
        if (notes) {
            this.data.deliveries[index].notes = notes;
        }
        if (status === 'delivered') {
            this.data.deliveries[index].deliveredAt = new Date().toISOString();
        }
        this.addHistory('update_status', 'delivery', id, { status, notes });
        this.saveData();
        return this.data.deliveries[index];
    }
    getFollowUps() {
        return [...this.data.followUps];
    }
    addFollowUp(followUp) {
        const now = new Date().toISOString();
        const newFollowUp = {
            ...followUp,
            id: (0, uuid_1.v4)(),
            createdAt: now,
        };
        this.data.followUps.push(newFollowUp);
        this.addHistory('create', 'followUp', newFollowUp.id, {
            elderId: newFollowUp.elderId,
            date: newFollowUp.date,
        });
        this.saveData();
        return newFollowUp;
    }
    saveImportErrors(type, errors) {
        this.data.importErrors[type].push(...errors);
        this.saveData();
    }
    getImportErrors(type) {
        return [...this.data.importErrors[type]];
    }
    getHistory(limit) {
        const history = [...this.data.history];
        return limit ? history.slice(0, limit) : history;
    }
    reset() {
        this.data = { ...defaultDatabase };
        this.saveData();
    }
    getDbPath() {
        return DB_PATH;
    }
}
exports.Database = Database;
exports.db = new Database();
