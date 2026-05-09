import fs from 'fs/promises'
import path from 'path'
import { storage, DATA_DIR } from './storage.js'
import { ruleEngine } from './rules.js'

export class DataExporter {
  async exportHoses(outputPath) {
    const hoses = await storage.getHoses()
    await this.writeJson(outputPath, hoses)
    await ruleEngine.addHistory('EXPORT_HOSES', `导出 ${hoses.length} 条水带记录到 ${outputPath}`)
    return { count: hoses.length, path: outputPath }
  }

  async exportBorrowRecords(outputPath) {
    const records = await storage.getBorrowRecords()
    await this.writeJson(outputPath, records)
    await ruleEngine.addHistory('EXPORT_BORROW', `导出 ${records.length} 条借用记录到 ${outputPath}`)
    return { count: records.length, path: outputPath }
  }

  async exportDryingRecords(outputPath) {
    const records = await storage.getDryingRecords()
    await this.writeJson(outputPath, records)
    await ruleEngine.addHistory('EXPORT_DRYING', `导出 ${records.length} 条晾晒记录到 ${outputPath}`)
    return { count: records.length, path: outputPath }
  }

  async exportProblems(outputPath) {
    const problems = await storage.getProblems()
    await this.writeJson(outputPath, problems)
    await ruleEngine.addHistory('EXPORT_PROBLEMS', `导出 ${problems.length} 条问题记录到 ${outputPath}`)
    return { count: problems.length, path: outputPath }
  }

  async exportHistory(outputPath) {
    const history = await storage.getHistory()
    await this.writeJson(outputPath, history)
    await ruleEngine.addHistory('EXPORT_HISTORY', `导出 ${history.length} 条历史记录到 ${outputPath}`)
    return { count: history.length, path: outputPath }
  }

  async exportCheckResults(outputPath) {
    const results = await ruleEngine.checkAllForStorage('export')
    const data = {
      generatedAt: new Date().toISOString(),
      summary: this.generateSummary(results),
      details: results
    }
    await this.writeJson(outputPath, data)
    await ruleEngine.addHistory('EXPORT_CHECK', `导出归仓检查报告到 ${outputPath}`)
    return { path: outputPath, summary: data.summary }
  }

  async exportAllData(outputDir) {
    await fs.mkdir(outputDir, { recursive: true })
    
    const results = {}
    
    results.hoses = await this.exportHoses(path.join(outputDir, 'hoses.json'))
    results.borrowRecords = await this.exportBorrowRecords(path.join(outputDir, 'borrow-records.json'))
    results.dryingRecords = await this.exportDryingRecords(path.join(outputDir, 'drying-records.json'))
    results.problems = await this.exportProblems(path.join(outputDir, 'problems.json'))
    results.history = await this.exportHistory(path.join(outputDir, 'history.json'))
    results.checkReport = await this.exportCheckResults(path.join(outputDir, 'storage-check-report.json'))

    await ruleEngine.addHistory('EXPORT_ALL', `导出全部数据到 ${outputDir}`)
    
    return { outputDir, ...results }
  }

  generateSummary(results) {
    const canStore = results.filter(r => r.canStore).length
    const cannotStore = results.filter(r => !r.canStore).length
    
    const reasonCounts = {}
    for (const r of results) {
      if (r.blockingReasons) {
        for (const reason of r.blockingReasons) {
          reasonCounts[reason] = (reasonCounts[reason] || 0) + 1
        }
      }
    }

    return {
      totalChecked: results.length,
      canStore,
      cannotStore,
      blockedReasons: reasonCounts
    }
  }

  async writeJson(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  }
}

export const exporter = new DataExporter()
