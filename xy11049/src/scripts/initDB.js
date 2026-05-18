const { initDatabase } = require('../database/db');
const { initAllData } = require('./initData');

async function main() {
    try {
        console.log('开始初始化数据库...');
        await initDatabase();
        console.log('开始导入初始化数据...');
        await initAllData();
        console.log('数据库初始化完成!');
        process.exit(0);
    } catch (error) {
        console.error('初始化失败:', error);
        process.exit(1);
    }
}

main();
