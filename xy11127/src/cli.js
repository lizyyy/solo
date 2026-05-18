#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const CertificateVerifier = require('./verifier')

function printUsage() {
  console.log(`
职业培训班证书邮寄核对 CLI

用法:
  cert-verify <csv文件路径>
  cert-verify --help | -h

示例:
  cert-verify ./data/202405职业培训班邮寄名单.csv

输出说明:
  - 源文件和行号精准定位问题
  - 收件人改名提醒 (NAME_CHANGED)
  - 证书补印提醒 (CERT_REPRINT)
  - 可重复执行核对

必填列:
  学员姓名、身份证号、培训项目、证书编号、
  收件人姓名、收件电话、收件地址、快递单号
  `)
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--help') || args.includes('-h')) {
    printUsage()
    process.exit(0)
  }

  const filePath = args[0]
  
  if (!filePath) {
    console.error('错误: 请指定CSV文件路径')
    printUsage()
    process.exit(1)
  }

  const absolutePath = path.resolve(filePath)
  
  if (!fs.existsSync(absolutePath)) {
    console.error(`错误: 文件不存在: ${absolutePath}`)
    process.exit(1)
  }

  try {
    const verifier = new CertificateVerifier()
    const result = verifier.verify(absolutePath)
    
    console.log(verifier.formatReport(result))
    
    if (!result.success) {
      process.exit(1)
    }
  } catch (e) {
    console.error(`核对失败: ${e.message}`)
    if (e.sourceFile) {
      console.error(`源文件: ${e.sourceFile}, 行号: ${e.lineNumber}`)
    }
    process.exit(1)
  }
}

main()
