import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 确保 data 目录存在
const dataDir = join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, 'music-theory.db');

// 初始化数据库
const initDatabase = () => {
  const db = new Database(dbPath);
  
  // 启用外键约束
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  
  // 创建表
  createTables(db);
  
  return db;
};

const createTables = (db) => {
  // 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      role TEXT DEFAULT 'student', -- student, teacher
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 知识点表
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL, -- scale, chord, cadence, etc.
      description TEXT,
      parent_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES knowledge_points(id)
    )
  `);

  // 题库表
  db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      knowledge_point_id INTEGER,
      type TEXT NOT NULL, -- scale_identification, chord_construction, inversion, roman_numeral, cadence
      difficulty INTEGER DEFAULT 1, -- 1-5
      content TEXT NOT NULL, -- JSON 格式存储题目内容
      options TEXT, -- JSON 格式存储选项（选择题）
      correct_answer TEXT NOT NULL, -- JSON 格式存储正确答案
      explanation TEXT, -- 解析
      tags TEXT, -- JSON 格式存储标签
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points(id)
    )
  `);

  // 练习记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS practice_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      knowledge_point_id INTEGER,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      total_questions INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points(id)
    )
  `);

  // 答题记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      session_id INTEGER,
      user_answer TEXT NOT NULL,
      is_correct BOOLEAN NOT NULL,
      error_tags TEXT, -- JSON 格式存储错因标签
      time_spent INTEGER, -- 毫秒
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (question_id) REFERENCES questions(id),
      FOREIGN KEY (session_id) REFERENCES practice_sessions(id)
    )
  `);

  // 错题本表
  db.exec(`
    CREATE TABLE IF NOT EXISTS wrong_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      answer_id INTEGER NOT NULL,
      error_tags TEXT,
      teacher_comment TEXT,
      status TEXT DEFAULT 'active', -- active, reviewed, mastered
      review_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (question_id) REFERENCES questions(id),
      FOREIGN KEY (answer_id) REFERENCES answers(id)
    )
  `);

  // 批注表
  db.exec(`
    CREATE TABLE IF NOT EXISTS annotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL, -- 教师ID
      wrong_note_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (wrong_note_id) REFERENCES wrong_notes(id)
    )
  `);

  // 创建索引以提高查询性能
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_answers_user_id ON answers(user_id);
    CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);
    CREATE INDEX IF NOT EXISTS idx_answers_is_correct ON answers(is_correct);
    CREATE INDEX IF NOT EXISTS idx_wrong_notes_user_id ON wrong_notes(user_id);
    CREATE INDEX IF NOT EXISTS idx_wrong_notes_status ON wrong_notes(status);
    CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
    CREATE INDEX IF NOT EXISTS idx_questions_knowledge_point ON questions(knowledge_point_id);
  `);

  // 插入默认用户
  const defaultUser = db.prepare(`
    SELECT id FROM users WHERE username = 'student'
  `).get();

  if (!defaultUser) {
    db.prepare(`
      INSERT INTO users (username, email, role)
      VALUES ('student', 'student@example.com', 'student')
    `).run();

    db.prepare(`
      INSERT INTO users (username, email, role)
      VALUES ('teacher', 'teacher@example.com', 'teacher')
    `).run();
  }
};

export default initDatabase;
