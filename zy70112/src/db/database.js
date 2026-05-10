const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let db;
let SQL;

async function initDb() {
    SQL = await initSqlJs();
    
    const dbDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    if (fs.existsSync(config.dbPath)) {
        const fileBuffer = fs.readFileSync(config.dbPath);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.run(schema);

    saveDb();
    
    return db;
}

function saveDb() {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(config.dbPath, buffer);
}

function getDb() {
    if (!db) {
        throw new Error('数据库未初始化');
    }
    
    const wrappedDb = {
        prepare(sql) {
            return {
                run(...params) {
                    db.run(sql, params);
                    saveDb();
                    return {
                        changes: db.getRowsModified(),
                        lastInsertRowid: db.exec('SELECT last_insert_rowid() as id')[0]?.values[0]?.[0]
                    };
                },
                get(...params) {
                    const results = db.exec(sql, params);
                    if (!results.length || !results[0].values.length) {
                        return undefined;
                    }
                    const columns = results[0].columns;
                    const values = results[0].values[0];
                    const row = {};
                    columns.forEach((col, idx) => {
                        row[col] = values[idx];
                    });
                    return row;
                },
                all(...params) {
                    const results = db.exec(sql, params);
                    if (!results.length) {
                        return [];
                    }
                    const columns = results[0].columns;
                    return results[0].values.map(values => {
                        const row = {};
                        columns.forEach((col, idx) => {
                            row[col] = values[idx];
                        });
                        return row;
                    });
                }
            };
        },
        exec(sql) {
            db.run(sql);
            saveDb();
        },
        pragma(sql) {
            return db.exec(sql);
        },
        transaction(fn) {
            return function(...args) {
                db.run('BEGIN TRANSACTION');
                try {
                    const result = fn.apply(null, args);
                    db.run('COMMIT');
                    saveDb();
                    return result;
                } catch (err) {
                    db.run('ROLLBACK');
                    throw err;
                }
            };
        },
        close() {
            saveDb();
            db.close();
        }
    };
    
    return wrappedDb;
}

function closeDb() {
    if (db) {
        saveDb();
        db.close();
        db = null;
    }
}

module.exports = { initDb, getDb, closeDb };
