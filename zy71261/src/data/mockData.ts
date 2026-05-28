import type { FieldFlags, PositionRecord } from "../types"

function makeFieldFlags(record: Partial<PositionRecord>): FieldFlags {
  return {
    clientIdMissing: !record.clientId,
    varietyCodeMissing: !record.varietyCode,
    contractMonthMissing: !record.contractMonth,
    directionMissing: record.direction === undefined || record.direction === null,
    marginMissing: record.margin === null || record.margin === undefined,
    riskReportMissing: !record.riskReport,
  }
}

const VARIETIES = [
  { code: "CU", name: "铜" },
  { code: "AL", name: "铝" },
  { code: "ZN", name: "锌" },
  { code: "RB", name: "螺纹钢" },
  { code: "AU", name: "黄金" },
  { code: "AG", name: "白银" },
  { code: "I", name: "铁矿石" },
  { code: "M", name: "豆粕" },
]

const MONTHS = [
  "2501", "2502", "2503", "2504",
  "2505", "2506", "2507", "2508",
  "2509", "2510", "2511", "2512",
]

const CLIENTS = [
  { id: "C001", name: "华泰资本" },
  { id: "C002", name: "中信投资" },
  { id: "C003", name: "国泰期货" },
  { id: "C004", name: "银河证券" },
  { id: "C005", name: "招商期货" },
  { id: "C006", name: "海通资管" },
  { id: "C007", name: "广发期货" },
  { id: "C008", name: "申万宏源" },
  { id: "C009", name: "光大期货" },
  { id: "C010", name: "中金公司" },
  { id: "C011", name: "永安期货" },
  { id: "C012", name: "南华期货" },
  { id: "C013", name: "浙商期货" },
  { id: "C014", name: "鲁证期货" },
  { id: "C015", name: "中信建投" },
  { id: "C016", name: "东证期货" },
  { id: "C017", name: "华鑫期货" },
  { id: "C018", name: "方正中期" },
  { id: "C019", name: "宏源期货" },
  { id: "C020", name: "中粮期货" },
]

const MARGIN_TABLE: Record<string, number[]> = {
  CU: [120000, 95000, 110000, 130000, 105000, 140000, 88000, 115000],
  AL: [35000, 28000, 42000, 31000, 38000, 29000, 36000, 40000],
  ZN: [45000, 38000, 52000, 41000, 48000, 35000, 46000, 50000],
  RB: [25000, 20000, 30000, 22000, 28000, 18000, 26000, 32000],
  AU: [350000, 280000, 420000, 310000, 380000, 290000, 360000, 400000],
  AG: [85000, 70000, 95000, 78000, 90000, 65000, 82000, 98000],
  I: [55000, 45000, 65000, 50000, 60000, 42000, 58000, 68000],
  M: [18000, 14000, 22000, 16000, 20000, 13000, 19000, 24000],
}

const QUANTITY_TABLE: Record<string, number[]> = {
  CU: [10, 20, 5, 15, 8, 25, 12, 30],
  AL: [30, 50, 20, 40, 25, 60, 35, 45],
  ZN: [20, 35, 10, 25, 15, 40, 28, 30],
  RB: [50, 80, 30, 60, 40, 100, 55, 70],
  AU: [3, 5, 2, 4, 6, 8, 1, 7],
  AG: [15, 25, 8, 20, 12, 30, 18, 22],
  I: [40, 70, 25, 50, 35, 90, 45, 60],
  M: [60, 100, 40, 80, 50, 120, 70, 90],
}

const DIRECTIONS: ("long" | "short")[] = ["long", "short"]

function makeRecord(
  idx: number,
  clientId: string,
  clientName: string | null,
  varietyCode: string,
  varietyName: string | null,
  contractMonth: string | null,
  direction: "long" | "short" | null,
  margin: number | null,
  quantity: number | null,
  riskReport: string | null,
): PositionRecord {
  const record: Partial<PositionRecord> = {
    id: `P${String(idx).padStart(4, "0")}`,
    clientId,
    clientName,
    varietyCode,
    varietyName,
    contractMonth,
    direction,
    margin,
    quantity,
    riskReport,
  }
  return { ...record, fieldFlags: makeFieldFlags(record) } as PositionRecord
}

function generateBaseRecords(): PositionRecord[] {
  const records: PositionRecord[] = []
  let idx = 1

  for (let vi = 0; vi < VARIETIES.length; vi++) {
    const variety = VARIETIES[vi]
    const margins = MARGIN_TABLE[variety.code]
    const quantities = QUANTITY_TABLE[variety.code]

    for (let mi = 0; mi < MONTHS.length; mi++) {
      const month = MONTHS[mi]
      const clientCount = (vi * 3 + mi) % 3 === 0 ? 3 : 2
      const directionCount = mi % 4 === 0 ? 2 : 1

      for (let ci = 0; ci < clientCount; ci++) {
        const clientIdx = (vi * 7 + mi * 3 + ci) % CLIENTS.length
        const client = CLIENTS[clientIdx]
        const marginIdx = (ci + mi) % margins.length
        const qtyIdx = (ci + mi + 1) % quantities.length

        for (let di = 0; di < directionCount; di++) {
          const dir = DIRECTIONS[di]
          const marginVal = margins[marginIdx] + (di * 5000)
          const qtyVal = quantities[qtyIdx] + (di * 5)
          const hasReport = (vi + mi + ci) % 5 !== 0
          const report = hasReport ? `${variety.code}${month}风险报告` : null

          records.push(makeRecord(
            idx,
            client.id,
            client.name,
            variety.code,
            variety.name,
            month,
            dir,
            marginVal,
            qtyVal,
            report,
          ))
          idx++
        }
      }
    }
  }

  return records
}

function generateMissingFieldRecords(): PositionRecord[] {
  const records: PositionRecord[] = []
  let idx = 201

  records.push(makeRecord(
    idx++, "", null, "CU", "铜", "2503", "long", 110000, 15, "CU2503风险报告",
  ))
  records.push(makeRecord(
    idx++, "", null, "RB", "螺纹钢", "2506", "short", 28000, 40, null,
  ))

  records.push(makeRecord(
    idx++, "C003", "国泰期货", "AL", "铝", null, "long", 38000, 25, "AL风险报告",
  ))
  records.push(makeRecord(
    idx++, "C007", "广发期货", "AU", "黄金", null, "short", 350000, 5, "AU风险报告",
  ))

  records.push(makeRecord(
    idx++, "C005", "招商期货", "ZN", "锌", "2504", null, 45000, 20, "ZN2504风险报告",
  ))

  records.push(makeRecord(
    idx++, "C010", "中金公司", "AG", "白银", "2509", "long", null, 18, "AG2509风险报告",
  ))
  records.push(makeRecord(
    idx++, "C012", "南华期货", "I", "铁矿石", "2507", "short", null, 50, null,
  ))
  records.push(makeRecord(
    idx++, "C015", "中信建投", "M", "豆粕", "2511", "long", null, 80, "M2511风险报告",
  ))

  return records
}

function generateDuplicateRecords(): PositionRecord[] {
  const records: PositionRecord[] = []
  let idx = 211

  const dupBase = [
    { clientId: "C001", clientName: "华泰资本", varietyCode: "CU", varietyName: "铜", month: "2503", dir: "long" as const, margin: 120000, qty: 10 },
    { clientId: "C001", clientName: "华泰资本", varietyCode: "CU", varietyName: "铜", month: "2503", dir: "long" as const, margin: 120000, qty: 10 },
    { clientId: "C004", clientName: "银河证券", varietyCode: "RB", varietyName: "螺纹钢", month: "2505", dir: "short" as const, margin: 25000, qty: 50 },
    { clientId: "C004", clientName: "银河证券", varietyCode: "RB", varietyName: "螺纹钢", month: "2505", dir: "short" as const, margin: 25000, qty: 50 },
    { clientId: "C004", clientName: "银河证券", varietyCode: "RB", varietyName: "螺纹钢", month: "2505", dir: "short" as const, margin: 25000, qty: 50 },
    { clientId: "C009", clientName: "光大期货", varietyCode: "AU", varietyName: "黄金", month: "2508", dir: "long" as const, margin: 350000, qty: 3 },
    { clientId: "C009", clientName: "光大期货", varietyCode: "AU", varietyName: "黄金", month: "2508", dir: "long" as const, margin: 350000, qty: 3 },
  ]

  for (const d of dupBase) {
    records.push(makeRecord(
      idx,
      d.clientId,
      d.clientName,
      d.varietyCode,
      d.varietyName,
      d.month,
      d.dir,
      d.margin,
      d.qty,
      `${d.varietyCode}${d.month}风险报告`,
    ))
    idx++
  }

  return records
}

function generateCrossMonthRollRecords(): PositionRecord[] {
  const records: PositionRecord[] = []
  let idx = 221

  const rollScenarios = [
    { client: CLIENTS[0], variety: VARIETIES[0], dir: "long" as const, fromMonth: "2503", toMonth: "2504", fromMargin: 120000, toMargin: 45000, fromQty: 20, toQty: 5 },
    { client: CLIENTS[1], variety: VARIETIES[4], dir: "short" as const, fromMonth: "2505", toMonth: "2506", fromMargin: 420000, toMargin: 90000, fromQty: 8, toQty: 1 },
    { client: CLIENTS[2], variety: VARIETIES[3], dir: "long" as const, fromMonth: "2507", toMonth: "2508", fromMargin: 30000, toMargin: 6000, fromQty: 60, toQty: 8 },
    { client: CLIENTS[5], variety: VARIETIES[6], dir: "short" as const, fromMonth: "2509", toMonth: "2510", fromMargin: 65000, toMargin: 12000, fromQty: 90, toQty: 12 },
    { client: CLIENTS[8], variety: VARIETIES[7], dir: "long" as const, fromMonth: "2511", toMonth: "2512", fromMargin: 22000, toMargin: 3500, fromQty: 120, toQty: 15 },
  ]

  for (const s of rollScenarios) {
    records.push(makeRecord(
      idx,
      s.client.id,
      s.client.name,
      s.variety.code,
      s.variety.name,
      s.fromMonth,
      s.dir,
      s.fromMargin,
      s.fromQty,
      `${s.variety.code}${s.fromMonth}风险报告`,
    ))
    idx++
    records.push(makeRecord(
      idx,
      s.client.id,
      s.client.name,
      s.variety.code,
      s.variety.name,
      s.toMonth,
      s.dir,
      s.toMargin,
      s.toQty,
      `${s.variety.code}${s.toMonth}风险报告`,
    ))
    idx++
  }

  return records
}

const baseRecords = generateBaseRecords()
const missingFieldRecords = generateMissingFieldRecords()
const duplicateRecords = generateDuplicateRecords()
const crossMonthRollRecords = generateCrossMonthRollRecords()

export const mockPositions: PositionRecord[] = [
  ...baseRecords,
  ...missingFieldRecords,
  ...duplicateRecords,
  ...crossMonthRollRecords,
]

export const mockClients = CLIENTS

export const mockVarieties = VARIETIES
