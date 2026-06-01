import type {
  SensorRecord,
  PressureUnit,
  UnitConversion,
  GapInterval,
  StandingWaveMode,
  RoomDimensions,
  DiagnosisResult,
  DiagnosisLevel,
  ThresholdVersion,
  ThresholdBand,
} from '@/types'

let _idCounter = 0
function genId(prefix = 'rec'): string {
  _idCounter += 1
  return `${prefix}-${Date.now()}-${_idCounter}`
}

const REF_PRESSURE = 0.00002

export function dbToPa(db: number): number {
  return REF_PRESSURE * Math.pow(10, db / 20)
}

export function paToDb(pa: number): number {
  if (pa <= 0) return -Infinity
  return 20 * Math.log10(pa / REF_PRESSURE)
}

export function convertUnit(value: number, from: PressureUnit, to: PressureUnit): UnitConversion {
  if (from === to) {
    return { from, to, fromValue: value, toValue: value, formula: `${from} = ${to}` }
  }
  if (from === 'dB' && to === 'Pa') {
    const pa = dbToPa(value)
    return {
      from, to, fromValue: value, toValue: pa,
      formula: `Pa = 20\u03Bce-6 \u00D7 10^(dB/20) = ${pa.toFixed(6)} Pa`,
    }
  }
  if (from === 'Pa' && to === 'dB') {
    const db = paToDb(value)
    return {
      from, to, fromValue: value, toValue: db,
      formula: `dB = 20 \u00D7 log10(Pa / 20\u03Bce-6) = ${db.toFixed(2)} dB SPL`,
    }
  }
  return { from, to, fromValue: value, toValue: value, formula: '\u4E0D\u652F\u6301\u7684\u6362\u7B97' }
}

export function parseSensorLog(text: string, source: 'import' | 'supplement' = 'import'): SensorRecord[] {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length === 0) return []

  const sep = detectSeparator(lines[0])
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase())
  const tsIdx = findIndex(headers, ['timestamp', 'time', '\u65F6\u95F4', '\u65F6\u95F4\u6233'])
  const freqIdx = findIndex(headers, ['frequency', 'freq', '\u9891\u7387', 'f'])
  const spIdx = findIndex(headers, ['soundpressure', 'pressure', 'spl', '\u58F0\u538B', '\u58F0\u538B\u7EA7', 'level'])
  const unitIdx = findIndex(headers, ['unit', '\u5355\u4F4D'])

  if (tsIdx < 0 || freqIdx < 0 || spIdx < 0) return []

  const records: SensorRecord[] = []
  const seenTimestamps = new Map<string, number>()

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim())
    const rawTimestamp = cols[tsIdx] || ''
    const rawFreq = cols[freqIdx] || ''
    const rawSp = cols[spIdx] || ''
    const rawUnit = unitIdx >= 0 ? (cols[unitIdx] || '') : ''

    const isEmpty = !rawTimestamp || !rawFreq || !rawSp
    const freq = parseFloat(rawFreq)
    const sp = parseFloat(rawSp)
    const unit = detectUnit(rawUnit, rawSp)

    const isDuplicate = seenTimestamps.has(rawTimestamp)
    if (rawTimestamp) {
      seenTimestamps.set(rawTimestamp, (seenTimestamps.get(rawTimestamp) || 0) + 1)
    }

    records.push({
      id: genId(),
      timestamp: rawTimestamp,
      frequency: isNaN(freq) ? 0 : freq,
      soundPressure: isNaN(sp) ? 0 : sp,
      unit,
      rawValue: rawSp,
      isGap: false,
      isDuplicate,
      isEmpty,
      source,
    })
  }

  detectGaps(records)
  return records
}

function detectSeparator(line: string): RegExp {
  if (line.includes('\t')) return /\t/
  if (line.includes(',')) return /,/
  if (line.includes(';')) return /;/
  return /\s+/
}

function findIndex(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.includes(c.toLowerCase()))
    if (idx >= 0) return idx
  }
  return -1
}

function detectUnit(raw: string, rawValue: string): PressureUnit {
  const lower = raw.toLowerCase().trim()
  if (lower.includes('pa')) return 'Pa'
  if (lower.includes('db') || lower.includes('spl')) return 'dB'
  if (lower.includes('m/s')) return 'm/s'
  const numVal = parseFloat(rawValue)
  if (!isNaN(numVal)) {
    if (numVal > 60) return 'dB'
    if (numVal < 10) return 'Pa'
  }
  return 'dB'
}

function detectGaps(records: SensorRecord[]): void {
  const validRecords = records.filter(r => !r.isEmpty && r.timestamp)
  if (validRecords.length < 2) return

  for (let i = 1; i < validRecords.length; i++) {
    const prev = new Date(validRecords[i - 1].timestamp).getTime()
    const curr = new Date(validRecords[i].timestamp).getTime()
    if (isNaN(prev) || isNaN(curr)) continue
    const gap = (curr - prev) / 1000
    if (gap > 10) {
      validRecords[i].isGap = true
    }
  }
}

export function findGapIntervals(records: SensorRecord[]): GapInterval[] {
  const validRecords = records.filter(r => !r.isEmpty && r.timestamp)
  const gaps: GapInterval[] = []
  for (let i = 1; i < validRecords.length; i++) {
    const prev = new Date(validRecords[i - 1].timestamp).getTime()
    const curr = new Date(validRecords[i].timestamp).getTime()
    if (isNaN(prev) || isNaN(curr)) continue
    const gap = (curr - prev) / 1000
    if (gap > 10) {
      gaps.push({
        start: validRecords[i - 1].timestamp,
        end: validRecords[i].timestamp,
        durationSeconds: gap,
      })
    }
  }
  return gaps
}

const SOUND_SPEED = 343

export function calculateStandingWaveModes(dimensions: RoomDimensions): StandingWaveMode[] {
  const modes: StandingWaveMode[] = []
  const axes: { axis: 'L' | 'W' | 'H'; dim: number }[] = [
    { axis: 'L', dim: dimensions.length },
    { axis: 'W', dim: dimensions.width },
    { axis: 'H', dim: dimensions.height },
  ]

  for (const { axis, dim } of axes) {
    for (let n = 1; n <= 4; n++) {
      const freq = (n * SOUND_SPEED) / (2 * dim)
      modes.push({
        order: n,
        axis,
        frequency: Math.round(freq * 100) / 100,
        label: `${axis}${n} = ${freq.toFixed(2)} Hz`,
      })
    }
  }

  modes.sort((a, b) => a.frequency - b.frequency)
  return modes
}

export function judgeRecord(
  record: SensorRecord,
  threshold: ThresholdVersion,
  targetUnit: 'dB' = 'dB'
): DiagnosisResult {
  if (record.isEmpty) {
    return {
      id: genId('diag'),
      recordId: record.id,
      level: 'warn',
      frequency: record.frequency,
      measuredValue: record.soundPressure,
      convertedValue: 0,
      convertedUnit: targetUnit,
      thresholdUsed: 0,
      thresholdVersion: threshold.version,
      note: '\u7A7A\u503C\u8BB0\u5F55\uFF0C\u7F3A\u5C11\u6709\u6548\u6570\u636E',
    }
  }

  const conversion = convertUnit(record.soundPressure, record.unit, targetUnit)
  const convertedValue = conversion.toValue

  const band = threshold.bands.find(b =>
    record.frequency >= b.frequencyRange[0] && record.frequency < b.frequencyRange[1]
  )

  if (!band) {
    return {
      id: genId('diag'),
      recordId: record.id,
      level: 'warn',
      frequency: record.frequency,
      measuredValue: record.soundPressure,
      convertedValue,
      convertedUnit: targetUnit,
      thresholdUsed: 0,
      thresholdVersion: threshold.version,
      note: `\u9891\u7387 ${record.frequency} Hz \u672A\u5728\u9608\u503C\u9891\u6BB5\u8986\u76D6\u8303\u56F4\u5185`,
    }
  }

  const thresholdInTargetUnit = band.unit === targetUnit ? band.dangerMax : convertUnit(band.dangerMax, band.unit, targetUnit).toValue
  const warnInTargetUnit = band.unit === targetUnit ? band.warnMax : convertUnit(band.warnMax, band.unit, targetUnit).toValue
  const safeInTargetUnit = band.unit === targetUnit ? band.safeMax : convertUnit(band.safeMax, band.unit, targetUnit).toValue

  let level: DiagnosisLevel = 'safe'
  let note = ''
  let thresholdUsed = safeInTargetUnit

  if (convertedValue >= safeInTargetUnit) {
    if (convertedValue >= thresholdInTargetUnit) {
      level = 'danger'
      note = `\u58F0\u538B ${convertedValue.toFixed(2)} ${targetUnit} \u8D85\u8FC7\u5371\u9669\u9608\u503C ${thresholdInTargetUnit.toFixed(2)} ${targetUnit}`
      thresholdUsed = thresholdInTargetUnit
    } else if (convertedValue >= warnInTargetUnit) {
      level = 'warn'
      note = `\u58F0\u538B ${convertedValue.toFixed(2)} ${targetUnit} \u8D85\u8FC7\u8B66\u544A\u9608\u503C ${warnInTargetUnit.toFixed(2)} ${targetUnit}\uFF0C\u9700\u4EBA\u5DE5\u786E\u8BA4`
      thresholdUsed = warnInTargetUnit
    } else {
      level = 'warn'
      note = `\u58F0\u538B ${convertedValue.toFixed(2)} ${targetUnit} \u8D85\u8FC7\u5B89\u5168\u4E0A\u9650 ${safeInTargetUnit.toFixed(2)} ${targetUnit}\uFF0C\u9700\u4EBA\u5DE5\u786E\u8BA4`
      thresholdUsed = safeInTargetUnit
    }
  } else {
    note = `\u58F0\u538B ${convertedValue.toFixed(2)} ${targetUnit} \u5728\u5B89\u5168\u8303\u56F4\u5185 (\u4E0A\u9650 ${safeInTargetUnit.toFixed(2)} ${targetUnit})`
  }

  if (record.isDuplicate) note += '\uFF1B\u68C0\u6D4B\u5230\u91CD\u590D\u65F6\u95F4\u6233'
  if (record.isGap) note += '\uFF1B\u524D\u65B9\u5B58\u5728\u91C7\u6837\u7F3A\u53E3'
  if (record.source === 'supplement') note += '\uFF1B\u6570\u636E\u6765\u6E90\uFF1A\u8865\u5F55'

  return {
    id: genId('diag'),
    recordId: record.id,
    level,
    frequency: record.frequency,
    measuredValue: record.soundPressure,
    convertedValue,
    convertedUnit: targetUnit,
    thresholdUsed,
    thresholdVersion: threshold.version,
    note,
  }
}

export function getDefaultThreshold(): ThresholdVersion {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    modifiedBy: '\u7CFB\u7EDF',
    reason: '\u521D\u59CB\u9ED8\u8BA4\u9608\u503C',
    bands: [
      { frequencyRange: [20, 40], safeMax: 0.5, warnMax: 1.0, dangerMax: 2.0, unit: 'Pa' },
      { frequencyRange: [40, 63], safeMax: 0.4, warnMax: 0.8, dangerMax: 1.5, unit: 'Pa' },
      { frequencyRange: [63, 100], safeMax: 0.3, warnMax: 0.6, dangerMax: 1.2, unit: 'Pa' },
      { frequencyRange: [100, 160], safeMax: 0.25, warnMax: 0.5, dangerMax: 1.0, unit: 'Pa' },
      { frequencyRange: [160, 250], safeMax: 0.2, warnMax: 0.4, dangerMax: 0.8, unit: 'Pa' },
    ],
  }
}

export function getBandLabel(band: ThresholdBand): string {
  return `${band.frequencyRange[0]}-${band.frequencyRange[1]} Hz`
}

export function convertBandToDb(band: ThresholdBand): ThresholdBand {
  if (band.unit === 'dB') return band
  return {
    ...band,
    unit: 'dB',
    safeMax: Math.round(paToDb(band.safeMax) * 100) / 100,
    warnMax: Math.round(paToDb(band.warnMax) * 100) / 100,
    dangerMax: Math.round(paToDb(band.dangerMax) * 100) / 100,
  }
}
