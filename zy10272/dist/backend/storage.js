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
exports.loadData = loadData;
exports.saveData = saveData;
exports.getNextOrderNumber = getNextOrderNumber;
exports.getOrders = getOrders;
exports.getOrderById = getOrderById;
exports.addOrder = addOrder;
exports.updateOrder = updateOrder;
exports.getActiveOrders = getActiveOrders;
exports.getQueueOrders = getQueueOrders;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DATA_DIR = path.join(process.cwd(), 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const COUNTER_FILE = path.join(DATA_DIR, 'counter.json');
let inMemoryStore = {
    orders: [],
    orderCounter: 0
};
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}
function loadData() {
    ensureDataDir();
    try {
        if (fs.existsSync(ORDERS_FILE)) {
            const ordersData = fs.readFileSync(ORDERS_FILE, 'utf-8');
            inMemoryStore.orders = JSON.parse(ordersData).map((order) => ({
                ...order,
                createdAt: new Date(order.createdAt),
                updatedAt: new Date(order.updatedAt),
                calledAt: order.calledAt ? new Date(order.calledAt) : undefined,
                completedAt: order.completedAt ? new Date(order.completedAt) : undefined
            }));
        }
    }
    catch (error) {
        console.error('Error loading orders:', error);
        inMemoryStore.orders = [];
    }
    try {
        if (fs.existsSync(COUNTER_FILE)) {
            const counterData = fs.readFileSync(COUNTER_FILE, 'utf-8');
            inMemoryStore.orderCounter = JSON.parse(counterData).counter || 0;
        }
    }
    catch (error) {
        console.error('Error loading counter:', error);
        inMemoryStore.orderCounter = 0;
    }
}
function saveData() {
    ensureDataDir();
    try {
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(inMemoryStore.orders, null, 2));
        fs.writeFileSync(COUNTER_FILE, JSON.stringify({ counter: inMemoryStore.orderCounter }, null, 2));
    }
    catch (error) {
        console.error('Error saving data:', error);
    }
}
function getNextOrderNumber() {
    inMemoryStore.orderCounter++;
    saveData();
    return inMemoryStore.orderCounter;
}
function getOrders() {
    return [...inMemoryStore.orders];
}
function getOrderById(id) {
    return inMemoryStore.orders.find(o => o.id === id);
}
function addOrder(order) {
    inMemoryStore.orders.push(order);
    saveData();
}
function updateOrder(order) {
    const index = inMemoryStore.orders.findIndex(o => o.id === order.id);
    if (index !== -1) {
        inMemoryStore.orders[index] = order;
        saveData();
    }
}
function getActiveOrders() {
    return inMemoryStore.orders.filter(o => o.status !== 'completed' && o.status !== 'refunded').sort((a, b) => a.orderNumber - b.orderNumber);
}
function getQueueOrders() {
    return inMemoryStore.orders.filter(o => o.status === 'paid' || o.status === 'needs_topup').sort((a, b) => a.orderNumber - b.orderNumber);
}
