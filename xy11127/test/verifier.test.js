const fs = require('fs')
const path = require('path')
const CertificateVerifier = require('../src/verifier')

const DATA_DIR = path.join(__dirname, 'data')

describe('职业培训班证书邮寄核对 - 核心功能测试', () => {
  let verifier

  beforeEach(() => {
    verifier = new CertificateVerifier()
  })

  describe('1. 正常数据验证', () => {
    test('正常CSV文件应通过验证', () => {
      const filePath = path.join(DATA_DIR, 'normal_sample.csv')
      const result = verifier.verify(filePath)
      
      expect(result.success).toBe(true)
      expect(result.totalRecords).toBe(4)
      expect(result.passedRecords).toBe(4)
      expect(result.errors.length).toBe(0)
    })

    test('报告应包含正确的统计信息', () => {
      const filePath = path.join(DATA_DIR, 'normal_sample.csv')
      const result = verifier.verify(filePath)
      const report = verifier.formatReport(result)
      
      expect(report).toContain('职业培训班证书邮寄核对报告')
      expect(report).toContain('总记录数: 4')
      expect(report).toContain('通过记录: 4')
      expect(report).toContain('可复跑输出')
    })
  })

  describe('2. 缺列检测', () => {
    test('缺少必需列应报错', () => {
      const filePath = path.join(DATA_DIR, 'missing_columns.csv')
      const result = verifier.verify(filePath)
      
      expect(result.success).toBe(false)
      
      const columnErrors = result.errors.filter(e => e.type === 'COLUMN_MISSING')
      expect(columnErrors.length).toBeGreaterThan(0)
      
      const missingColumns = columnErrors.map(e => e.details.columnName)
      expect(missingColumns).toContain('收件电话')
      expect(missingColumns).toContain('收件地址')
      expect(missingColumns).toContain('快递单号')
      
      columnErrors.forEach(err => {
        expect(err.sourceFile).toBe(filePath)
        expect(err.lineNumber).toBe(1)
      })
    })
  })

  describe('3. 重复行检测', () => {
    test('重复记录应被检测并报告行号', () => {
      const filePath = path.join(DATA_DIR, 'problem_sample.csv')
      const result = verifier.verify(filePath)
      
      const duplicateErrors = result.errors.filter(e => e.type === 'DUPLICATE_ROW')
      expect(duplicateErrors.length).toBeGreaterThan(0)
      
      const duplicateError = duplicateErrors[0]
      expect(duplicateError.lineNumber).toBe(4)
      expect(duplicateError.details.existingLine).toBe(2)
      expect(duplicateError.sourceFile).toBe(filePath)
      expect(duplicateError.message).toContain('重复记录')
    })
  })

  describe('4. 业务场景 - 收件人改名', () => {
    test('学员姓名与收件人姓名不同应标记NAME_CHANGED', () => {
      const filePath = path.join(DATA_DIR, 'problem_sample.csv')
      const result = verifier.verify(filePath)
      
      const nameChangedErrors = result.errors.filter(e => e.type === 'NAME_CHANGED')
      expect(nameChangedErrors.length).toBe(1)
      
      const error = nameChangedErrors[0]
      expect(error.lineNumber).toBe(6)
      expect(error.sourceFile).toBe(filePath)
      expect(error.message).toContain('收件人改名')
      expect(error.details.学员姓名).toBe('陈七')
      expect(error.details.收件人姓名).toBe('陈七妈妈')
      expect(error.details.处理建议).toBeDefined()
    })
  })

  describe('5. 业务场景 - 证书补印', () => {
    test('证书编号包含"补"字应标记CERT_REPRINT', () => {
      const filePath = path.join(DATA_DIR, 'problem_sample.csv')
      const result = verifier.verify(filePath)
      
      const reprintErrors = result.errors.filter(e => e.type === 'CERT_REPRINT')
      expect(reprintErrors.length).toBe(1)
      
      const error = reprintErrors[0]
      expect(error.lineNumber).toBe(5)
      expect(error.sourceFile).toBe(filePath)
      expect(error.message).toContain('证书补印')
      expect(error.details.证书编号).toBe('CERT2024003补')
      expect(error.details.处理建议).toBeDefined()
    })
  })

  describe('6. 空值检测', () => {
    test('空值列应报错', () => {
      const filePath = path.join(DATA_DIR, 'problem_sample.csv')
      const result = verifier.verify(filePath)
      
      const emptyErrors = result.errors.filter(e => e.type === 'EMPTY_VALUE')
      expect(emptyErrors.length).toBeGreaterThan(0)
      
      const emptyPhone = emptyErrors.find(e => e.details.columnName === '收件电话')
      expect(emptyPhone).toBeDefined()
      expect(emptyPhone.lineNumber).toBe(5)
      expect(emptyPhone.sourceFile).toBe(filePath)
    })
  })

  describe('7. 格式验证', () => {
    test('身份证号格式错误应报错', () => {
      const filePath = path.join(DATA_DIR, 'problem_sample.csv')
      const result = verifier.verify(filePath)
      
      const formatErrors = result.errors.filter(e => 
        e.type === 'INVALID_FORMAT' && e.details.columnName === '身份证号'
      )
      expect(formatErrors.length).toBe(1)
      expect(formatErrors[0].lineNumber).toBe(7)
      expect(formatErrors[0].details.value).toBe('12345')
    })

    test('手机号格式错误应报错', () => {
      const filePath = path.join(DATA_DIR, 'problem_sample.csv')
      const result = verifier.verify(filePath)
      
      const formatErrors = result.errors.filter(e => 
        e.type === 'INVALID_FORMAT' && e.details.columnName === '收件电话'
      )
      expect(formatErrors.length).toBeGreaterThan(0)
    })
  })

  describe('8. 空文件/空目录测试', () => {
    test('空数据文件应报错', () => {
      const filePath = path.join(DATA_DIR, 'empty.csv')
      const result = verifier.verify(filePath)
      
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('9. 部分失败场景', () => {
    test('部分记录失败应统计正确', () => {
      const filePath = path.join(DATA_DIR, 'problem_sample.csv')
      const result = verifier.verify(filePath)
      
      expect(result.totalRecords).toBe(6)
      expect(result.passedRecords).toBeLessThan(6)
      expect(result.failedRecords).toBeGreaterThan(0)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('10. 可复跑测试 - 重复执行', () => {
    test('重复执行应得到一致结果', () => {
      const filePath = path.join(DATA_DIR, 'problem_sample.csv')
      
      const result1 = verifier.verify(filePath)
      const errorCount1 = result1.errors.length
      
      const verifier2 = new CertificateVerifier()
      const result2 = verifier2.verify(filePath)
      const errorCount2 = result2.errors.length
      
      expect(errorCount1).toBe(errorCount2)
      expect(result1.totalRecords).toBe(result2.totalRecords)
      expect(result1.passedRecords).toBe(result2.passedRecords)
    })

    test('错误信息应包含源文件和行号', () => {
      const filePath = path.join(DATA_DIR, 'problem_sample.csv')
      const result = verifier.verify(filePath)
      
      result.errors.forEach(err => {
        expect(err.sourceFile).toBeDefined()
        expect(err.lineNumber).toBeDefined()
        expect(err.sourceFile).toContain('problem_sample.csv')
      })
    })
  })

  describe('11. 错误输出格式', () => {
    test('VerificationError应能转成JSON', () => {
      const { ColumnMissingError } = require('../src/errors')
      const error = new ColumnMissingError('测试列', '/test/file.csv', 5)
      
      const json = error.toJSON()
      expect(json.sourceFile).toBe('/test/file.csv')
      expect(json.lineNumber).toBe(5)
      expect(json.type).toBe('COLUMN_MISSING')
    })

    test('VerificationError应能转成可读字符串', () => {
      const { ColumnMissingError } = require('../src/errors')
      const error = new ColumnMissingError('测试列', '/test/file.csv', 5)
      
      const str = error.toString()
      expect(str).toContain('COLUMN_MISSING')
      expect(str).toContain('测试列')
      expect(str).toContain('/test/file.csv')
      expect(str).toContain('5')
    })
  })
})

describe('职业培训班证书邮寄核对 - 边界条件测试', () => {
  let verifier

  beforeEach(() => {
    verifier = new CertificateVerifier()
  })

  test('文件不存在应抛出异常', () => {
    const nonExistentFile = path.join(DATA_DIR, 'nonexistent.csv')
    expect(() => verifier.verify(nonExistentFile)).toThrow()
  })

  test('重复执行不应累积错误', () => {
    const filePath = path.join(DATA_DIR, 'problem_sample.csv')
    
    verifier.verify(filePath)
    const firstErrorCount = verifier.errors.length
    
    verifier.verify(filePath)
    const secondErrorCount = verifier.errors.length
    
    expect(firstErrorCount).toBe(secondErrorCount)
  })
})
