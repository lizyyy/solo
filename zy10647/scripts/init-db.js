const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../database/exam.db');
const initSqlPath = path.join(__dirname, '../database/init.sql');
const testDataSqlPath = path.join(__dirname, '../database/test-data.sql');

function initDatabase() {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(dbPath)) {
            console.log('数据库已存在，正在删除...');
            fs.unlinkSync(dbPath);
        }

        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('创建数据库失败:', err);
                reject(err);
                return;
            }
            console.log('数据库创建成功');
        });

        db.serialize(() => {
            console.log('开始执行初始化SQL...');
            const initSql = fs.readFileSync(initSqlPath, 'utf8');
            db.exec(initSql, (err) => {
                if (err) {
                    console.error('执行初始化SQL失败:', err);
                    reject(err);
                    return;
                }
                console.log('初始化SQL执行完成');
            });

            console.log('开始执行测试数据SQL...');
            const testDataSql = fs.readFileSync(testDataSqlPath, 'utf8');
            db.exec(testDataSql, (err) => {
                if (err) {
                    console.error('执行测试数据SQL失败:', err);
                    reject(err);
                    return;
                }
                console.log('测试数据SQL执行完成');
            });
        });

        db.close((err) => {
            if (err) {
                console.error('关闭数据库失败:', err);
                reject(err);
                return;
            }
            console.log('数据库初始化完成！');
            resolve();
        });
    });
}

initDatabase().catch(console.error);
