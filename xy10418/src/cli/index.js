#!/usr/bin/env node

const ConfigManager = require('../config-manager')
const LicenseClassifier = require('../license-classifier')
const ExceptionManager = require('../exception-manager')
const DependencyReader = require('../dependency-reader')
const LicenseAuditor = require('../auditor')
const ReportGenerator = require('../report-generator')
const ScanComparator = require('../scan-comparator')

class LicenseAuditCLI {
  constructor() {
    this.configManager = new ConfigManager()
    this.classifier = new LicenseClassifier(this.configManager)
    this.exceptionManager = new ExceptionManager(this.configManager)
    this.dependencyReader = new DependencyReader()
    this.auditor = new LicenseAuditor(this.configManager, this.classifier, this.exceptionManager)
    this.reportGenerator = new ReportGenerator(this.configManager)
    this.comparator = new ScanComparator()
  }

  run() {
    const args = process.argv.slice(2)
    const command = args[0] || 'scan'

    switch (command) {
      case 'scan':
        this.scan(args.slice(1))
        break
      case 'rescan':
        this.rescan(args.slice(1))
        break
      case 'scan-sample':
      case 'demo':
        this.scanSample(args.slice(1))
        break
      case 'exception':
      case 'exceptions':
        this.handleExceptions(args.slice(1))
        break
      case 'compare':
      case 'diff':
        this.compare(args.slice(1))
        break
      case 'history':
      case 'list':
        this.listHistory()
        break
      case 'report':
        this.generateReport(args.slice(1))
        break
      case 'help':
      case '--help':
      case '-h':
        this.showHelp()
        break
      default:
        console.error(`未知命令: ${command}`)
        this.showHelp()
        process.exit(1)
    }
  }

  parseArgs(args) {
    const options = {}
    const positional = []
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      if (arg.startsWith('--')) {
        const key = arg.slice(2)
        const next = args[i + 1]
        if (next && !next.startsWith('--')) {
          options[key] = next
          i++
        } else {
          options[key] = true
        }
      } else if (arg.startsWith('-')) {
        const key = arg.slice(1)
        options[key] = true
      } else {
        positional.push(arg)
      }
    }
    
    return { options, positional }
  }

  scan(args) {
    const { options, positional } = this.parseArgs(args)
    const source = positional[0] || 'sample'
    
    try {
      console.log(`🔍 开始扫描依赖: ${source}`)
      
      const result = this.auditor.runAudit(this.dependencyReader, source)
      
      this.printScanSummary(result)
      
      if (!options['no-save']) {
        const savedPath = this.configManager.saveScan(result)
        console.log(`📦 扫描结果已保存: ${savedPath}`)
      }
      
      if (options['report'] || options['r']) {
        const format = options['format'] || 'html'
        const reportPath = this.reportGenerator.generateReport(result, { format })
        console.log(`📊 报告已生成: ${reportPath}`)
      }
      
      if (result.status !== 'PASS' && !options['force']) {
        process.exit(1)
      }
      
    } catch (error) {
      console.error(`❌ 扫描失败: ${error.message}`)
      process.exit(1)
    }
  }

  scanSample(args) {
    const { options } = this.parseArgs(args)
    
    console.log('🎯 使用内置样例数据进行扫描')
    console.log('')
    
    const result = this.auditor.runAudit(this.dependencyReader, 'sample')
    
    this.printScanSummary(result)
    
    if (!options['no-save']) {
      const savedPath = this.configManager.saveScan(result)
      console.log(`📦 扫描结果已保存: ${savedPath}`)
    }
    
    if (options['report'] || options['r']) {
      const format = options['format'] || 'html'
      const reportPath = this.reportGenerator.generateReport(result, { format })
      console.log(`📊 报告已生成: ${reportPath}`)
    }
  }

  rescan(args) {
    const latest = this.configManager.getLatestScan()
    
    if (!latest) {
      console.log('⚠️ 未找到历史扫描记录，执行新扫描')
      this.scan(args)
      return
    }
    
    console.log(`🔄 基于上次扫描重新执行`)
    console.log(`   上次扫描: ${latest.timestamp}`)
    console.log('')
    
    this.scan(args)
  }

  handleExceptions(args) {
    const { options, positional } = this.parseArgs(args)
    const subCommand = positional[0]
    
    switch (subCommand) {
      case 'add':
        this.addException(positional.slice(1), options)
        break
      case 'remove':
      case 'delete':
        this.removeException(positional.slice(1))
        break
      case 'list':
        this.listExceptions(options)
        break
      case 'check':
        this.checkExceptions()
        break
      default:
        console.log('例外审批管理命令:')
        console.log('')
        console.log('  license-audit exception list')
        console.log('  license-audit exception add <package> [options]')
        console.log('  license-audit exception remove <package>')
        console.log('  license-audit exception check')
    }
  }

  addException(args, options) {
    if (args.length < 1) {
      console.error('❌ 请指定包名')
      process.exit(1)
    }
    
    const packageName = args[0]
    const version = options['version'] || options['v']
    const license = options['license'] || options['l']
    const reason = options['reason'] || options['r'] || '人工审批通过'
    const approvedBy = options['approved-by'] || options['a'] || '发布经理'
    const expiresAt = options['expires-at'] || options['e']
    
    try {
      const exception = this.exceptionManager.addException({
        packageName,
        version,
        license,
        reason,
        approvedBy,
        expiresAt
      })
      
      console.log(`✅ 已添加例外审批:`)
      console.log(`   包名: ${exception.packageName}`)
      console.log(`   版本: ${exception.version}`)
      console.log(`   审批人: ${exception.approvedBy}`)
      console.log(`   理由: ${exception.reason}`)
      if (exception.expiresAt) {
        console.log(`   过期时间: ${exception.expiresAt}`)
      }
      
    } catch (error) {
      console.error(`❌ 添加失败: ${error.message}`)
      process.exit(1)
    }
  }

  removeException(args) {
    if (args.length < 1) {
      console.error('❌ 请指定包名')
      process.exit(1)
    }
    
    const packageName = args[0]
    
    try {
      this.exceptionManager.removeException(packageName)
      console.log(`✅ 已移除例外审批: ${packageName}`)
    } catch (error) {
      console.error(`❌ 移除失败: ${error.message}`)
      process.exit(1)
    }
  }

  listExceptions(options) {
    const exceptions = this.exceptionManager.getExceptions()
    
    if (exceptions.length === 0) {
      console.log('暂无例外审批记录')
      return
    }
    
    console.log(`📋 例外审批列表 (${exceptions.length} 条):`)
    console.log('')
    
    for (const exc of exceptions) {
      const expired = exc.expiresAt && new Date(exc.expiresAt) < new Date()
      const status = expired ? ' [已过期]' : ''
      
      console.log(`  ${exc.packageName}@${exc.version}${status}`)
      console.log(`    审批人: ${exc.approvedBy}`)
      console.log(`    理由: ${exc.reason}`)
      console.log(`    创建时间: ${exc.createdAt}`)
      if (exc.expiresAt) {
        console.log(`    过期时间: ${exc.expiresAt}`)
      }
      console.log('')
    }
  }

  checkExceptions() {
    const expired = this.exceptionManager.listExpiredExceptions()
    const expiring = this.exceptionManager.listExpiringExceptions(7)
    
    let hasIssues = false
    
    if (expired.length > 0) {
      hasIssues = true
      console.log(`❌ 已过期的例外审批 (${expired.length} 条):`)
      for (const exc of expired) {
        console.log(`   ${exc.packageName}@${exc.version} (过期时间: ${exc.expiresAt})`)
      }
      console.log('')
    }
    
    if (expiring.length > 0) {
      hasIssues = true
      console.log(`⚠️ 即将过期的例外审批 (${expiring.length} 条):`)
      for (const exc of expiring) {
        console.log(`   ${exc.packageName}@${exc.version} (过期时间: ${exc.expiresAt})`)
      }
      console.log('')
    }
    
    if (!hasIssues) {
      console.log('✅ 所有例外审批均有效')
    }
  }

  compare(args) {
    const { options, positional } = this.parseArgs(args)
    
    let scan1Path, scan2Path
    
    if (positional.length === 0) {
      const scans = this.configManager.getAllScans()
      if (scans.length < 2) {
        console.error('❌ 需要至少两次扫描记录才能比较')
        process.exit(1)
      }
      scan1Path = scans[1].path
      scan2Path = scans[0].path
      console.log(`🔄 比较最近两次扫描:`)
      console.log(`   扫描1: ${scans[1].timestamp}`)
      console.log(`   扫描2: ${scans[0].timestamp}`)
    } else if (positional.length === 1) {
      const latest = this.configManager.getLatestScan()
      if (!latest) {
        console.error('❌ 未找到最新扫描记录')
        process.exit(1)
      }
      scan1Path = positional[0]
      scan2Path = latest.path
    } else {
      scan1Path = positional[0]
      scan2Path = positional[1]
    }
    
    try {
      const scan1 = this.configManager.loadScan(scan1Path)
      const scan2 = this.configManager.loadScan(scan2Path)
      
      const comparison = this.comparator.compare(scan1, scan2)
      this.printComparison(comparison)
      
    } catch (error) {
      console.error(`❌ 比较失败: ${error.message}`)
      process.exit(1)
    }
  }

  listHistory() {
    const scans = this.configManager.getAllScans()
    
    if (scans.length === 0) {
      console.log('暂无扫描历史记录')
      return
    }
    
    console.log(`📜 扫描历史 (${scans.length} 条):`)
    console.log('')
    
    for (let i = 0; i < scans.length; i++) {
      const scan = this.configManager.loadScan(scans[i].path)
      const latest = i === 0 ? ' [最新]' : ''
      console.log(`  ${i + 1}. ${scans[i].timestamp}${latest}`)
      console.log(`     状态: ${scan.status} | 依赖: ${scan.summary.total} | 问题: ${scan.issues.length}`)
      console.log(`     文件: ${scans[i].path}`)
      console.log('')
    }
  }

  generateReport(args) {
    const { options, positional } = this.parseArgs(args)
    const format = options['format'] || 'html'
    
    let scanData
    
    if (positional.length > 0) {
      scanData = this.configManager.loadScan(positional[0])
    } else {
      const latest = this.configManager.getLatestScan()
      if (!latest) {
        console.error('❌ 未找到扫描记录，请先执行 scan 命令')
        process.exit(1)
      }
      scanData = this.configManager.loadScan(latest.path)
    }
    
    try {
      const reportPath = this.reportGenerator.generateReport(scanData, { 
        format,
        filename: options['filename'] || options['f']
      })
      console.log(`📊 报告已生成: ${reportPath}`)
    } catch (error) {
      console.error(`❌ 报告生成失败: ${error.message}`)
      process.exit(1)
    }
  }

  printScanSummary(result) {
    const summary = result.summary
    const statusColor = {
      'PASS': '✅',
      'WARN': '⚠️',
      'FAIL': '❌'
    }[result.status] || ''
    
    console.log('')
    console.log('='.repeat(60))
    console.log(`                   扫描结果`)
    console.log('='.repeat(60))
    console.log('')
    console.log(`   状态: ${statusColor} ${result.status}`)
    console.log(`   时间: ${result.scanTime}`)
    console.log(`   源: ${result.source}`)
    console.log('')
    console.log(`   总依赖数: ${summary.total}`)
    console.log(`   直接依赖: ${summary.direct}`)
    console.log(`   传递依赖: ${summary.transitive}`)
    console.log('')
    console.log(`   ✓ 允许: ${summary.allowed}`)
    console.log(`   ⚠ 需确认: ${summary.needsConfirmation}`)
    console.log(`   ✗ 禁止: ${summary.forbidden}`)
    console.log(`   ? 未知: ${summary.unknown}`)
    console.log(`   例外审批: ${summary.withExceptions}`)
    console.log('')
    
    if (summary.warnings.length > 0) {
      console.log('⚠️ 警告:')
      for (const warning of summary.warnings) {
        if (warning.type === 'duplicate_package') {
          console.log(`   ${warning.package}: 同名不同版本 - 版本: ${warning.versions.join(', ')}, 许可证: ${warning.licenses.join(', ')}`)
        }
      }
      console.log('')
    }
    
    if (result.issues.length > 0) {
      console.log('❗ 发现问题:')
      for (const issue of result.issues) {
        const typeLabel = {
          forbidden: '禁止',
          needs_confirmation: '需确认',
          unknown: '未知'
        }[issue.severity] || issue.severity
        console.log(`   [${typeLabel}] ${issue.package}@${issue.version} - ${issue.license}`)
      }
      console.log('')
    }
  }

  printComparison(comparison) {
    const summary = comparison.summary
    
    console.log('')
    console.log('='.repeat(60))
    console.log(`                   扫描比较结果`)
    console.log('='.repeat(60))
    console.log('')
    console.log(`   扫描1: ${comparison.scan1.time} (${comparison.scan1.status})`)
    console.log(`   扫描2: ${comparison.scan2.time} (${comparison.scan2.status})`)
    console.log('')
    console.log(`   新增包: ${summary.added}`)
    console.log(`   移除包: ${summary.removed}`)
    console.log(`   变更包: ${summary.changed}`)
    console.log(`   许可证变更: ${summary.licenseChanges}`)
    console.log(`   分类变更: ${summary.categoryChanges}`)
    console.log(`   新增问题: ${summary.newIssues}`)
    console.log(`   已解决问题: ${summary.resolvedIssues}`)
    console.log('')
    
    if (comparison.packages.added.length > 0) {
      console.log('➕ 新增的包:')
      for (const pkg of comparison.packages.added) {
        console.log(`   ${pkg.name}@${pkg.version} - ${pkg.normalizedLicense}`)
      }
      console.log('')
    }
    
    if (comparison.packages.removed.length > 0) {
      console.log('➖ 移除的包:')
      for (const pkg of comparison.packages.removed) {
        console.log(`   ${pkg.name}@${pkg.version} - ${pkg.normalizedLicense}`)
      }
      console.log('')
    }
    
    if (comparison.packages.changed.length > 0) {
      console.log('🔄 变更的包:')
      for (const change of comparison.packages.changed) {
        console.log(`   ${change.name}@${change.version}`)
        if (change.licenseChanged) {
          console.log(`     许可证: ${change.from.normalizedLicense} → ${change.to.normalizedLicense}`)
        }
        if (change.categoryChanged) {
          console.log(`     分类: ${change.from.category} → ${change.to.category}`)
        }
      }
      console.log('')
    }
    
    if (comparison.issues.new.length > 0) {
      console.log('❌ 新增的问题:')
      for (const issue of comparison.issues.new) {
        console.log(`   [${issue.severity}] ${issue.package}@${issue.version}`)
      }
      console.log('')
    }
    
    if (comparison.issues.resolved.length > 0) {
      console.log('✅ 已解决的问题:')
      for (const issue of comparison.issues.resolved) {
        console.log(`   [${issue.severity}] ${issue.package}@${issue.version}`)
      }
      console.log('')
    }
  }

  showHelp() {
    console.log(`
本地依赖许可证审计 CLI

用法:
  license-audit <command> [options]

命令:
  scan [source]                扫描依赖许可证 (默认使用内置样例)
  scan-sample | demo           使用内置样例数据进行扫描
  rescan                       重新执行上次扫描
  exception add <pkg>          添加例外审批
  exception remove <pkg>       移除例外审批
  exception list               列出所有例外审批
  exception check              检查过期的例外审批
  compare [scan1] [scan2]      比较两次扫描结果 (默认比较最近两次)
  history | list               列出扫描历史
  report [scan]                生成审计报告

选项:
  scan:
    --report, -r               扫描后自动生成报告
    --format <type>            报告格式: json|html|md|txt (默认: html)
    --no-save                  不保存扫描结果
  
  exception add:
    --version, -v <version>    指定版本 (默认: 所有版本)
    --license, -l <license>    指定许可证
    --reason, -r <text>        审批理由
    --approved-by, -a <name>   审批人
    --expires-at, -e <date>    过期时间 (ISO格式)
  
  report:
    --format <type>            报告格式: json|html|md|txt
    --filename, -f <name>      报告文件名

示例:
  license-audit scan sample                       # 使用内置样例扫描
  license-audit scan package.json                 # 扫描本地 npm 项目
  license-audit scan-sample --report              # 扫描样例并生成报告
  license-audit exception add agpl-library --reason "业务必需" --approved-by "张三"
  license-audit compare                           # 比较最近两次扫描
  license-audit report --format html              # 生成 HTML 报告
    `)
  }
}

if (require.main === module) {
  const cli = new LicenseAuditCLI()
  cli.run()
}

module.exports = LicenseAuditCLI
