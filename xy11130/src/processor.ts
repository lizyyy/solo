import { PackageRow, ProcessResult } from './types'

export class PackageProcessor {
  private processedKeys: Set<string> = new Set()

  generatePackageKey(row: PackageRow): string {
    return `${row.团号}-${row.团长ID}-${row.商品SKU}-${row.订购数量}`
  }

  generatePackageNumber(row: PackageRow, index: number): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const groupCode = row.团号.padStart(6, '0').slice(-6)
    const leaderCode = row.团长ID.padStart(4, '0').slice(-4)
    const seq = String(index + 1).padStart(4, '0')
    return `PKG${date}${groupCode}${leaderCode}${seq}`
  }

  validateRow(row: PackageRow): string | null {
    if (!row.团号 || row.团号.trim() === '') {
      return '团号不能为空'
    }
    if (!row.团长ID || row.团长ID.trim() === '') {
      return '团长ID不能为空'
    }
    if (!row.商品SKU || row.商品SKU.trim() === '') {
      return '商品SKU不能为空'
    }
    if (!row.商品名称 || row.商品名称.trim() === '') {
      return '商品名称不能为空'
    }
    if (!row.订购数量 || row.订购数量 <= 0) {
      return '订购数量必须大于0'
    }
    if (!['正常', '替换品', '缺货补发'].includes(row.商品状态)) {
      return `无效的商品状态: ${row.商品状态}`
    }
    if (row.商品状态 === '替换品') {
      if (!row.替换原SKU || row.替换原SKU.trim() === '') {
        return '替换品必须填写替换原SKU'
      }
    }
    return null
  }

  processRow(row: PackageRow, index: number): { row: PackageRow; status: 'success' | 'skipped' | 'failed' } {
    const validationError = this.validateRow(row)
    if (validationError) {
      return {
        row: {
          ...row,
          处理状态: '处理失败',
          错误信息: validationError,
          处理时间: new Date().toISOString()
        },
        status: 'failed'
      }
    }

    const key = this.generatePackageKey(row)
    if (this.processedKeys.has(key)) {
      return {
        row: {
          ...row,
          处理状态: '已跳过',
          错误信息: '重复记录，已跳过',
          处理时间: new Date().toISOString()
        },
        status: 'skipped'
      }
    }

    this.processedKeys.add(key)
    const processedRow: PackageRow = {
      ...row,
      包裹号: this.generatePackageNumber(row, index),
      处理状态: '已拆分',
      处理时间: new Date().toISOString()
    }

    if (row.商品状态 === '缺货补发') {
      processedRow.包裹号 = `${processedRow.包裹号}-BF`
    } else if (row.商品状态 === '替换品') {
      processedRow.包裹号 = `${processedRow.包裹号}-TH`
    }

    return { row: processedRow, status: 'success' }
  }

  processRows(rows: PackageRow[]): ProcessResult {
    const result: ProcessResult = {
      success: [],
      skipped: [],
      failed: []
    }

    rows.forEach((row, index) => {
      const { row: processedRow, status } = this.processRow(row, index)
      result[status].push(processedRow)
    })

    return result
  }

  resetProcessedKeys(): void {
    this.processedKeys.clear()
  }
}
