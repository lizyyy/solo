import type { DataQualityFlag, ExperimentRecord } from "@/types"

let flagCounter = 0
function nextFlagId(): string {
  return `flag-${++flagCounter}`
}

export function scanDataQuality(records: ExperimentRecord[], thresholdMax: number): ExperimentRecord[] {
  const scanned = records.map((r) => ({ ...r, dataQualityFlags: [...r.dataQualityFlags] }))

  for (let i = 0; i < scanned.length; i++) {
    const rec = scanned[i]

    if (rec.temperature === null) {
      rec.dataQualityFlags.push({
        id: nextFlagId(), type: "missing_value", field: "temperature",
        message: `第 ${i + 1} 行炉温为空`,
        suggestedAction: `第 ${i + 1} 行炉温缺失→建议确认传感器状态后手动补录`,
        status: "pending",
      })
    }
    if (rec.beanCenterTemp === null && rec.temperature !== null) {
      rec.dataQualityFlags.push({
        id: nextFlagId(), type: "missing_value", field: "beanCenterTemp",
        message: `第 ${i + 1} 行豆心温度为空`,
        suggestedAction: `第 ${i + 1} 行豆心温度缺失→建议确认后手动补录`,
        status: "pending",
      })
    }
    if (rec.duration === null) {
      rec.dataQualityFlags.push({
        id: nextFlagId(), type: "missing_value", field: "duration",
        message: `第 ${i + 1} 行持续时间为空`,
        suggestedAction: `第 ${i + 1} 行持续时间缺失→建议查看实验记录本后补录`,
        status: "pending",
      })
    }

    if (rec.temperatureUnit === "°F") {
      rec.dataQualityFlags.push({
        id: nextFlagId(), type: "mixed_unit", field: "temperatureUnit",
        message: `第 ${i + 1} 行温度单位为 °F（其余为 °C）`,
        suggestedAction: `第 ${i + 1} 行温度疑似 °F→建议确认后手动改为 °C（当前值 ${rec.temperature}°F ≈ ${fToC(rec.temperature!)}°C）`,
        status: "pending",
      })
    }
    if (rec.durationUnit === "s") {
      rec.dataQualityFlags.push({
        id: nextFlagId(), type: "mixed_unit", field: "durationUnit",
        message: `第 ${i + 1} 行持续时间单位为 s（其余为 min）`,
        suggestedAction: `第 ${i + 1} 行持续时间疑似 s→建议确认后手动改为 min（当前值 ${rec.duration}s = ${(rec.duration! / 60).toFixed(1)}min）`,
        status: "pending",
      })
    }

    for (let j = i + 1; j < scanned.length; j++) {
      const other = scanned[j]
      if (
        rec.temperature === other.temperature &&
        rec.beanCenterTemp === other.beanCenterTemp &&
        rec.beanSurfaceTemp === other.beanSurfaceTemp &&
        rec.duration === other.duration &&
        rec.timestamp === other.timestamp
      ) {
        rec.dataQualityFlags.push({
          id: nextFlagId(), type: "duplicate", field: "all",
          message: `第 ${i + 1} 行与第 ${j + 1} 行数据完全相同`,
          suggestedAction: `第 ${i + 1} 行与第 ${j + 1} 行重复→建议确认是否重复录入后删除多余行`,
          status: "pending",
        })
      }
    }

    if (rec.beanCenterTemp !== null && rec.beanCenterTemp > thresholdMax) {
      rec.dataQualityFlags.push({
        id: nextFlagId(), type: "threshold_exceeded", field: "beanCenterTemp",
        message: `第 ${i + 1} 行豆心温度 ${rec.beanCenterTemp}°C 超过安全阈值 ${thresholdMax}°C`,
        suggestedAction: `第 ${i + 1} 行豆心温度 ${rec.beanCenterTemp}°C 超限→建议检查该批次是否为异常烘焙，并确认是否需要调整阈值`,
        status: "pending",
      })
    }
  }

  return scanned
}

function fToC(f: number): number {
  return Math.round(((f - 32) * 5) / 9)
}

export function getFlagIcon(type: DataQualityFlag["type"]): string {
  switch (type) {
    case "missing_value": return "⬜"
    case "mixed_unit": return "🔄"
    case "duplicate": return "📋"
    case "threshold_exceeded": return "🔴"
  }
}

export function getFlagColor(type: DataQualityFlag["type"]): string {
  switch (type) {
    case "missing_value": return "bg-zinc-100 text-zinc-700 border-zinc-300"
    case "mixed_unit": return "bg-amber-50 text-amber-800 border-amber-300"
    case "duplicate": return "bg-blue-50 text-blue-800 border-blue-300"
    case "threshold_exceeded": return "bg-red-50 text-red-800 border-red-300"
  }
}
