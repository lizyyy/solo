"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../database");
async function init() {
    try {
        await (0, database_1.initDatabase)();
        console.log('数据库初始化成功！');
        process.exit(0);
    }
    catch (err) {
        console.error('数据库初始化失败:', err);
        process.exit(1);
    }
}
init();
