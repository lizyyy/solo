import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import { PackageRow, ProcessResult } from './types'

export const OUTPUT_COLUMNS = [
  '包裹号',
  '团号',
  '团长ID',
  '团长姓名',
  '自提点',
  '商品SKU',
  '商品名称',
  '订购数量',
  '商品状态',
  '替换原SKU',
  '替换原商品名',
  '处理状态',
  '处理时间',
  '错误信息'
]

export class FileHandler {
  readCsv(filePath: string): PackageRow[] {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`)
    }

    const content = fs.readFileSync(filePath, 'utf-8')
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    })

    return records.map((record: any, index: number) => ({
      团号: String(record.团号 || ''),
      团长ID: String(record.团长ID || ''),
      团长姓名: String(record.团长姓名 || ''),
      自提点: String(record.自提点 || ''),
      商品SKU: String(record.商品SKU || ''),
      商品名称: String(record.商品名称 || ''),
      订购数量: parseInt(record.订购数量 || '0', 10),
      商品状态: (record.商品状态 || '正常') as PackageRow['商品状态'],
      替换原SKU: record.替换原SKU ? String(record.替换原SKU) : undefined,
      替换原商品名: record.替换原商品名 ? String(record.替换原商品名) : undefined,
      处理状态: '待处理' as const,
      行号: index + 2
    }))
  }

  writeCsv(filePath: string, rows: PackageRow[]): void {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const records = rows.map(row => {
      const record: Record<string, any> = {}
      OUTPUT_COLUMNS.forEach(col => {
        record[col] = row[col as keyof PackageRow] ?? ''
      })
      return record
    })

    const csvContent = stringify(records, {
      header: true,
      columns: OUTPUT_COLUMNS,
      encoding: 'utf-8'
    })

    fs.writeFileSync(filePath, '\uFEFF' + csvContent)
  }

  writeResult(outputDir: string, fileName: string, result: ProcessResult): void {
    const baseName = path.basename(fileName, path.extname(fileName))
    
    if (result.success.length > 0) {
      this.writeCsv(path.join(outputDir, `${baseName}_成功.csv`), result.success)
    }
    if (result.skipped.length > 0) {
      this.writeCsv(path.join(outputDir, `${baseName}_跳过.csv`), result.skipped)
    }
    if (result.failed.length > 0) {
      this.writeCsv(path.join(outputDir, `${baseName}_失败.csv`), result.failed)
    }
  }

  getInputFiles(inputPath: string): string[] {
    if (!fs.existsSync(inputPath)) {
      return []
    }

    const stat = fs.statSync(inputPath)
    if (stat.isFile()) {
      return [inputPath]
    }

    if (stat.isDirectory()) {
      const files = fs.readdirSync(inputPath)
        .filter(f => f.endsWith('.csv'))
        .map(f => path.join(inputPath, f))
        .sort()
      return files
    }

    return []
  }
}
