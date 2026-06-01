import { useState } from "react"
import { X, FileText, AlertTriangle, MessageSquarePlus } from "lucide-react"
import type { StationPoint, QualityFlagType } from "@/data/types"
import { DEVICE_TYPE_LABELS, QUALITY_FLAG_LABELS, QUALITY_STATUS_COLORS } from "@/data/types"
import { useAppStore } from "@/store/useAppStore"
import { computeDiffs } from "@/utils/diffCalculator"

const SUPPLEMENT_FIELDS = [
  { value: "name", label: "名称" },
  { value: "rawNote", label: "备注" },
  { value: "photo", label: "照片" },
  { value: "floor", label: "楼层" },
]

function getCongestionBg(v: number): string {
  if (v < 0.25) return "#1A5276"
  if (v < 0.5) return "#1E8449"
  if (v < 0.75) return "#D4AC0D"
  return "#C0392B"
}

export default function DetailPanel() {
  const {
    selectedPointId, points, selectPoint, resolveQualityFlag,
    supplementPoint, getPointQualityStatus, getCongestionForHour,
    filter, detailPanelOpen, toggleDetailPanel, previousPointSnapshot,
  } = useAppStore()

  const [suppField, setSuppField] = useState("rawNote")
  const [suppValue, setSuppValue] = useState("")

  if (!detailPanelOpen) return null

  const point = points.find(p => p.id === selectedPointId) as StationPoint | undefined

  if (!point) {
    return (
      <aside className="w-[320px] shrink-0 bg-[#1A1A2E]/95 border-l border-white/10 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-sm font-semibold text-white">详情</span>
          <button onClick={toggleDetailPanel} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>
        <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
          点选设备查看详情
        </div>
      </aside>
    )
  }

  const qualityStatus = getPointQualityStatus(point)
  const congestion = getCongestionForHour(point.id, filter.timeHour)
  const prevSnap = previousPointSnapshot.get(point.id)
  const diffs = computeDiffs(point, prevSnap)

  const handleSupplement = () => {
    if (!suppValue.trim()) return
    const oldVal = String((point as unknown as Record<string, unknown>)[suppField] ?? "")
    supplementPoint(point.id, suppField, oldVal, suppValue.trim())
    setSuppValue("")
  }

  return (
    <aside className="w-[320px] shrink-0 bg-[#1A1A2E]/95 border-l border-white/10 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-sm font-semibold text-white">{point.name}</span>
        <button onClick={() => selectPoint(null)} className="text-white/40 hover:text-white"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-sm">
        <section>
          <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">基本信息</h4>
          <div className="space-y-1.5 text-white/80">
            <div className="flex justify-between"><span className="text-white/40">ID</span><span>{point.id}</span></div>
            <div className="flex justify-between"><span className="text-white/40">名称</span><span>{point.name}</span></div>
            <div className="flex justify-between"><span className="text-white/40">楼层</span><span>{point.floor}</span></div>
            <div className="flex justify-between"><span className="text-white/40">类型</span><span>{DEVICE_TYPE_LABELS[point.type]}</span></div>
            <div className="flex justify-between"><span className="text-white/40">坐标</span><span>({point.x.toFixed(1)}, {point.y.toFixed(1)})</span></div>
            <div className="flex justify-between items-center">
              <span className="text-white/40">拥挤度</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-2 rounded-full overflow-hidden bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${congestion * 100}%`, backgroundColor: getCongestionBg(congestion) }} />
                </div>
                <span>{(congestion * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/40">质量</span>
              <span className="px-1.5 py-0.5 rounded text-xs text-white" style={{ backgroundColor: QUALITY_STATUS_COLORS[qualityStatus] }}>
                {qualityStatus === "ok" ? "正常" : qualityStatus === "warning" ? "警告" : "异常"}
              </span>
            </div>
          </div>
        </section>

        <div className="border-t border-white/5" />

        <section>
          <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1"><FileText size={12} />原始备注</h4>
          <p className="text-white/60 italic text-xs leading-relaxed">{point.rawNote || "—"}</p>
        </section>

        <div className="border-t border-white/5" />

        <section>
          <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">现场照片</h4>
          {point.photo ? (
            <span className="text-white/70 text-xs">{point.photo}</span>
          ) : (
            <span className="inline-block px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">缺失</span>
          )}
        </section>

        <div className="border-t border-white/5" />

        <section>
          <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1"><AlertTriangle size={12} />质量标记</h4>
          {point.qualityFlags.filter(f => !f.resolved).length === 0 ? (
            <span className="text-white/30 text-xs">无未处理标记</span>
          ) : (
            <div className="space-y-2">
              {point.qualityFlags.map((flag, idx) => flag.resolved ? null : (
                <div key={idx} className="bg-white/5 rounded p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-yellow-400">
                      {QUALITY_FLAG_LABELS[flag.type as QualityFlagType]}
                    </span>
                    <button
                      onClick={() => resolveQualityFlag(point.id, idx, "已处理")}
                      className="text-[10px] px-1.5 py-0.5 bg-green-600/30 text-green-400 rounded hover:bg-green-600/50"
                    >
                      处理
                    </button>
                  </div>
                  <p className="text-white/50 text-xs">{flag.description}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="border-t border-white/5" />

        <section>
          <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1"><MessageSquarePlus size={12} />补录</h4>
          <div className="flex gap-2 mb-2">
            <select
              value={suppField}
              onChange={e => setSuppField(e.target.value)}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80"
            >
              {SUPPLEMENT_FIELDS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <textarea
            value={suppValue}
            onChange={e => setSuppValue(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs text-white/80 resize-none h-14"
            placeholder="输入补录内容…"
          />
          <button
            onClick={handleSupplement}
            disabled={!suppValue.trim()}
            className="mt-1.5 w-full py-1 rounded text-xs bg-[#E94560]/80 text-white hover:bg-[#E94560] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            提交补录
          </button>
        </section>

        {diffs.length > 0 && (
          <>
            <div className="border-t border-white/5" />
            <section>
              <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">变更记录</h4>
              <div className="space-y-1.5">
                {diffs.map((d, i) => (
                  <div key={i} className="bg-white/5 rounded p-2 text-xs text-white/60">
                    <span className="text-white/40">{d.field}: </span>
                    <span className="text-red-400">"{d.oldValue}"</span>
                    <span className="text-white/30"> → </span>
                    <span className="text-green-400">"{d.newValue}"</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </aside>
  )
}
