import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { MooringRecord, ThresholdVersion, Report, CalculationParams } from "@/types"
import { createSampleData } from "@/utils/sampleData"
import { calculateMooringForce } from "@/utils/calculation"
import { convertToKN, fillGaps } from "@/utils/unitConversion"
import type { RawDataPoint, DataSource, Judgment, ProcessedDataPoint, JudgmentStatus } from "@/types"

const STORE_VERSION = 2

const INITIAL_THRESHOLD: ThresholdVersion = {
  version: "v1.0",
  valueKN: 30,
  changedAt: "2026-06-01T08:00:00.000Z",
  changeReason: "初始默认阈值",
}

function processAndJudge(
  rawData: RawDataPoint[],
  source: DataSource,
  params: CalculationParams,
  threshold: ThresholdVersion
): { processedData: ProcessedDataPoint[]; forceResult: ReturnType<typeof calculateMooringForce>; judgment: Judgment } {
  const values = rawData.map((r) => r.value)
  const filled = fillGaps(values)
  const processedData: ProcessedDataPoint[] = rawData.map((r, i) => {
    const wasInterpolated = r.isGap && filled[i] !== null
    const val = filled[i] ?? 0
    return {
      sampleIndex: i,
      valueKilonewtons: convertToKN(val, r.unit),
      originalUnit: r.unit,
      originalValue: wasInterpolated ? Math.round(val * 100) / 100 : (r.value ?? 0),
      wasInterpolated,
    }
  })

  const forceResult = calculateMooringForce(params, processedData)
  const interpolatedCount = processedData.filter((p) => p.wasInterpolated).length
  const ratio = forceResult.measuredPeakKN / threshold.valueKN

  let status: JudgmentStatus
  let statusLabel: string
  let reason: string

  if (ratio <= 0.8) {
    status = "pass"
    statusLabel = "通过"
    reason = `海上浮标系泊受力实测峰值 ${forceResult.measuredPeakKN.toFixed(2)} kN 为阈值 ${threshold.valueKN} kN 的 ${(ratio * 100).toFixed(1)}%，低于80%安全线`
  } else if (ratio <= 1.0) {
    status = "confirm"
    statusLabel = "需人工确认"
    reason = `海上浮标系泊受力实测峰值 ${forceResult.measuredPeakKN.toFixed(2)} kN 达到阈值 ${threshold.valueKN} kN 的 ${(ratio * 100).toFixed(1)}%，处于80%-100%确认区间`
  } else {
    status = "exceed"
    statusLabel = "超限告警"
    reason = `海上浮标系泊受力实测峰值 ${forceResult.measuredPeakKN.toFixed(2)} kN 超过阈值 ${threshold.valueKN} kN（${(ratio * 100).toFixed(1)}%），已超出安全范围`
  }

  if (interpolatedCount > 0) {
    reason += `；存在${interpolatedCount}个采样缺口已线性插值补充`
  }
  if (source === "legacy_supplement") {
    reason += "；数据来源为传感器日志旧口径补录"
  }
  if (source === "sensor_log") {
    reason += "；数据来源为传感器日志直接采集"
  }

  const judgment: Judgment = {
    status,
    statusLabel,
    reason,
    thresholdVersion: threshold.version,
    thresholdValueKN: threshold.valueKN,
    ratioToThreshold: ratio,
    judgedAt: new Date().toISOString(),
  }

  return { processedData, forceResult, judgment }
}

interface AppStore {
  records: MooringRecord[]
  thresholdVersions: ThresholdVersion[]
  currentThreshold: ThresholdVersion
  selectedRecordId: string | null

  loadSampleData: () => void
  addRecord: (record: MooringRecord) => void
  recalculateAll: () => void
  updateThreshold: (valueKN: number, reason: string) => void
  selectRecord: (id: string | null) => void
  exportReport: () => Report
  clearAll: () => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      records: [],
      thresholdVersions: [INITIAL_THRESHOLD],
      currentThreshold: INITIAL_THRESHOLD,
      selectedRecordId: null,

      loadSampleData: () => {
        const { currentThreshold, records } = get()
        if (records.length > 0) return
        const sampleRecords = createSampleData(currentThreshold)
        set({ records: sampleRecords, selectedRecordId: sampleRecords[0].id })
      },

      addRecord: (record) => {
        set((state) => ({ records: [...state.records, record] }))
      },

      recalculateAll: () => {
        const { records, currentThreshold } = get()
        const updated = records.map((rec) => {
          const { processedData, forceResult, judgment } = processAndJudge(
            rec.rawData,
            rec.source,
            rec.forceResult.paramsUsed,
            currentThreshold
          )
          return {
            ...rec,
            processedData,
            forceResult,
            judgment,
          }
        })
        set({ records: updated })
      },

      updateThreshold: (valueKN, reason) => {
        const { thresholdVersions } = get()
        const lastVersion = thresholdVersions[thresholdVersions.length - 1]
        const majorMatch = lastVersion.version.match(/^v(\d+)/)
        const major = majorMatch ? parseInt(majorMatch[1]) : 1
        const newVersion: ThresholdVersion = {
          version: `v${major + 1}.0`,
          valueKN,
          changedAt: new Date().toISOString(),
          changeReason: reason,
        }
        set((state) => ({
          thresholdVersions: [...state.thresholdVersions, newVersion],
          currentThreshold: newVersion,
        }))
        get().recalculateAll()
      },

      selectRecord: (id) => {
        set({ selectedRecordId: id })
      },

      exportReport: () => {
        const { records, currentThreshold } = get()
        return {
          reportId: `RPT-${Date.now()}`,
          generatedAt: new Date().toISOString(),
          thresholdAtGeneration: currentThreshold,
          records,
        }
      },

      clearAll: () => {
        set({
          records: [],
          thresholdVersions: [INITIAL_THRESHOLD],
          currentThreshold: INITIAL_THRESHOLD,
          selectedRecordId: null,
        })
      },
    }),
    {
      name: "mooring-force-store",
      version: STORE_VERSION,
      migrate: (persistedState: unknown, version: number) => {
        if (version < STORE_VERSION) {
          return {
            records: [],
            thresholdVersions: [INITIAL_THRESHOLD],
            currentThreshold: INITIAL_THRESHOLD,
            selectedRecordId: null,
          }
        }
        return persistedState as AppStore
      },
    }
  )
)
