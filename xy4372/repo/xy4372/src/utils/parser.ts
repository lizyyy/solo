import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import type {
  Horse,
  VetRecord,
  ShoeingRecord,
  TackItem,
  RaceEntry,
} from '@/types'

export interface ImportResult<T> {
  success: boolean
  data: T[]
  errors: string[]
  warnings: string[]
}

interface HeaderMapping {
  [key: string]: string[]
}

const HEADER_MAPPINGS: Record<string, HeaderMapping> = {
  horses: {
    horseNumber: ['马匹编号', '马号', 'horseNumber', 'horse_id', 'HorseNo', '编号'],
    horseName: ['马匹名称', '马名', 'horseName', 'HorseName', '名称', '名字'],
    breed: ['品种', 'breed', 'Breed', '马种'],
    gender: ['性别', 'gender', 'Gender', '公母'],
    birthDate: ['出生日期', 'birthDate', 'BirthDate', '生日', '出生年月'],
    owner: ['马主', 'owner', 'Owner', '主人'],
    rider: ['骑手', 'rider', 'Rider', '骑师'],
    microchipId: ['芯片号', '微芯片号', 'microchipId', 'MicrochipId', '芯片'],
    notes: ['备注', 'notes', 'Notes', '说明'],
  },
  vetRecords: {
    horseNumber: ['马匹编号', '马号', 'horseNumber', 'horse_id', 'HorseNo'],
    horseName: ['马匹名称', '马名', 'horseName', 'HorseName'],
    treatmentDate: ['治疗日期', '就诊日期', 'treatmentDate', 'TreatmentDate', '日期'],
    diagnosis: ['诊断', '诊断结果', 'diagnosis', 'Diagnosis', '病情'],
    treatment: ['治疗方案', 'treatment', 'Treatment', '处理'],
    vetName: ['兽医姓名', '兽医', 'vetName', 'VetName', '医生'],
    restPeriodDays: ['休养天数', '休息天数', 'restPeriodDays', 'RestPeriodDays', '休养期'],
    recoveryDate: ['康复日期', '解禁日期', 'recoveryDate', 'RecoveryDate', '可参赛日期'],
    isCleared: ['是否放行', '已康复', 'isCleared', 'IsCleared', '放行'],
    notes: ['备注', 'notes', 'Notes', '说明'],
  },
  shoeing: {
    horseNumber: ['马匹编号', '马号', 'horseNumber', 'horse_id', 'HorseNo'],
    horseName: ['马匹名称', '马名', 'horseName', 'HorseName'],
    shoeingDate: ['装蹄日期', '钉蹄日期', 'shoeingDate', 'ShoeingDate', '日期'],
    farrierName: ['蹄铁匠', '钉蹄师', 'farrierName', 'FarrierName', '师傅'],
    frontLeft: ['左前蹄', 'frontLeft', 'FrontLeft', '前左'],
    frontRight: ['右前蹄', 'frontRight', 'FrontRight', '前右'],
    hindLeft: ['左后蹄', 'hindLeft', 'HindLeft', '后左'],
    hindRight: ['右后蹄', 'hindRight', 'HindRight', '后右'],
    nextDueDate: ['下次装蹄日期', '到期日期', 'nextDueDate', 'NextDueDate', '下次日期'],
    notes: ['备注', 'notes', 'Notes', '说明'],
  },
  tack: {
    tackNumber: ['鞍具编号', '装备编号', 'tackNumber', 'TackNumber', '编号'],
    tackType: ['类型', '装备类型', 'tackType', 'TackType', '种类'],
    brand: ['品牌', 'brand', 'Brand', '牌子'],
    model: ['型号', 'model', 'Model', '款号'],
    size: ['尺寸', 'size', 'Size', '尺码'],
    sizeUnit: ['单位', '尺寸单位', 'sizeUnit', 'SizeUnit'],
    purchaseDate: ['购买日期', 'purchaseDate', 'PurchaseDate'],
    lastInspectionDate: ['上次检查日期', 'lastInspectionDate', 'LastInspectionDate', '检查日期'],
    condition: ['状态', 'condition', 'Condition', '状况'],
    assignedHorseNumber: ['分配马匹编号', 'assignedHorseNumber', 'AssignedHorseNumber', '马匹编号'],
    assignedHorseName: ['分配马匹名称', 'assignedHorseName', 'AssignedHorseName', '马匹名称'],
    notes: ['备注', 'notes', 'Notes', '说明'],
  },
  raceSchedule: {
    raceNumber: ['场次编号', '比赛编号', 'raceNumber', 'RaceNumber', '场次', '场号'],
    raceName: ['场次名称', '比赛名称', 'raceName', 'RaceName', '名称'],
    startTime: ['开始时间', '比赛时间', 'startTime', 'StartTime', '时间'],
    endTime: ['结束时间', 'endTime', 'EndTime'],
    location: ['场地', 'location', 'Location', '地点'],
    weatherCondition: ['天气', 'weatherCondition', 'WeatherCondition', '天气状况'],
    temperature: ['温度', 'temperature', 'Temperature', '气温'],
    humidity: ['湿度', 'humidity', 'Humidity'],
    horseNumber: ['马匹编号', '马号', 'horseNumber', 'horse_id', 'HorseNo'],
    horseName: ['马匹名称', '马名', 'horseName', 'HorseName'],
    rider: ['骑手', 'rider', 'Rider', '骑师'],
    category: ['项目', 'category', 'Category', '比赛项目'],
    class: ['级别', 'class', 'Class', '等级'],
    notes: ['备注', 'notes', 'Notes', '说明'],
  },
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]/g, '')
}

function findHeaderMapping(
  headers: string[],
  fieldKey: string,
  mappingType: string
): string | null {
  const mappings = HEADER_MAPPINGS[mappingType]
  if (!mappings) return null

  const aliases = mappings[fieldKey] || []
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias)
    for (const header of headers) {
      if (normalizeHeader(header) === normalizedAlias || header.includes(alias)) {
        return header
      }
    }
  }
  return null
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return isNaN(num) ? null : num
}

function parseDate(value: unknown): string {
  if (!value) return ''
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'number') {
    return new Date(value).toISOString()
  }
  const str = String(value)
  const date = new Date(str)
  if (!isNaN(date.getTime())) {
    return date.toISOString()
  }
  return str
}

function parseBoolean(value: unknown): boolean {
  if (value === null || value === undefined) return false
  const str = String(value).toLowerCase()
  return str === '是' || str === 'true' || str === 'yes' || str === '1' || str === '已放行' || str === '放行'
}

function parseTackType(value: unknown): 'saddle' | 'bridle' | 'girth' | 'pad' | 'other' {
  if (!value) return 'other'
  const str = String(value).toLowerCase()
  if (str.includes('鞍') || str.includes('saddle')) return 'saddle'
  if (str.includes('笼头') || str.includes('水勒') || str.includes('bridle')) return 'bridle'
  if (str.includes('肚带') || str.includes('girth')) return 'girth'
  if (str.includes('鞍垫') || str.includes('垫') || str.includes('pad')) return 'pad'
  return 'other'
}

function parseCondition(value: unknown): 'excellent' | 'good' | 'fair' | 'needs_repair' | 'retired' {
  if (!value) return 'good'
  const str = String(value).toLowerCase()
  if (str.includes('优秀') || str.includes('极佳') || str.includes('excellent')) return 'excellent'
  if (str.includes('良好') || str.includes('good')) return 'good'
  if (str.includes('一般') || str.includes('尚可') || str.includes('fair')) return 'fair'
  if (str.includes('需维修') || str.includes('修理') || str.includes('repair')) return 'needs_repair'
  if (str.includes('退役') || str.includes('报废') || str.includes('retired')) return 'retired'
  return 'good'
}

async function parseExcelFileInternal<T>(
  file: File,
  type: 'horses' | 'vet_records' | 'shoeing' | 'tack' | 'race_schedule'
): Promise<ImportResult<T>> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    const errors: string[] = []
    const warnings: string[] = []

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        if (jsonData.length < 2) {
          errors.push('Excel文件为空或没有数据行')
          resolve({ success: false, data: [], errors, warnings })
          return
        }

        const headers = (jsonData[0] as unknown[]).map(h => String(h || ''))
        const rows = jsonData.slice(1) as unknown[][]

        const parsedData = parseDataByType(headers, rows, type, warnings)

        resolve({
          success: errors.length === 0,
          data: parsedData as T[],
          errors,
          warnings,
        })
      } catch (err) {
        errors.push(`解析Excel文件失败: ${(err as Error).message}`)
        resolve({ success: false, data: [], errors, warnings })
      }
    }

    reader.onerror = () => {
      errors.push('读取文件失败')
      resolve({ success: false, data: [], errors, warnings })
    }

    reader.readAsArrayBuffer(file)
  })
}

async function parseCsvFileInternal<T>(
  file: File,
  type: 'horses' | 'vet_records' | 'shoeing' | 'tack' | 'race_schedule'
): Promise<ImportResult<T>> {
  return new Promise((resolve) => {
    const errors: string[] = []
    const warnings: string[] = []

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        try {
          const headers = results.meta.fields || []
          const rows = results.data as Record<string, unknown>[]
          
          if (rows.length === 0) {
            errors.push('CSV文件为空')
            resolve({ success: false, data: [], errors, warnings })
            return
          }

          const rowArrays = rows.map(row => headers.map(h => row[h]))
          const parsedData = parseDataByType(headers, rowArrays, type, warnings)

          resolve({
            success: errors.length === 0,
            data: parsedData as T[],
            errors,
            warnings,
          })
        } catch (err) {
          errors.push(`解析CSV文件失败: ${(err as Error).message}`)
          resolve({ success: false, data: [], errors, warnings })
        }
      },
      error: (err) => {
        errors.push(`CSV解析错误: ${err.message}`)
        resolve({ success: false, data: [], errors, warnings })
      },
    })
  })
}

function parseDataByType(
  headers: string[],
  rows: unknown[][],
  type: 'horses' | 'vet_records' | 'shoeing' | 'tack' | 'race_schedule',
  warnings: string[]
): Horse[] | VetRecord[] | ShoeingRecord[] | TackItem[] | RaceEntry[] {
  const mappingType = type === 'vet_records' ? 'vetRecords' : 
                      type === 'race_schedule' ? 'raceSchedule' : 
                      type

  switch (type) {
    case 'horses':
      return parseHorses(headers, rows, warnings, mappingType)
    case 'vet_records':
      return parseVetRecords(headers, rows, warnings, mappingType)
    case 'shoeing':
      return parseShoeingRecords(headers, rows, warnings, mappingType)
    case 'tack':
      return parseTackItems(headers, rows, warnings, mappingType)
    case 'race_schedule':
      return parseRaceEntries(headers, rows, warnings, mappingType)
  }
}

function parseHorses(headers: string[], rows: unknown[][], warnings: string[], mappingType: string): Horse[] {
  const horses: Horse[] = []
  
  const horseNumberKey = findHeaderMapping(headers, 'horseNumber', mappingType)
  const horseNameKey = findHeaderMapping(headers, 'horseName', mappingType)
  const breedKey = findHeaderMapping(headers, 'breed', mappingType)
  const genderKey = findHeaderMapping(headers, 'gender', mappingType)
  const birthDateKey = findHeaderMapping(headers, 'birthDate', mappingType)
  const ownerKey = findHeaderMapping(headers, 'owner', mappingType)
  const riderKey = findHeaderMapping(headers, 'rider', mappingType)
  const microchipIdKey = findHeaderMapping(headers, 'microchipId', mappingType)
  const notesKey = findHeaderMapping(headers, 'notes', mappingType)

  let rowIndex = 0
  for (const row of rows) {
    rowIndex++
    const record: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      record[h] = row[i]
    })

    const horseNumber = String(record[horseNumberKey || ''] || '')
    if (!horseNumber) {
      warnings.push(`第${rowIndex}行: 马匹编号为空，已跳过`)
      continue
    }

    const horse: Horse = {
      id: crypto.randomUUID(),
      horseNumber,
      horseName: String(record[horseNameKey || ''] || ''),
      breed: String(record[breedKey || ''] || ''),
      gender: String(record[genderKey || ''] || ''),
      birthDate: parseDate(record[birthDateKey || '']),
      owner: String(record[ownerKey || ''] || ''),
      rider: String(record[riderKey || ''] || ''),
      microchipId: String(record[microchipIdKey || ''] || '') || undefined,
      notes: String(record[notesKey || ''] || '') || undefined,
    }

    horses.push(horse)
  }

  return horses
}

function parseVetRecords(headers: string[], rows: unknown[][], warnings: string[], mappingType: string): VetRecord[] {
  const records: VetRecord[] = []
  
  const horseNumberKey = findHeaderMapping(headers, 'horseNumber', mappingType)
  const horseNameKey = findHeaderMapping(headers, 'horseName', mappingType)
  const treatmentDateKey = findHeaderMapping(headers, 'treatmentDate', mappingType)
  const diagnosisKey = findHeaderMapping(headers, 'diagnosis', mappingType)
  const treatmentKey = findHeaderMapping(headers, 'treatment', mappingType)
  const vetNameKey = findHeaderMapping(headers, 'vetName', mappingType)
  const restPeriodDaysKey = findHeaderMapping(headers, 'restPeriodDays', mappingType)
  const recoveryDateKey = findHeaderMapping(headers, 'recoveryDate', mappingType)
  const isClearedKey = findHeaderMapping(headers, 'isCleared', mappingType)
  const notesKey = findHeaderMapping(headers, 'notes', mappingType)

  let rowIndex = 0
  for (const row of rows) {
    rowIndex++
    const record: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      record[h] = row[i]
    })

    const horseNumber = String(record[horseNumberKey || ''] || '')
    if (!horseNumber) {
      warnings.push(`第${rowIndex}行: 马匹编号为空，已跳过`)
      continue
    }

    const restPeriodDays = parseNumber(record[restPeriodDaysKey || '']) || 14
    const treatmentDate = parseDate(record[treatmentDateKey || ''])
    const recoveryDate = parseDate(record[recoveryDateKey || '']) || 
      (treatmentDate ? new Date(new Date(treatmentDate).getTime() + restPeriodDays * 86400000).toISOString() : '')

    const vetRecord: VetRecord = {
      id: crypto.randomUUID(),
      horseNumber,
      horseName: String(record[horseNameKey || ''] || ''),
      treatmentDate,
      diagnosis: String(record[diagnosisKey || ''] || ''),
      treatment: String(record[treatmentKey || ''] || ''),
      vetName: String(record[vetNameKey || ''] || ''),
      restPeriodDays,
      recoveryDate,
      isCleared: parseBoolean(record[isClearedKey || '']),
      notes: String(record[notesKey || ''] || '') || undefined,
    }

    records.push(vetRecord)
  }

  return records
}

function parseShoeingRecords(headers: string[], rows: unknown[][], warnings: string[], mappingType: string): ShoeingRecord[] {
  const records: ShoeingRecord[] = []
  
  const horseNumberKey = findHeaderMapping(headers, 'horseNumber', mappingType)
  const horseNameKey = findHeaderMapping(headers, 'horseName', mappingType)
  const shoeingDateKey = findHeaderMapping(headers, 'shoeingDate', mappingType)
  const farrierNameKey = findHeaderMapping(headers, 'farrierName', mappingType)
  const frontLeftKey = findHeaderMapping(headers, 'frontLeft', mappingType)
  const frontRightKey = findHeaderMapping(headers, 'frontRight', mappingType)
  const hindLeftKey = findHeaderMapping(headers, 'hindLeft', mappingType)
  const hindRightKey = findHeaderMapping(headers, 'hindRight', mappingType)
  const nextDueDateKey = findHeaderMapping(headers, 'nextDueDate', mappingType)
  const notesKey = findHeaderMapping(headers, 'notes', mappingType)

  let rowIndex = 0
  for (const row of rows) {
    rowIndex++
    const record: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      record[h] = row[i]
    })

    const horseNumber = String(record[horseNumberKey || ''] || '')
    if (!horseNumber) {
      warnings.push(`第${rowIndex}行: 马匹编号为空，已跳过`)
      continue
    }

    const shoeingDate = parseDate(record[shoeingDateKey || ''])
    const nextDueDate = parseDate(record[nextDueDateKey || '']) || 
      (shoeingDate ? new Date(new Date(shoeingDate).getTime() + 42 * 86400000).toISOString() : '')

    const shoeingRecord: ShoeingRecord = {
      id: crypto.randomUUID(),
      horseNumber,
      horseName: String(record[horseNameKey || ''] || ''),
      shoeingDate,
      farrierName: String(record[farrierNameKey || ''] || ''),
      frontLeft: String(record[frontLeftKey || ''] || ''),
      frontRight: String(record[frontRightKey || ''] || ''),
      hindLeft: String(record[hindLeftKey || ''] || ''),
      hindRight: String(record[hindRightKey || ''] || ''),
      nextDueDate,
      notes: String(record[notesKey || ''] || '') || undefined,
    }

    records.push(shoeingRecord)
  }

  return records
}

function parseTackItems(headers: string[], rows: unknown[][], warnings: string[], mappingType: string): TackItem[] {
  const items: TackItem[] = []
  
  const tackNumberKey = findHeaderMapping(headers, 'tackNumber', mappingType)
  const tackTypeKey = findHeaderMapping(headers, 'tackType', mappingType)
  const brandKey = findHeaderMapping(headers, 'brand', mappingType)
  const modelKey = findHeaderMapping(headers, 'model', mappingType)
  const sizeKey = findHeaderMapping(headers, 'size', mappingType)
  const sizeUnitKey = findHeaderMapping(headers, 'sizeUnit', mappingType)
  const purchaseDateKey = findHeaderMapping(headers, 'purchaseDate', mappingType)
  const lastInspectionDateKey = findHeaderMapping(headers, 'lastInspectionDate', mappingType)
  const conditionKey = findHeaderMapping(headers, 'condition', mappingType)
  const assignedHorseNumberKey = findHeaderMapping(headers, 'assignedHorseNumber', mappingType)
  const assignedHorseNameKey = findHeaderMapping(headers, 'assignedHorseName', mappingType)
  const notesKey = findHeaderMapping(headers, 'notes', mappingType)

  let rowIndex = 0
  for (const row of rows) {
    rowIndex++
    const record: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      record[h] = row[i]
    })

    const tackNumber = String(record[tackNumberKey || ''] || '')
    if (!tackNumber) {
      warnings.push(`第${rowIndex}行: 鞍具编号为空，已跳过`)
      continue
    }

    const assignedHorseNumber = String(record[assignedHorseNumberKey || ''] || '')

    const tackItem: TackItem = {
      id: crypto.randomUUID(),
      tackNumber,
      tackType: parseTackType(record[tackTypeKey || '']),
      brand: String(record[brandKey || ''] || ''),
      model: String(record[modelKey || ''] || ''),
      size: String(record[sizeKey || ''] || ''),
      sizeUnit: String(record[sizeUnitKey || ''] || '') || 'cm',
      purchaseDate: parseDate(record[purchaseDateKey || '']),
      lastInspectionDate: parseDate(record[lastInspectionDateKey || '']),
      condition: parseCondition(record[conditionKey || '']),
      assignedHorseNumber: assignedHorseNumber || undefined,
      assignedHorseName: String(record[assignedHorseNameKey || ''] || '') || undefined,
      notes: String(record[notesKey || ''] || '') || undefined,
    }

    items.push(tackItem)
  }

  return items
}

function parseRaceEntries(headers: string[], rows: unknown[][], warnings: string[], mappingType: string): RaceEntry[] {
  const entries: RaceEntry[] = []
  
  const raceNumberKey = findHeaderMapping(headers, 'raceNumber', mappingType)
  const raceNameKey = findHeaderMapping(headers, 'raceName', mappingType)
  const startTimeKey = findHeaderMapping(headers, 'startTime', mappingType)
  const endTimeKey = findHeaderMapping(headers, 'endTime', mappingType)
  const locationKey = findHeaderMapping(headers, 'location', mappingType)
  const weatherConditionKey = findHeaderMapping(headers, 'weatherCondition', mappingType)
  const temperatureKey = findHeaderMapping(headers, 'temperature', mappingType)
  const humidityKey = findHeaderMapping(headers, 'humidity', mappingType)
  const horseNumberKey = findHeaderMapping(headers, 'horseNumber', mappingType)
  const horseNameKey = findHeaderMapping(headers, 'horseName', mappingType)
  const riderKey = findHeaderMapping(headers, 'rider', mappingType)
  const categoryKey = findHeaderMapping(headers, 'category', mappingType)
  const classKey = findHeaderMapping(headers, 'class', mappingType)
  const notesKey = findHeaderMapping(headers, 'notes', mappingType)

  let rowIndex = 0
  for (const row of rows) {
    rowIndex++
    const record: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      record[h] = row[i]
    })

    const horseNumber = String(record[horseNumberKey || ''] || '')
    const raceNumber = String(record[raceNumberKey || ''] || '')
    
    if (!horseNumber && !raceNumber) {
      warnings.push(`第${rowIndex}行: 马匹编号和场次编号均为空，已跳过`)
      continue
    }

    const temperature = parseNumber(record[temperatureKey || ''])

    const raceEntry: RaceEntry = {
      id: crypto.randomUUID(),
      raceNumber,
      raceName: String(record[raceNameKey || ''] || ''),
      startTime: parseDate(record[startTimeKey || '']),
      endTime: parseDate(record[endTimeKey || '']),
      location: String(record[locationKey || ''] || ''),
      weatherCondition: String(record[weatherConditionKey || ''] || '') || undefined,
      temperature: temperature ?? undefined,
      humidity: parseNumber(record[humidityKey || '']) ?? undefined,
      horseNumber,
      horseName: String(record[horseNameKey || ''] || ''),
      rider: String(record[riderKey || ''] || ''),
      category: String(record[categoryKey || ''] || ''),
      class: String(record[classKey || ''] || ''),
      notes: String(record[notesKey || ''] || '') || undefined,
    }

    entries.push(raceEntry)
  }

  return entries
}

export async function parseFile<T>(
  file: File,
  type: 'horses' | 'vet_records' | 'shoeing' | 'tack' | 'race_schedule'
): Promise<ImportResult<T>> {
  const ext = getFileExtension(file.name)
  
  if (['xlsx', 'xls', 'xlsm'].includes(ext)) {
    return parseExcelFileInternal<T>(file, type)
  }
  
  if (ext === 'csv') {
    return parseCsvFileInternal<T>(file, type)
  }

  return {
    success: false,
    data: [],
    errors: [`不支持的文件格式: .${ext}`],
    warnings: [],
  }
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

export function isExcelFile(filename: string): boolean {
  const ext = getFileExtension(filename)
  return ['xlsx', 'xls', 'xlsm'].includes(ext)
}

export function isCsvFile(filename: string): boolean {
  return getFileExtension(filename) === 'csv'
}
