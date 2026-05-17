require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function initDatabase() {
  console.log('开始初始化数据库...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456'
  });

  try {
    const dbName = process.env.DB_NAME || 'points_mall_stock';
    
    console.log(`1. 创建数据库 ${dbName}...`);
    await connection.execute(`CREATE DATABASE IF NOT EXISTS ${dbName} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.execute(`USE ${dbName}`);

    console.log('2. 执行 schema.sql...');
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    const schemaStatements = schemaSql.split(';').filter(s => s.trim());
    
    for (const stmt of schemaStatements) {
      if (stmt.trim()) {
        await connection.execute(stmt);
      }
    }

    console.log('3. 执行 data.sql...');
    const dataPath = path.join(__dirname, '../database/data.sql');
    const dataSql = fs.readFileSync(dataPath, 'utf8');
    const dataStatements = dataSql.split(';').filter(s => s.trim());
    
    for (const stmt of dataStatements) {
      if (stmt.trim()) {
        await connection.execute(stmt);
      }
    }

    console.log('4. 执行 acceptance_data.sql...');
    const acceptancePath = path.join(__dirname, '../database/acceptance_data.sql');
    const acceptanceSql = fs.readFileSync(acceptancePath, 'utf8');
    const acceptanceStatements = acceptanceSql.split(';').filter(s => s.trim());
    
    for (const stmt of acceptanceStatements) {
      if (stmt.trim()) {
        await connection.execute(stmt);
      }
    }

    console.log('✅ 数据库初始化完成!');
    console.log(`   数据库: ${dbName}`);
    console.log(`   主机: ${process.env.DB_HOST || 'localhost'}`);

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

initDatabase().catch(console.error);
