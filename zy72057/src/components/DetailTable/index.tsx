import { useState, useMemo } from "react"
import { useSchemeStore } from "@/store/useSchemeStore"
import { useUIStore } from "@/store/useUIStore"
import { STATUS_LABELS, STATUS_COLORS } from "@/types"
import type { ItemStatus } from "@/types"

type TabKey = "building" | "panel" | "inverter"

const TABS: { key: TabKey; label: string }[] = [
  { key: "building", label: "建筑" },
  { key: "panel", label: "光伏板" },
  { key: "inverter", label: "逆变器" },
]

function StatusBadge({ status }: { status: ItemStatus }) {
  return (
    <span
      style={{ backgroundColor: STATUS_COLORS[status] + "22", color: STATUS_COLORS[status], borderColor: STATUS_COLORS[status] + "44" }}
      className="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap"
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

function ShadowBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct < 30 ? "#22c55e" : pct <= 50 ? "#eab308" : "#ef4444"
  return (
    <div className="flex items-center gap-1">
      <div className="h-1.5 w-12 rounded-full bg-slate-700 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="font-mono text-[10px] text-slate-400">{pct}%</span>
    </div>
  )
}

export default function DetailTable() {
  const [tab, setTab] = useState<TabKey>("building")
  const { currentScheme } = useSchemeStore()
  const { filterStatus, filterType, searchText, selectItem, selectedItemId } = useUIStore()

  const activeTab = filterType !== "all" ? filterType as TabKey : tab

  const buildings = useMemo(() => {
    let list = currentScheme.buildings
    if (filterStatus !== "all") list = list.filter((b) => b.status === filterStatus)
    if (searchText) list = list.filter((b) => b.name.includes(searchText) || b.id.includes(searchText))
    return list
  }, [currentScheme.buildings, filterStatus, searchText])

  const panels = useMemo(() => {
    let list = currentScheme.panels
    if (filterStatus !== "all") list = list.filter((p) => p.status === filterStatus)
    if (searchText) list = list.filter((p) => p.name.includes(searchText) || p.id.includes(searchText))
    return list
  }, [currentScheme.panels, filterStatus, searchText])

  const inverters = useMemo(() => {
    let list = currentScheme.inverters
    if (filterStatus !== "all") list = list.filter((i) => i.status === filterStatus)
    if (searchText) list = list.filter((i) => i.name.includes(searchText) || i.id.includes(searchText))
    return list
  }, [currentScheme.inverters, filterStatus, searchText])

  const rowData = activeTab === "building" ? buildings : activeTab === "panel" ? panels : inverters

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="flex border-b border-slate-700">
        {TABS.map((t) => {
          const count = t.key === "building" ? buildings.length : t.key === "panel" ? panels.length : inverters.length
          return (
            <button
              key={t.key}
              onClick={() => { if (filterType === "all") setTab(t.key) }}
              className={`px-3 py-1.5 text-xs transition-colors ${
                activeTab === t.key
                  ? "text-amber-400 border-b-2 border-amber-400"
                  : "text-slate-400 hover:text-slate-200"
              } ${filterType !== "all" && activeTab !== t.key ? "opacity-50 cursor-default" : ""}`}
            >
              {t.label}
              <span className="ml-1 text-[10px] text-slate-500">({count})</span>
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-slate-800 z-10">
            <tr className="text-slate-400 text-[10px] uppercase tracking-wider">
              {activeTab === "building" && (
                <>
                  <th className="px-2 py-1 text-left">名称</th>
                  <th className="px-2 py-1 text-right">X</th>
                  <th className="px-2 py-1 text-right">Y</th>
                  <th className="px-2 py-1 text-right">宽</th>
                  <th className="px-2 py-1 text-right">深</th>
                  <th className="px-2 py-1 text-right">高</th>
                  <th className="px-2 py-1 text-left">楼层</th>
                  <th className="px-2 py-1 text-left">状态</th>
                </>
              )}
              {activeTab === "panel" && (
                <>
                  <th className="px-2 py-1 text-left">名称</th>
                  <th className="px-2 py-1 text-right">X</th>
                  <th className="px-2 py-1 text-right">Y</th>
                  <th className="px-2 py-1 text-right">倾角</th>
                  <th className="px-2 py-1 text-right">方位角</th>
                  <th className="px-2 py-1 text-left">遮挡率</th>
                  <th className="px-2 py-1 text-left">状态</th>
                </>
              )}
              {activeTab === "inverter" && (
                <>
                  <th className="px-2 py-1 text-left">名称</th>
                  <th className="px-2 py-1 text-left">别名</th>
                  <th className="px-2 py-1 text-right">X</th>
                  <th className="px-2 py-1 text-right">Y</th>
                  <th className="px-2 py-1 text-left">楼层</th>
                  <th className="px-2 py-1 text-left">状态</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rowData.map((item: any) => {
              const isSelected = selectedItemId === item.id
              const isAbnormal = item.status !== "normal"
              return (
                <tr
                  key={item.id}
                  onClick={() => selectItem(item.id)}
                  className={`cursor-pointer transition-colors border-l-2 ${
                    isSelected ? "border-l-amber-400 bg-amber-400/10" : "border-l-transparent hover:bg-slate-700/50"
                  }`}
                >
                  {activeTab === "building" && (
                    <>
                      <td className="px-2 py-1 truncate max-w-[80px]">{item.name}</td>
                      <td className="px-2 py-1 text-right font-mono">{item.x.toFixed(1)}</td>
                      <td className="px-2 py-1 text-right font-mono">{item.y.toFixed(1)}</td>
                      <td className="px-2 py-1 text-right font-mono">{item.width.toFixed(1)}</td>
                      <td className="px-2 py-1 text-right font-mono">{item.depth.toFixed(1)}</td>
                      <td className="px-2 py-1 text-right font-mono">{item.height.toFixed(1)}</td>
                      <td className="px-2 py-1">{(item as any).floor || <span className="text-slate-500">—</span>}</td>
                      <td className="px-2 py-1">
                        <StatusBadge status={item.status} />
                        {isAbnormal && (
                          <span className="ml-1 text-[10px] text-slate-500" title={item.anomalyNote}>⚠</span>
                        )}
                      </td>
                    </>
                  )}
                  {activeTab === "panel" && (
                    <>
                      <td className="px-2 py-1 truncate max-w-[80px]">{item.name}</td>
                      <td className="px-2 py-1 text-right font-mono">{item.x.toFixed(1)}</td>
                      <td className="px-2 py-1 text-right font-mono">{item.y.toFixed(1)}</td>
                      <td className="px-2 py-1 text-right font-mono">{(item as any).tiltAngle?.toFixed(1) ?? "—"}</td>
                      <td className="px-2 py-1 text-right font-mono">{(item as any).azimuth?.toFixed(1) ?? "—"}</td>
                      <td className="px-2 py-1"><ShadowBar value={(item as any).shadowCoverage ?? 0} /></td>
                      <td className="px-2 py-1">
                        <StatusBadge status={item.status} />
                        {isAbnormal && (
                          <span className="ml-1 text-[10px] text-slate-500" title={item.anomalyNote}>⚠</span>
                        )}
                      </td>
                    </>
                  )}
                  {activeTab === "inverter" && (
                    <>
                      <td className="px-2 py-1 truncate max-w-[80px]">{item.name}</td>
                      <td className="px-2 py-1">{(item as any).aliasName || <span className="text-slate-500">—</span>}</td>
                      <td className="px-2 py-1 text-right font-mono">{item.x.toFixed(1)}</td>
                      <td className="px-2 py-1 text-right font-mono">{item.y.toFixed(1)}</td>
                      <td className="px-2 py-1">{(item as any).floor || <span className="text-slate-500">—</span>}</td>
                      <td className="px-2 py-1">
                        <StatusBadge status={item.status} />
                        {isAbnormal && (
                          <span className="ml-1 text-[10px] text-slate-500" title={item.anomalyNote}>⚠</span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
            {rowData.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-4 text-center text-slate-500">无匹配数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
