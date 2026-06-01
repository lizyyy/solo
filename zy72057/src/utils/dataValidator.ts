import type { Building, SolarPanel, Inverter, ItemStatus } from "@/types"

function hasEmptyValues(obj: Record<string, unknown>): boolean {
  return Object.values(obj).some(
    (v) => v === "" || v === null || v === undefined
  )
}

function isBoundaryFloor(floor: string): boolean {
  return floor.includes("-") || floor.includes("/")
}

function normalizeName(name: string): string {
  return name.replace(/[-_]/g, "").replace(/\s/g, "")
}

export function validateBuilding(b: Building): { status: ItemStatus; note: string } {
  if (hasEmptyValues(b as unknown as Record<string, unknown>)) {
    return { status: "empty_value", note: "存在空值字段" }
  }
  if (isBoundaryFloor(b.floor)) {
    return { status: "boundary", note: `floor字段为'${b.floor}'，跨楼层，请确认` }
  }
  if (!b.photoUrl) {
    return { status: "missing_photo", note: "缺少建筑照片" }
  }
  if (b.x > 100 || b.y > 100) {
    return { status: "offset", note: "坐标偏移较大，疑似测量错误" }
  }
  return { status: "normal", note: "" }
}

export function validatePanel(p: SolarPanel): { status: ItemStatus; note: string } {
  if (hasEmptyValues(p as unknown as Record<string, unknown>)) {
    return { status: "empty_value", note: "存在空值字段" }
  }
  if (!p.photoUrl) {
    return { status: "missing_photo", note: "缺少现场照片" }
  }
  return { status: "normal", note: "" }
}

export function validateInverter(inv: Inverter): { status: ItemStatus; note: string } {
  if (hasEmptyValues(inv as unknown as Record<string, unknown>)) {
    return { status: "empty_value", note: "存在空值字段" }
  }
  if (inv.aliasName && normalizeName(inv.name) !== normalizeName(inv.aliasName) && normalizeName(inv.name).includes(normalizeName(inv.aliasName).slice(0, 3))) {
    return { status: "duplicate", note: `名称'${inv.name}'与'${inv.aliasName}'疑似同一设备` }
  }
  if (!inv.photoUrl) {
    return { status: "missing_photo", note: "缺少设备照片" }
  }
  return { status: "normal", note: "" }
}

export function findDuplicates(inverters: Inverter[]): Map<string, string[]> {
  const nameMap = new Map<string, string[]>()
  inverters.forEach((inv) => {
    const norm = normalizeName(inv.name)
    if (!nameMap.has(norm)) nameMap.set(norm, [])
    nameMap.get(norm)!.push(inv.id)
    if (inv.aliasName) {
      const aliasNorm = normalizeName(inv.aliasName)
      if (!nameMap.has(aliasNorm)) nameMap.set(aliasNorm, [])
      nameMap.get(aliasNorm)!.push(inv.id)
    }
  })
  const dupes = new Map<string, string[]>()
  nameMap.forEach((ids, _norm) => {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length > 1) {
      uniqueIds.forEach((id) => dupes.set(id, uniqueIds.filter((i) => i !== id)))
    }
  })
  return dupes
}
