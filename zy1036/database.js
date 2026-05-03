const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'fostering.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const defaultData = {
    owners: [],
    pets: [],
    cages: [],
    orders: [],
    todos: [],
    incidents: [],
    operation_logs: []
};

function initDatabase() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = { ...defaultData };
        
        for (let i = 1; i <= 10; i++) {
            initialData.cages.push({
                id: `cage-${i}`,
                name: `笼位 ${i}`,
                location: i <= 5 ? '一楼' : '二楼',
                description: i <= 3 ? '小型犬/猫专用' : i <= 7 ? '中型犬专用' : '大型犬专用',
                max_weight: i <= 3 ? 15 : i <= 7 ? 30 : 60,
                status: 'available',
                created_at: new Date().toISOString()
            });
        }
        
        saveData(initialData);
        console.log('数据库初始化完成，已创建默认笼位');
    }
}

function loadData() {
    if (!fs.existsSync(DB_FILE)) {
        initDatabase();
    }
    const content = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(content);
}

function saveData(data) {
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(DB_FILE, content, 'utf8');
}

function generateId() {
    return uuidv4();
}

function logOperation(entity_type, entity_id, operation, operator, details = {}) {
    const data = loadData();
    const log = {
        id: generateId(),
        entity_type,
        entity_id,
        operation,
        operator: operator || 'system',
        details: JSON.stringify(details),
        created_at: new Date().toISOString()
    };
    data.operation_logs.push(log);
    saveData(data);
    return log;
}

module.exports = {
    loadData,
    saveData,
    generateId,
    logOperation,
    initDatabase
};
