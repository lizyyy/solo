'use strict'

const { Command, Option } = require('commander')
const chalk = require('chalk')
const path = require('path')
const fs = require('fs').promises

const { EXIT_CODES, OUTPUT_FORMATS } = require('../config/constants')
const { parseApk, parseManifestFile, parseModulesDirectory } = require('../parser')
const { comparePermissions, compareFeatures, comparePermissionGroups, detectObfuscated } = require('../diff/engine')
const { analyzeDiffSources, detectInjectedPermissions } = require('../source/tracker')
const { rateDiffPermissions, generateRiskReport } = require('../risk/rating')
const {
  printTerminalSummary,
  writeJsonReport,
  writeMarkdownReport
} = require('../output')

async function runCLI (argv) {
  const program = new Command()
  let exitCode = EXIT_CODES.SUCCESS

  program
    .name('apkd')
    .description('Android APK 权限差异分析 CLI 工具')
    .version(require('../../package.json').version, '-v, --version', '显示版本号')
    .helpOption('-h, --help', '显示帮助信息')
    .exitOverride()

  program
    .command('compare')
    .description('对比两个 Android 应用的权限差异')
    .requiredOption('--old <path>', '旧版本 APK 或 AndroidManifest.xml 路径')
    .requiredOption('--new <path>', '新版本 APK 或 AndroidManifest.xml 路径')
    .option('-m, --modules <dir>', '模块清单目录，用于权限来源归因')
    .option('-o, --output <dir>', '输出目录，默认为当前目录下的 output')
    .option('-f, --format <format>', `输出格式: ${Object.values(OUTPUT_FORMATS).join('|')}`, OUTPUT_FORMATS.ALL)
    .option('--verbose', '显示详细信息', false)
    .option('--show-all', '显示所有权限（包括未变更的）', false)
    .option('--no-terminal', '不输出终端摘要')
    .action(async (options) => {
      exitCode = await handleCompareCommand(options)
    })

  program
    .command('parse <file>')
    .description('解析单个 APK 或 Manifest 文件并显示权限信息')
    .option('-o, --output <dir>', '输出目录')
    .option('-f, --format <format>', `输出格式: terminal|json|all`, 'all')
    .action(async (file, options) => {
      exitCode = await handleParseCommand(file, options)
    })

  program
    .command('list')
    .description('列出支持的权限组和风险等级')
    .option('--risk', '只显示风险等级说明')
    .option('--groups', '只显示权限组列表')
    .action((options) => {
      exitCode = handleListCommand(options)
    })

  try {
    await program.parseAsync(argv)
  } catch (err) {
    if (err.name === 'CommanderError') {
      exitCode = EXIT_CODES.ERROR_INVALID_INPUT
    } else {
      exitCode = handleError(err)
    }
  }

  process.exitCode = exitCode
  return exitCode
}

async function handleCompareCommand (options) {
  const startTime = Date.now()

  console.log(chalk.cyan('🔍 开始分析 Android 权限差异...'))
  console.log()

  const validation = validateCompareOptions(options)
  if (!validation.valid) {
    console.error(chalk.red('❌ 参数错误:'))
    validation.errors.forEach(e => console.error(`   - ${e}`))
    return EXIT_CODES.ERROR_INVALID_INPUT
  }

  const outputDir = path.resolve(options.output || './output')

  try {
    console.log(chalk.gray('  解析旧版本文件...'))
    const oldData = await parseInputFile(options.old)

    console.log(chalk.gray('  解析新版本文件...'))
    const newData = await parseInputFile(options.new)

    let modules = []
    if (options.modules) {
      console.log(chalk.gray('  解析模块清单...'))
      modules = await parseModulesDirectory(path.resolve(options.modules))
    }

    console.log(chalk.gray('  分析权限差异...'))
    const permDiff = comparePermissions(oldData, newData)

    console.log(chalk.gray('  分析特性差异...'))
    const featureDiff = compareFeatures(oldData, newData)

    console.log(chalk.gray('  分析权限组变更...'))
    const groupDiff = comparePermissionGroups(oldData, newData)

    console.log(chalk.gray('  检测混淆权限...'))
    const obfuscated = detectObfuscated(permDiff)

    console.log(chalk.gray('  评估风险等级...'))
    const ratedDiff = rateDiffPermissions(permDiff)

    console.log(chalk.gray('  生成风险报告...'))
    const riskReport = generateRiskReport(ratedDiff)

    let sourcesAnalysis = null
    if (modules.length > 0) {
      console.log(chalk.gray('  分析权限来源...'))
      const diffWithSources = analyzeDiffSources(ratedDiff, modules, [])
      const injectedPerms = detectInjectedPermissions(diffWithSources, modules)

      sourcesAnalysis = {
        summary: diffWithSources.summary,
        injected: injectedPerms
      }

      ratedDiff.added = diffWithSources.added
      ratedDiff.removed = diffWithSources.removed
      ratedDiff.changed = diffWithSources.changed
    }

    const exitCode = determineExitCode(riskReport, permDiff)

    const result = {
      oldVersion: oldData,
      newVersion: newData,
      permissions: ratedDiff,
      features: featureDiff,
      groups: groupDiff,
      risk: riskReport,
      sources: sourcesAnalysis,
      obfuscated,
      exitCode,
      duration: Date.now() - startTime
    }

    if (options.terminal !== false) {
      printTerminalSummary(result, {
        verbose: options.verbose,
        showAll: options.showAll
      })
    }

    const format = options.format || OUTPUT_FORMATS.ALL

    if (format === OUTPUT_FORMATS.JSON || format === OUTPUT_FORMATS.ALL) {
      console.log(chalk.gray('  生成 JSON 报告...'))
      const jsonResult = await writeJsonReport(result, outputDir)
      console.log(chalk.green(`  ✓ JSON 报告已保存: ${jsonResult.path}`))
    }

    if (format === OUTPUT_FORMATS.MARKDOWN || format === OUTPUT_FORMATS.ALL) {
      console.log(chalk.gray('  生成 Markdown 报告...'))
      const mdResult = await writeMarkdownReport(result, outputDir)
      console.log(chalk.green(`  ✓ Markdown 报告已保存: ${mdResult.path}`))
    }

    console.log()
    console.log(chalk.green(`✨ 分析完成! 耗时: ${result.duration}ms`))

    return exitCode
  } catch (err) {
    return handleError(err)
  }
}

async function handleParseCommand (file, options) {
  console.log(chalk.cyan(`🔍 解析文件: ${file}`))
  console.log()

  try {
    const data = await parseInputFile(file)

    const outputDir = options.output ? path.resolve(options.output) : null

    console.log(chalk.bold('应用信息:'))
    console.log(`  包名: ${data.appInfo.packageName}`)
    console.log(`  版本: ${data.appInfo.versionName} (${data.appInfo.versionCode})`)
    console.log(`  权限数量: ${data.permissions.length}`)
    console.log(`  特性数量: ${data.features.length}`)
    console.log()

    if (data.permissions.length > 0) {
      console.log(chalk.bold('权限列表:'))
      for (const perm of data.permissions) {
        console.log(`  - ${perm.name} (${perm.type})`)
      }
    }

    if (outputDir) {
      await fs.mkdir(outputDir, { recursive: true })
      const outputPath = path.join(outputDir, `parsed-${data.appInfo.packageName || 'manifest'}.json`)
      await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf-8')
      console.log()
      console.log(chalk.green(`解析结果已保存到: ${outputPath}`))
    }

    return EXIT_CODES.SUCCESS
  } catch (err) {
    return handleError(err)
  }
}

function handleListCommand (options) {
  const { RISK_LEVELS, PERMISSION_GROUPS } = require('../config/constants')

  if (!options.groups) {
    console.log(chalk.bold('风险等级说明:'))
    console.log()
    for (const [key, level] of Object.entries(RISK_LEVELS)) {
      const color = level.color === 'red' ? chalk.red
        : level.color === 'magenta' ? chalk.magenta
          : level.color === 'yellow' ? chalk.yellow
            : level.color === 'blue' ? chalk.blue
              : chalk.gray
      console.log(`  ${color(key)}: ${level.name} - ${level.description}`)
    }
    console.log()
  }

  if (!options.risk) {
    console.log(chalk.bold('权限组列表:'))
    console.log()
    for (const [id, group] of Object.entries(PERMISSION_GROUPS)) {
      console.log(`  ${chalk.cyan(group.name)} (${id})`)
      group.permissions.forEach(p => {
        console.log(`    - ${p}`)
      })
      console.log()
    }
  }

  return EXIT_CODES.SUCCESS
}

function validateCompareOptions (options) {
  const errors = []

  if (!options.old) {
    errors.push('必须指定 --old 参数')
  }

  if (!options.new) {
    errors.push('必须指定 --new 参数')
  }

  const validFormats = Object.values(OUTPUT_FORMATS)
  if (options.format && !validFormats.includes(options.format)) {
    errors.push(`无效的输出格式: ${options.format}。可选值: ${validFormats.join(', ')}`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

async function parseInputFile (filePath) {
  const resolvedPath = path.resolve(filePath)
  const ext = path.extname(resolvedPath).toLowerCase()

  if (ext === '.apk') {
    return parseApk(resolvedPath)
  } else if (ext === '.xml') {
    return parseManifestFile(resolvedPath)
  } else if (ext === '.json') {
    const content = await fs.readFile(resolvedPath, 'utf-8')
    return JSON.parse(content)
  } else {
    throw new Error(`不支持的文件格式: ${ext}。支持格式: .apk, .xml, .json`)
  }
}

function determineExitCode (riskReport, permDiff) {
  if (riskReport && riskReport.overall) {
    if (riskReport.overall.hasHighRiskChanges) {
      return EXIT_CODES.WARNING_HIGH_RISK_ADDED
    }
  }

  if (permDiff && permDiff.summary) {
    const hasChanges = permDiff.summary.addedCount > 0 ||
      permDiff.summary.removedCount > 0 ||
      permDiff.summary.changedCount > 0

    if (hasChanges) {
      return EXIT_CODES.WARNING_PERMISSIONS_CHANGED
    }
  }

  return EXIT_CODES.SUCCESS
}

function handleError (err) {
  console.error()
  console.error(chalk.red('❌ 错误:'))
  console.error(`   ${err.message}`)

  if (process.env.DEBUG) {
    console.error()
    console.error(chalk.gray('Stack trace:'))
    console.error(err.stack)
  }

  let exitCode = EXIT_CODES.ERROR_COMPARE_FAILED
  if (err.code && typeof err.code === 'number') {
    exitCode = err.code
  }

  process.exitCode = exitCode
  return exitCode
}

module.exports = {
  runCLI,
  handleCompareCommand,
  handleParseCommand,
  handleListCommand,
  validateCompareOptions,
  parseInputFile,
  determineExitCode
}
