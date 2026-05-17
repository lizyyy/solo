import { ReportData, ReportOptions, HttpRequestRecord, VariableMap } from './types'
import { ReplayGenerator } from './replay-generator'
import * as fs from 'fs'
import * as path from 'path'

export class ReportGenerator {
  private replayGenerator: ReplayGenerator

  constructor() {
    this.replayGenerator = new ReplayGenerator()
  }

  generateTerminalReport(data: ReportData): string {
    const lines: string[] = []

    lines.push('\n' + '='.repeat(60))
    lines.push('           HTTP Record Variable CLI')
    lines.push('='.repeat(60))
    lines.push('')

    lines.push('Summary Statistics')
    lines.push('-'.repeat(40))
    lines.push(`  Total Requests:     ${data.summary.totalRequests}`)
    lines.push(`  Valid Requests:     ${data.summary.validRequests} OK`)
    lines.push(`  Bad Requests:       ${data.summary.badRequests} BAD`)
    lines.push(`  Variables Extracted:${data.summary.variablesExtracted}`)
    lines.push(`  Sensitive Values:   ${data.summary.sensitiveValuesMasked}`)
    lines.push('')

    if (Object.keys(data.variables).length > 0) {
      lines.push('Extracted Variables')
      lines.push('-'.repeat(40))
      for (const [name, info] of Object.entries(data.variables)) {
        const typeIcon = this.getTypeIcon(info.type)
        const displayValue = info.type === 'sensitive' ? '***MASKED***' : info.value
        lines.push(`  ${typeIcon} ${name} = ${displayValue}`)
        lines.push(`     Type: ${info.type} | Location: ${info.location} | Occurrences: ${info.occurrences}`)
      }
      lines.push('')
    }

    if (data.badLinesDetails.length > 0) {
      lines.push('Bad Request Details (Preserved)')
      lines.push('-'.repeat(40))
      for (const bad of data.badLinesDetails) {
        lines.push(`  Line ${bad.lineNumber}: ${bad.reason}`)
        lines.push(`     Original: ${bad.original.substring(0, 80)}${bad.original.length > 80 ? '...' : ''}`)
      }
      lines.push('')
    }

    lines.push('Replay Commands (First 3)')
    lines.push('-'.repeat(40))
    data.replayCommands.slice(0, 3).forEach((cmd, i) => {
      lines.push(`  ${i + 1}. ${cmd.substring(0, 100)}${cmd.length > 100 ? '...' : ''}`)
    })
    lines.push('')

    lines.push('='.repeat(60))
    lines.push('Tip: Use --format=markdown to generate shareable reports')
    lines.push('='.repeat(60))
    lines.push('')

    return lines.join('\n')
  }

  generateJsonReport(data: ReportData): string {
    return JSON.stringify(data, null, 2)
  }

  generateMarkdownReport(data: ReportData): string {
    const lines: string[] = []

    lines.push('# HTTP Record Variable Report')
    lines.push('')
    lines.push(`> Generated at: ${new Date().toLocaleString()}`)
    lines.push('')

    lines.push('## Summary Statistics')
    lines.push('')
    lines.push('| Metric | Value | Status |')
    lines.push('|--------|-------|--------|')
    lines.push(`| Total Requests | ${data.summary.totalRequests} | |`)
    lines.push(`| Valid Requests | ${data.summary.validRequests} | ✅ |`)
    lines.push(`| Bad Requests | ${data.summary.badRequests} | ❌ |`)
    lines.push(`| Variables Extracted | ${data.summary.variablesExtracted} | 🔧 |`)
    lines.push(`| Sensitive Values Masked | ${data.summary.sensitiveValuesMasked} | 🔒 |`)
    lines.push('')

    if (Object.keys(data.variables).length > 0) {
      lines.push('## Extracted Variables')
      lines.push('')
      lines.push('| Variable Name | Type | Location | Occurrences | Value |')
      lines.push('|---------------|------|----------|-------------|-------|')
      for (const [name, info] of Object.entries(data.variables)) {
        const displayValue = info.type === 'sensitive' ? '`***MASKED***`' : `\`${info.value}\``
        lines.push(`| \`${name}\` | ${info.type} | ${info.location} | ${info.occurrences} | ${displayValue} |`)
      }
      lines.push('')
    }

    lines.push('## Variable Export')
    lines.push('')
    lines.push('```bash')
    lines.push('# Variable Export')
    for (const [name, info] of Object.entries(data.variables)) {
      const displayValue = info.type === 'sensitive' ? 'your_value_here' : info.value
      lines.push(`export ${name}="${displayValue}"`)
    }
    lines.push('```')
    lines.push('')

    lines.push('## Replay Commands')
    lines.push('')
    lines.push('```bash')
    data.replayCommands.forEach((cmd, i) => {
      lines.push(`# Request ${i + 1}`)
      lines.push(cmd)
      lines.push('')
    })
    lines.push('```')
    lines.push('')

    if (data.badLinesDetails.length > 0) {
      lines.push('## Bad Request Details')
      lines.push('')
      lines.push('> These requests were preserved with their original location and reason')
      lines.push('')
      lines.push('| Line Number | Reason | Original Content |')
      lines.push('|-------------|--------|------------------|')
      for (const bad of data.badLinesDetails) {
        const escapedOriginal = bad.original.replace(/\|/g, '\\|')
        lines.push(`| ${bad.lineNumber} | ${bad.reason} | \`${escapedOriginal.substring(0, 50)}\` |`)
      }
      lines.push('')
    }

    lines.push('## Usage Instructions')
    lines.push('')
    lines.push('1. Set environment variables (copy from the Variable Export section above)')
    lines.push('2. Modify variable values as needed')
    lines.push('3. Run replay commands to test')
    lines.push('4. All sensitive values have been automatically masked, replace with actual values manually')
    lines.push('')

    return lines.join('\n')
  }

  async writeReports(data: ReportData, options: ReportOptions): Promise<string[]> {
    const outputDir = options.outputDir || process.cwd()
    const formats = options.formats || ['terminal', 'json', 'markdown']
    const writtenFiles: string[] = []

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    if (formats.includes('terminal')) {
      const terminalReport = this.generateTerminalReport(data)
      console.log(terminalReport)
    }

    if (formats.includes('json')) {
      const jsonPath = path.join(outputDir, 'http-record-report.json')
      fs.writeFileSync(jsonPath, this.generateJsonReport(data))
      writtenFiles.push(jsonPath)
    }

    if (formats.includes('markdown')) {
      const mdPath = path.join(outputDir, 'http-record-report.md')
      fs.writeFileSync(mdPath, this.generateMarkdownReport(data))
      writtenFiles.push(mdPath)
    }

    return writtenFiles
  }

  private getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      host: '[H]',
      token: '[T]',
      timestamp: '[TS]',
      path_param: '[P]',
      query_param: '[Q]',
      header: '[H]',
      body: '[B]',
      sensitive: '[S]',
    }
    return icons[type] || '[?]'
  }

  buildReportData(
    records: HttpRequestRecord[],
    variables: VariableMap,
    totalLines: number,
    validLines: number,
    badLines: number
  ): ReportData {
    const replayCommands = records
      .filter(r => !r.isBadLine)
      .map(r => this.replayGenerator.generateCurlCommand(r))

    const badLinesDetails = records
      .filter(r => r.isBadLine && r.badLineReason)
      .map(r => ({
        lineNumber: r.lineNumber,
        original: r.original,
        reason: r.badLineReason!,
      }))

    const sensitiveCount = Object.values(variables).filter(v => v.type === 'sensitive').length

    return {
      summary: {
        totalRequests: totalLines,
        validRequests: validLines,
        badRequests: badLines,
        variablesExtracted: Object.keys(variables).length,
        sensitiveValuesMasked: sensitiveCount,
      },
      variables,
      records,
      replayCommands,
      badLinesDetails,
    }
  }
}
