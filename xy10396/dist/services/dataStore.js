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
exports.DataStore = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class DataStore {
    constructor(dataDir = './data') {
        this.dataDir = path.resolve(dataDir);
        this.data = {
            orders: new Map(),
            elevators: new Map(),
            installations: new Map(),
            missingParts: new Map(),
            reschedules: new Map(),
            compensations: new Map()
        };
        this.ensureDataDirectory();
        this.loadFromDisk();
    }
    ensureDataDirectory() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }
    loadFromDisk() {
        const files = ['orders.json', 'elevators.json', 'installations.json', 'missingParts.json', 'reschedules.json', 'compensations.json'];
        for (const file of files) {
            const filePath = path.join(this.dataDir, file);
            if (fs.existsSync(filePath)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const parsed = JSON.parse(content);
                    this.loadFromArray(file.replace('.json', ''), parsed);
                }
                catch (e) {
                    console.error(`Error loading ${file}:`, e);
                }
            }
        }
    }
    loadFromArray(type, array) {
        switch (type) {
            case 'orders':
                array.forEach((item) => this.data.orders.set(item.orderId, item));
                break;
            case 'elevators':
                array.forEach((item) => this.data.elevators.set(item.orderId, item));
                break;
            case 'installations':
                array.forEach((item) => {
                    const existing = this.data.installations.get(item.orderId) || [];
                    existing.push(item);
                    this.data.installations.set(item.orderId, existing);
                });
                break;
            case 'missingParts':
                array.forEach((item) => {
                    const existing = this.data.missingParts.get(item.orderId) || [];
                    existing.push(item);
                    this.data.missingParts.set(item.orderId, existing);
                });
                break;
            case 'reschedules':
                array.forEach((item) => {
                    const existing = this.data.reschedules.get(item.orderId) || [];
                    existing.push(item);
                    this.data.reschedules.set(item.orderId, existing);
                });
                break;
            case 'compensations':
                array.forEach((item) => {
                    const existing = this.data.compensations.get(item.orderId) || [];
                    existing.push(item);
                    this.data.compensations.set(item.orderId, existing);
                });
                break;
        }
    }
    saveToDisk() {
        fs.writeFileSync(path.join(this.dataDir, 'orders.json'), JSON.stringify(Array.from(this.data.orders.values()), null, 2));
        fs.writeFileSync(path.join(this.dataDir, 'elevators.json'), JSON.stringify(Array.from(this.data.elevators.values()), null, 2));
        fs.writeFileSync(path.join(this.dataDir, 'installations.json'), JSON.stringify(this.flattenMap(this.data.installations), null, 2));
        fs.writeFileSync(path.join(this.dataDir, 'missingParts.json'), JSON.stringify(this.flattenMap(this.data.missingParts), null, 2));
        fs.writeFileSync(path.join(this.dataDir, 'reschedules.json'), JSON.stringify(this.flattenMap(this.data.reschedules), null, 2));
        fs.writeFileSync(path.join(this.dataDir, 'compensations.json'), JSON.stringify(this.flattenMap(this.data.compensations), null, 2));
    }
    flattenMap(map) {
        const result = [];
        for (const [, value] of map) {
            result.push(...value);
        }
        return result;
    }
    importOrder(order) {
        if (this.data.orders.has(order.orderId)) {
            throw new Error(`订单 ${order.orderId} 已存在，不能重复导入`);
        }
        this.data.orders.set(order.orderId, order);
        this.saveToDisk();
    }
    importOrders(orders) {
        const errors = [];
        let imported = 0;
        for (const order of orders) {
            try {
                this.importOrder(order);
                imported++;
            }
            catch (e) {
                errors.push(e.message);
            }
        }
        return { imported, errors };
    }
    importElevator(elevator) {
        this.data.elevators.set(elevator.orderId, elevator);
        this.saveToDisk();
    }
    importInstallation(installation) {
        const existing = this.data.installations.get(installation.orderId) || [];
        existing.push(installation);
        this.data.installations.set(installation.orderId, existing);
        this.saveToDisk();
    }
    importMissingPart(missingPart) {
        const existing = this.data.missingParts.get(missingPart.orderId) || [];
        existing.push(missingPart);
        this.data.missingParts.set(missingPart.orderId, existing);
        this.saveToDisk();
    }
    importReschedule(reschedule) {
        const existing = this.data.reschedules.get(reschedule.orderId) || [];
        existing.push(reschedule);
        this.data.reschedules.set(reschedule.orderId, existing);
        this.saveToDisk();
    }
    importCompensation(compensation) {
        const existingCompensations = this.data.compensations.get(compensation.orderId) || [];
        const isDuplicate = existingCompensations.some(c => c.itemId === compensation.itemId &&
            c.damageType === compensation.damageType &&
            c.status !== 'rejected');
        if (isDuplicate) {
            throw new Error(`订单 ${compensation.orderId} 的商品 ${compensation.itemId} 已有相同类型的赔付记录，不能重复赔付`);
        }
        existingCompensations.push(compensation);
        this.data.compensations.set(compensation.orderId, existingCompensations);
        this.saveToDisk();
    }
    getOrder(orderId) {
        return this.data.orders.get(orderId);
    }
    getAllOrders() {
        return Array.from(this.data.orders.values());
    }
    getElevator(orderId) {
        return this.data.elevators.get(orderId);
    }
    getInstallations(orderId) {
        return this.data.installations.get(orderId) || [];
    }
    getMissingParts(orderId) {
        return this.data.missingParts.get(orderId) || [];
    }
    getReschedules(orderId) {
        return this.data.reschedules.get(orderId) || [];
    }
    getCompensations(orderId) {
        return this.data.compensations.get(orderId) || [];
    }
    getAllCompensations() {
        return this.flattenMap(this.data.compensations);
    }
    getData() {
        return this.data;
    }
    hasCompensation(orderId, itemId, damageType) {
        const compensations = this.getCompensations(orderId);
        return compensations.some(c => c.itemId === itemId &&
            c.damageType === damageType &&
            c.status !== 'rejected');
    }
    updateAbnormalityResolution(orderId, abnormalityType, resolution) {
        console.log(`更新订单 ${orderId} 的异常 ${abnormalityType} 的处理状态: ${resolution}`);
    }
}
exports.DataStore = DataStore;
