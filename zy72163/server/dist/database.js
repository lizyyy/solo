"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dbPath = path_1.default.join(__dirname, '../data/db.json');
let db = {
    locations: [],
    location_aliases: [],
    resident_feedbacks: [],
    inspection_photos: [],
    street_notes: [],
    plan_versions: [],
    reports: [],
    data_conflicts: [],
    audit_logs: []
};
let idCounters = {
    locations: 0,
    location_aliases: 0,
    resident_feedbacks: 0,
    inspection_photos: 0,
    street_notes: 0,
    plan_versions: 0,
    reports: 0,
    data_conflicts: 0,
    audit_logs: 0
};
function loadDatabase() {
    try {
        if (fs_1.default.existsSync(dbPath)) {
            const data = fs_1.default.readFileSync(dbPath, 'utf-8');
            const loaded = JSON.parse(data);
            db = loaded.db || db;
            idCounters = loaded.idCounters || idCounters;
        }
    }
    catch (e) {
        console.log('创建新数据库');
    }
}
function saveDatabase() {
    const dir = path_1.default.dirname(dbPath);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    fs_1.default.writeFileSync(dbPath, JSON.stringify({ db, idCounters }, null, 2));
}
function initDatabase() {
    loadDatabase();
    console.log('数据库初始化完成 (JSON文件存储)');
}
class Table {
    constructor(name) {
        this.name = name;
    }
    all() {
        return [...db[this.name]];
    }
    get(id) {
        return db[this.name].find((item) => item.id === id);
    }
    filter(predicate) {
        return db[this.name].filter(predicate);
    }
    findOne(predicate) {
        return db[this.name].find(predicate);
    }
    insert(data) {
        idCounters[this.name]++;
        const item = {
            id: idCounters[this.name],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...data
        };
        db[this.name].push(item);
        saveDatabase();
        return { lastInsertRowid: item.id };
    }
    update(id, data) {
        const index = db[this.name].findIndex((item) => item.id === id);
        if (index !== -1) {
            db[this.name][index] = {
                ...db[this.name][index],
                ...data,
                updatedAt: new Date().toISOString()
            };
            saveDatabase();
            return { changes: 1 };
        }
        return { changes: 0 };
    }
    delete(id) {
        const index = db[this.name].findIndex((item) => item.id === id);
        if (index !== -1) {
            db[this.name].splice(index, 1);
            saveDatabase();
            return { changes: 1 };
        }
        return { changes: 0 };
    }
    deleteWhere(predicate) {
        const before = db[this.name].length;
        db[this.name] = db[this.name].filter((item) => !predicate(item));
        saveDatabase();
        return { changes: before - db[this.name].length };
    }
    prepare(sql) {
        return {
            all: (...params) => {
                return this.all();
            },
            get: (...params) => {
                if (sql.includes('WHERE id = ?')) {
                    return this.get(params[0]);
                }
                return this.findOne(() => true);
            },
            run: (...params) => {
                if (sql.startsWith('INSERT')) {
                    const data = {};
                    const match = sql.match(/INSERT INTO \w+ \(([^)]+)\)/);
                    if (match) {
                        const columns = match[1].split(',').map((c) => c.trim());
                        columns.forEach((col, i) => {
                            if (params[i] !== undefined && params[i] !== null) {
                                data[col] = params[i];
                            }
                        });
                    }
                    return this.insert(data);
                }
                if (sql.startsWith('UPDATE')) {
                    const idMatch = sql.match(/WHERE id = \?$/);
                    if (idMatch) {
                        const id = params[params.length - 1];
                        return this.update(id, {});
                    }
                }
                if (sql.startsWith('DELETE')) {
                    const idMatch = sql.match(/WHERE id = \?$/);
                    if (idMatch) {
                        return this.delete(params[0]);
                    }
                }
                return { changes: 0, lastInsertRowid: 0 };
            }
        };
    }
}
exports.default = {
    prepare: (sql) => {
        const match = sql.match(/FROM\s+(\w+)|INTO\s+(\w+)|UPDATE\s+(\w+)|DELETE\s+FROM\s+(\w+)/);
        const tableName = match?.[1] || match?.[2] || match?.[3] || match?.[4];
        if (tableName) {
            const table = new Table(tableName);
            return table.prepare(sql);
        }
        return {
            all: () => [],
            get: () => undefined,
            run: () => ({ changes: 0, lastInsertRowid: 0 })
        };
    },
    exec: (sql) => {
        console.log('SQL exec:', sql.substring(0, 100));
    },
    pragma: () => { },
    locations: new Table('locations'),
    location_aliases: new Table('location_aliases'),
    resident_feedbacks: new Table('resident_feedbacks'),
    inspection_photos: new Table('inspection_photos'),
    street_notes: new Table('street_notes'),
    plan_versions: new Table('plan_versions'),
    reports: new Table('reports'),
    data_conflicts: new Table('data_conflicts'),
    audit_logs: new Table('audit_logs')
};
