import type { Scheme, ItemStatus } from "@/types"

export function generateReport(scheme: Scheme, filterStatus: ItemStatus | "all"): string {
  const now = new Date().toLocaleString("zh-CN")
  const totalBuildings = scheme.buildings.length
  const totalPanels = scheme.panels.length
  const totalInverters = scheme.inverters.length

  const anomalyBuildings = scheme.buildings.filter((b) => b.status !== "normal")
  const anomalyPanels = scheme.panels.filter((p) => p.status !== "normal")
  const anomalyInverters = scheme.inverters.filter((i) => i.status !== "normal")

  const avgShadow = scheme.panels.length > 0
    ? (scheme.panels.reduce((s, p) => s + p.shadowCoverage, 0) / scheme.panels.length * 100).toFixed(1)
    : "0"

  const highShadowPanels = scheme.panels.filter((p) => p.shadowCoverage > 0.5)

  const sections: string[] = []

  sections.push(`光伏园区阴影分析报告`)
  sections.push(`方案：${scheme.name}`)
  sections.push(`生成时间：${now}`)
  sections.push(`${"=".repeat(40)}`)
  sections.push("")

  sections.push(`一、基本概况`)
  sections.push(`  园区坐标：${scheme.latitude}°N, ${scheme.longitude}°E`)
  sections.push(`  分析日期：${scheme.date} ${scheme.time}`)
  sections.push(`  太阳高度角：${scheme.sunAltitude}°  方位角：${scheme.sunAzimuth}°`)
  sections.push(`  建筑数量：${totalBuildings}  光伏板数量：${totalPanels}  逆变器数量：${totalInverters}`)
  sections.push("")

  sections.push(`二、阴影情况`)
  sections.push(`  平均阴影覆盖率：${avgShadow}%`)
  sections.push(`  高遮挡板数量（>50%）：${highShadowPanels.length}块`)
  if (highShadowPanels.length > 0) {
    sections.push(`  受影响板：${highShadowPanels.map((p) => p.name).join("、")}`)
  }
  sections.push("")

  sections.push(`三、数据质量`)
  sections.push(`  异常建筑：${anomalyBuildings.length}/${totalBuildings}`)
  sections.push(`  异常光伏板：${anomalyPanels.length}/${totalPanels}`)
  sections.push(`  异常逆变器：${anomalyInverters.length}/${totalInverters}`)

  if (anomalyBuildings.length > 0 || anomalyPanels.length > 0 || anomalyInverters.length > 0) {
    sections.push("")
    sections.push("  异常明细：")
    anomalyBuildings.forEach((b) => {
      sections.push(`    [${statusLabel(b.status)}] ${b.name}：${b.anomalyNote || "请检查"}`)
    })
    anomalyPanels.forEach((p) => {
      sections.push(`    [${statusLabel(p.status)}] ${p.name}：${p.anomalyNote || "请检查"}`)
    })
    anomalyInverters.forEach((i) => {
      sections.push(`    [${statusLabel(i.status)}] ${i.name}：${i.anomalyNote || "请检查"}`)
    })
  }
  sections.push("")

  if (filterStatus !== "all") {
    sections.push(`四、当前筛选条件`)
    sections.push(`  状态筛选：${statusLabel(filterStatus)}`)
    sections.push("")
  }

  sections.push(`五、建议`)
  if (highShadowPanels.length > 0) {
    sections.push(`  - ${highShadowPanels.length}块光伏板遮挡率超过50%，建议评估是否调整位置或修剪遮挡物`)
  }
  if (anomalyBuildings.length > 0 || anomalyPanels.length > 0 || anomalyInverters.length > 0) {
    sections.push(`  - 有${anomalyBuildings.length + anomalyPanels.length + anomalyInverters.length}条异常数据待确认，处理后再出正式报告`)
  }
  const dupes = scheme.inverters.filter((i) => i.status === "duplicate")
  if (dupes.length > 0) {
    sections.push(`  - 发现疑似重复设备（${dupes.map((d) => d.name).join("、")}），确认后合并`)
  }
  const boundaries = scheme.buildings.filter((b) => b.status === "boundary")
  if (boundaries.length > 0) {
    sections.push(`  - ${boundaries[0].name}的楼层信息跨层，核实后更新`)
  }
  if (highShadowPanels.length === 0 && anomalyBuildings.length === 0 && anomalyPanels.length === 0 && anomalyInverters.length === 0) {
    sections.push("  - 数据看起来都没问题，可以出正式版了")
  }

  sections.push("")
  sections.push(`${"=".repeat(40)}`)
  sections.push("报告由光伏园区阴影模型工具自动生成")

  return sections.join("\n")
}

function statusLabel(s: ItemStatus | "all"): string {
  const map: Record<string, string> = {
    all: "全部",
    normal: "正常",
    duplicate: "疑似重复",
    offset: "坐标偏移",
    missing_photo: "缺照片",
    boundary: "边界异常",
    empty_value: "空值",
  }
  return map[s] || s
}
