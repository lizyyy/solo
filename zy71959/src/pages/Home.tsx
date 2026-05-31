import StatsBar from "@/components/StatsBar"
import FilterBar from "@/components/FilterBar"
import RouteList from "@/components/RouteList"
import ImportPanel from "@/components/ImportPanel"
import { Route, BarChart3, Activity } from "lucide-react"

export default function Home() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Route size={22} className="text-accent-green" />
            屋顶光伏航线管理
          </h1>
          <p className="text-xs text-slate-500 mt-1">电池循环 · 返航点 · 禁飞区 — 异常可溯源，结论可复核</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Activity size={12} className="text-accent-green" />
            系统运行中
          </span>
          <span className="flex items-center gap-1">
            <BarChart3 size={12} />
            {new Date().toLocaleDateString("zh-CN")}
          </span>
        </div>
      </div>

      <StatsBar />
      <FilterBar />
      <ImportPanel />
      <RouteList />
    </div>
  )
}
