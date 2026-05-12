const path = require('path')
const fs = require('fs')

const APP_DATA = process.env.APPDATA || 
  (process.platform === 'darwin' ? 
    path.join(process.env.HOME, 'Library', 'Application Support') :
    path.join(process.env.HOME, '.local', 'share'))

const DB_DIR = path.join(APP_DATA, 'LegalContractReview')
const DB_FILE = path.join(DB_DIR, 'data.json')

const DEFAULT_DATA = {
  contracts: [],
  comments: [],
  comment_history: [],
  nextIds: {
    contract: 1,
    comment: 1,
    history: 1
  }
}

function now() {
  return new Date().toISOString()
}

class ContractDatabase {
  constructor() {
    this.data = null
  }

  init() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true })
    }
    
    if (!fs.existsSync(DB_FILE)) {
      this.data = JSON.parse(JSON.stringify(DEFAULT_DATA))
      this.save()
    } else {
      try {
        const content = fs.readFileSync(DB_FILE, 'utf-8')
        this.data = JSON.parse(content)
        if (!this.data.nextIds) {
          this.data.nextIds = { contract: 1, comment: 1, history: 1 }
        }
      } catch (e) {
        console.error('Database file corrupted, resetting:', e)
        this.data = JSON.parse(JSON.stringify(DEFAULT_DATA))
        this.save()
      }
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (e) {
      console.error('Failed to save database:', e)
    }
  }

  checkDuplicate(filePath) {
    const contract = this.data.contracts.find(c => c.file_path === filePath)
    return { exists: !!contract, contract }
  }

  saveContract(contractData) {
    const existing = this.data.contracts.find(c => c.file_path === contractData.file_path)
    
    if (existing) {
      existing.content = contractData.content
      existing.updated_at = now()
      existing.version = (existing.version || 1) + 1
      this.save()
      return { id: existing.id, updated: true }
    }

    const id = this.data.nextIds.contract++
    const newContract = {
      id,
      file_name: contractData.file_name,
      file_path: contractData.file_path,
      content: contractData.content,
      status: 'pending',
      created_at: now(),
      updated_at: now(),
      version: 1
    }
    this.data.contracts.push(newContract)
    this.save()
    return { id, updated: false }
  }

  getContracts() {
    return this.data.contracts.map(c => {
      const comments = this.data.comments.filter(cm => cm.contract_id === c.id)
      return {
        ...c,
        comment_count: comments.length,
        accepted_count: comments.filter(cm => cm.adoption_status === 'accepted').length,
        rejected_count: comments.filter(cm => cm.adoption_status === 'rejected').length,
        pending_count: comments.filter(cm => cm.adoption_status === 'pending').length
      }
    }).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
  }

  getContract(id) {
    return this.data.contracts.find(c => c.id === id) || null
  }

  updateContractStatus(id, status) {
    const validStatuses = ['pending', 'reviewing', 'completed', 'archived']
    if (!validStatuses.includes(status)) {
      throw new Error(`无效的状态值: ${status}`)
    }
    
    const contract = this.data.contracts.find(c => c.id === id)
    if (!contract) return { success: false }
    
    contract.status = status
    contract.updated_at = now()
    this.save()
    return { success: true }
  }

  deleteContract(id) {
    const beforeLen = this.data.contracts.length
    this.data.contracts = this.data.contracts.filter(c => c.id !== id)
    this.data.comments = this.data.comments.filter(c => c.contract_id !== id)
    this.data.comment_history = this.data.comment_history.filter(h => h.contract_id !== id)
    const deleted = beforeLen !== this.data.contracts.length
    if (deleted) this.save()
    return { success: deleted }
  }

  getComments(contractId) {
    return this.data.comments
      .filter(c => c.contract_id === contractId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }

  _recordHistory(comment, changeType) {
    const historyId = this.data.nextIds.history++
    this.data.comment_history.push({
      id: historyId,
      comment_id: comment.id,
      contract_id: comment.contract_id,
      clause_text: comment.clause_text,
      clause_type: comment.clause_type,
      risk_level: comment.risk_level,
      comment_text: comment.comment_text,
      reviewer: comment.reviewer,
      adoption_status: comment.adoption_status,
      version: comment.version,
      change_type: changeType,
      changed_at: now(),
      changed_by: comment.reviewer || null
    })
  }

  saveComment(comment) {
    const id = this.data.nextIds.comment++
    const newComment = {
      id,
      contract_id: comment.contract_id,
      clause_text: comment.clause_text,
      clause_type: comment.clause_type || null,
      risk_level: comment.risk_level || null,
      comment_text: comment.comment_text || null,
      reviewer: comment.reviewer || null,
      review_date: comment.review_date || now(),
      adoption_status: comment.adoption_status || 'pending',
      version: 1,
      created_at: now(),
      updated_at: now()
    }
    this.data.comments.push(newComment)
    this._recordHistory(newComment, 'INSERT')
    this.save()
    return { id, success: true }
  }

  updateComment(comment) {
    const validStatuses = ['pending', 'accepted', 'rejected', 'needs_review']
    if (comment.adoption_status && !validStatuses.includes(comment.adoption_status)) {
      throw new Error(`无效的采纳状态: ${comment.adoption_status}`)
    }

    const existing = this.data.comments.find(c => c.id === comment.id)
    if (!existing) return { success: false, message: '批注不存在' }

    const updatableFields = [
      'clause_text', 'clause_type', 'risk_level', 
      'comment_text', 'reviewer', 'review_date', 'adoption_status'
    ]
    
    let changed = false
    updatableFields.forEach(field => {
      if (comment[field] !== undefined && existing[field] !== comment[field]) {
        existing[field] = comment[field]
        changed = true
      }
    })
    
    if (!changed) {
      return { success: false, message: '没有可更新的字段' }
    }
    
    existing.updated_at = now()
    existing.version = (existing.version || 1) + 1
    
    this._recordHistory(existing, 'UPDATE')
    this.save()
    return { success: true }
  }

  deleteComment(id) {
    const beforeLen = this.data.comments.length
    this.data.comments = this.data.comments.filter(c => c.id !== id)
    this.data.comment_history = this.data.comment_history.filter(h => h.comment_id !== id)
    const deleted = beforeLen !== this.data.comments.length
    if (deleted) this.save()
    return { success: deleted }
  }

  getHistory(contractId) {
    let history = this.data.comment_history
    if (contractId) {
      history = history.filter(h => h.contract_id === contractId)
    }
    return history.sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at))
  }

  getAllHistory() {
    return this.getHistory(null)
  }

  close() {
    // No-op for JSON storage
  }
}

module.exports = ContractDatabase
