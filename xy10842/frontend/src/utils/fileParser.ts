import * as XLSX from 'xlsx'

export interface ParsedEvaluationData {
  model_version_name: string
  model_name: string
  dataset_name: string
  dataset_version: string
  metrics: Array<{
    metric_name: string
    metric_value: number
    metric_unit: string
    threshold?: number | null
    is_alert: boolean
  }>
  failure_samples: Array<{
    sample_id: string
    input_data: string
    expected_output: string
    actual_output: string
    error_type: string
  }>
}

export function parseExcelFile(file: File): Promise<ParsedEvaluationData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })

        const result: ParsedEvaluationData = {
          model_version_name: '',
          model_name: '',
          dataset_name: '',
          dataset_version: '',
          metrics: [],
          failure_samples: [],
        }

        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

        if (jsonData.length > 0) {
          let currentSection = ''
          let metricHeaders: string[] = []
          let sampleHeaders: string[] = []

          for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i]
            if (!row || row.length === 0) continue

            const firstCell = String(row[0] || '').trim().toLowerCase()

            if (firstCell.includes('基本信息') || firstCell.includes('basic info')) {
              currentSection = 'basic'
              continue
            } else if (firstCell.includes('指标') || firstCell.includes('metrics')) {
              currentSection = 'metrics'
              if (i + 1 < jsonData.length) {
                metricHeaders = jsonData[i + 1].map((h: any) => String(h || '').trim().toLowerCase())
                i++
              }
              continue
            } else if (firstCell.includes('失败样本') || firstCell.includes('failure sample')) {
              currentSection = 'samples'
              if (i + 1 < jsonData.length) {
                sampleHeaders = jsonData[i + 1].map((h: any) => String(h || '').trim().toLowerCase())
                i++
              }
              continue
            }

            if (currentSection === 'basic' && row.length >= 2) {
              const key = String(row[0] || '').trim().toLowerCase()
              const value = String(row[1] || '').trim()

              if (key.includes('模型版本') || key.includes('model version')) {
                result.model_version_name = value
              } else if (key.includes('模型名称') || key.includes('model name')) {
                result.model_name = value
              } else if (key.includes('数据集版本') || key.includes('dataset version')) {
                result.dataset_version = value
              } else if (key.includes('数据集') || key.includes('dataset name')) {
                result.dataset_name = value
              }
            } else if (currentSection === 'metrics' && row.length >= 2) {
              const metric: any = {}
              for (let j = 0; j < metricHeaders.length && j < row.length; j++) {
                const header = metricHeaders[j]
                const value = row[j]

                if (header.includes('指标名称') || header.includes('metric name')) {
                  metric.metric_name = String(value || '')
                } else if (header.includes('值') || header.includes('value')) {
                  metric.metric_value = parseFloat(value) || 0
                } else if (header.includes('单位') || header.includes('unit')) {
                  metric.metric_unit = String(value || '')
                } else if (header.includes('阈值') || header.includes('threshold')) {
                  metric.threshold = value ? parseFloat(value) : null
                } else if (header.includes('告警') || header.includes('alert')) {
                  metric.is_alert = String(value).toLowerCase() === 'true' || String(value).toLowerCase() === '是'
                }
              }
              if (metric.metric_name) {
                result.metrics.push(metric)
              }
            } else if (currentSection === 'samples' && row.length >= 2) {
              const sample: any = {}
              for (let j = 0; j < sampleHeaders.length && j < row.length; j++) {
                const header = sampleHeaders[j]
                const value = row[j]

                if (header.includes('样本') || header.includes('sample id')) {
                  sample.sample_id = String(value || '')
                } else if (header.includes('输入') || header.includes('input')) {
                  sample.input_data = String(value || '')
                } else if (header.includes('期望') || header.includes('expected')) {
                  sample.expected_output = String(value || '')
                } else if (header.includes('实际') || header.includes('actual')) {
                  sample.actual_output = String(value || '')
                } else if (header.includes('错误类型') || header.includes('error type')) {
                  sample.error_type = String(value || '')
                }
              }
              if (sample.sample_id) {
                result.failure_samples.push(sample)
              }
            }
          }
        }

        if (!result.model_version_name) {
          result.model_version_name = 'v1.0.0'
        }
        if (!result.model_name) {
          result.model_name = 'DefaultModel'
        }
        if (!result.dataset_name) {
          result.dataset_name = 'Dataset'
        }
        if (!result.dataset_version) {
          result.dataset_version = '1.0'
        }

        resolve(result)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = (error) => reject(error)
    reader.readAsBinaryString(file)
  })
}

export function parseCsvFile(file: File): Promise<ParsedEvaluationData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.split('\n')

        const result: ParsedEvaluationData = {
          model_version_name: '',
          model_name: '',
          dataset_name: '',
          dataset_version: '',
          metrics: [],
          failure_samples: [],
        }

        let currentSection = ''
        let metricHeaders: string[] = []
        let sampleHeaders: string[] = []

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim()
          if (!line) continue

          const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
          const firstCell = cells[0].toLowerCase()

          if (firstCell.includes('基本信息') || firstCell.includes('basic info')) {
            currentSection = 'basic'
            continue
          } else if (firstCell.includes('指标') || firstCell.includes('metrics')) {
            currentSection = 'metrics'
            if (i + 1 < lines.length) {
              metricHeaders = lines[i + 1].split(',').map((h) => h.trim().toLowerCase())
              i++
            }
            continue
          } else if (firstCell.includes('失败样本') || firstCell.includes('failure sample')) {
            currentSection = 'samples'
            if (i + 1 < lines.length) {
              sampleHeaders = lines[i + 1].split(',').map((h) => h.trim().toLowerCase())
              i++
            }
            continue
          }

          if (currentSection === 'basic' && cells.length >= 2) {
            const key = cells[0].toLowerCase()
            const value = cells[1]

            if (key.includes('模型版本') || key.includes('model version')) {
              result.model_version_name = value
            } else if (key.includes('模型名称') || key.includes('model name')) {
              result.model_name = value
            } else if (key.includes('数据集版本') || key.includes('dataset version')) {
              result.dataset_version = value
            } else if (key.includes('数据集') || key.includes('dataset name')) {
              result.dataset_name = value
            }
          } else if (currentSection === 'metrics' && cells.length >= 2) {
            const metric: any = {}
            for (let j = 0; j < metricHeaders.length && j < cells.length; j++) {
              const header = metricHeaders[j]
              const value = cells[j]

              if (header.includes('指标名称') || header.includes('metric name')) {
                metric.metric_name = value
              } else if (header.includes('值') || header.includes('value')) {
                metric.metric_value = parseFloat(value) || 0
              } else if (header.includes('单位') || header.includes('unit')) {
                metric.metric_unit = value
              } else if (header.includes('阈值') || header.includes('threshold')) {
                metric.threshold = value ? parseFloat(value) : null
              } else if (header.includes('告警') || header.includes('alert')) {
                metric.is_alert = value.toLowerCase() === 'true' || value.toLowerCase() === '是'
              }
            }
            if (metric.metric_name) {
              result.metrics.push(metric)
            }
          } else if (currentSection === 'samples' && cells.length >= 2) {
            const sample: any = {}
            for (let j = 0; j < sampleHeaders.length && j < cells.length; j++) {
              const header = sampleHeaders[j]
              const value = cells[j]

              if (header.includes('样本') || header.includes('sample id')) {
                sample.sample_id = value
              } else if (header.includes('输入') || header.includes('input')) {
                sample.input_data = value
              } else if (header.includes('期望') || header.includes('expected')) {
                sample.expected_output = value
              } else if (header.includes('实际') || header.includes('actual')) {
                sample.actual_output = value
              } else if (header.includes('错误类型') || header.includes('error type')) {
                sample.error_type = value
              }
            }
            if (sample.sample_id) {
              result.failure_samples.push(sample)
            }
          }
        }

        if (!result.model_version_name) {
          result.model_version_name = 'v1.0.0'
        }
        if (!result.model_name) {
          result.model_name = 'DefaultModel'
        }
        if (!result.dataset_name) {
          result.dataset_name = 'Dataset'
        }
        if (!result.dataset_version) {
          result.dataset_version = '1.0'
        }

        resolve(result)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = (error) => reject(error)
    reader.readAsText(file, 'UTF-8')
  })
}

export function generateTemplateExcel(): Blob {
  const wb = XLSX.utils.book_new()

  const basicInfoData = [
    ['【基本信息】'],
    ['模型版本', 'v2.0.0'],
    ['模型名称', 'GPT-4'],
    ['数据集名称', 'SQuAD-v1'],
    ['数据集版本', '1.0'],
    [],
  ]

  const metricsData = [
    ['【评测指标】'],
    ['指标名称', '指标值', '单位', '阈值', '是否告警'],
    ['accuracy', 0.956, '', 0.8, false],
    ['f1_score', 0.942, '', 0.8, false],
    ['precision', 0.948, '', 0.8, false],
    ['recall', 0.945, '', 0.8, false],
    ['latency', 125.5, 'ms', 200, false],
    [],
  ]

  const samplesData = [
    ['【失败样本】'],
    ['样本ID', '输入数据', '期望输出', '实际输出', '错误类型'],
    ['S001', '2+2等于几', '4', '5', '计算错误'],
    ['S002', '法国的首都是哪里', '巴黎', '里昂', '知识错误'],
  ]

  const allData = [...basicInfoData, ...metricsData, ...samplesData]

  const ws = XLSX.utils.aoa_to_sheet(allData)
  XLSX.utils.book_append_sheet(wb, ws, '评测结果')

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function generateTemplateCsv(): Blob {
  const csvContent = `【基本信息】
模型版本,v2.0.0
模型名称,GPT-4
数据集名称,SQuAD-v1
数据集版本,1.0

【评测指标】
指标名称,指标值,单位,阈值,是否告警
accuracy,0.956,,0.8,false
f1_score,0.942,,0.8,false
precision,0.948,,0.8,false
recall,0.945,,0.8,false
latency,125.5,ms,200,false

【失败样本】
样本ID,输入数据,期望输出,实际输出,错误类型
S001,2+2等于几,4,5,计算错误
S002,法国的首都是哪里,巴黎,里昂,知识错误
`

  return new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
}
