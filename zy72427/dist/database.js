"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.getCollection = getCollection;
exports.insertOne = insertOne;
exports.insertMany = insertMany;
exports.updateOne = updateOne;
exports.findOne = findOne;
exports.findMany = findMany;
exports.deleteMany = deleteMany;
exports.getDb = getDb;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.join(__dirname, '..', 'data');
const DATA_FILE = path_1.default.join(DATA_DIR, 'db.json');
let data = {
    cards: [],
    attendance: [],
    tickets: [],
    conflicts: [],
    revenue: [],
    snapshots: [],
};
let loaded = false;
function initDatabase() {
    if (!fs_1.default.existsSync(DATA_DIR)) {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs_1.default.existsSync(DATA_FILE)) {
        try {
            const content = fs_1.default.readFileSync(DATA_FILE, 'utf-8');
            data = JSON.parse(content);
        }
        catch (e) {
            console.warn('读取数据库文件失败，使用空数据库');
        }
    }
    loaded = true;
}
function saveData() {
    if (!loaded)
        initDatabase();
    fs_1.default.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function getCollection(name) {
    if (!loaded)
        initDatabase();
    return data[name];
}
function insertOne(collection, doc) {
    if (!loaded)
        initDatabase();
    data[collection].push(doc);
    saveData();
    return doc;
}
function insertMany(collection, docs) {
    if (!loaded)
        initDatabase();
    data[collection].push(...docs);
    saveData();
    return docs;
}
function updateOne(collection, predicate, update) {
    if (!loaded)
        initDatabase();
    const idx = data[collection].findIndex(predicate);
    if (idx === -1)
        return null;
    data[collection][idx] = { ...data[collection][idx], ...update };
    saveData();
    return data[collection][idx];
}
function findOne(collection, predicate) {
    if (!loaded)
        initDatabase();
    return data[collection].find(predicate);
}
function findMany(collection, predicate = () => true) {
    if (!loaded)
        initDatabase();
    return data[collection].filter(predicate);
}
function deleteMany(collection, predicate) {
    if (!loaded)
        initDatabase();
    const before = data[collection].length;
    data[collection] = data[collection].filter((d) => !predicate(d));
    const deleted = before - data[collection].length;
    saveData();
    return deleted;
}
function getDb() {
    if (!loaded)
        initDatabase();
    return data;
}
