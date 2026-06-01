import type { Building, SolarPanel, Inverter, Scheme, ConflictRecord } from "@/types"

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n")
  if (lines.length < 2) return []
  const headers = lines[0].split(",").map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = values[i] || ""
    })
    return row
  })
}

function parseJSON(text: string): Record<string, unknown>[] {
  try {
    const data = JSON.parse(text)
    return Array.isArray(data) ? data : [data]
  } catch {
    return []
  }
}

export function parseImportData(text: string, format: "csv" | "json"): Record<string, unknown>[] {
  if (format === "csv") return parseCSV(text) as unknown as Record<string, unknown>[]
  return parseJSON(text)
}

function normalizeName(name: string): string {
  return name.replace(/[-_\s]/g, "").toLowerCase()
}

export function detectConflicts(
  existing: Scheme,
  imported: { buildings?: Partial<Building>[]; panels?: Partial<SolarPanel>[]; inverters?: Partial<Inverter>[] }
): ConflictRecord[] {
  const conflicts: ConflictRecord[] = []

  if (imported.buildings) {
    imported.buildings.forEach((b) => {
      if (!b.name) return
      const match = existing.buildings.find((eb) => eb.name === b.name)
      if (match && b.x !== undefined && b.y !== undefined) {
        const dist = Math.sqrt((match.x - b.x) ** 2 + (match.y - b.y) ** 2)
        if (dist > 30) {
          conflicts.push({
            id: `conf-b-${match.id}-${Date.now()}`,
            type: "coordinate_offset",
            existingData: { name: match.name, x: match.x, y: match.y },
            importedData: { name: b.name, x: b.x, y: b.y },
            description: `${match.name}的坐标差异约${dist.toFixed(0)}米`,
            suggestion: "确认哪个坐标更准确，或标记为待核实",
            resolved: false,
            entityType: "building",
            entityId: match.id,
          })
        }
      }
    })
  }

  if (imported.inverters) {
    imported.inverters.forEach((inv) => {
      if (!inv.name) return
      const normImport = normalizeName(inv.name)
      existing.inverters.forEach((ei) => {
        const normExist = normalizeName(ei.name)
        const normAlias = ei.aliasName ? normalizeName(ei.aliasName) : ""
        if (normImport !== normExist && (normImport === normAlias || normImport.includes(normExist.slice(0, 4)))) {
          conflicts.push({
            id: `conf-inv-${ei.id}-${Date.now()}`,
            type: "name_mismatch",
            existingData: { name: ei.name, aliasName: ei.aliasName },
            importedData: { name: inv.name },
            description: `导入的'${inv.name}'可能就是现有的'${ei.name}'`,
            suggestion: "确认是否为同一设备；如果是，合并记录",
            resolved: false,
            entityType: "inverter",
            entityId: ei.id,
          })
        }
      })
    })
  }

  return conflicts
}

export function mapCSVToBuildings(rows: Record<string, string>[]): Partial<Building>[] {
  return rows.map((row) => ({
    id: row.id || `b-import-${Math.random().toString(36).slice(2, 8)}`,
    name: row.name || "",
    x: parseFloat(row.x) || 0,
    y: parseFloat(row.y) || 0,
    width: parseFloat(row.width) || 10,
    depth: parseFloat(row.depth) || 10,
    height: parseFloat(row.height) || 8,
    floor: row.floor || "1",
    photoUrl: row.photoUrl || "",
    status: "normal" as const,
    anomalyNote: "",
  }))
}

export function mapCSVToPanels(rows: Record<string, string>[]): Partial<SolarPanel>[] {
  return rows.map((row) => ({
    id: row.id || `p-import-${Math.random().toString(36).slice(2, 8)}`,
    name: row.name || "",
    x: parseFloat(row.x) || 0,
    y: parseFloat(row.y) || 0,
    width: parseFloat(row.width) || 2,
    height: parseFloat(row.height) || 1,
    tiltAngle: parseFloat(row.tiltAngle) || 25,
    azimuth: parseFloat(row.azimuth) || 180,
    inverterId: row.inverterId || "",
    photoUrl: row.photoUrl || "",
    status: "normal" as const,
    anomalyNote: "",
    shadowCoverage: 0,
  }))
}

export function mapCSVToInverters(rows: Record<string, string>[]): Partial<Inverter>[] {
  return rows.map((row) => ({
    id: row.id || `inv-import-${Math.random().toString(36).slice(2, 8)}`,
    name: row.name || "",
    aliasName: row.aliasName || "",
    x: parseFloat(row.x) || 0,
    y: parseFloat(row.y) || 0,
    floor: row.floor || "1",
    buildingId: row.buildingId || "",
    photoUrl: row.photoUrl || "",
    status: "normal" as const,
    anomalyNote: "",
  }))
}
