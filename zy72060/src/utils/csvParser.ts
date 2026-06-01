import Papa from 'papaparse'
import { InspectionPoint } from '@/types'

interface CSVRow {
  序号: string
  构件: string
  检测项: string
  测量值: string
  标准值: string
  判定: string
  备注: string
  X: string
  Y: string
  Z: string
}

export function parseCSV(csvText: string): InspectionPoint[] {
  const result = Papa.parse<CSVRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  return result.data.map((row, index) => {
    const judgment = row['判定']?.trim() || ''
    const isAnomaly = judgment.includes('不合格')
    return {
      id: `IMP-${Date.now()}-${index}`,
      planId: '',
      label: `IMP-${index + 1}`,
      component: row['构件']?.trim() || '',
      inspectItem: row['检测项']?.trim() || '',
      measuredValue: row['测量值']?.trim() || '',
      standardValue: row['标准值']?.trim() || '',
      judgment,
      x: parseFloat(row['X']) || 0,
      y: parseFloat(row['Y']) || 0,
      z: parseFloat(row['Z']) || 0,
      status: isAnomaly ? 'anomaly' : 'normal',
      sourceType: 'point_table' as const,
      sourceRef: `行${index + 1}`,
      originalRow: index + 1,
    }
  })
}

export function generateCSVFromPoints(points: InspectionPoint[]): string {
  const rows = points.map((p, i) => ({
    序号: i + 1,
    构件: p.component,
    检测项: p.inspectItem,
    测量值: p.measuredValue,
    标准值: p.standardValue,
    判定: p.judgment,
    备注: '',
    X: p.x,
    Y: p.y,
    Z: p.z,
  }))
  return Papa.unparse(rows)
}
