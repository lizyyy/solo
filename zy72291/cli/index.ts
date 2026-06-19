#!/usr/bin/env node
/**
 * 滑翔伞起降区风向图 - 命令行工具
 * 
 * 用法:
 *   node dist/cli/index.js logs list                    # 列出所有点云抽稀日志
 *   node dist/cli/index.js logs import <file>           # 导入点云抽稀日志
 *   node dist/cli/index.js logs status <id> <status>    # 更新日志状态
 *   node dist/cli/index.js radius list [version]        # 列出安全半径表
 *   node dist/cli/index.js radius lookup <dir> <speed>  # 查找安全半径
 *   node dist/cli/index.js report generate              # 生成安全距离报告
 *   node dist/cli/index.js report export                # 导出安全距离报告
 *   node dist/cli/index.js demo run                     # 运行完整演示流程
 */

import fetch from 'node-fetch'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
  note?: string
}

interface LogData {
  id: string
  batchNo: string
  status: string
  windDirection: number
  windSpeed: number
  measuredDistance: number
  hasScreenshotOcclusion: boolean
}

interface RadiusData {
  id: string
  windDirection: number
  windSpeedMin: number
  windSpeedMax: number
  requiredRadius: number
  version: string
}

interface RadiusLookupData {
  requiredRadius: number
  version: string
}

interface ReportItem {
  batchNo: string
  status: string
  measuredDistance: number
  requiredDistance: number
  diff: number
  compliance: string
  version: string
}

interface ReportData {
  id: string
  generatedAt: string
  summary: string
  items: ReportItem[]
}

interface TableColumn {
  key: string
  label: string
  width?: number
}

type TableRow = Record<string, unknown>

const API_BASE = process.env.API_BASE || 'http://localhost:3001/api'

async function request<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  return res.json() as Promise<ApiResponse<T>>
}

function printTable(data: TableRow[], columns: TableColumn[]) {
  const widths = columns.map(c => c.width || Math.max(c.label.length, ...data.map(d => String(d[c.key] || '').length)))
  const header = columns.map((c, i) => c.label.padEnd(widths[i])).join(' | ')
  const separator = widths.map(w => '─'.repeat(w)).join('─┼─')
  
  console.log(`\n${header}`)
  console.log(separator)
  
  data.forEach(row => {
    const line = columns.map((c, i) => String(row[c.key] || '').padEnd(widths[i])).join(' | ')
    console.log(line)
  })
  console.log()
}

const commands: Record<string, () => Promise<void>> = {
  'logs list': async () => {
    const res = await request<LogData[]>('/logs')
    if (res.success) {
      console.log('=== 点云抽稀日志列表 ===')
      printTable(res.data || [], [
        { key: 'id', label: 'ID', width: 10 },
        { key: 'batchNo', label: '批次号', width: 18 },
        { key: 'status', label: '状态', width: 14 },
        { key: 'windDirection', label: '风向', width: 6 },
        { key: 'windSpeed', label: '风速', width: 6 },
        { key: 'measuredDistance', label: '实测距离', width: 10 },
        { key: 'hasScreenshotOcclusion', label: '截图遮挡', width: 10 }
      ])
    }
  },
  
  'logs import': async () => {
    const fileName = process.argv[4] || 'demo-log.json'
    console.log(`正在导入日志文件: ${fileName}...`)
    const res = await request<LogData>('/logs/import', {
      method: 'POST',
      body: JSON.stringify({ fileName, fileData: '{}' })
    })
    console.log(res.message || '导入完成')
    console.log(`  日志ID: ${res.data?.id}`)
    console.log(`  状态: ${res.data?.status}`)
    if (res.data?.hasScreenshotOcclusion) {
      console.log(`  ⚠️  检测到截图遮挡，已标记待施工经理复核`)
    }
  },
  
  'logs status': async () => {
    const id = process.argv[4]
    const status = process.argv[5]
    if (!id || !status) {
      console.log('用法: logs status <id> <status>')
      return
    }
    const res = await request(`/logs/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, note: 'CLI更新' })
    })
    console.log(res.success ? `状态已更新为: ${status}` : `错误: ${res.error}`)
  },
  
  'radius list': async () => {
    const version = process.argv[4] || ''
    const res = await request<RadiusData[]>(`/radius${version ? `?version=${version}` : ''}`)
    if (res.success) {
      console.log(`=== 安全半径表 ${version ? `(${version}版)` : ''} ===`)
      printTable(res.data || [], [
        { key: 'id', label: 'ID', width: 10 },
        { key: 'windDirection', label: '风向', width: 6 },
        { key: 'windSpeedMin', label: '最小风速', width: 10 },
        { key: 'windSpeedMax', label: '最大风速', width: 10 },
        { key: 'requiredRadius', label: '要求半径', width: 10 },
        { key: 'version', label: '版本', width: 8 }
      ])
    }
  },
  
  'radius lookup': async () => {
    const dir = process.argv[4]
    const speed = process.argv[5]
    if (!dir || !speed) {
      console.log('用法: radius lookup <风向(度)> <风速(m/s)>')
      return
    }
    const res = await request<RadiusLookupData>(`/radius/lookup?windDirection=${dir}&windSpeed=${speed}`)
    if (res.success && res.data) {
      console.log(`\n=== 安全半径查询结果 ===`)
      console.log(`  风向: ${dir}°`)
      console.log(`  风速: ${speed} m/s`)
      console.log(`  要求安全半径: ${res.data.requiredRadius} 米`)
      console.log(`  口径版本: ${res.data.version}`)
      if (res.note) console.log(`  备注: ${res.note}`)
      console.log()
    } else {
      console.log(`错误: ${res.error}`)
    }
  },
  
  'report generate': async () => {
    console.log('正在生成安全距离报告...')
    const res = await request<ReportData>('/report/generate', { method: 'POST' })
    if (res.success && res.data) {
      console.log(`\n=== 安全距离报告 ===`)
      console.log(`  报告ID: ${res.data.id}`)
      console.log(`  生成时间: ${res.data.generatedAt}`)
      console.log(`  摘要: ${res.data.summary}`)
      console.log()
      printTable(res.data.items, [
        { key: 'batchNo', label: '批次号', width: 18 },
        { key: 'status', label: '状态', width: 14 },
        { key: 'measuredDistance', label: '实测', width: 8 },
        { key: 'requiredDistance', label: '要求', width: 8 },
        { key: 'diff', label: '差值', width: 8 },
        { key: 'compliance', label: '合规性', width: 12 },
        { key: 'version', label: '口径', width: 8 }
      ])
    }
  },
  
  'report export': async () => {
    console.log('正在导出安全距离报告...')
    await request('/report/export')
    console.log('报告已导出为CSV格式')
  },
  
  'demo run': async () => {
    console.log('')
    console.log('╔══════════════════════════════════════════════════════════════╗')
    console.log('║           滑翔伞起降区风向图 - 完整流程演示                  ║')
    console.log('╚══════════════════════════════════════════════════════════════╝')
    console.log('')
    
    console.log('📍 【第一步】点云抽稀日志导入')
    console.log('   许工导入三份点云抽稀日志：LOG-001、LOG-002、LOG-003')
    console.log('')
    await commands['logs list']()
    
    console.log('📍 【第二步】检测截图遮挡')
    console.log('   LOG-002检测到移动端截图遮挡告警标签，遮挡面积约40%')
    console.log('   ⚠️  关键：不归为正常，标记为"待施工经理复核"')
    console.log('')
    
    console.log('📍 【第三步】许工补看安全半径表')
    console.log('   LOG-003是2023年历史数据，从旧口径安全半径表补录数据')
    await commands['radius list']()
    
    console.log('📍 【第四步】人工修正 + 重跑')
    console.log('   LOG-003风向从85°修正为90°，重跑分析（已完成1次）')
    console.log('')
    
    console.log('📍 【第五步】安全距离报告更新')
    console.log('   三种处理结果对比：')
    console.log('')
    await commands['report generate']()
    
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')
    console.log('📊 三种结果差异说明（许工给施工经理的解释）：')
    console.log('')
    console.log('  ✅ LOG-001（顺利）：南风4.5m/s，实测185米 ≥ 要求160米，合规')
    console.log('     机载LiDAR数据，无遮挡，直接过。')
    console.log('')
    console.log('  ⏳ LOG-002（截图遮挡）：西风6.2m/s，实测88米')
    console.log('     移动端巡检时截图挡住告警标签40%，实测距离存疑。')
    console.log('     我不敢直接发，留给您复核确认。')
    console.log('')
    console.log('  📜 LOG-003（旧口径补录）：东风3.8m/s，实测195米 ≥ 要求180米')
    console.log('     2023年的历史数据，用旧口径标准（要求180米 vs 新口径140米）。')
    console.log('     风向我人工修正了5度，重跑过一次，数据没问题。')
    console.log('')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')
  }
}

async function main() {
  const args = process.argv.slice(2)
  const cmd = args.slice(0, 2).join(' ')
  
  if (commands[cmd]) {
    await commands[cmd]()
  } else if (args[0] === 'help' || args.length === 0) {
    console.log(`
滑翔伞起降区风向图 - 命令行工具

用法:
  node dist/cli/index.js <command>

命令:
  logs list                    列出所有点云抽稀日志
  logs import <file>           导入点云抽稀日志
  logs status <id> <status>    更新日志状态
  radius list [version]        列出安全半径表
  radius lookup <dir> <speed>  查找安全半径
  report generate              生成安全距离报告
  report export                导出安全距离报告
  demo run                     运行完整演示流程
  help                         显示帮助信息

示例:
  node dist/cli/index.js demo run
  node dist/cli/index.js logs list
  node dist/cli/index.js radius lookup 180 4.5
  node dist/cli/index.js report generate
`)
  } else {
    console.log(`未知命令: ${cmd}`)
    console.log('使用 "help" 查看帮助')
  }
}

main().catch(console.error)
