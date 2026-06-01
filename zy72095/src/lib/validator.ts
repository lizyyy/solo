import { RawImportRow, IntersectionData, ValidationResult, ConflictChoice } from "./types"

const DEFAULT_CYCLE = 120

export function convertUnit(value: string): number {
  const trimmed = value.trim()
  if (/km\/h$/i.test(trimmed)) {
    return parseFloat(trimmed.replace(/km\/h$/i, "")) / 3.6
  }
  if (/km$/i.test(trimmed)) {
    return parseFloat(trimmed.replace(/km$/i, "")) * 1000
  }
  return parseFloat(trimmed)
}

export function parseRawText(text: string): RawImportRow[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim() !== "")
  if (lines.length < 2) return []

  const header = lines[0]
  let delimiter = "\t"
  if (header.includes(",")) delimiter = ","
  else if (header.includes(";")) delimiter = ";"

  const headers = header.split(delimiter).map((h) => h.trim())

  const idIdx = headers.findIndex((h) => h.includes("编号") || h.toLowerCase() === "id")
  const nameIdx = headers.findIndex((h) => h.includes("名称") || h.toLowerCase() === "name")
  const distIdx = headers.findIndex((h) => h.includes("距起点") || h.toLowerCase().includes("distance"))
  const cycleIdx = headers.findIndex((h) => h.includes("周期") || h.toLowerCase() === "cycle")
  const greenIdx = headers.findIndex((h) => h.includes("绿信比") || h.toLowerCase().includes("greenratio") || h.toLowerCase().includes("green"))
  const offsetIdx = headers.findIndex((h) => h.includes("偏移") || h.toLowerCase() === "offset")
  const dirIdx = headers.findIndex((h) => h.includes("方向") || h.toLowerCase().includes("direction"))

  const rows: RawImportRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim())
    rows.push({
      id: idIdx >= 0 ? (cols[idIdx] ?? "") : "",
      name: nameIdx >= 0 ? (cols[nameIdx] ?? "") : "",
      distanceFromStart: distIdx >= 0 ? (cols[distIdx] ?? "") : "",
      cycle: cycleIdx >= 0 ? (cols[cycleIdx] ?? "") : "",
      greenRatio: greenIdx >= 0 ? (cols[greenIdx] ?? "") : "",
      offset: offsetIdx >= 0 ? (cols[offsetIdx] ?? "") : "",
      direction: dirIdx >= 0 ? (cols[dirIdx] ?? "") : "",
    })
  }

  return rows
}

export function validateData(rows: RawImportRow[]): {
  validData: IntersectionData[]
  validationResults: ValidationResult[]
} {
  const validationResults: ValidationResult[] = []
  const seenIds = new Map<string, number>()
  const unitConvertedRows: RawImportRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const converted = { ...row }

    if (!row.id || row.id.trim() === "") {
      validationResults.push({
        id: `empty-id-${i}`,
        type: "empty",
        rowIndex: i,
        field: "id",
        message: `第${i + 1}行路口编号为空`,
        suggestion: "请补充路口编号",
      })
    }

    if (!row.name || row.name.trim() === "") {
      validationResults.push({
        id: `empty-name-${i}`,
        type: "empty",
        rowIndex: i,
        field: "name",
        message: `第${i + 1}行路口名称为空`,
        suggestion: "请补充路口名称",
      })
    }

    if (!row.distanceFromStart || row.distanceFromStart.trim() === "") {
      validationResults.push({
        id: `empty-distance-${i}`,
        type: "empty",
        rowIndex: i,
        field: "distanceFromStart",
        message: `第${i + 1}行距起点距离为空`,
        suggestion: "请补充距起点距离",
      })
    } else if (/km$/i.test(row.distanceFromStart.trim())) {
      const val = convertUnit(row.distanceFromStart)
      if (!isNaN(val)) {
        converted.distanceFromStart = String(val)
        validationResults.push({
          id: `unit-distance-${i}`,
          type: "unit_mismatch",
          rowIndex: i,
          field: "distanceFromStart",
          message: `第${i + 1}行距起点距离含km后缀，已自动转换为${val}m`,
          importedValue: row.distanceFromStart,
          suggestion: "已自动将km转换为m",
        })
      }
    } else if (isNaN(parseFloat(row.distanceFromStart))) {
      validationResults.push({
        id: `empty-distance-${i}`,
        type: "empty",
        rowIndex: i,
        field: "distanceFromStart",
        message: `第${i + 1}行距起点距离无法解析为数值`,
        importedValue: row.distanceFromStart,
        suggestion: "请检查距起点距离格式",
      })
    }

    if (!row.greenRatio || row.greenRatio.trim() === "") {
      validationResults.push({
        id: `empty-greenRatio-${i}`,
        type: "empty",
        rowIndex: i,
        field: "greenRatio",
        message: `第${i + 1}行绿信比为空`,
        suggestion: "请补充绿信比",
      })
    } else {
      const gr = parseFloat(converted.greenRatio)
      if (gr === 0) {
        validationResults.push({
          id: `boundary-greenRatio-${i}`,
          type: "boundary",
          rowIndex: i,
          field: "greenRatio",
          message: `第${i + 1}行绿信比为0，将导致绿波带宽为0`,
          importedValue: row.greenRatio,
          suggestion: "请调整绿信比为合理正值",
        })
      }
    }

    if (!row.offset || row.offset.trim() === "") {
      validationResults.push({
        id: `empty-offset-${i}`,
        type: "empty",
        rowIndex: i,
        field: "offset",
        message: `第${i + 1}行偏移量为空`,
        suggestion: "请补充偏移量",
      })
    }

    if (row.id && row.id.trim() !== "") {
      if (seenIds.has(row.id)) {
        const prevIdx = seenIds.get(row.id)!
        validationResults.push({
          id: `duplicate-${row.id}-${i}`,
          type: "duplicate",
          rowIndex: i,
          field: "id",
          message: `路口编号${row.id}在第${prevIdx + 1}行和第${i + 1}行重复`,
          suggestion: "请修改重复的路口编号或删除多余行",
        })
      } else {
        seenIds.set(row.id, i)
      }
    }

    const cycleVal = parseFloat(converted.cycle)
    if (!isNaN(cycleVal) && cycleVal !== DEFAULT_CYCLE) {
      validationResults.push({
        id: `conflict-cycle-${i}`,
        type: "conflict",
        rowIndex: i,
        field: "cycle",
        message: `第${i + 1}行周期为${cycleVal}，与参数表默认值${DEFAULT_CYCLE}不一致`,
        paramTableValue: String(DEFAULT_CYCLE),
        importedValue: row.cycle,
        suggestion: `选择使用参数表默认值${DEFAULT_CYCLE}或保留导入值${cycleVal}`,
      })
    }

    unitConvertedRows.push(converted)
  }

  const validData: IntersectionData[] = []
  const errorRowIndices = new Set<number>()
  for (const vr of validationResults) {
    if (vr.type === "empty" || vr.type === "duplicate") {
      errorRowIndices.add(vr.rowIndex)
    }
  }

  for (let i = 0; i < unitConvertedRows.length; i++) {
    if (errorRowIndices.has(i)) continue
    const row = unitConvertedRows[i]
    const dist = convertUnit(row.distanceFromStart)
    const cycle = parseFloat(row.cycle)
    const greenRatio = parseFloat(row.greenRatio)
    const offset = parseFloat(row.offset)
    const direction = row.direction === "下行" ? "下行" : "上行"

    if (isNaN(dist) || isNaN(cycle) || isNaN(greenRatio) || isNaN(offset)) continue

    validData.push({
      id: row.id,
      name: row.name,
      distanceFromStart: dist,
      cycle,
      greenRatio,
      offset,
      direction: direction as "上行" | "下行",
    })
  }

  return { validData, validationResults }
}

export function resolveConflicts(
  rows: RawImportRow[],
  conflicts: ConflictChoice[]
): RawImportRow[] {
  const result = rows.map((row, i) => {
    const updated = { ...row }
    conflicts.forEach((choice) => {
      const id = choice.validationResultId
      if (id.includes(`-cycle-${i}`) && id.startsWith("conflict-cycle")) {
        if (choice.resolution === "paramTable") {
          updated.cycle = String(DEFAULT_CYCLE)
        }
      }
    })
    return updated
  })

  return result
}
