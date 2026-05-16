const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/compatibility-scoring.db');

class Database {
  constructor() {
    this.db = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('数据库连接失败:', err.message);
          reject(err);
        }
      });

      this.db.serialize(() => {
        this.db.run(`CREATE TABLE IF NOT EXISTS scoring_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_id TEXT UNIQUE NOT NULL,
          supplier_name TEXT NOT NULL,
          supplier_dir_before TEXT,
          supplier_dir_after TEXT,
          total_score INTEGER DEFAULT 100,
          risk_level TEXT DEFAULT 'low',
          status TEXT NOT NULL,
          material_summary TEXT,
          conclusion TEXT,
          zip_path TEXT,
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS score_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          record_id INTEGER NOT NULL,
          sample_id TEXT NOT NULL,
          sample_name TEXT NOT NULL,
          deduction_reason TEXT NOT NULL,
          deduction_points INTEGER NOT NULL,
          risk_level TEXT DEFAULT 'low',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (record_id) REFERENCES scoring_records(id) ON DELETE CASCADE
        )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS review_samples (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          expected_result TEXT,
          deduction_points INTEGER DEFAULT 0,
          risk_level TEXT DEFAULT 'low',
          category TEXT,
          is_boundary INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS exception_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          record_id INTEGER NOT NULL,
          exception_type TEXT NOT NULL,
          error_message TEXT NOT NULL,
          input_data TEXT,
          stack_trace TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (record_id) REFERENCES scoring_records(id) ON DELETE CASCADE
        )`);

        const insertSample = this.db.prepare(`INSERT OR IGNORE INTO review_samples 
          (id, name, description, expected_result, deduction_points, risk_level, category, is_boundary) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

        const samples = [
          ['sample_001', '人物露肤度检测-正常', '正常商务照片，无过度露肤', 'pass', 0, 'low', 'image_content', 0],
          ['sample_002', '人物露肤度检测-边界', '人物照片处于露肤标准边界', 'pass_with_warning', 5, 'medium', 'image_content', 1],
          ['sample_003', '人物露肤度检测-违规', '人物照片露肤过度', 'fail', 20, 'high', 'image_content', 0],
          ['sample_004', '图片清晰度检测-模糊', '图片分辨率过低，模糊不清', 'fail', 15, 'medium', 'image_quality', 0],
          ['sample_005', '图片格式检测-不支持', '使用不支持的WebP格式', 'fail', 10, 'low', 'image_format', 0],
          ['sample_006', '图片尺寸检测-过大', '图片尺寸超过最大限制', 'fail', 10, 'low', 'image_size', 0],
          ['sample_007', '水印检测-含违规水印', '图片包含竞品平台水印', 'fail', 25, 'high', 'watermark', 0],
          ['sample_008', '压缩包路径异常-边界', '压缩包路径包含特殊字符边界情况', 'fail', 5, 'medium', 'zip_path', 1]
        ];

        samples.forEach(sample => {
          insertSample.run(...sample);
        });
        insertSample.finalize();

        console.log('数据库初始化完成，预置样本数据已加载');
        resolve();
      });
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  prepare(sql) {
    return this.db.prepare(sql);
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

module.exports = new Database();
