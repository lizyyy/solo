const XLSX = require('xlsx')
const path = require('path')

const statusMap = {
  'pending': '待处理',
  'reviewing': '审核中',
  'completed': '已完成',
  'archived': '已归档'
}

const riskLevelMap = {
  'high': '高风险',
  'medium': '中风险',
  'low': '低风险',
  'none': '无风险'
}

const adoptionStatusMap = {
  'pending': '待采纳',
  'accepted': '已采纳',
  'rejected': '已拒绝',
  'needs_review': '需复核'
}

const clauseTypeMap = {
  'liability': '责任条款',
  'payment': '付款条款',
  'termination': '终止条款',
  'ip': '知识产权',
  'confidentiality': '保密条款',
  'warranty': '保修条款',
  'other': '其他'
}

class Exporter {
  constructor(db) {
    this.db = db
  }

  exportToExcel(contractId, outputPath) {
    try {
      const contract = this.db.getContract(contractId)
      if (!contract) {
        return { success: false, error: '合同不存在' }
      }

      const comments = this.db.getComments(contractId)
      
      const wb = XLSX.utils.book_new()
      
      const contractData = [{
        '合同名称': contract.file_name,
        '文件路径': contract.file_path,
        '状态': statusMap[contract.status] || contract.status,
        '版本': contract.version,
        '创建时间': this.formatDate(contract.created_at),
        '更新时间': this.formatDate(contract.updated_at),
        '批注数量': comments.length
      }]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(contractData), '合同信息')

      const commentsData = comments.map((c, idx) => ({
        '序号': idx + 1,
        '条款内容': c.clause_text,
        '条款类型': clauseTypeMap[c.clause_type] || c.clause_type || '',
        '风险等级': riskLevelMap[c.risk_level] || c.risk_level || '',
        '批注内容': c.comment_text || '',
        '批注人': c.reviewer || '',
        '批注日期': this.formatDate(c.review_date || c.created_at),
        '采纳状态': adoptionStatusMap[c.adoption_status] || c.adoption_status,
        '版本': c.version
      }))
      
      if (commentsData.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(commentsData), '批注清单')
      }

      XLSX.writeFile(wb, outputPath)
      
      return {
        success: true,
        path: outputPath,
        fileName: path.basename(outputPath),
        commentCount: comments.length
      }

    } catch (error) {
      console.error('Export error:', error)
      return { success: false, error: error.message }
    }
  }

  exportAllToExcel(outputPath) {
    try {
      const contracts = this.db.getContracts()
      
      const wb = XLSX.utils.book_new()
      
      const contractsData = contracts.map(c => ({
        '合同ID': c.id,
        '合同名称': c.file_name,
        '状态': statusMap[c.status] || c.status,
        '批注总数': c.comment_count,
        '已采纳': c.accepted_count,
        '已拒绝': c.rejected_count,
        '待处理': c.pending_count,
        '版本': c.version,
        '创建时间': this.formatDate(c.created_at),
        '更新时间': this.formatDate(c.updated_at)
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(contractsData), '合同汇总')

      const allComments = []
      contracts.forEach(contract => {
        const comments = this.db.getComments(contract.id)
        comments.forEach((c, idx) => {
          allComments.push({
            '合同名称': contract.file_name,
            '序号': idx + 1,
            '条款内容': c.clause_text,
            '条款类型': clauseTypeMap[c.clause_type] || c.clause_type || '',
            '风险等级': riskLevelMap[c.risk_level] || c.risk_level || '',
            '批注内容': c.comment_text || '',
            '批注人': c.reviewer || '',
            '批注日期': this.formatDate(c.review_date || c.created_at),
            '采纳状态': adoptionStatusMap[c.adoption_status] || c.adoption_status,
            '版本': c.version
          })
        })
      })

      if (allComments.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allComments), '全部批注')
      }

      XLSX.writeFile(wb, outputPath)
      
      return {
        success: true,
        path: outputPath,
        fileName: path.basename(outputPath),
        contractCount: contracts.length,
        commentCount: allComments.length
      }

    } catch (error) {
      console.error('Export all error:', error)
      return { success: false, error: error.message }
    }
  }

  formatDate(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}

module.exports = Exporter
