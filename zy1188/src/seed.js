'use strict';

const fs = require('fs-extra');
const path = require('path');
const initSqlJs = require('sql.js');

class SeedProject {
  constructor() {}

  async create(outputDir) {
    const resolvedDir = path.resolve(outputDir);
    
    await fs.ensureDir(resolvedDir);

    const files = [];

    files.push(await this._createBadExamplesJs(resolvedDir));
    files.push(await this._createUserControllerJs(resolvedDir));
    files.push(await this._createAuthModuleJs(resolvedDir));
    files.push(await this._createProductRoutesJs(resolvedDir));
    files.push(await this._createDbUtilJs(resolvedDir));
    files.push(await this._createBadExamplesPy(resolvedDir));
    files.push(await this._createSearchPhp(resolvedDir));
    
    files.push(await this._createSqliteDatabase(resolvedDir));
    
    files.push(await this._createPackageJson(resolvedDir));
    files.push(await this._createReadme(resolvedDir));

    return {
      directory: resolvedDir,
      files: files,
      issueTypes: [
        '字符串拼接SQL (CRITICAL)',
        '模板字面量拼接SQL (CRITICAL)',
        '用户输入直接嵌入SQL (CRITICAL)',
        '动态表名无白名单 (HIGH)',
        '字符串格式化函数构建SQL (HIGH)',
        'SQL注释符检测 (MEDIUM)',
        '数据库权限问题'
      ]
    };
  }

  async _createBadExamplesJs(dir) {
    const filePath = path.join(dir, 'src', 'bad-examples.js');
    await fs.ensureDir(path.dirname(filePath));

    const content = `// ============================================================
// WARNING: 这些代码示例包含SQL注入漏洞
// 仅用于测试扫描器，切勿在生产环境中使用！
// ============================================================

const db = require('./db-util');

// ============================================================
// 示例1: 字符串拼接SQL (CRITICAL)
// ============================================================
function getUserById_bad(userId) {
  // 危险: 直接使用字符串拼接
  const sql = "SELECT * FROM users WHERE id = " + userId;
  return db.query(sql);
}

function createUser_bad(username, email, password) {
  // 危险: 字符串拼接，引号处理错误
  const sql = "INSERT INTO users (username, email, password) VALUES ('" + 
              username + "', '" + email + "', '" + password + "')";
  return db.run(sql);
}

// ============================================================
// 示例2: 模板字面量拼接SQL (CRITICAL)
// ============================================================
function searchUsers_bad(searchTerm) {
  // 危险: 模板字面量插值
  const sql = \`SELECT * FROM users WHERE username LIKE '%\${searchTerm}%'\`;
  return db.query(sql);
}

function updateUser_bad(userId, field, value) {
  // 危险: 多个模板插值
  const sql = \`UPDATE users SET \${field} = '\${value}' WHERE id = \${userId}\`;
  return db.run(sql);
}

// ============================================================
// 示例3: 用户输入直接嵌入SQL (CRITICAL)
// ============================================================
function login_bad(req, res) {
  const username = req.body.username;
  const password = req.body.password;
  
  // 危险: 直接使用req.body中的值
  const sql = \`SELECT * FROM users 
               WHERE username = '\${username}' 
               AND password = '\${password}'\`;
  
  const user = db.query(sql)[0];
  return user;
}

function getProduct_bad(req) {
  // 危险: 直接使用URL参数
  const productId = req.params.id;
  const sql = "SELECT * FROM products WHERE id = " + productId;
  return db.query(sql);
}

function searchProducts_bad(req) {
  // 危险: 直接使用查询参数
  const category = req.query.category;
  const keyword = req.query.keyword;
  
  const sql = "SELECT * FROM products WHERE category = '" + category + 
              "' AND name LIKE '%" + keyword + "%'";
  return db.query(sql);
}

// ============================================================
// 示例4: 动态表名无白名单验证 (HIGH)
// ============================================================
function getTableData_bad(tableName) {
  // 危险: 直接使用用户输入作为表名，无白名单
  const sql = \`SELECT * FROM \${tableName}\`;
  return db.query(sql);
}

function dynamicJoin_bad(mainTable, joinTable, joinField) {
  // 危险: 多个动态部分，都无验证
  const sql = \`SELECT * FROM \${mainTable} 
               JOIN \${joinTable} ON \${mainTable}.id = \${joinTable}.\${joinField}\`;
  return db.query(sql);
}

// ============================================================
// 示例5: 字符串格式化函数构建SQL (HIGH)
// ============================================================
function formatQuery_bad(userId, status) {
  // 危险: 使用字符串格式化
  const sql = require('util').format(
    "SELECT * FROM orders WHERE user_id = %s AND status = '%s'",
    userId, status
  );
  return db.query(sql);
}

// ============================================================
// 示例6: SQL注释符和UNION检测 (MEDIUM)
// ============================================================
function conditionalQuery_bad(condition, value) {
  let sql = "SELECT * FROM users WHERE 1=1";
  
  if (condition) {
    // 危险: 可能包含注释符
    sql += " AND " + value;
  }
  
  // 如果 value = "username = 'admin' --"，则后续条件被注释
  
  return db.query(sql);
}

function searchWithUnion_bad(input) {
  // 危险: 输入可能包含 UNION 注入
  const sql = "SELECT id, name FROM products WHERE name LIKE '%" + input + "%'";
  return db.query(sql);
}

// ============================================================
// 示例7: 多行SQL构建
// ============================================================
function complexQuery_bad(filters) {
  let sql = \`
    SELECT u.id, u.username, o.order_number, o.total
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    WHERE 1=1
  \`;
  
  if (filters.userId) {
    // 危险: 直接拼接
    sql += " AND u.id = " + filters.userId;
  }
  
  if (filters.startDate) {
    sql += \` AND o.created_at >= '\${filters.startDate}'\`;
  }
  
  if (filters.status) {
    sql += " AND o.status = '" + filters.status + "'";
  }
  
  sql += " ORDER BY o.created_at DESC";
  
  return db.query(sql);
}

// ============================================================
// 示例8: 批量操作中的注入
// ============================================================
function batchDelete_bad(ids) {
  // 危险: 直接拼接IN子句
  const sql = "DELETE FROM temp_data WHERE id IN (" + ids.join(',') + ")";
  return db.run(sql);
}

function bulkInsert_bad(records) {
  let values = records.map(r => 
    "('" + r.name + "', " + r.value + ")"
  ).join(',');
  
  const sql = "INSERT INTO logs (name, value) VALUES " + values;
  return db.run(sql);
}

// ============================================================
// 正确写法示例 (用于对比)
// ============================================================
function getUserById_good(userId) {
  const sql = "SELECT * FROM users WHERE id = ?";
  return db.query(sql, [userId]);
}

function searchUsers_good(searchTerm) {
  const sql = "SELECT * FROM users WHERE username LIKE ?";
  return db.query(sql, ['%' + searchTerm + '%']);
}

function getTableData_good(tableName) {
  const ALLOWED_TABLES = ['users', 'products', 'orders', 'logs'];
  
  if (!ALLOWED_TABLES.includes(tableName)) {
    throw new Error('Invalid table name');
  }
  
  // 表名不能参数化，但已通过白名单验证
  const sql = \`SELECT * FROM \${tableName}\`;
  return db.query(sql);
}

module.exports = {
  getUserById_bad,
  createUser_bad,
  searchUsers_bad,
  updateUser_bad,
  login_bad,
  getProduct_bad,
  searchProducts_bad,
  getTableData_bad,
  dynamicJoin_bad,
  formatQuery_bad,
  conditionalQuery_bad,
  searchWithUnion_bad,
  complexQuery_bad,
  batchDelete_bad,
  bulkInsert_bad
};
`;

    await fs.writeFile(filePath, content, 'utf-8');
    return { path: filePath, relativePath: 'src/bad-examples.js' };
  }

  async _createUserControllerJs(dir) {
    const filePath = path.join(dir, 'src', 'controllers', 'user-controller.js');
    await fs.ensureDir(path.dirname(filePath));

    const content = `// 用户控制器 - 包含多个SQL注入漏洞示例
// 仅用于测试扫描器

const db = require('../db-util');

// 获取用户列表
async function getUsers(req, res) {
  const search = req.query.search || '';
  const sortBy = req.query.sortBy || 'id';
  const sortOrder = req.query.sortOrder || 'ASC';

  // 漏洞1: 搜索条件直接拼接
  let sql = "SELECT * FROM users WHERE 1=1";
  
  if (search) {
    sql += " AND (username LIKE '%" + search + "%' OR email LIKE '%" + search + "%')";
  }

  // 漏洞2: 排序字段直接拼接 (无白名单)
  sql += \` ORDER BY \${sortBy} \${sortOrder}\`;

  try {
    const users = await db.query(sql);
    res.json({ success: true, data: users });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
}

// 用户登录
async function login(req, res) {
  const { username, password } = req.body;

  // 漏洞: 直接拼接用户名和密码
  const sql = \`
    SELECT * FROM users 
    WHERE username = '\${username}' 
    AND password = '\${password}'
    LIMIT 1
  \`;

  try {
    const users = await db.query(sql);
    
    if (users.length > 0) {
      res.json({ success: true, user: users[0] });
    } else {
      res.json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
}

// 更新用户资料
async function updateProfile(req, res) {
  const userId = req.params.id;
  const { field, value } = req.body;

  // 漏洞: 动态字段名和值都直接拼接
  const sql = \`
    UPDATE users 
    SET \${field} = '\${value}'
    WHERE id = \${userId}
  \`;

  try {
    await db.run(sql);
    res.json({ success: true, message: 'Profile updated' });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
}

// 删除用户
async function deleteUser(req, res) {
  const userId = req.query.userId;

  // 漏洞: 直接使用查询参数
  const sql = "DELETE FROM users WHERE id = " + userId;

  try {
    await db.run(sql);
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
}

module.exports = {
  getUsers,
  login,
  updateProfile,
  deleteUser
};
`;

    await fs.writeFile(filePath, content, 'utf-8');
    return { path: filePath, relativePath: 'src/controllers/user-controller.js' };
  }

  async _createAuthModuleJs(dir) {
    const filePath = path.join(dir, 'src', 'modules', 'auth.js');
    await fs.ensureDir(path.dirname(filePath));

    const content = `// 认证模块 - SQL注入示例

const db = require('../db-util');

// 检查用户权限
function checkPermission(userId, resource) {
  // 漏洞: 字符串拼接
  const sql = "SELECT * FROM permissions WHERE user_id = " + userId + 
              " AND resource = '" + resource + "'";
  
  const result = db.query(sql);
  return result.length > 0;
}

// 获取用户角色
function getUserRoles(userId) {
  // 漏洞: 模板字面量
  const sql = \`
    SELECT r.* FROM roles r
    JOIN user_roles ur ON r.id = ur.role_id
    WHERE ur.user_id = \${userId}
  \`;
  
  return db.query(sql);
}

// 登录日志
function logLogin(username, success) {
  const successInt = success ? 1 : 0;
  
  // 漏洞: 虽然是内部变量，但拼接方式危险
  const sql = "INSERT INTO login_logs (username, success, login_time) " +
              "VALUES ('" + username + "', " + successInt + ", datetime('now'))";
  
  return db.run(sql);
}

// 重置密码
function resetPassword(email, newPassword) {
  // 漏洞: 直接拼接
  const sql = require('util').format(
    "UPDATE users SET password = '%s' WHERE email = '%s'",
    newPassword, email
  );
  
  return db.run(sql);
}

module.exports = {
  checkPermission,
  getUserRoles,
  logLogin,
  resetPassword
};
`;

    await fs.writeFile(filePath, content, 'utf-8');
    return { path: filePath, relativePath: 'src/modules/auth.js' };
  }

  async _createProductRoutesJs(dir) {
    const filePath = path.join(dir, 'src', 'routes', 'products.js');
    await fs.ensureDir(path.dirname(filePath));

    const content = `// 产品路由 - 包含SQL注入的API示例

const express = require('express');
const router = express.Router();
const db = require('../db-util');

// 获取产品列表
router.get('/', async (req, res) => {
  const { category, minPrice, maxPrice, keyword, limit } = req.query;

  let sql = "SELECT * FROM products WHERE 1=1";

  if (category) {
    sql += " AND category = '" + category + "'";
  }

  if (minPrice) {
    sql += " AND price >= " + minPrice;
  }

  if (maxPrice) {
    sql += " AND price <= " + maxPrice;
  }

  if (keyword) {
    sql += " AND (name LIKE '%" + keyword + "%' OR description LIKE '%" + keyword + "%')";
  }

  if (limit) {
    sql += " LIMIT " + limit;
  }

  try {
    const products = await db.query(sql);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个产品
router.get('/:id', async (req, res) => {
  const productId = req.params.id;

  // 漏洞: 直接拼接
  const sql = \`SELECT * FROM products WHERE id = \${productId}\`;

  try {
    const products = await db.query(sql);
    if (products.length > 0) {
      res.json(products[0]);
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 高级搜索
router.post('/search', async (req, res) => {
  const { filters, table, joinTables } = req.body;

  // 漏洞: 动态表名
  let sql = \`SELECT * FROM \${table} WHERE 1=1\`;

  // 漏洞: 动态连接表
  if (joinTables && Array.isArray(joinTables)) {
    for (const join of joinTables) {
      sql += \` \${join.type} JOIN \${join.table} ON \${join.condition}\`;
    }
  }

  // 漏洞: 动态过滤条件
  if (filters) {
    for (const [field, value] of Object.entries(filters)) {
      if (typeof value === 'string') {
        sql += " AND " + field + " = '" + value + "'";
      } else {
        sql += " AND " + field + " = " + value;
      }
    }
  }

  try {
    const results = await db.query(sql);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message, sql: sql });
  }
});

// 批量更新
router.put('/batch', async (req, res) => {
  const { ids, updates } = req.body;

  // 漏洞: 直接拼接IN子句
  const idList = ids.join(',');

  let setClauses = [];
  for (const [field, value] of Object.entries(updates)) {
    if (typeof value === 'string') {
      setClauses.push(\`\${field} = '\${value}'\`);
    } else {
      setClauses.push(\`\${field} = \${value}\`);
    }
  }

  const sql = \`
    UPDATE products 
    SET \${setClauses.join(', ')}
    WHERE id IN (\${idList})
  \`;

  try {
    await db.run(sql);
    res.json({ success: true, updated: ids.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
`;

    await fs.writeFile(filePath, content, 'utf-8');
    return { path: filePath, relativePath: 'src/routes/products.js' };
  }

  async _createDbUtilJs(dir) {
    const filePath = path.join(dir, 'src', 'db-util.js');
    await fs.ensureDir(path.dirname(filePath));

    const content = `// 数据库工具模块 (模拟)
// 这是一个模拟的数据库连接模块
// 用于展示SQL语句是如何被构建和执行的

const sqlite3 = require('sqlite3').verbose();

class Database {
  constructor(dbPath) {
    this.db = new sqlite3.Database(dbPath || './data/app.db');
  }

  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      console.log('[DEBUG] Executing SQL:', sql);
      if (params.length > 0) {
        console.log('[DEBUG] With params:', params);
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      console.log('[DEBUG] Running SQL:', sql);
      if (params.length > 0) {
        console.log('[DEBUG] With params:', params);
      }

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

// 单例实例
let instance = null;

function getInstance() {
  if (!instance) {
    instance = new Database();
  }
  return instance;
}

module.exports = {
  Database,
  getInstance,
  query: (sql, params) => getInstance().query(sql, params),
  run: (sql, params) => getInstance().run(sql, params)
};
`;

    await fs.writeFile(filePath, content, 'utf-8');
    return { path: filePath, relativePath: 'src/db-util.js' };
  }

  async _createBadExamplesPy(dir) {
    const filePath = path.join(dir, 'examples', 'bad-examples.py');
    await fs.ensureDir(path.dirname(filePath));

    const content = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Python SQL注入漏洞示例
仅用于测试扫描器，切勿在生产环境中使用！
"""

import sqlite3
import os


class BadDatabase:
    def __init__(self, db_path):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row

    def get_user_by_id_bad(self, user_id):
        """漏洞: 字符串拼接"""
        sql = "SELECT * FROM users WHERE id = " + str(user_id)
        cursor = self.conn.execute(sql)
        return cursor.fetchone()

    def search_users_bad(self, search_term):
        """漏洞: 字符串格式化"""
        sql = "SELECT * FROM users WHERE username LIKE '%%%s%%'" % search_term
        cursor = self.conn.execute(sql)
        return cursor.fetchall()

    def create_user_bad(self, username, email, password):
        """漏洞: f-string拼接"""
        sql = f"INSERT INTO users (username, email, password) VALUES ('{username}', '{email}', '{password}')"
        self.conn.execute(sql)
        self.conn.commit()

    def get_table_data_bad(self, table_name):
        """漏洞: 动态表名无白名单"""
        sql = "SELECT * FROM " + table_name
        cursor = self.conn.execute(sql)
        return cursor.fetchall()

    def login_bad(self, username, password):
        """漏洞: 多条件拼接"""
        sql = f"SELECT * FROM users WHERE username = '{username}' AND password = '{password}'"
        cursor = self.conn.execute(sql)
        return cursor.fetchone()

    def complex_query_bad(self, filters):
        """漏洞: 复杂条件构建"""
        sql = "SELECT * FROM orders WHERE 1=1"
        
        if 'user_id' in filters:
            sql += " AND user_id = " + str(filters['user_id'])
        
        if 'status' in filters:
            sql += " AND status = '%s'" % filters['status']
        
        if 'start_date' in filters:
            sql += f" AND created_at >= '{filters['start_date']}'"
        
        cursor = self.conn.execute(sql)
        return cursor.fetchall()

    def batch_delete_bad(self, ids):
        """漏洞: IN子句拼接"""
        id_list = ','.join(map(str, ids))
        sql = "DELETE FROM temp_data WHERE id IN (" + id_list + ")"
        self.conn.execute(sql)
        self.conn.commit()


def correct_examples():
    """正确写法示例"""
    
    def get_user_by_id_good(conn, user_id):
        """参数绑定"""
        sql = "SELECT * FROM users WHERE id = ?"
        cursor = conn.execute(sql, (user_id,))
        return cursor.fetchone()

    def search_users_good(conn, search_term):
        """参数绑定"""
        sql = "SELECT * FROM users WHERE username LIKE ?"
        cursor = conn.execute(sql, ('%' + search_term + '%',))
        return cursor.fetchall()

    ALLOWED_TABLES = ['users', 'products', 'orders']

    def get_table_data_good(conn, table_name):
        """白名单验证"""
        if table_name not in ALLOWED_TABLES:
            raise ValueError("Invalid table name")
        
        sql = f"SELECT * FROM {table_name}"
        cursor = conn.execute(sql)
        return cursor.fetchall()


if __name__ == '__main__':
    print("This file contains SQL injection examples for testing purposes only.")
    print("Do NOT use in production!")
`;

    await fs.writeFile(filePath, content, 'utf-8');
    return { path: filePath, relativePath: 'examples/bad-examples.py' };
  }

  async _createSearchPhp(dir) {
    const filePath = path.join(dir, 'examples', 'search.php');
    await fs.ensureDir(path.dirname(filePath));

    const content = `<?php
/**
 * PHP SQL注入漏洞示例
 * 仅用于测试扫描器，切勿在生产环境中使用！
 */

class BadSearch {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function searchUsers_bad($search) {
        // 漏洞: 字符串拼接
        $sql = "SELECT * FROM users WHERE username LIKE '%" . $search . "%'";
        return $this->conn->query($sql);
    }

    public function login_bad($username, $password) {
        // 漏洞: 直接嵌入
        $sql = "SELECT * FROM users WHERE username = '$username' AND password = '$password'";
        return $this->conn->query($sql);
    }

    public function getProduct_bad($id) {
        // 漏洞: 拼接
        $sql = "SELECT * FROM products WHERE id = " . $id;
        return $this->conn->query($sql);
    }

    public function dynamicTable_bad($table) {
        // 漏洞: 动态表名无白名单
        $sql = "SELECT * FROM " . $table;
        return $this->conn->query($sql);
    }

    public function orderBy_bad($field, $order) {
        // 漏洞: 排序字段直接拼接
        $sql = "SELECT * FROM users ORDER BY " . $field . " " . $order;
        return $this->conn->query($sql);
    }
}

// 处理请求示例
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $search = $_GET['search'] ?? '';
    $category = $_GET['category'] ?? '';
    
    // 漏洞: 多条件拼接
    $sql = "SELECT * FROM products WHERE 1=1";
    
    if ($search) {
        $sql .= " AND name LIKE '%" . $search . "%'";
    }
    
    if ($category) {
        $sql .= " AND category = '" . $category . "'";
    }
}

// 正确写法示例
class GoodSearch {
    private $conn;

    public function searchUsers_good($search) {
        // 参数绑定
        $sql = "SELECT * FROM users WHERE username LIKE ?";
        $stmt = $this->conn->prepare($sql);
        $searchParam = '%' . $search . '%';
        $stmt->bind_param('s', $searchParam);
        $stmt->execute();
        return $stmt->get_result();
    }

    const ALLOWED_TABLES = ['users', 'products', 'orders'];

    public function dynamicTable_good($table) {
        // 白名单
        if (!in_array($table, self::ALLOWED_TABLES)) {
            throw new Exception("Invalid table");
        }
        $sql = "SELECT * FROM " . $table;
        return $this->conn->query($sql);
    }
}
?>
`;

    await fs.writeFile(filePath, content, 'utf-8');
    return { path: filePath, relativePath: 'examples/search.php' };
  }

  async _createSqliteDatabase(dir) {
    const dataDir = path.join(dir, 'data');
    await fs.ensureDir(dataDir);
    const dbPath = path.join(dataDir, 'app.db');

    const SQL = require('sql.js');
    const db = new SQL.Database();

    db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL DEFAULT 0,
        category TEXT,
        stock INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        order_number TEXT UNIQUE NOT NULL,
        total REAL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        resource TEXT NOT NULL,
        can_read INTEGER DEFAULT 0,
        can_write INTEGER DEFAULT 0
      )
    `);

    db.run(`
      CREATE TABLE roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT
      )
    `);

    db.run(`
      CREATE TABLE user_roles (
        user_id INTEGER NOT NULL,
        role_id INTEGER NOT NULL,
        PRIMARY KEY (user_id, role_id)
      )
    `);

    db.run(`
      CREATE TABLE login_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        success INTEGER DEFAULT 0,
        login_time TEXT DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT
      )
    `);

    db.run(`INSERT INTO users (username, email, password) VALUES 
      ('admin', 'admin@example.com', 'admin123'),
      ('user1', 'user1@example.com', 'password1'),
      ('user2', 'user2@example.com', 'password2')`);

    db.run(`INSERT INTO products (name, description, price, category, stock) VALUES 
      ('Laptop', 'High performance laptop', 999.99, 'Electronics', 50),
      ('Mouse', 'Wireless mouse', 29.99, 'Accessories', 200),
      ('Keyboard', 'Mechanical keyboard', 79.99, 'Accessories', 100),
      ('Monitor', '4K Monitor', 399.99, 'Electronics', 30)`);

    db.run(`INSERT INTO orders (user_id, order_number, total, status) VALUES 
      (1, 'ORD-001', 999.99, 'completed'),
      (2, 'ORD-002', 109.98, 'pending'),
      (1, 'ORD-003', 399.99, 'shipped')`);

    db.run(`INSERT INTO roles (name, description) VALUES 
      ('admin', 'Administrator with full access'),
      ('user', 'Regular user'),
      ('guest', 'Guest user')`);

    const data = db.export();
    const buffer = Buffer.from(data);
    await fs.writeFile(dbPath, buffer);

    if (process.platform !== 'win32') {
      try {
        await fs.chmod(dbPath, 0o644);
      } catch (e) {}
    }

    return { path: dbPath, relativePath: 'data/app.db' };
  }

  async _createPackageJson(dir) {
    const filePath = path.join(dir, 'package.json');

    const content = {
      name: "sql-injection-examples",
      version: "1.0.0",
      description: "包含SQL注入漏洞的示例项目 (仅用于测试扫描器)",
      main: "src/index.js",
      scripts: {
        "scan": "echo '请使用 sql-scan 工具扫描此目录'",
        "test": "echo '这是漏洞示例项目，不是测试项目'"
      },
      keywords: [
        "sql-injection",
        "security",
        "vulnerability",
        "example"
      ],
      author: "",
      license: "MIT",
      dependencies: {
        "sqlite3": "^5.1.6",
        "express": "^4.18.2"
      },
      devDependencies: {}
    };

    await fs.writeFile(filePath, JSON.stringify(content, null, 2), 'utf-8');
    return { path: filePath, relativePath: 'package.json' };
  }

  async _createReadme(dir) {
    const filePath = path.join(dir, 'README.md');

    const content = `# SQL注入漏洞示例项目

⚠️ **警告**: 此项目包含已知的SQL注入漏洞！
此项目仅用于测试SQL注入扫描工具，**切勿在生产环境中使用**！

## 项目结构

\`\`\`
.
├── src/
│   ├── bad-examples.js          # 各种SQL注入漏洞示例
│   ├── db-util.js               # 数据库工具
│   ├── controllers/
│   │   └── user-controller.js   # 用户控制器 (含漏洞)
│   ├── modules/
│   │   └── auth.js              # 认证模块 (含漏洞)
│   └── routes/
│       └── products.js          # 产品路由 (含漏洞)
├── examples/
│   ├── bad-examples.py          # Python漏洞示例
│   └── search.php               # PHP漏洞示例
├── data/
│   └── app.db                    # SQLite测试数据库
└── README.md
\`\`\`

## 漏洞类型

此项目包含以下SQL注入漏洞类型：

### 1. 字符串拼接SQL (CRITICAL)
\`\`\`javascript
// 危险
const sql = "SELECT * FROM users WHERE id = " + userId;
\`\`\`

### 2. 模板字面量拼接SQL (CRITICAL)
\`\`\`javascript
// 危险
const sql = \`SELECT * FROM users WHERE username LIKE '%\${searchTerm}%'\`;
\`\`\`

### 3. 用户输入直接嵌入SQL (CRITICAL)
\`\`\`javascript
// 危险
const sql = \`SELECT * FROM users WHERE username = '\${req.body.username}'\`;
\`\`\`

### 4. 动态表名无白名单 (HIGH)
\`\`\`javascript
// 危险
const sql = \`SELECT * FROM \${tableName}\`;
\`\`\`

### 5. 字符串格式化函数 (HIGH)
\`\`\`javascript
// 危险
const sql = util.format("SELECT * FROM users WHERE id = %s", userId);
\`\`\`

## 扫描此项目

使用 sql-scan 工具扫描此项目：

\`\`\`bash
# 基本扫描
sql-scan scan -c .

# 同时检查数据库权限
sql-scan scan -c . -d ./data/app.db

# 只显示高危及以上问题
sql-scan scan -c . -l high

# 生成JSON和Markdown报告
sql-scan scan -c . -o both
\`\`\`

## 正确写法

### 参数绑定
\`\`\`javascript
// 正确
const sql = "SELECT * FROM users WHERE id = ?";
db.query(sql, [userId]);
\`\`\`

### 白名单验证动态表名
\`\`\`javascript
// 正确
const ALLOWED_TABLES = ['users', 'products', 'orders'];
if (!ALLOWED_TABLES.includes(tableName)) {
  throw new Error('Invalid table name');
}
const sql = \`SELECT * FROM \${tableName}\`;
\`\`\`

## 测试数据

数据库包含以下测试数据：

### Users
| id | username | email |
|----|----------|-------|
| 1 | admin | admin@example.com |
| 2 | user1 | user1@example.com |
| 3 | user2 | user2@example.com |

### Products
- Laptop ($999.99)
- Mouse ($29.99)
- Keyboard ($79.99)
- Monitor ($399.99)

## 免责声明

此项目仅用于教育和测试目的。使用这些代码造成的任何直接或间接损失，作者不承担任何责任。
`;

    await fs.writeFile(filePath, content, 'utf-8');
    return { path: filePath, relativePath: 'README.md' };
  }
}

module.exports = SeedProject;
