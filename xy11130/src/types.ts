export interface PackageRow {
  团号: string
  团长ID: string
  团长姓名: string
  自提点: string
  商品SKU: string
  商品名称: string
  订购数量: number
  商品状态: '正常' | '替换品' | '缺货补发'
  替换原SKU?: string
  替换原商品名?: string
  包裹号?: string
  处理时间?: string
  处理状态?: '待处理' | '已拆分' | '已跳过' | '处理失败'
  错误信息?: string
  行号?: number
}

export interface ProcessResult {
  success: PackageRow[]
  skipped: PackageRow[]
  failed: PackageRow[]
}

export interface ProcessingSummary {
  totalFiles: number
  totalRows: number
  successCount: number
  skippedCount: number
  failedCount: number
  fileResults: Array<{
    fileName: string
    success: number
    skipped: number
    failed: number
    errors: string[]
  }>
}
