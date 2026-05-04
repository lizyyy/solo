#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const ScanEngine = require('./core/ScanEngine')
const CheckEngine = require('./core/CheckEngine')
const ExportEngine = require('./core/ExportEngine')

class LicenseCheckerCLI {
  constructor() {
    this.commands = {
      scan: this.handleScan.bind(this),
      check: this.handleCheck.bind(this),
      export: this.handleExport.bind(this),
      help: this.handleHelp.bind(this)
    }
    
    this.options = {
      projectDir: process.cwd(),
      outputDir: process.cwd(),
      includeDevDependencies: true,
      includeTransitive: true,
      strict: false,
      format: ['json', 'markdown', 'html', 'notice'],
      verbose: false
    }
  }

  run(args) {
    const parsed = this.parseArgs(args)
    
    if (parsed.help || parsed.command === 'help') {
      this.handleHelp(parsed)
      return
    }

    if (!parsed.command) {
      console.error('错误: 未指定命令')
      console.error('使用 license-check help 查看帮助')
      process.exit(1)
    }

    const command = this.commands[parsed.command]
    if (!command) {
      console.error(`错误: 未知命令 '${parsed.command}'`)
      console.error('使用 license-check help 查看帮助')
      process.exit(1)
    }

    try {
      command(parsed)
    } catch (error) {
      console.error(`执行出错: ${error.message}`)
      if (parsed.verbose) {
        console.error(error.stack)
      }
      process.exit(1)
    }
  }

  parseArgs(args) {
    const parsed = {
      command: null,
      help: false,
      verbose: false,
      strict: false,
      includeDevDependencies: true,
      includeTransitive: true,
      projectDir: process.cwd(),
      outputDir: process.cwd(),
      format: ['json', 'markdown', 'html', 'notice']
    }

    let i = 0
    while (i < args.length) {
      const arg = args[i]
      
      if (arg === '--' || arg === '-') {
        i++
        continue
      }
      
      if (arg.startsWith('--')) {
        const equalsIndex = arg.indexOf('=')
        let key, value
        
        if (equalsIndex !== -1) {
          key = arg.substring(2, equalsIndex)
          value = arg.substring(equalsIndex + 1)
        } else {
          key = arg.substring(2)
          value = args[i + 1] && !args[i + 1].startsWith('-') ? args[i + 1] : true
          if (value !== true) i++
        }

        this.applyOption(parsed, key, value)
      } else if (arg.startsWith('-') && arg.length > 1) {
        const shortArgs = arg.substring(1).split('')
        
        for (let j = 0; j < shortArgs.length; j++) {
          const shortKey = shortArgs[j]
          const isLast = j === shortArgs.length - 1
          
          let value = true
          if (isLast && args[i + 1] && !args[i + 1].startsWith('-')) {
            if (this.optionRequiresValue(shortKey)) {
              value = args[i + 1]
              i++
            }
          }
          
          this.applyShortOption(parsed, shortKey, value)
        }
      } else if (!parsed.command) {
        parsed.command = arg.toLowerCase()
      }
      
      i++
    }

    return parsed
  }

  optionRequiresValue(shortKey) {
    const requiresValue = {
      'd': true,
      'o': true,
      'f': true
    }
    return requiresValue[shortKey] || false
  }

  applyShortOption(parsed, shortKey, value) {
    switch (shortKey) {
      case 'h':
        parsed.help = true
        break
      case 'v':
        parsed.verbose = true
        break
      case 'd':
        if (typeof value !== 'string') {
          console.error('错误: -d 需要指定目录路径')
          process.exit(1)
        }
        parsed.projectDir = this.resolvePath(value)
        break
      case 'o':
        if (typeof value !== 'string') {
          console.error('错误: -o 需要指定输出目录')
          process.exit(1)
        }
        parsed.outputDir = this.resolvePath(value)
        break
      case 'f':
        if (typeof value !== 'string') {
          console.error('错误: -f 需要指定格式')
          process.exit(1)
        }
        parsed.format = value.split(',').map(f => f.trim().toLowerCase())
        break
      default:
        console.error(`错误: 未知选项 -${shortKey}`)
        process.exit(1)
    }
  }

  applyOption(parsed, key, value) {
    switch (key) {
      case 'help':
      case 'h':
        parsed.help = true
        break
      case 'verbose':
      case 'v':
        parsed.verbose = true
        break
      case 'strict':
        parsed.strict = true
        break
      case 'no-dev':
        parsed.includeDevDependencies = false
        break
      case 'no-transitive':
        parsed.includeTransitive = false
        break
      case 'dir':
      case 'd':
        if (typeof value !== 'string') {
          console.error('错误: --dir 需要指定目录路径')
          process.exit(1)
        }
        parsed.projectDir = this.resolvePath(value)
        break
      case 'output':
      case 'o':
        if (typeof value !== 'string') {
          console.error('错误: --output 需要指定输出目录')
          process.exit(1)
        }
        parsed.outputDir = this.resolvePath(value)
        break
      case 'format':
      case 'f':
        if (typeof value !== 'string') {
          console.error('错误: --format 需要指定格式')
          process.exit(1)
        }
        parsed.format = value.split(',').map(f => f.trim().toLowerCase())
        break
      default:
        console.error(`错误: 未知选项 --${key}`)
        process.exit(1)
    }
  }

  resolvePath(inputPath) {
    if (path.isAbsolute(inputPath)) {
      return inputPath
    }
    return path.resolve(process.cwd(), inputPath)
  }

  handleScan(parsed) {
    this.validateProjectDir(parsed.projectDir)
    
    if (parsed.verbose) {
      console.log(`扫描项目目录: ${parsed.projectDir}`)
      console.log(`输出目录: ${parsed.outputDir}`)
      console.log(`包含开发依赖: ${parsed.includeDevDependencies}`)
      console.log(`包含传递依赖: ${parsed.includeTransitive}`)
      console.log('')
    }

    const scanEngine = new ScanEngine(parsed.projectDir, {
      includeDevDependencies: parsed.includeDevDependencies,
      includeTransitive: parsed.includeTransitive,
      strict: parsed.strict
    })

    const scanResult = scanEngine.scan()

    if (scanResult.errors.length > 0) {
      console.error('\n扫描过程中发现错误:')
      for (const error of scanResult.errors) {
        console.error(`  ✗ ${error.message}`)
        if (error.file) {
          console.error(`    文件: ${error.file}`)
        }
      }
    }

    if (scanResult.warnings.length > 0 && parsed.verbose) {
      console.log('\n扫描警告:')
      for (const warning of scanResult.warnings) {
        console.log(`  ⚠ ${warning.message}`)
      }
    }

    this.printScanSummary(scanResult)

    const outputPath = path.join(parsed.outputDir, 'scan-result.json')
    fs.writeFileSync(outputPath, JSON.stringify(scanResult, null, 2), 'utf-8')
    
    console.log(`\n扫描结果已保存: ${outputPath}`)

    return scanResult
  }

  handleCheck(parsed) {
    this.validateProjectDir(parsed.projectDir)

    if (parsed.verbose) {
      console.log(`检查项目: ${parsed.projectDir}`)
      console.log(`严格模式: ${parsed.strict}`)
      console.log('')
    }

    const scanEngine = new ScanEngine(parsed.projectDir, {
      includeDevDependencies: parsed.includeDevDependencies,
      includeTransitive: parsed.includeTransitive,
      strict: parsed.strict
    })

    const scanResult = scanEngine.scan()
    const checkEngine = new CheckEngine(scanResult, {
      strict: parsed.strict
    })

    const checkResult = checkEngine.check()

    this.printCheckResult(checkResult, parsed.verbose)

    const outputPath = path.join(parsed.outputDir, 'check-result.json')
    fs.writeFileSync(outputPath, JSON.stringify(checkResult, null, 2), 'utf-8')
    console.log(`\n检查结果已保存: ${outputPath}`)

    if (!checkResult.passed) {
      if (parsed.strict) {
        process.exit(1)
      } else if (checkResult.summary.high > 0 || checkResult.summary.critical > 0) {
        process.exit(1)
      }
    }

    return { scanResult, checkResult }
  }

  handleExport(parsed) {
    this.validateProjectDir(parsed.projectDir)
    this.ensureOutputDir(parsed.outputDir)

    const validFormats = ['json', 'markdown', 'md', 'html', 'notice']
    for (const format of parsed.format) {
      if (!validFormats.includes(format)) {
        console.error(`错误: 不支持的导出格式 '${format}'`)
        console.error(`支持的格式: ${validFormats.join(', ')}`)
        process.exit(1)
      }
    }

    if (parsed.verbose) {
      console.log(`导出项目分析: ${parsed.projectDir}`)
      console.log(`输出目录: ${parsed.outputDir}`)
      console.log(`导出格式: ${parsed.format.join(', ')}`)
      console.log('')
    }

    const scanEngine = new ScanEngine(parsed.projectDir, {
      includeDevDependencies: parsed.includeDevDependencies,
      includeTransitive: parsed.includeTransitive,
      strict: parsed.strict
    })

    const scanResult = scanEngine.scan()
    const checkEngine = new CheckEngine(scanResult, {
      strict: parsed.strict
    })
    const checkResult = checkEngine.check()

    const projectName = scanResult.projectInfo?.name || path.basename(parsed.projectDir)
    const projectVersion = scanResult.projectInfo?.version || 'unknown'

    const exportEngine = new ExportEngine(scanResult, checkResult, {
      projectName,
      projectVersion,
      outputDir: parsed.outputDir,
      includeDetails: true
    })

    const exportedFiles = []

    for (const format of parsed.format) {
      try {
        let result
        switch (format) {
          case 'json':
            result = exportEngine.exportJson()
            break
          case 'markdown':
          case 'md':
            result = exportEngine.exportMarkdown()
            break
          case 'html':
            result = exportEngine.exportHtml()
            break
          case 'notice':
            result = exportEngine.exportNotice()
            break
        }
        exportedFiles.push(result)
        console.log(`✓ 已导出: ${result.path}`)
      } catch (error) {
        console.error(`✗ 导出 ${format} 失败: ${error.message}`)
        if (parsed.verbose) {
          console.error(error.stack)
        }
      }
    }

    console.log(`\n导出完成，共 ${exportedFiles.length} 个文件`)

    this.printCheckSummary(checkResult)

    if (!checkResult.passed) {
      console.log('\n⚠ 注意：检查发现了需要关注的问题')
      if (parsed.strict) {
        process.exit(1)
      }
    }

    return { scanResult, checkResult, exportedFiles }
  }

  handleHelp(parsed) {
    const helpText = `
许可证风险检查工具 (license-risk-checker)
========================================

用于检查项目依赖的许可证合规性，识别商用风险。

命令:
  scan    扫描项目目录，收集依赖信息
  check   执行许可证合规检查
  export  导出完整的分析报告

选项:
  --dir, -d <path>      指定项目目录 (默认: 当前目录)
  --output, -o <path>   指定输出目录 (默认: 当前目录)
  --format, -f <formats>  指定导出格式 (逗号分隔)
                         支持: json, markdown, html, notice
                         默认: 所有格式
  --no-dev              排除开发依赖
  --no-transitive       排除传递依赖
  --strict              严格模式，任何警告都视为失败
  --verbose, -v         显示详细输出
  --help, -h            显示此帮助信息

示例:
  # 扫描当前目录
  license-check scan

  # 扫描指定目录并显示详细信息
  license-check scan -d /path/to/project -v

  # 执行合规检查（严格模式）
  license-check check --strict

  # 导出报告到指定目录
  license-check export -o ./reports

  # 仅导出 JSON 和 Markdown 格式
  license-check export -f json,markdown

  # 排除开发依赖
  license-check check --no-dev

文件格式说明:
  package.json          npm 项目依赖清单
  pnpm-lock.yaml        pnpm 锁文件
  package-lock.json     npm 锁文件
  requirements.txt      Python 依赖清单
  third_party.csv       第三方依赖声明清单 (推荐)
  LICENSE / LICENSE.txt 项目许可证文件
  NOTICE / NOTICE.txt   Apache-2.0 许可证声明文件
  overrides.json        可选的覆盖配置文件

third_party.csv 格式:
  name,version,license,source,notes
  lodash,4.17.21,MIT,https://github.com/lodash/lodash,工具库
  express,4.18.2,MIT,npm,Web 框架

overrides.json 格式:
  {
    "licenseOverrides": {
      "some-package": {
        "license": "MIT",
        "version": "1.0.0",
        "source": "手动核实"
      }
    },
    "riskOverrides": {
      "UnknownLicense": "LOW"
    },
    "ignorePackages": ["some-internal-package"],
    "exclusions": {
      "devDependencies": false,
      "packages": []
    }
  }

风险等级说明:
  🟢 SAFE (安全)     - MIT, BSD, Apache-2.0, Unlicense 等
  🟡 LOW (低风险)    - 需要保留许可证声明
  🟠 MEDIUM (中风险) - Copyleft 许可证，可能需要公开修改
  🔴 HIGH (高风险)   - 强 Copyleft 或 AGPL，可能导致项目开源
  ⚪ UNKNOWN (未知)   - 许可证信息缺失，需手动核实
`
    console.log(helpText)
  }

  validateProjectDir(dir) {
    if (!fs.existsSync(dir)) {
      console.error(`错误: 项目目录不存在: ${dir}`)
      process.exit(1)
    }

    if (!fs.statSync(dir).isDirectory()) {
      console.error(`错误: 指定的路径不是目录: ${dir}`)
      process.exit(1)
    }
  }

  ensureOutputDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  printScanSummary(scanResult) {
    const stats = scanResult.statistics
    const info = scanResult.projectInfo || {}

    console.log('\n' + '='.repeat(50))
    console.log('扫描结果摘要')
    console.log('='.repeat(50))

    console.log('\n项目信息:')
    if (info.name) console.log(`  名称: ${info.name}`)
    if (info.version) console.log(`  版本: ${info.version}`)
    if (info.license) console.log(`  许可证: ${info.license}`)
    console.log(`  目录: ${scanResult.projectDir}`)

    console.log('\n检测到的文件:')
    console.log(`  package.json: ${info.hasPackageJson ? '✓' : '✗'}`)
    console.log(`  requirements.txt: ${info.hasRequirements ? '✓' : '✗'}`)
    console.log(`  third_party.csv: ${info.hasThirdPartyCsv ? '✓' : '✗'}`)
    console.log(`  LICENSE 文件: ${info.hasLicenseFile ? '✓' : '✗'}`)
    console.log(`  NOTICE 文件: ${info.hasNoticeFile ? '✓' : '✗'}`)
    console.log(`  overrides.json: ${info.hasOverridesJson ? '✓' : '✗'}`)

    console.log('\n依赖统计:')
    console.log(`  总依赖数: ${stats.totalDependencies}`)
    console.log(`  安全: ${stats.byRiskLevel.SAFE || 0}`)
    console.log(`  低风险: ${stats.byRiskLevel.LOW || 0}`)
    console.log(`  中风险: ${stats.byRiskLevel.MEDIUM || 0}`)
    console.log(`  高风险: ${stats.byRiskLevel.HIGH || 0}`)
    console.log(`  未知: ${stats.byRiskLevel.UNKNOWN || 0}`)

    if (Object.keys(stats.byLicense || {}).length > 0) {
      console.log('\n许可证分布:')
      for (const [license, count] of Object.entries(stats.byLicense || {})) {
        console.log(`  ${license}: ${count}`)
      }
    }
  }

  printCheckResult(checkResult, verbose) {
    console.log('\n' + '='.repeat(50))
    console.log('检查结果')
    console.log('='.repeat(50))

    const status = checkResult.passed ? '✓ 通过' : '✗ 发现问题'
    console.log(`\n整体状态: ${status}`)
    console.log(`整体风险: ${this.getRiskDisplay(checkResult.overallRisk)}`)

    console.log('\n问题统计:')
    console.log(`  严重: ${checkResult.summary.critical}`)
    console.log(`  高: ${checkResult.summary.high}`)
    console.log(`  中: ${checkResult.summary.medium}`)
    console.log(`  低: ${checkResult.summary.low}`)
    console.log(`  信息: ${checkResult.summary.info}`)

    if (checkResult.issues.length > 0) {
      const severityOrder = ['critical', 'high', 'medium', 'low', 'info']
      const severityNames = {
        critical: '严重',
        high: '高',
        medium: '中',
        low: '低',
        info: '信息'
      }
      const severityEmoji = {
        critical: '🚨',
        high: '🔴',
        medium: '🟠',
        low: '🟡',
        info: 'ℹ️'
      }

      for (const severity of severityOrder) {
        const issues = checkResult.issues.filter(i => i.severity === severity)
        if (issues.length === 0) continue

        console.log(`\n${severityEmoji[severity]} ${severityNames[severity]}优先级问题 (${issues.length}):`)
        
        for (const issue of issues) {
          console.log(`\n  ${issue.message}`)
          
          if (verbose) {
            if (issue.package) console.log(`    包名: ${issue.package}`)
            if (issue.version) console.log(`    版本: ${issue.version}`)
            if (issue.license) console.log(`    许可证: ${issue.license}`)
            if (issue.file) console.log(`    文件: ${issue.file}${issue.line ? ` (行 ${issue.line})` : ''}`)
            if (issue.evidence) console.log(`    证据: ${issue.evidence}`)
            if (issue.explanation) {
              console.log(`    说明: ${issue.explanation.split('\n')[0]}`)
            }
          }
        }
      }
    }

    if (checkResult.recommendations.length > 0) {
      console.log('\n💡 建议:')
      for (const rec of checkResult.recommendations) {
        const priorityEmoji = {
          high: '🔴',
          medium: '🟠',
          low: '🟡',
          info: 'ℹ️'
        }
        console.log(`\n  ${priorityEmoji[rec.priority] || 'ℹ️'} ${rec.title}`)
        console.log(`    ${rec.description}`)
        if (verbose && rec.actions && rec.actions.length > 0) {
          console.log('    行动项:')
          for (const action of rec.actions) {
            console.log(`      ☐ ${action}`)
          }
        }
      }
    }
  }

  printCheckSummary(checkResult) {
    console.log('\n' + '='.repeat(50))
    console.log('摘要')
    console.log('='.repeat(50))
    
    console.log(`\n整体状态: ${checkResult.passed ? '✓ 合规' : '⚠ 需关注'}`)
    console.log(`整体风险: ${this.getRiskDisplay(checkResult.overallRisk)}`)
    
    const stats = checkResult.statistics || {}
    const risk = stats.byRiskLevel || {}
    
    console.log(`\n依赖分布:`)
    console.log(`  🟢 安全: ${risk.SAFE || 0}`)
    console.log(`  🟡 低风险: ${risk.LOW || 0}`)
    console.log(`  🟠 中风险: ${risk.MEDIUM || 0}`)
    console.log(`  🔴 高风险: ${risk.HIGH || 0}`)
    console.log(`  ⚪ 未知: ${risk.UNKNOWN || 0}`)
    
    console.log(`\n问题统计:`)
    const issues = checkResult.summary || {}
    console.log(`  🚨 严重: ${issues.critical || 0}`)
    console.log(`  🔴 高: ${issues.high || 0}`)
    console.log(`  🟠 中: ${issues.medium || 0}`)
    console.log(`  🟡 低: ${issues.low || 0}`)
    console.log(`  ℹ️ 信息: ${issues.info || 0}`)
  }

  getRiskDisplay(level) {
    const displays = {
      'SAFE': '🟢 安全',
      'LOW': '🟡 低风险',
      'MEDIUM': '🟠 中风险',
      'HIGH': '🔴 高风险',
      'CRITICAL': '🚨 严重',
      'UNKNOWN': '⚪ 未知'
    }
    return displays[level] || `未知 (${level})`
  }
}

const cli = new LicenseCheckerCLI()
cli.run(process.argv.slice(2))

module.exports = LicenseCheckerCLI
