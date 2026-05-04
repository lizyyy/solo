import Papa from 'papaparse'
import type {
  TestRound,
  WindSpeedPoint,
  SixAxisForceData,
  SupportConfiguration,
  SensorCalibration,
  ManualNote,
  ImportResult
} from '@/types'

function generateId(): string {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

function parseDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return dateString
    }
    return date.toISOString()
  } catch {
    return dateString
  }
}

function parseNumber(value: string | number): number {
  if (typeof value === 'number') return value
  const parsed = parseFloat(value.replace(',', ''))
  return isNaN(parsed) ? 0 : parsed
}

export function parseWindSpeedCSV(data: unknown[]): WindSpeedPoint[] {
  return data.map((row: unknown) => {
    const r = row as Record<string, unknown>
    return {
      timestamp: parseNumber(r.timestamp?.toString() || r.time?.toString() || '0'),
      speed: parseNumber(r.speed?.toString() || r.windSpeed?.toString() || r.velocity?.toString() || '0'),
      altitude: r.altitude !== undefined ? parseNumber(r.altitude.toString()) : undefined,
      pressure: r.pressure !== undefined ? parseNumber(r.pressure.toString()) : undefined,
      temperature: r.temperature !== undefined ? parseNumber(r.temperature.toString()) : undefined
    }
  })
}

export function parseForceDataCSV(data: unknown[]): SixAxisForceData[] {
  return data.map((row: unknown) => {
    const r = row as Record<string, unknown>
    return {
      timestamp: parseNumber(r.timestamp?.toString() || r.time?.toString() || '0'),
      fx: parseNumber(r.fx?.toString() || r.Fx?.toString() || r.forceX?.toString() || '0'),
      fy: parseNumber(r.fy?.toString() || r.Fy?.toString() || r.forceY?.toString() || '0'),
      fz: parseNumber(r.fz?.toString() || r.Fz?.toString() || r.forceZ?.toString() || '0'),
      mx: parseNumber(r.mx?.toString() || r.Mx?.toString() || r.momentX?.toString() || '0'),
      my: parseNumber(r.my?.toString() || r.My?.toString() || r.momentY?.toString() || '0'),
      mz: parseNumber(r.mz?.toString() || r.Mz?.toString() || r.momentZ?.toString() || '0')
    }
  })
}

export function parseSupportConfigJSON(data: unknown): SupportConfiguration {
  const d = data as Record<string, unknown>
  return {
    id: d.id?.toString() || generateId(),
    name: d.name?.toString() || '未命名支架',
    description: d.description?.toString() || '',
    material: d.material?.toString() || '未知',
    stiffness: parseNumber(d.stiffness?.toString() || '0'),
    naturalFrequency: parseNumber(d.naturalFrequency?.toString() || d.frequency?.toString() || '0'),
    dampingRatio: parseNumber(d.dampingRatio?.toString() || d.damping?.toString() || '0'),
    mountingType: d.mountingType?.toString() || d.type?.toString() || '标准',
    createdAt: parseDate(d.createdAt?.toString() || d.date?.toString() || new Date().toISOString())
  }
}

export function parseSensorCalibrationJSON(data: unknown): SensorCalibration {
  const d = data as Record<string, unknown>
  return {
    sensorId: d.sensorId?.toString() || d.id?.toString() || generateId(),
    sensorName: d.sensorName?.toString() || d.name?.toString() || '未命名传感器',
    calibrationDate: parseDate(d.calibrationDate?.toString() || d.date?.toString() || new Date().toISOString()),
    expirationDate: parseDate(d.expirationDate?.toString() || d.expiry?.toString() || new Date().toISOString()),
    calibrationFactor: parseNumber(d.calibrationFactor?.toString() || d.factor?.toString() || '1'),
    offset: parseNumber(d.offset?.toString() || '0'),
    calibratedBy: d.calibratedBy?.toString() || d.operator?.toString() || '未知',
    certificateNumber: d.certificateNumber?.toString() || d.cert?.toString() || ''
  }
}

export function parseManualNoteJSON(data: unknown): ManualNote {
  const d = data as Record<string, unknown>
  const category = d.category?.toString() as ManualNote['category']
  return {
    id: d.id?.toString() || generateId(),
    timestamp: parseNumber(d.timestamp?.toString() || d.time?.toString() || Date.now().toString()),
    author: d.author?.toString() || '未知',
    content: d.content?.toString() || d.note?.toString() || d.text?.toString() || '',
    category: ['observation', 'warning', 'issue', 'other'].includes(category) ? category : 'other',
    attachments: d.attachments as string[] | undefined
  }
}

export async function importCSVFile(file: File): Promise<ImportResult> {
  return new Promise((resolve) => {
    const result: ImportResult = {
      success: false,
      testRounds: [],
      errors: [],
      warnings: []
    }

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (parseResult) => {
        try {
          const data = parseResult.data as unknown[]
          
          if (data.length === 0) {
            result.errors.push('CSV 文件为空')
            resolve(result)
            return
          }

          const firstRow = data[0] as Record<string, unknown>
          
          const hasForceColumns = 'fx' in firstRow || 'fy' in firstRow || 'fz' in firstRow || 
                                   'Fx' in firstRow || 'Fy' in firstRow || 'Fz' in firstRow
          const hasWindColumns = 'speed' in firstRow || 'windSpeed' in firstRow || 'velocity' in firstRow

          if (hasForceColumns) {
            const forceData = parseForceDataCSV(data)
            result.testRounds.push(createTestRoundFromForceData(forceData, file.name))
            result.success = true
          } else if (hasWindColumns) {
            const windData = parseWindSpeedCSV(data)
            result.testRounds.push(createTestRoundFromWindData(windData, file.name))
            result.success = true
          } else {
            result.warnings.push('无法识别数据类型，尝试作为通用数据导入')
            result.testRounds.push(createTestRoundFromGenericData(data, file.name))
            result.success = true
          }
        } catch (error) {
          result.errors.push(`解析 CSV 失败: ${error instanceof Error ? error.message : String(error)}`)
        }
        resolve(result)
      },
      error: (error) => {
        result.errors.push(`CSV 解析错误: ${error.message}`)
        resolve(result)
      }
    })
  })
}

export async function importJSONFile(file: File): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    testRounds: [],
    errors: [],
    warnings: []
  }

  try {
    const text = await file.text()
    const data = JSON.parse(text)

    if (Array.isArray(data)) {
      for (const item of data) {
        const parsed = tryParseTestRoundJSON(item)
        if (parsed) {
          result.testRounds.push(parsed)
        }
      }
    } else if (typeof data === 'object' && data !== null) {
      const parsed = tryParseTestRoundJSON(data)
      if (parsed) {
        result.testRounds.push(parsed)
      }
    }

    if (result.testRounds.length > 0) {
      result.success = true
    } else {
      result.errors.push('无法从 JSON 文件中识别有效的测试数据')
    }
  } catch (error) {
    result.errors.push(`解析 JSON 失败: ${error instanceof Error ? error.message : String(error)}`)
  }

  return result
}

function tryParseTestRoundJSON(data: unknown): TestRound | null {
  const d = data as Record<string, unknown>
  
  if (d.testNumber || d.testName || d.modelName) {
    return parseTestRoundJSON(data)
  }
  
  return null
}

export function parseTestRoundJSON(data: unknown): TestRound {
  const d = data as Record<string, unknown>
  
  const windSpeedProfile = Array.isArray(d.windSpeedProfile) 
    ? parseWindSpeedCSV(d.windSpeedProfile)
    : []
  
  const forceData = Array.isArray(d.forceData)
    ? parseForceDataCSV(d.forceData)
    : []
  
  const sensorCalibrations = Array.isArray(d.sensorCalibrations)
    ? d.sensorCalibrations.map(parseSensorCalibrationJSON)
    : []
  
  const manualNotes = Array.isArray(d.manualNotes)
    ? d.manualNotes.map(parseManualNoteJSON)
    : []

  return {
    id: d.id?.toString() || generateId(),
    testNumber: d.testNumber?.toString() || d.number?.toString() || 'T-' + Date.now(),
    testName: d.testName?.toString() || d.name?.toString() || '未命名测试',
    modelName: d.modelName?.toString() || d.model?.toString() || '未命名模型',
    testDate: parseDate(d.testDate?.toString() || d.date?.toString() || new Date().toISOString()),
    startTime: d.startTime?.toString() || '00:00:00',
    endTime: d.endTime?.toString() || '00:00:00',
    windSpeedProfile,
    forceData,
    supportConfigId: d.supportConfigId?.toString() || '',
    sensorCalibrations,
    manualNotes,
    referenceArea: parseNumber(d.referenceArea?.toString() || d.area?.toString() || '1'),
    airDensity: parseNumber(d.airDensity?.toString() || d.density?.toString() || '1.225'),
    metadata: d.metadata as Record<string, unknown> | undefined
  }
}

function createTestRoundFromForceData(forceData: SixAxisForceData[], fileName: string): TestRound {
  const now = new Date()
  return {
    id: generateId(),
    testNumber: 'T-' + now.getTime(),
    testName: `六分力数据 - ${fileName}`,
    modelName: '未指定',
    testDate: now.toISOString(),
    startTime: '00:00:00',
    endTime: '00:00:00',
    windSpeedProfile: [],
    forceData,
    supportConfigId: '',
    sensorCalibrations: [],
    manualNotes: [],
    referenceArea: 1,
    airDensity: 1.225
  }
}

function createTestRoundFromWindData(windData: WindSpeedPoint[], fileName: string): TestRound {
  const now = new Date()
  return {
    id: generateId(),
    testNumber: 'T-' + now.getTime(),
    testName: `风速数据 - ${fileName}`,
    modelName: '未指定',
    testDate: now.toISOString(),
    startTime: '00:00:00',
    endTime: '00:00:00',
    windSpeedProfile: windData,
    forceData: [],
    supportConfigId: '',
    sensorCalibrations: [],
    manualNotes: [],
    referenceArea: 1,
    airDensity: 1.225
  }
}

function createTestRoundFromGenericData(data: unknown[], fileName: string): TestRound {
  const now = new Date()
  return {
    id: generateId(),
    testNumber: 'T-' + now.getTime(),
    testName: `导入数据 - ${fileName}`,
    modelName: '未指定',
    testDate: now.toISOString(),
    startTime: '00:00:00',
    endTime: '00:00:00',
    windSpeedProfile: [],
    forceData: [],
    supportConfigId: '',
    sensorCalibrations: [],
    manualNotes: [],
    referenceArea: 1,
    airDensity: 1.225,
    metadata: { rawData: data }
  }
}

export async function importMultipleFiles(files: FileList): Promise<ImportResult> {
  const allResults: ImportResult = {
    success: true,
    testRounds: [],
    errors: [],
    warnings: []
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const extension = file.name.split('.').pop()?.toLowerCase()
    
    let result: ImportResult
    
    if (extension === 'csv') {
      result = await importCSVFile(file)
    } else if (extension === 'json') {
      result = await importJSONFile(file)
    } else {
      allResults.warnings.push(`不支持的文件格式: ${file.name}`)
      continue
    }

    if (result.success) {
      allResults.testRounds.push(...result.testRounds)
    } else {
      allResults.errors.push(...result.errors.map(e => `${file.name}: ${e}`))
    }
    
    allResults.warnings.push(...result.warnings.map(w => `${file.name}: ${w}`))
  }

  allResults.success = allResults.testRounds.length > 0
  return allResults
}
