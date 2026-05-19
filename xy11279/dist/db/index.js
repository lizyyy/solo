"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.saveDatabase = saveDatabase;
exports.getDatabase = getDatabase;
exports.generateId = generateId;
exports.generateHash = generateHash;
exports.checkImportDuplicate = checkImportDuplicate;
exports.recordImport = recordImport;
exports.getVehicles = getVehicles;
exports.getVehicleById = getVehicleById;
exports.getVehicleByPlate = getVehicleByPlate;
exports.addVehicle = addVehicle;
exports.updateVehicle = updateVehicle;
exports.getChargers = getChargers;
exports.getChargerById = getChargerById;
exports.addCharger = addCharger;
exports.updateCharger = updateCharger;
exports.getTasks = getTasks;
exports.getTaskById = getTaskById;
exports.getTaskByOrderNumber = getTaskByOrderNumber;
exports.addTask = addTask;
exports.updateTask = updateTask;
exports.getShifts = getShifts;
exports.getShiftById = getShiftById;
exports.getShiftByDateAndType = getShiftByDateAndType;
exports.addShift = addShift;
exports.updateShift = updateShift;
exports.getExceptions = getExceptions;
exports.getExceptionById = getExceptionById;
exports.addException = addException;
exports.resolveException = resolveException;
exports.getOperators = getOperators;
exports.getOperatorById = getOperatorById;
exports.addOperator = addOperator;
const lowdb_1 = require("lowdb");
const node_1 = require("lowdb/node");
const path_1 = require("path");
const uuid_1 = require("uuid");
const crypto_1 = require("crypto");
const defaultData = {
    vehicles: [],
    chargers: [],
    tasks: [],
    shifts: [],
    exceptions: [],
    operators: [],
    importHistory: []
};
let db;
async function initDatabase(dbPath) {
    const path = dbPath || (0, path_1.join)(process.cwd(), 'data', 'db.json');
    const adapter = new node_1.JSONFile(path);
    db = new lowdb_1.Low(adapter, defaultData);
    await db.read();
}
async function saveDatabase() {
    await db.write();
}
function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}
function generateId() {
    return (0, uuid_1.v4)();
}
function generateHash(content) {
    return (0, crypto_1.createHash)('sha256').update(content).digest('hex');
}
async function checkImportDuplicate(type, hash) {
    const db = getDatabase();
    return db.data.importHistory.some(h => h.type === type && h.hash === hash);
}
async function recordImport(type, fileName, recordCount, hash) {
    const db = getDatabase();
    db.data.importHistory.push({
        id: generateId(),
        type,
        fileName,
        timestamp: new Date().toISOString(),
        recordCount,
        hash
    });
    await saveDatabase();
}
async function getVehicles() {
    return getDatabase().data.vehicles;
}
async function getVehicleById(id) {
    return getDatabase().data.vehicles.find(v => v.id === id);
}
async function getVehicleByPlate(plateNumber) {
    return getDatabase().data.vehicles.find(v => v.plateNumber === plateNumber);
}
async function addVehicle(vehicle) {
    const db = getDatabase();
    const newVehicle = {
        ...vehicle,
        id: generateId(),
        lastUpdate: new Date().toISOString()
    };
    db.data.vehicles.push(newVehicle);
    await saveDatabase();
    return newVehicle;
}
async function updateVehicle(id, updates) {
    const db = getDatabase();
    const index = db.data.vehicles.findIndex(v => v.id === id);
    if (index === -1)
        return null;
    db.data.vehicles[index] = {
        ...db.data.vehicles[index],
        ...updates,
        lastUpdate: new Date().toISOString()
    };
    await saveDatabase();
    return db.data.vehicles[index];
}
async function getChargers() {
    return getDatabase().data.chargers;
}
async function getChargerById(id) {
    return getDatabase().data.chargers.find(c => c.id === id);
}
async function addCharger(charger) {
    const db = getDatabase();
    const newCharger = {
        ...charger,
        id: generateId()
    };
    db.data.chargers.push(newCharger);
    await saveDatabase();
    return newCharger;
}
async function updateCharger(id, updates) {
    const db = getDatabase();
    const index = db.data.chargers.findIndex(c => c.id === id);
    if (index === -1)
        return null;
    db.data.chargers[index] = { ...db.data.chargers[index], ...updates };
    await saveDatabase();
    return db.data.chargers[index];
}
async function getTasks() {
    return getDatabase().data.tasks;
}
async function getTaskById(id) {
    return getDatabase().data.tasks.find(t => t.id === id);
}
async function getTaskByOrderNumber(orderNumber) {
    return getDatabase().data.tasks.find(t => t.orderNumber === orderNumber);
}
async function addTask(task) {
    const db = getDatabase();
    const newTask = {
        ...task,
        id: generateId(),
        createdAt: new Date().toISOString()
    };
    db.data.tasks.push(newTask);
    await saveDatabase();
    return newTask;
}
async function updateTask(id, updates) {
    const db = getDatabase();
    const index = db.data.tasks.findIndex(t => t.id === id);
    if (index === -1)
        return null;
    db.data.tasks[index] = { ...db.data.tasks[index], ...updates };
    await saveDatabase();
    return db.data.tasks[index];
}
async function getShifts() {
    return getDatabase().data.shifts;
}
async function getShiftById(id) {
    return getDatabase().data.shifts.find(s => s.id === id);
}
async function getShiftByDateAndType(date, type) {
    return getDatabase().data.shifts.find(s => s.date === date && s.type === type);
}
async function addShift(shift) {
    const db = getDatabase();
    const newShift = {
        ...shift,
        id: generateId(),
        createdAt: new Date().toISOString()
    };
    db.data.shifts.push(newShift);
    await saveDatabase();
    return newShift;
}
async function updateShift(id, updates) {
    const db = getDatabase();
    const index = db.data.shifts.findIndex(s => s.id === id);
    if (index === -1)
        return null;
    db.data.shifts[index] = { ...db.data.shifts[index], ...updates };
    await saveDatabase();
    return db.data.shifts[index];
}
async function getExceptions() {
    return getDatabase().data.exceptions;
}
async function getExceptionById(id) {
    return getDatabase().data.exceptions.find(e => e.id === id);
}
async function addException(exception) {
    const db = getDatabase();
    const newException = {
        ...exception,
        id: generateId(),
        createdAt: new Date().toISOString(),
        resolved: false
    };
    db.data.exceptions.push(newException);
    await saveDatabase();
    return newException;
}
async function resolveException(id, resolution) {
    const db = getDatabase();
    const index = db.data.exceptions.findIndex(e => e.id === id);
    if (index === -1)
        return null;
    db.data.exceptions[index] = {
        ...db.data.exceptions[index],
        resolved: true,
        resolution,
        resolvedAt: new Date().toISOString()
    };
    await saveDatabase();
    return db.data.exceptions[index];
}
async function getOperators() {
    return getDatabase().data.operators;
}
async function getOperatorById(id) {
    return getDatabase().data.operators.find(o => o.id === id);
}
async function addOperator(operator) {
    const db = getDatabase();
    const newOperator = {
        ...operator,
        id: generateId()
    };
    db.data.operators.push(newOperator);
    await saveDatabase();
    return newOperator;
}
