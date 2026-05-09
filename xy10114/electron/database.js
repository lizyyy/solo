const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const APP_DATA = process.env.APPDATA || 
  (process.platform === 'darwin' ? 
    path.join(process.env.HOME, 'Library', 'Application Support') :
    path.join(process.env.HOME, '.local', 'share'))

const DB_DIR = path.join(APP_DATA, 'LegalContractReview')
const DB_PATH = path.join(DB_DIR, 'contracts.db')

class ContractDatabase {
  constructor() {
    this.db = null
  }

  init() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true })
    }

    this.db = new Database(DB_PATH)
    this.db.pragma('journal_mode = WAL')
    
    this.createTables()
    this.addHistoryTrigger()
  }

  createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        version INTEGER DEFAULT 1,
        UNIQUE(file_path)
      );

      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_id INTEGER NOT NULL,
        clause_text TEXT NOT NULL,
        clause_type TEXT,
        risk_level TEXT,
        comment_text TEXT,
        reviewer TEXT,
        review_date DATETIME,
        adoption_status TEXT DEFAULT 'pending',
        version INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS comment_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comment_id INTEGER NOT NULL,
        contract_id INTEGER NOT NULL,
        clause_text TEXT,
        clause_type TEXT,
        risk_level TEXT,
        comment_text TEXT,
        reviewer TEXT,
        adoption_status TEXT,
        version INTEGER,
        change_type TEXT,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        changed_by TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_comments_contract ON comments(contract_id);
      CREATE INDEX IF NOT EXISTS idx_history_comment ON comment_history(comment_id);
      CREATE INDEX IF NOT EXISTS idx_history_contract ON comment_history(contract_id);
    `)
  }

  addHistoryTrigger() {
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_comment_insert
      AFTER INSERT ON comments
      FOR EACH ROW
      BEGIN
        INSERT INTO comment_history (
          comment_id, contract_id, clause_text, clause_type, risk_level,
          comment_text, reviewer, adoption_status, version, change_type
        ) VALUES (
          NEW.id, NEW.contract_id, NEW.clause_text, NEW.clause_type, NEW.risk_level,
          NEW.comment_text, NEW.reviewer, NEW.adoption_status, NEW.version, 'INSERT'
        );
      END;

      CREATE TRIGGER IF NOT EXISTS trg_comment_update
      AFTER UPDATE ON comments
      FOR EACH ROW
      BEGIN
        INSERT INTO comment_history (
          comment_id, contract_id, clause_text, clause_type, risk_level,
          comment_text, reviewer, adoption_status, version, change_type
        ) VALUES (
          NEW.id, NEW.contract_id, NEW.clause_text, NEW.clause_type, NEW.risk_level,
          NEW.comment_text, NEW.reviewer, NEW.adoption_status, NEW.version, 'UPDATE'
        );
      END;
    `)
  }

  checkDuplicate(filePath) {
    const stmt = this.db.prepare('SELECT id, file_name FROM contracts WHERE file_path = ?')
    const result = stmt.get(filePath)
    return { exists: !!result, contract: result }
  }

  saveContract(contractData) {
    const existing = this.db.prepare('SELECT id FROM contracts WHERE file_path = ?').get(contractData.file_path)
    
    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE contracts 
        SET content = ?, updated_at = CURRENT_TIMESTAMP, version = version + 1
        WHERE file_path = ?
      `)
      const result = stmt.run(contractData.content, contractData.file_path)
      return { id: existing.id, updated: true }
    }

    const stmt = this.db.prepare(`
      INSERT INTO contracts (file_name, file_path, content, status)
      VALUES (?, ?, ?, 'pending')
    `)
    const result = stmt.run(
      contractData.file_name,
      contractData.file_path,
      contractData.content
    )
    return { id: result.lastInsertRowid, updated: false }
  }

  getContracts() {
    const stmt = this.db.prepare(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM comments WHERE contract_id = c.id) as comment_count,
             (SELECT COUNT(*) FROM comments WHERE contract_id = c.id AND adoption_status = 'accepted') as accepted_count,
             (SELECT COUNT(*) FROM comments WHERE contract_id = c.id AND adoption_status = 'rejected') as rejected_count,
             (SELECT COUNT(*) FROM comments WHERE contract_id = c.id AND adoption_status = 'pending') as pending_count
      FROM contracts c
      ORDER BY c.updated_at DESC
    `)
    return stmt.all()
  }

  getContract(id) {
    const stmt = this.db.prepare('SELECT * FROM contracts WHERE id = ?')
    return stmt.get(id)
  }

  updateContractStatus(id, status) {
    const validStatuses = ['pending', 'reviewing', 'completed', 'archived']
    if (!validStatuses.includes(status)) {
      throw new Error(`无效的状态值: ${status}`)
    }
    
    const stmt = this.db.prepare(`
      UPDATE contracts 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    const result = stmt.run(status, id)
    return { success: result.changes > 0 }
  }

  deleteContract(id) {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM comment_history WHERE contract_id = ?').run(id)
      this.db.prepare('DELETE FROM comments WHERE contract_id = ?').run(id)
      const result = this.db.prepare('DELETE FROM contracts WHERE id = ?').run(id)
      return result.changes > 0
    })
    return { success: tx() }
  }

  getComments(contractId) {
    const stmt = this.db.prepare(`
      SELECT * FROM comments 
      WHERE contract_id = ? 
      ORDER BY created_at DESC
    `)
    return stmt.all(contractId)
  }

  saveComment(comment) {
    const stmt = this.db.prepare(`
      INSERT INTO comments (
        contract_id, clause_text, clause_type, risk_level,
        comment_text, reviewer, review_date, adoption_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      comment.contract_id,
      comment.clause_text,
      comment.clause_type || null,
      comment.risk_level || null,
      comment.comment_text || null,
      comment.reviewer || null,
      comment.review_date || new Date().toISOString(),
      comment.adoption_status || 'pending'
    )
    
    return { id: result.lastInsertRowid, success: true }
  }

  updateComment(comment) {
    const validStatuses = ['pending', 'accepted', 'rejected', 'needs_review']
    if (comment.adoption_status && !validStatuses.includes(comment.adoption_status)) {
      throw new Error(`无效的采纳状态: ${comment.adoption_status}`)
    }

    const fields = []
    const values = []
    
    const updatableFields = [
      'clause_text', 'clause_type', 'risk_level', 
      'comment_text', 'reviewer', 'review_date', 'adoption_status'
    ]
    
    updatableFields.forEach(field => {
      if (comment[field] !== undefined) {
        fields.push(`${field} = ?`)
        values.push(comment[field])
      }
    })
    
    if (fields.length === 0) {
      return { success: false, message: '没有可更新的字段' }
    }
    
    fields.push('updated_at = CURRENT_TIMESTAMP')
    fields.push('version = version + 1')
    values.push(comment.id)
    
    const stmt = this.db.prepare(`
      UPDATE comments 
      SET ${fields.join(', ')}
      WHERE id = ?
    `)
    
    const result = stmt.run(...values)
    return { success: result.changes > 0 }
  }

  deleteComment(id) {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM comment_history WHERE comment_id = ?').run(id)
      const result = this.db.prepare('DELETE FROM comments WHERE id = ?').run(id)
      return result.changes > 0
    })
    return { success: tx() }
  }

  getHistory(contractId) {
    const stmt = this.db.prepare(`
      SELECT ch.*, c.file_name
      FROM comment_history ch
      LEFT JOIN contracts c ON ch.contract_id = c.id
      ${contractId ? 'WHERE ch.contract_id = ?' : ''}
      ORDER BY ch.changed_at DESC
    `)
    
    return contractId ? stmt.all(contractId) : stmt.all()
  }

  getAllHistory() {
    return this.getHistory(null)
  }

  close() {
    if (this.db) {
      this.db.close()
    }
  }
}

module.exports = ContractDatabase
