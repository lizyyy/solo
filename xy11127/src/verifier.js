const fs = require('fs')
const path = require('path')
const { parse } = require('csv-parse/sync')
const iconv = require('iconv-lite')
const {
  ColumnMissingError,
  DuplicateRowError,
  EncodingError,
  EmptyValueError,
  InvalidFormatError,
  VerificationError
} = require('./errors')

const REQUIRED_COLUMNS = [
  '学员姓名',
  '身份证号',
  '培训项目',
  '证书编号',
  '收件人姓名',
  '收件电话',
  '收件地址',
  '快递单号'
]

class CertificateVerifier {
  constructor(options = {}) {
    this.sourceFile = options.sourceFile || ''
    this.encoding = options.encoding || 'utf-8'
    this.errors = []
    this.warnings = []
    this.passedRecords = []
    this.seenKeys = new Map()
  }

  detectEncoding(buffer) {
    const gbkSample = iconv.decode(buffer.slice(0, 1024), 'gbk')
    const utf8Sample = iconv.decode(buffer.slice(0, 1024), 'utf-8')
    
    if (gbkSample.includes('学员姓名') || gbkSample.includes('证书编号')) {
      return 'gbk'
    }
    return 'utf-8'
  }

  readFile(filePath) {
    this.sourceFile = filePath
    try {
      const buffer = fs.readFileSync(filePath)
      const detectedEncoding = this.detectEncoding(buffer)
      this.encoding = detectedEncoding
      
      let content
      try {
        content = iconv.decode(buffer, detectedEncoding)
      } catch (e) {
        throw new EncodingError(`无法使用 ${detectedEncoding} 编码解码文件`, filePath, 0)
      }
      
      return content
    } catch (e) {
      if (e instanceof VerificationError) {
        throw e
      }
      throw new EncodingError(e.message, filePath, 0)
    }
  }

  parseCSV(content) {
    try {
      return parse(content, {
        columns: true,
        skip_empty_lines: false,
        relax_column_count: false,
        trim: true
      })
    } catch (e) {
      throw new EncodingError(`CSV解析失败: ${e.message}`, this.sourceFile, 0)
    }
  }

  validateHeaders(headers) {
    const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col))
    if (missingColumns.length > 0) {
      missingColumns.forEach(col => {
        this.errors.push(new ColumnMissingError(col, this.sourceFile, 1))
      })
      return false
    }
    return true
  }

  generateRecordKey(record) {
    const idCard = record['身份证号'] || ''
    const certNo = record['证书编号'] || ''
    return `${idCard}-${certNo}`.trim()
  }

  validateRecord(record, lineNumber) {
    const recordErrors = []

    REQUIRED_COLUMNS.forEach(col => {
      if (!record[col] || record[col].trim() === '') {
        recordErrors.push(new EmptyValueError(col, this.sourceFile, lineNumber + 2))
      }
    })

    if (record['身份证号'] && !/^\d{17}[\dXx]$/.test(record['身份证号'].trim())) {
      recordErrors.push(new InvalidFormatError('身份证号', record['身份证号'], '18位身份证号', this.sourceFile, lineNumber + 2))
    }

    if (record['收件电话'] && !/^1[3-9]\d{9}$/.test(record['收件电话'].trim())) {
      recordErrors.push(new InvalidFormatError('收件电话', record['收件电话'], '11位手机号', this.sourceFile, lineNumber + 2))
    }

    const key = this.generateRecordKey(record)
    if (this.seenKeys.has(key)) {
      const existingLine = this.seenKeys.get(key)
      recordErrors.push(new DuplicateRowError(key, this.sourceFile, lineNumber + 2, existingLine))
    } else {
      this.seenKeys.set(key, lineNumber + 2)
    }

    if (record['学员姓名'] !== record['收件人姓名']) {
      recordErrors.push({
        type: 'NAME_CHANGED',
        message: `收件人改名: 学员姓名 "${record['学员姓名']}" vs 收件人 "${record['收件人姓名']}"`,
        sourceFile: this.sourceFile,
        lineNumber: lineNumber + 2,
        details: {
          学员姓名: record['学员姓名'],
          收件人姓名: record['收件人姓名'],
          处理建议: '确认是否为代领或姓名变更，需学员签字授权'
        }
      })
    }

    if (record['证书编号'] && record['证书编号'].includes('补')) {
      recordErrors.push({
        type: 'CERT_REPRINT',
        message: `证书补印: ${record['证书编号']}`,
        sourceFile: this.sourceFile,
        lineNumber: lineNumber + 2,
        details: {
          证书编号: record['证书编号'],
          处理建议: '检查补印申请记录，确认审批流程'
        }
      })
    }

    if (recordErrors.length > 0) {
      this.errors.push(...recordErrors)
    } else {
      this.passedRecords.push(record)
    }

    return recordErrors
  }

  verify(filePath) {
    this.errors = []
    this.warnings = []
    this.passedRecords = []
    this.seenKeys.clear()

    const content = this.readFile(filePath)
    const records = this.parseCSV(content)

    if (records.length === 0) {
      return { success: false, errors: [new EncodingError('CSV文件为空', filePath, 0)] }
    }

    const headers = Object.keys(records[0])
    this.validateHeaders(headers)

    records.forEach((record, index) => {
      this.validateRecord(record, index)
    })

    return {
      success: this.errors.length === 0,
      totalRecords: records.length,
      passedRecords: this.passedRecords.length,
      failedRecords: records.length - this.passedRecords.length,
      errors: this.errors,
      warnings: this.warnings
    }
  }

  formatReport(result) {
    const report = []
    report.push('='.repeat(60))
    report.push('职业培训班证书邮寄核对报告')
    report.push('='.repeat(60))
    report.push(`源文件: ${this.sourceFile}`)
    report.push(`总记录数: ${result.totalRecords}`)
    report.push(`通过记录: ${result.passedRecords}`)
    report.push(`失败记录: ${result.failedRecords}`)
    report.push('')

    if (result.errors.length > 0) {
      report.push('问题摘要:')
      report.push('-'.repeat(60))
      
      const groupedErrors = {}
      result.errors.forEach(err => {
        const type = err.type || 'OTHER'
        if (!groupedErrors[type]) groupedErrors[type] = []
        groupedErrors[type].push(err)
      })

      Object.entries(groupedErrors).forEach(([type, errs]) => {
        report.push(`\n【${type}】共 ${errs.length} 项:`)
        errs.forEach(err => {
          const lineInfo = err.lineNumber > 0 ? `第 ${err.lineNumber} 行` : '文件级别'
          report.push(`  → ${err.message} (${lineInfo})`)
          if (err.details && err.details.处理建议) {
            report.push(`     处理建议: ${err.details.处理建议}`)
          }
        })
      })
    }

    report.push('')
    report.push('='.repeat(60))
    report.push('可复跑输出: 修正数据后重新运行本工具即可再次核对')
    report.push('='.repeat(60))

    return report.join('\n')
  }
}

module.exports = CertificateVerifier
