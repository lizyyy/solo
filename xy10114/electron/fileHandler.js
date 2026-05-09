const fs = require('fs')
const path = require('path')
const mammoth = require('mammoth')

class FileHandler {
  constructor(db) {
    this.db = db
  }

  async importFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: '文件不存在',
          errorType: 'FILE_NOT_FOUND',
          filePath: filePath
        }
      }

      const fileExt = path.extname(filePath).toLowerCase()
      if (fileExt !== '.docx') {
        return {
          success: false,
          error: '不支持的文件格式，仅支持 .docx 文件',
          errorType: 'UNSUPPORTED_FORMAT',
          filePath: filePath
        }
      }

      const duplicateCheck = this.db.checkDuplicate(filePath)
      if (duplicateCheck.exists) {
        return {
          success: false,
          error: '文件已导入过',
          errorType: 'DUPLICATE_FILE',
          filePath: filePath,
          existingContract: duplicateCheck.contract
        }
      }

      const fileName = path.basename(filePath)
      const fileSize = fs.statSync(filePath).size
      
      if (fileSize === 0) {
        return {
          success: false,
          error: '文件为空',
          errorType: 'EMPTY_FILE',
          filePath: filePath
        }
      }

      const content = await this.parseDocx(filePath)

      if (!content || content.trim().length === 0) {
        return {
          success: false,
          error: '无法解析文件内容或文件为空',
          errorType: 'PARSE_ERROR',
          filePath: filePath
        }
      }

      const result = this.db.saveContract({
        file_name: fileName,
        file_path: filePath,
        content: content
      })

      return {
        success: true,
        id: result.id,
        updated: result.updated,
        file_name: fileName,
        file_path: filePath,
        message: result.updated ? '文件已更新' : '文件导入成功'
      }

    } catch (error) {
      console.error('File import error:', error)
      return {
        success: false,
        error: `导入失败: ${error.message}`,
        errorType: 'UNKNOWN_ERROR',
        filePath: filePath
      }
    }
  }

  async parseDocx(filePath) {
    try {
      const result = await mammoth.extractRawText({ path: filePath })
      return result.value
    } catch (error) {
      console.error('DOCX parse error:', error)
      throw new Error('无法解析 Word 文档')
    }
  }

  async parseDocxToHtml(filePath) {
    try {
      const result = await mammoth.convertToHtml({ path: filePath })
      return result.value
    } catch (error) {
      console.error('DOCX to HTML error:', error)
      throw new Error('无法转换 Word 文档为 HTML')
    }
  }

  verifyFileExists(filePath) {
    try {
      const exists = fs.existsSync(filePath)
      return {
        exists: exists,
        filePath: filePath,
        message: exists ? '文件存在' : '文件不存在，可能已被移动或删除'
      }
    } catch (error) {
      return {
        exists: false,
        filePath: filePath,
        error: error.message
      }
    }
  }

  forceReimport(filePath) {
    return this.importFile(filePath)
  }
}

module.exports = FileHandler
